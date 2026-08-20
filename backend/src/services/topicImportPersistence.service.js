const crypto = require('crypto');
const prisma = require('../config/database');
const { residentCorpus } = require('./residentCorpus.service');
const { embedDocument, documentMetadata, validStoredEmbedding } = require('./voyageEmbedding.service');
const { retryVoyageCall } = require('./topicCorpusLifecycle.service');

const BUCKET_MODEL_MAP = {
  historical: 'historicalTopic',
  current_session: 'currentSessionTopic',
  under_review: 'underReviewTopic'
};

const INSERTED_BY_BUCKET_INITIAL = {
  historical: 0,
  current_session: 0,
  under_review: 0
};

const SESSION_YEAR_ALIASES = ['session_year', 'sessionYear', 'Session Year'];
const SUPERVISOR_ALIASES = ['supervisor_name', 'supervisorName', 'Supervisor Name', 'supervisor'];
const CATEGORY_ALIASES = ['category', 'Category'];
const STUDENT_ID_ALIASES = ['student_id', 'studentId', 'Student ID'];
const APPROVED_DATE_ALIASES = ['approved_date', 'approvedDate', 'Approved Date'];
const REVIEWING_LECTURER_ALIASES = ['reviewing_lecturer', 'reviewingLecturer', 'Reviewing Lecturer'];
const REVIEW_STARTED_AT_ALIASES = ['review_started_at', 'reviewStartedAt', 'Review Started At'];

// Raised when Voyage cannot produce the embeddings an import commit requires.
// The commit is aborted before any database mutation, so nothing is persisted.
class TopicImportEmbeddingUnavailableError extends Error {
  constructor(message, { attemptedRecords = 0, embeddedBeforeFailure = 0 } = {}) {
    super(message);
    this.name = 'TopicImportEmbeddingUnavailableError';
    this.attemptedRecords = attemptedRecords;
    this.embeddedBeforeFailure = embeddedBeforeFailure;
  }
}

function normalizeString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function emptyToNull(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function getAliasedValue(source, aliases) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      return source[alias];
    }
  }

  return undefined;
}

function serializeKeywords(keywords) {
  if (Array.isArray(keywords)) {
    return keywords.map(normalizeString).filter(Boolean).join(', ');
  }

  return normalizeString(keywords);
}

function addWarning(report, record, field, message) {
  report.warnings.push({
    title: record.title,
    lifecycle_bucket: record.lifecycle_bucket,
    field,
    message
  });
}

function getRequiredString(record, report, field, aliases) {
  const value = normalizeString(getAliasedValue(record.raw_record, aliases));

  if (!value) {
    addWarning(report, record, field, `${field} missing from raw_record; defaulted to empty string`);
    return '';
  }

  return value;
}

function parseDateField(record, report, field, aliases) {
  const value = getAliasedValue(record.raw_record, aliases);

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  addWarning(report, record, field, `${field} is not a valid date and was not persisted`);
  return undefined;
}

function buildBaseData(record, options, report) {
  return {
    title: normalizeString(record.title),
    keywords: serializeKeywords(record.keywords),
    sessionYear: getRequiredString(record, report, 'sessionYear', SESSION_YEAR_ALIASES),
    supervisorName: getRequiredString(record, report, 'supervisorName', SUPERVISOR_ALIASES),
    category: emptyToNull(getAliasedValue(record.raw_record, CATEGORY_ALIASES)),
    population: emptyToNull(record.population),
    location: emptyToNull(record.location),
    studyFocus: emptyToNull(record.study_focus),
    rawRecord: record.raw_record || null,
    importWarnings: Array.isArray(record.warnings) ? record.warnings : [],
    sourceType: options.sourceType || null,
    sourceFilename: options.sourceFilename || null,
    importBatchId: options.importBatchId || null,
    embedding: null,
    embeddingProvider: null,
    embeddingModel: null,
    embeddingDimension: null,
    embeddingRepresentation: null,
    embeddingSourceHash: null,
    embeddedAt: null
  };
}

function buildCurrentSessionData(record, report) {
  const data = {};
  const studentId = emptyToNull(getAliasedValue(record.raw_record, STUDENT_ID_ALIASES));
  const approvedDate = parseDateField(record, report, 'approvedDate', APPROVED_DATE_ALIASES);

  if (studentId) {
    data.studentId = studentId;
  }

  if (approvedDate) {
    data.approvedDate = approvedDate;
  }

  return data;
}

function buildUnderReviewData(record, report) {
  const data = {};
  const reviewingLecturer = emptyToNull(getAliasedValue(record.raw_record, REVIEWING_LECTURER_ALIASES));
  const reviewStartedAt = parseDateField(record, report, 'reviewStartedAt', REVIEW_STARTED_AT_ALIASES);

  if (reviewingLecturer) {
    data.reviewingLecturer = reviewingLecturer;
  }

  if (reviewStartedAt) {
    data.reviewStartedAt = reviewStartedAt;
  }

  return data;
}

function buildPrismaData(record, options, report) {
  const baseData = buildBaseData(record, options, report);

  if (record.lifecycle_bucket === 'current_session') {
    return {
      ...baseData,
      ...buildCurrentSessionData(record, report)
    };
  }

  if (record.lifecycle_bucket === 'under_review') {
    return {
      ...baseData,
      ...buildUnderReviewData(record, report)
    };
  }

  return baseData;
}

function fingerprintDate(value) {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

// Deterministic identity of an imported departmental record. It hashes the
// normalized persisted content — not the batch id or filename — so replaying the
// same source data always maps to the same identity, while a genuinely distinct
// record that merely shares a title (different session, supervisor, student,
// context, or lifecycle bucket) hashes differently and may coexist.
function computeSourceFingerprint(lifecycleBucket, data) {
  const identity = {
    bucket: lifecycleBucket,
    title: normalizeString(data.title).toLowerCase(),
    sessionYear: data.sessionYear || '',
    supervisorName: data.supervisorName || '',
    category: data.category || '',
    population: data.population || '',
    location: data.location || '',
    studyFocus: data.studyFocus || '',
    keywords: data.keywords || '',
    studentId: data.studentId || '',
    approvedDate: fingerprintDate(data.approvedDate),
    reviewingLecturer: data.reviewingLecturer || '',
    reviewStartedAt: fingerprintDate(data.reviewStartedAt)
  };

  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

function buildEmptyReport(records) {
  return {
    attempted_records: records.length,
    inserted_records: 0,
    failed_records: 0,
    skipped_records: 0,
    duplicate_records: 0,
    searchable_records: 0,
    embedding_generated: 0,
    corpus_refreshed: null,
    inserted_by_bucket: { ...INSERTED_BY_BUCKET_INITIAL },
    duplicates: [],
    warnings: [],
    errors: []
  };
}

function markDuplicate(report, candidate, reason) {
  report.duplicate_records += 1;
  report.duplicates.push({
    title: candidate.record.title,
    lifecycle_bucket: candidate.record.lifecycle_bucket,
    reason
  });
}

function groupByModel(candidates) {
  const groups = new Map();

  for (const candidate of candidates) {
    if (!groups.has(candidate.modelName)) {
      groups.set(candidate.modelName, []);
    }
    groups.get(candidate.modelName).push(candidate);
  }

  return groups;
}

async function markExistingFingerprints(dbClient, candidates, report) {
  const remaining = [];

  for (const [modelName, group] of groupByModel(candidates)) {
    const existingRows = await dbClient[modelName].findMany({
      where: { sourceFingerprint: { in: group.map(candidate => candidate.data.sourceFingerprint) } },
      select: { sourceFingerprint: true }
    });
    const existing = new Set(existingRows.map(row => row.sourceFingerprint));

    for (const candidate of group) {
      if (existing.has(candidate.data.sourceFingerprint)) {
        markDuplicate(report, candidate, 'already_persisted');
      } else {
        remaining.push(candidate);
      }
    }
  }

  return remaining;
}

// Embeds sequentially with the shared bounded retry so imports respect provider
// limits instead of issuing uncontrolled parallel requests. Any unrecoverable
// provider failure aborts the whole commit before any database write.
async function embedCandidates(candidates, report, embedImpl) {
  for (const candidate of candidates) {
    let embedding;

    try {
      embedding = await retryVoyageCall(() => embedImpl(candidate.data));
    } catch (error) {
      throw new TopicImportEmbeddingUnavailableError(
        `Voyage embedding could not be generated for "${candidate.record.title}": ${error.message}. ` +
        'The import was aborted before commit; no records were persisted.',
        { attemptedRecords: candidates.length, embeddedBeforeFailure: report.embedding_generated }
      );
    }

    Object.assign(candidate.data, documentMetadata(candidate.data, embedding));
    report.embedding_generated += 1;

    if (!validStoredEmbedding(candidate.data)) {
      throw new TopicImportEmbeddingUnavailableError(
        `Generated embedding for "${candidate.record.title}" failed stored-embedding validation. ` +
        'The import was aborted before commit; no records were persisted.',
        { attemptedRecords: candidates.length, embeddedBeforeFailure: report.embedding_generated }
      );
    }
  }
}

// Rows per createMany statement: each row carries a 1024-float embedding plus
// ~25 columns, so chunking keeps every INSERT far below the Postgres bind-parameter
// ceiling at multi-thousand-record import scale. All chunks share one transaction.
const COMMIT_CHUNK_SIZE = 250;
// Departmental imports can commit thousands of embedded rows; the Prisma default
// interactive-transaction timeout (5s) is too small for that pure-DB work.
const COMMIT_TRANSACTION_OPTIONS = { timeout: 120000, maxWait: 10000 };

async function commitCandidates(dbClient, candidates, report) {
  const groups = groupByModel(candidates);

  await dbClient.$transaction(async (tx) => {
    for (const [modelName, group] of groups) {
      const bucket = group[0].record.lifecycle_bucket;
      let insertedInGroup = 0;

      for (let start = 0; start < group.length; start += COMMIT_CHUNK_SIZE) {
        const chunk = group.slice(start, start + COMMIT_CHUNK_SIZE);
        const result = await tx[modelName].createMany({
          data: chunk.map(candidate => candidate.data),
          skipDuplicates: true
        });
        insertedInGroup += result.count;
      }

      report.inserted_records += insertedInGroup;
      report.inserted_by_bucket[bucket] += insertedInGroup;

      const raceSkipped = group.length - insertedInGroup;
      if (raceSkipped > 0) {
        report.duplicate_records += raceSkipped;
        report.warnings.push({
          title: null,
          lifecycle_bucket: bucket,
          field: 'sourceFingerprint',
          message: `${raceSkipped} record(s) were skipped at commit time because an identical record was persisted concurrently`
        });
      }
    }
  }, COMMIT_TRANSACTION_OPTIONS);

  report.searchable_records = report.inserted_records;
}

async function persistNormalizedTopicImport(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new Error('records must be an array');
  }

  const dbClient = options.prismaClient || prisma;
  const embedImpl = options.embedDocumentImpl || embedDocument;
  const report = buildEmptyReport(records);

  const candidates = [];
  const batchFingerprints = new Set();

  for (const record of records) {
    const modelName = BUCKET_MODEL_MAP[record.lifecycle_bucket];

    if (!modelName) {
      report.skipped_records += 1;
      report.errors.push({
        title: record.title,
        lifecycle_bucket: record.lifecycle_bucket,
        message: 'Unsupported lifecycle bucket'
      });
      continue;
    }

    const data = buildPrismaData(record, options, report);
    data.sourceFingerprint = computeSourceFingerprint(record.lifecycle_bucket, data);
    const candidate = { record, modelName, data };

    if (batchFingerprints.has(data.sourceFingerprint)) {
      markDuplicate(report, candidate, 'duplicate_in_batch');
      continue;
    }

    batchFingerprints.add(data.sourceFingerprint);
    candidates.push(candidate);
  }

  const toCreate = await markExistingFingerprints(dbClient, candidates, report);

  if (toCreate.length) {
    await embedCandidates(toCreate, report, embedImpl);
    await commitCandidates(dbClient, toCreate, report);
  }

  if (report.inserted_records && !options.prismaClient) {
    try {
      await residentCorpus.refresh();
      report.corpus_refreshed = true;
    } catch (error) {
      report.corpus_refreshed = false;
      report.warnings.push({
        title: null,
        lifecycle_bucket: null,
        field: 'residentCorpus',
        message: `Resident corpus refresh failed after commit: ${error.message}. The corpus self-refreshes on next read.`
      });
    }
  }

  return report;
}

module.exports = {
  persistNormalizedTopicImport,
  computeSourceFingerprint,
  TopicImportEmbeddingUnavailableError
};
