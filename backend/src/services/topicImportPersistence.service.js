const prisma = require('../config/database');
const { residentCorpus } = require('./residentCorpus.service');

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

function buildEmptyReport(records) {
  return {
    attempted_records: records.length,
    inserted_records: 0,
    failed_records: 0,
    skipped_records: 0,
    inserted_by_bucket: { ...INSERTED_BY_BUCKET_INITIAL },
    warnings: [],
    errors: []
  };
}

async function persistNormalizedTopicImport(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new Error('records must be an array');
  }

  const dbClient = options.prismaClient || prisma;
  const report = buildEmptyReport(records);

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

    try {
      const data = buildPrismaData(record, options, report);
      await dbClient[modelName].create({ data });
      report.inserted_records += 1;
      report.inserted_by_bucket[record.lifecycle_bucket] += 1;
    } catch (error) {
      report.failed_records += 1;
      report.errors.push({
        title: record.title,
        lifecycle_bucket: record.lifecycle_bucket,
        message: error.message
      });
    }
  }

  if (report.inserted_records && !options.prismaClient) await residentCorpus.refresh();
  return report;
}

module.exports = {
  persistNormalizedTopicImport
};
