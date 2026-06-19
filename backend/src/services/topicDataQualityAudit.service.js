const crypto = require('crypto');
const prisma = require('../config/database');

const LIFECYCLE_CONFIGS = [
  { key: 'historical', model: 'historicalTopic' },
  { key: 'currentSession', model: 'currentSessionTopic' },
  { key: 'underReview', model: 'underReviewTopic' }
];

const SAFE_SELECT = {
  id: true,
  title: true,
  category: true,
  keywords: true,
  sessionYear: true,
  supervisorName: true,
  population: true,
  location: true,
  studyFocus: true,
  importWarnings: true,
  sourceType: true,
  importBatchId: true,
  embedding: true
};

function normalizeString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function isBlank(value) {
  return normalizeString(value).length === 0;
}

function normalizeTitle(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashValue(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 16);
}

function hasEmbedding(value) {
  if (!value) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
}

function hasImportWarnings(value) {
  if (!value) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
}

function increment(map, key) {
  const normalized = normalizeString(key) || 'missing';
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function mapToCounts(map, fieldName) {
  return Array.from(map.entries())
    .map(([value, count]) => ({
      [fieldName]: value,
      count
    }))
    .sort((a, b) => b.count - a.count || String(a[fieldName]).localeCompare(String(b[fieldName])));
}

function createEmptyLifecycleSummary() {
  return {
    total: 0,
    blankTitle: 0,
    missingCategory: 0,
    missingSessionYear: 0,
    missingSupervisorName: 0,
    missingKeywords: 0,
    missingPopulation: 0,
    missingLocation: 0,
    missingStudyFocus: 0,
    incompleteContext: 0,
    withEmbeddings: 0,
    withoutEmbeddings: 0,
    withImportWarnings: 0
  };
}

function summarizeRecord(summary, record) {
  summary.total += 1;

  if (isBlank(record.title)) summary.blankTitle += 1;
  if (isBlank(record.category)) summary.missingCategory += 1;
  if (isBlank(record.sessionYear)) summary.missingSessionYear += 1;
  if (isBlank(record.supervisorName)) summary.missingSupervisorName += 1;
  if (isBlank(record.keywords)) summary.missingKeywords += 1;
  if (isBlank(record.population)) summary.missingPopulation += 1;
  if (isBlank(record.location)) summary.missingLocation += 1;
  if (isBlank(record.studyFocus)) summary.missingStudyFocus += 1;

  if (isBlank(record.population) || isBlank(record.location) || isBlank(record.studyFocus)) {
    summary.incompleteContext += 1;
  }

  if (hasEmbedding(record.embedding)) {
    summary.withEmbeddings += 1;
  } else {
    summary.withoutEmbeddings += 1;
  }

  if (hasImportWarnings(record.importWarnings)) {
    summary.withImportWarnings += 1;
  }
}

function buildDuplicateCandidates(recordsWithLifecycle) {
  const byTitle = new Map();

  recordsWithLifecycle.forEach(({ lifecycle, record }) => {
    const normalizedTitle = normalizeTitle(record.title);
    if (!normalizedTitle) {
      return;
    }

    if (!byTitle.has(normalizedTitle)) {
      byTitle.set(normalizedTitle, []);
    }

    byTitle.get(normalizedTitle).push({
      lifecycle,
      id: record.id
    });
  });

  const duplicates = Array.from(byTitle.entries())
    .filter(([, refs]) => refs.length > 1)
    .map(([normalizedTitle, refs]) => {
      const lifecycleSet = new Set(refs.map(ref => ref.lifecycle));
      return {
        normalizedTitleHash: hashValue(normalizedTitle),
        count: refs.length,
        scope: lifecycleSet.size > 1 ? 'across_lifecycle' : 'within_lifecycle',
        lifecycles: Array.from(lifecycleSet).sort(),
        recordRefs: refs.sort((a, b) => `${a.lifecycle}:${a.id}`.localeCompare(`${b.lifecycle}:${b.id}`))
      };
    })
    .sort((a, b) => b.count - a.count || a.normalizedTitleHash.localeCompare(b.normalizedTitleHash));

  return {
    totalCandidateGroups: duplicates.length,
    withinLifecycleGroups: duplicates.filter(candidate => candidate.scope === 'within_lifecycle').length,
    acrossLifecycleGroups: duplicates.filter(candidate => candidate.scope === 'across_lifecycle').length,
    candidates: duplicates
  };
}

function auditTopicRecords(recordsByLifecycle, { generatedAt = new Date().toISOString(), mode = 'in_memory' } = {}) {
  const lifecycleSummaries = {};
  const sourceTypeCounts = new Map();
  const importBatchCounts = new Map();
  const recordsWithLifecycle = [];

  LIFECYCLE_CONFIGS.forEach(({ key }) => {
    const records = recordsByLifecycle[key] || [];
    const summary = createEmptyLifecycleSummary();

    records.forEach(record => {
      summarizeRecord(summary, record);
      increment(sourceTypeCounts, record.sourceType);
      increment(importBatchCounts, record.importBatchId);
      recordsWithLifecycle.push({ lifecycle: key, record });
    });

    lifecycleSummaries[key] = summary;
  });

  const totals = Object.values(lifecycleSummaries).reduce((combined, summary) => {
    Object.entries(summary).forEach(([key, value]) => {
      combined[key] = (combined[key] || 0) + value;
    });
    return combined;
  }, {});

  return {
    generatedAt,
    mode,
    dataSafety: {
      readOnly: true,
      rawTitlesIncluded: false,
      duplicateTitlesHashed: true,
      mutatesDatabase: false
    },
    sourceTables: [
      'HistoricalTopic',
      'CurrentSessionTopic',
      'UnderReviewTopic'
    ],
    totals,
    byLifecycle: lifecycleSummaries,
    groupedCounts: {
      sourceType: mapToCounts(sourceTypeCounts, 'sourceType'),
      importBatchId: mapToCounts(importBatchCounts, 'importBatchId')
    },
    duplicateTitleCandidates: buildDuplicateCandidates(recordsWithLifecycle),
    limitations: [
      'Duplicate candidates are based on normalized exact title matches only.',
      'No raw titles are written to the committed audit report.',
      'The audit does not recalculate embeddings or similarity scores.',
      'Missing-field counts reflect current stored fields only; they do not infer meaning from raw import rows.'
    ]
  };
}

async function fetchLifecycleRecords(prismaClient = prisma) {
  const entries = await Promise.all(
    LIFECYCLE_CONFIGS.map(async ({ key, model }) => {
      const records = await prismaClient[model].findMany({
        select: SAFE_SELECT
      });
      return [key, records];
    })
  );

  return Object.fromEntries(entries);
}

async function runTopicDataQualityAudit({ prismaClient = prisma, recordsByLifecycle, mode = 'database' } = {}) {
  const records = recordsByLifecycle || await fetchLifecycleRecords(prismaClient);
  return auditTopicRecords(records, {
    mode
  });
}

module.exports = {
  LIFECYCLE_CONFIGS,
  SAFE_SELECT,
  normalizeTitle,
  auditTopicRecords,
  fetchLifecycleRecords,
  runTopicDataQualityAudit
};
