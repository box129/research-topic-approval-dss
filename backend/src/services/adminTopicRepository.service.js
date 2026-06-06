const prisma = require('../config/database');

const DATA_COVERAGE_LIST = 'Read-only topic data from existing lifecycle tables.';
const DATA_COVERAGE_SUMMARY = 'Read-only aggregate counts from existing topic tables.';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const LIFECYCLES = {
  historical: {
    label: 'historical',
    model: 'historicalTopic',
    summaryKey: 'historical'
  },
  'current-session': {
    label: 'current-session',
    model: 'currentSessionTopic',
    summaryKey: 'currentSession'
  },
  'under-review': {
    label: 'under-review',
    model: 'underReviewTopic',
    summaryKey: 'underReview'
  }
};

const SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'sessionYear',
  'title',
  'category',
  'supervisorName'
]);

class AdminTopicRepositoryServiceError extends Error {
  constructor(message, { code = 'ADMIN_TOPIC_REPOSITORY_VALIDATION_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'AdminTopicRepositoryServiceError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function normalizeLifecycle(value) {
  if (!value || value === 'all') {
    return null;
  }

  const normalized = String(value).trim().toLowerCase().replace(/_/g, '-');
  return LIFECYCLES[normalized] ? normalized : undefined;
}

function parsePositiveInteger(value, { defaultValue, field, max }) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AdminTopicRepositoryServiceError(`${field} must be a positive integer.`, {
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_PAGINATION',
      field
    });
  }

  if (max && parsed > max) {
    throw new AdminTopicRepositoryServiceError(`${field} cannot exceed ${max}.`, {
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_PAGINATION',
      field
    });
  }

  return parsed;
}

function normalizeFilters(query = {}) {
  const lifecycle = normalizeLifecycle(query.lifecycle);
  if (lifecycle === undefined) {
    throw new AdminTopicRepositoryServiceError('Unsupported topic lifecycle filter.', {
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_LIFECYCLE',
      field: 'lifecycle'
    });
  }

  const page = parsePositiveInteger(query.page, {
    defaultValue: DEFAULT_PAGE,
    field: 'page'
  });
  const limit = parsePositiveInteger(query.limit, {
    defaultValue: DEFAULT_LIMIT,
    field: 'limit',
    max: MAX_LIMIT
  });

  const sort = query.sort ? String(query.sort).trim() : 'updatedAt';
  if (!SORT_FIELDS.has(sort)) {
    throw new AdminTopicRepositoryServiceError('Unsupported topic repository sort field.', {
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_SORT',
      field: 'sort'
    });
  }

  const direction = query.direction ? String(query.direction).trim().toLowerCase() : 'desc';
  if (!['asc', 'desc'].includes(direction)) {
    throw new AdminTopicRepositoryServiceError('Sort direction must be asc or desc.', {
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_SORT',
      field: 'direction'
    });
  }

  return {
    lifecycle,
    search: normalizeString(query.search),
    category: normalizeString(query.category),
    sessionYear: normalizeString(query.sessionYear),
    supervisorName: normalizeString(query.supervisorName),
    sourceType: normalizeString(query.sourceType),
    importBatchId: normalizeString(query.importBatchId),
    page,
    limit,
    sort,
    direction
  };
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

function contains(value) {
  return {
    contains: value,
    mode: 'insensitive'
  };
}

function buildWhere(filters) {
  const and = [];

  if (filters.search) {
    and.push({
      OR: [
        { title: contains(filters.search) },
        { keywords: contains(filters.search) },
        { category: contains(filters.search) },
        { supervisorName: contains(filters.search) }
      ]
    });
  }

  [
    ['category', filters.category],
    ['sessionYear', filters.sessionYear],
    ['supervisorName', filters.supervisorName],
    ['sourceType', filters.sourceType],
    ['importBatchId', filters.importBatchId]
  ].forEach(([field, value]) => {
    if (value) {
      and.push({ [field]: contains(value) });
    }
  });

  return and.length ? { AND: and } : {};
}

function toIso(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function parseImportWarnings(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'object') {
    return [value];
  }

  return [];
}

function hasContextFields(topic) {
  return Boolean(
    normalizeString(topic.population)
    && normalizeString(topic.location)
    && normalizeString(topic.studyFocus)
  );
}

function serializeTopic(topic, lifecycle, { includeDetail = false } = {}) {
  const warnings = parseImportWarnings(topic.importWarnings);
  const base = {
    id: topic.id,
    lifecycle,
    title: topic.title,
    keywords: topic.keywords || null,
    category: topic.category || null,
    sessionYear: topic.sessionYear || null,
    supervisorName: topic.supervisorName || null,
    sourceType: topic.sourceType || null,
    sourceFilename: topic.sourceFilename || null,
    importBatchId: topic.importBatchId || null,
    createdAt: toIso(topic.createdAt),
    updatedAt: toIso(topic.updatedAt),
    dataQuality: {
      hasEmbedding: Array.isArray(topic.embedding) ? topic.embedding.length > 0 : Boolean(topic.embedding),
      hasContextFields: hasContextFields(topic),
      hasImportWarnings: warnings.length > 0,
      importWarningCount: warnings.length
    }
  };

  if (!includeDetail) {
    return base;
  }

  return {
    ...base,
    population: topic.population || null,
    location: topic.location || null,
    studyFocus: topic.studyFocus || null,
    rawRecord: topic.rawRecord || null,
    importWarnings: warnings,
    lifecycleDetails: {
      approvedDate: toIso(topic.approvedDate),
      studentId: topic.studentId || null,
      reviewStartedAt: toIso(topic.reviewStartedAt),
      reviewingLecturer: topic.reviewingLecturer || null
    }
  };
}

function compareValues(a, b, sort, direction) {
  const aValue = a[sort] ?? '';
  const bValue = b[sort] ?? '';

  if (sort === 'createdAt' || sort === 'updatedAt') {
    const aTime = aValue ? new Date(aValue).getTime() : 0;
    const bTime = bValue ? new Date(bValue).getTime() : 0;
    return direction === 'asc' ? aTime - bTime : bTime - aTime;
  }

  const result = String(aValue).localeCompare(String(bValue), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  return direction === 'asc' ? result : -result;
}

function createPagination({ page, limit, total }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: totalPages > page,
    hasPreviousPage: page > 1 && totalPages > 0
  };
}

function createFilterMeta(filters) {
  return {
    lifecycle: filters.lifecycle || 'all',
    search: filters.search || null,
    category: filters.category || null,
    sessionYear: filters.sessionYear || null,
    supervisorName: filters.supervisorName || null,
    sourceType: filters.sourceType || null,
    importBatchId: filters.importBatchId || null,
    sort: filters.sort,
    direction: filters.direction
  };
}

function getLifecycleEntries(lifecycle) {
  if (lifecycle) {
    return [[lifecycle, LIFECYCLES[lifecycle]]];
  }

  return Object.entries(LIFECYCLES);
}

function addCount(map, key) {
  const normalized = normalizeString(key) || 'Missing';
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function mapToSortedCounts(map, fieldName) {
  return Array.from(map.entries())
    .map(([value, count]) => ({
      [fieldName]: value === 'Missing' ? null : value,
      count
    }))
    .sort((a, b) => b.count - a.count || String(a[fieldName] || '').localeCompare(String(b[fieldName] || '')));
}

function createAdminTopicRepositoryService({ prismaClient = prisma } = {}) {
  const listTopics = async (query = {}) => {
    const filters = normalizeFilters(query);
    const where = buildWhere(filters);
    const lifecycleEntries = getLifecycleEntries(filters.lifecycle);

    const topicGroups = await Promise.all(
      lifecycleEntries.map(async ([lifecycle, config]) => {
        const records = await prismaClient[config.model].findMany({
          where,
          orderBy: {
            [filters.sort]: filters.direction
          }
        });

        return records.map((topic) => serializeTopic(topic, lifecycle));
      })
    );

    const allTopics = topicGroups
      .flat()
      .sort((a, b) => compareValues(a, b, filters.sort, filters.direction));

    const total = allTopics.length;
    const start = (filters.page - 1) * filters.limit;

    return {
      data: {
        items: allTopics.slice(start, start + filters.limit)
      },
      meta: {
        pagination: createPagination({
          page: filters.page,
          limit: filters.limit,
          total
        }),
        filters: createFilterMeta(filters),
        dataCoverage: DATA_COVERAGE_LIST
      }
    };
  };

  const getTopicByLifecycleAndId = async (lifecycleValue, idValue) => {
    const lifecycle = normalizeLifecycle(lifecycleValue);
    if (!lifecycle) {
      throw new AdminTopicRepositoryServiceError('Unsupported topic lifecycle.', {
        code: 'ADMIN_TOPIC_REPOSITORY_INVALID_LIFECYCLE',
        field: 'lifecycle'
      });
    }

    const id = Number.parseInt(idValue, 10);
    if (!Number.isInteger(id) || id < 1) {
      throw new AdminTopicRepositoryServiceError('Topic id must be a positive integer.', {
        code: 'ADMIN_TOPIC_REPOSITORY_INVALID_ID',
        field: 'id'
      });
    }

    const topic = await prismaClient[LIFECYCLES[lifecycle].model].findUnique({
      where: { id }
    });

    return topic ? serializeTopic(topic, lifecycle, { includeDetail: true }) : null;
  };

  const getTopicsSummary = async () => {
    const lifecycleEntries = Object.entries(LIFECYCLES);
    const topicGroups = await Promise.all(
      lifecycleEntries.map(async ([lifecycle, config]) => {
        const records = await prismaClient[config.model].findMany();
        return records.map((topic) => serializeTopic(topic, lifecycle, { includeDetail: true }));
      })
    );

    const topics = topicGroups.flat();
    const byCategory = new Map();
    const bySessionYear = new Map();
    const lifecycleTotals = {
      historical: 0,
      currentSession: 0,
      underReview: 0
    };
    const dataQuality = {
      missingCategory: 0,
      missingSessionYear: 0,
      missingSupervisorName: 0,
      missingContextFields: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0,
      withImportWarnings: 0
    };

    topics.forEach((topic) => {
      const summaryKey = LIFECYCLES[topic.lifecycle].summaryKey;
      lifecycleTotals[summaryKey] += 1;
      addCount(byCategory, topic.category);
      addCount(bySessionYear, topic.sessionYear);

      if (!topic.category) {
        dataQuality.missingCategory += 1;
      }
      if (!topic.sessionYear) {
        dataQuality.missingSessionYear += 1;
      }
      if (!topic.supervisorName) {
        dataQuality.missingSupervisorName += 1;
      }
      if (!topic.dataQuality.hasContextFields) {
        dataQuality.missingContextFields += 1;
      }
      if (topic.dataQuality.hasEmbedding) {
        dataQuality.withEmbeddings += 1;
      } else {
        dataQuality.withoutEmbeddings += 1;
      }
      if (topic.dataQuality.hasImportWarnings) {
        dataQuality.withImportWarnings += 1;
      }
    });

    return {
      data: {
        totals: {
          all: topics.length,
          ...lifecycleTotals
        },
        byCategory: mapToSortedCounts(byCategory, 'category'),
        bySessionYear: mapToSortedCounts(bySessionYear, 'sessionYear'),
        dataQuality
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataCoverage: DATA_COVERAGE_SUMMARY
      }
    };
  };

  return {
    listTopics,
    getTopicByLifecycleAndId,
    getTopicsSummary
  };
}

module.exports = {
  ...createAdminTopicRepositoryService(),
  createAdminTopicRepositoryService,
  AdminTopicRepositoryServiceError,
  DATA_COVERAGE_LIST,
  DATA_COVERAGE_SUMMARY,
  LIFECYCLES
};
