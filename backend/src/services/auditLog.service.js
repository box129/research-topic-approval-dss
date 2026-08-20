const prisma = require('../config/database');
const logger = require('../config/logger');
const config = require('../config/env');

const AUDIT_EVENT_TYPES = Object.freeze({
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  SUBMISSION_CREATED: 'SUBMISSION_CREATED',
  SUBMISSION_REVIEWED: 'SUBMISSION_REVIEWED',
  SIMILARITY_CHECK_RUN: 'SIMILARITY_CHECK_RUN',
  TOPIC_IMPORT_PREVIEWED: 'TOPIC_IMPORT_PREVIEWED',
  TOPIC_IMPORT_COMMITTED: 'TOPIC_IMPORT_COMMITTED',
  ADMIN_SETTING_UPDATED: 'ADMIN_SETTING_UPDATED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  ADMIN_BOOTSTRAPPED: 'ADMIN_BOOTSTRAPPED',
  USER_PROVISIONED: 'USER_PROVISIONED',
  USER_CREDENTIAL_RESET: 'USER_CREDENTIAL_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SUPERVISEE_ASSIGNED: 'SUPERVISEE_ASSIGNED',
  SUPERVISEE_ASSIGNMENT_UPDATED: 'SUPERVISEE_ASSIGNMENT_UPDATED',
  SUPERVISEE_ASSIGNMENT_ENDED: 'SUPERVISEE_ASSIGNMENT_ENDED',
  REPORT_EXPORTED: 'REPORT_EXPORTED',
  AUDIT_LOGS_PURGED: 'AUDIT_LOGS_PURGED'
});

const SENSITIVE_KEY_PATTERN = /(password|passwordHash|token|resetToken|resetTokenHash|secret|authorization|cookie|jwt|session)/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const AUDIT_PURGE_CONFIRMATION = 'CONFIRM_AUDIT_PURGE';

class AuditLogServiceError extends Error {
  constructor(message, statusCode, code, field) {
    super(message);
    this.name = 'AuditLogServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
  }
}

function normalizeNullableString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function redactMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(redactMetadata);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((redacted, [key, nestedValue]) => {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[redacted]'
      : redactMetadata(nestedValue);
    return redacted;
  }, {});
}

function buildAuditContextFromRequest(req = {}) {
  return {
    actorId: normalizeNullableInteger(req.user?.id),
    actorRole: normalizeNullableString(req.user?.role),
    actorEmail: normalizeNullableString(req.user?.email),
    ipAddress: normalizeNullableString(req.ip || req.headers?.['x-forwarded-for']),
    userAgent: normalizeNullableString(req.get?.('user-agent') || req.headers?.['user-agent']),
    requestId: normalizeNullableString(req.get?.('x-request-id') || req.headers?.['x-request-id'])
  };
}

function serializeAuditLog(log) {
  if (!log) {
    return null;
  }

  return {
    id: log.id,
    event_type: log.eventType,
    actor: {
      id: log.actorId,
      role: log.actorRole,
      email: log.actorEmail
    },
    target: {
      type: log.targetType,
      id: log.targetId
    },
    request: {
      id: log.requestId,
      ip_address: log.ipAddress,
      user_agent: log.userAgent
    },
    metadata: log.metadata || null,
    created_at: log.createdAt?.toISOString?.() || log.createdAt
  };
}

function normalizePagination({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new AuditLogServiceError('Page must be a positive integer.', 400, 'INVALID_PAGE', 'page');
  }

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
    throw new AuditLogServiceError(`Limit must be between 1 and ${MAX_LIMIT}.`, 400, 'INVALID_LIMIT', 'limit');
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit
  };
}

function normalizeDateFilter(value, field) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AuditLogServiceError(`${field} must be a valid ISO date.`, 400, 'INVALID_DATE_FILTER', field);
  }

  return date;
}

function buildWhere(filters = {}) {
  const where = {};

  if (filters.eventType) {
    where.eventType = String(filters.eventType).trim();
  }

  if (filters.actorRole) {
    where.actorRole = String(filters.actorRole).trim();
  }

  if (filters.actorId !== undefined && filters.actorId !== null && filters.actorId !== '') {
    const actorId = Number(filters.actorId);
    if (!Number.isInteger(actorId)) {
      throw new AuditLogServiceError('actorId must be an integer.', 400, 'INVALID_ACTOR_ID', 'actorId');
    }
    where.actorId = actorId;
  }

  if (filters.targetType) {
    where.targetType = String(filters.targetType).trim();
  }

  if (filters.targetId) {
    where.targetId = String(filters.targetId).trim();
  }

  const dateFrom = normalizeDateFilter(filters.dateFrom, 'dateFrom');
  const dateTo = normalizeDateFilter(filters.dateTo, 'dateTo');

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = dateFrom;
    }
    if (dateTo) {
      where.createdAt.lte = dateTo;
    }
  }

  if (filters.search) {
    const search = String(filters.search).trim();
    if (search) {
      where.OR = [
        { eventType: { contains: search, mode: 'insensitive' } },
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { targetType: { contains: search, mode: 'insensitive' } },
        { targetId: { contains: search, mode: 'insensitive' } }
      ];
    }
  }

  return where;
}

function normalizePositiveIntegerInput(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AuditLogServiceError(`${field} must be a positive integer.`, 400, 'INVALID_AUDIT_PURGE_INPUT', field);
  }

  return parsed;
}

function subtractDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function normalizePurgePolicy(policy = {}) {
  return {
    retentionDays: normalizePositiveIntegerInput(policy.retentionDays || 365, 'retentionDays'),
    purgeMinAgeDays: normalizePositiveIntegerInput(policy.purgeMinAgeDays || 90, 'purgeMinAgeDays'),
    purgeMaxBatch: normalizePositiveIntegerInput(policy.purgeMaxBatch || 1000, 'purgeMaxBatch')
  };
}

function normalizePurgeRequest(input = {}, policy, now = new Date()) {
  const olderThanDaysValue = input.olderThanDays ?? input.older_than_days;
  const cutoffDateValue = input.cutoffDate ?? input.cutoff_date;

  const hasOlderThanDays = olderThanDaysValue !== undefined && olderThanDaysValue !== null && olderThanDaysValue !== '';
  const hasCutoffDate = cutoffDateValue !== undefined && cutoffDateValue !== null && cutoffDateValue !== '';

  if (hasOlderThanDays && hasCutoffDate) {
    throw new AuditLogServiceError(
      'Provide either olderThanDays or cutoffDate, not both.',
      400,
      'AUDIT_PURGE_AMBIGUOUS_CUTOFF',
      'cutoff'
    );
  }

  const olderThanDays = hasOlderThanDays
    ? normalizePositiveIntegerInput(olderThanDaysValue, 'olderThanDays')
    : null;
  const cutoffDate = hasCutoffDate
    ? normalizeDateFilter(cutoffDateValue, 'cutoffDate')
    : subtractDays(now, olderThanDays || policy.retentionDays);
  const minAllowedCutoff = subtractDays(now, policy.purgeMinAgeDays);

  if (cutoffDate.getTime() > minAllowedCutoff.getTime()) {
    throw new AuditLogServiceError(
      `Audit purge cutoff must be at least ${policy.purgeMinAgeDays} days old.`,
      400,
      'AUDIT_PURGE_CUTOFF_TOO_RECENT',
      olderThanDays ? 'olderThanDays' : 'cutoffDate'
    );
  }

  return {
    cutoffDate,
    olderThanDays: olderThanDays || Math.floor((now.getTime() - cutoffDate.getTime()) / (24 * 60 * 60 * 1000)),
    minAgeDays: policy.purgeMinAgeDays,
    maxBatch: policy.purgeMaxBatch,
    retentionDays: policy.retentionDays
  };
}

function countGroup(group) {
  if (typeof group?._count?._all === 'number') {
    return group._count._all;
  }

  if (typeof group?._count === 'number') {
    return group._count;
  }

  return 0;
}

function mapGroupedCounts(groups, field) {
  return groups.map((group) => ({
    [field]: group[field] || 'unknown',
    count: countGroup(group)
  }));
}

function serializePurgePreview({ candidateCount, eventTypeGroups, actorRoleGroups, request }) {
  return {
    cutoffDate: request.cutoffDate.toISOString(),
    olderThanDays: request.olderThanDays,
    candidateCount,
    maxBatch: request.maxBatch,
    willDeleteCount: Math.min(candidateCount, request.maxBatch),
    policy: {
      retentionDays: request.retentionDays,
      purgeMinAgeDays: request.minAgeDays,
      confirmationPhrase: AUDIT_PURGE_CONFIRMATION
    },
    summary: {
      byEventType: mapGroupedCounts(eventTypeGroups, 'eventType'),
      byActorRole: mapGroupedCounts(actorRoleGroups, 'actorRole')
    }
  };
}

function createAuditLogService({
  prismaClient = prisma,
  log = logger,
  retentionPolicy = config.auditLog
} = {}) {
  const policy = normalizePurgePolicy(retentionPolicy);

  const createAuditLog = async ({
    eventType,
    actorId = null,
    actorRole = null,
    actorEmail = null,
    targetType = null,
    targetId = null,
    requestId = null,
    ipAddress = null,
    userAgent = null,
    metadata = null
  }) => {
    if (!eventType || typeof eventType !== 'string') {
      throw new AuditLogServiceError('eventType is required.', 400, 'AUDIT_EVENT_TYPE_REQUIRED', 'eventType');
    }

    return prismaClient.auditLog.create({
      data: {
        eventType,
        actorId: normalizeNullableInteger(actorId),
        actorRole: normalizeNullableString(actorRole),
        actorEmail: normalizeNullableString(actorEmail),
        targetType: normalizeNullableString(targetType),
        targetId: normalizeNullableString(targetId),
        requestId: normalizeNullableString(requestId),
        ipAddress: normalizeNullableString(ipAddress),
        userAgent: normalizeNullableString(userAgent),
        metadata: metadata ? redactMetadata(metadata) : null
      }
    });
  };

  const createAuditLogSafely = async (event) => {
    try {
      return await createAuditLog(event);
    } catch (error) {
      log.warn('Audit log creation failed', {
        eventType: event?.eventType,
        error: error.message
      });
      return null;
    }
  };

  const listAuditLogs = async ({ filters = {}, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
    const pagination = normalizePagination({ page, limit });
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      prismaClient.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit
      }),
      prismaClient.auditLog.count({ where })
    ]);
    const totalPages = Math.ceil(total / pagination.limit);

    return {
      items: items.map(serializeAuditLog),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPreviousPage: pagination.page > 1
      },
      filters
    };
  };

  const getAuditLogById = async (id) => {
    const auditLogId = Number(id);
    if (!Number.isInteger(auditLogId) || auditLogId < 1) {
      throw new AuditLogServiceError('Audit log id must be a positive integer.', 400, 'INVALID_AUDIT_LOG_ID', 'id');
    }

    const auditLog = await prismaClient.auditLog.findUnique({
      where: { id: auditLogId }
    });

    return serializeAuditLog(auditLog);
  };

  const previewAuditLogPurge = async (input = {}, { now = new Date() } = {}) => {
    const request = normalizePurgeRequest(input, policy, now);
    const where = {
      createdAt: {
        lt: request.cutoffDate
      }
    };
    const [candidateCount, eventTypeGroups, actorRoleGroups] = await Promise.all([
      prismaClient.auditLog.count({ where }),
      prismaClient.auditLog.groupBy({
        by: ['eventType'],
        where,
        _count: { _all: true }
      }),
      prismaClient.auditLog.groupBy({
        by: ['actorRole'],
        where,
        _count: { _all: true }
      })
    ]);

    return serializePurgePreview({
      candidateCount,
      eventTypeGroups,
      actorRoleGroups,
      request
    });
  };

  const purgeAuditLogs = async ({ input = {}, req, now = new Date() } = {}) => {
    if (input.confirmation !== AUDIT_PURGE_CONFIRMATION) {
      throw new AuditLogServiceError(
        `confirmation must equal ${AUDIT_PURGE_CONFIRMATION}.`,
        400,
        'AUDIT_PURGE_CONFIRMATION_REQUIRED',
        'confirmation'
      );
    }

    const preview = await previewAuditLogPurge(input, { now });
    const eligibleLogs = await prismaClient.auditLog.findMany({
      where: {
        createdAt: {
          lt: new Date(preview.cutoffDate)
        }
      },
      select: {
        id: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: policy.purgeMaxBatch
    });
    const ids = eligibleLogs.map((auditLog) => auditLog.id);
    const deleteResult = ids.length
      ? await prismaClient.auditLog.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      })
      : { count: 0 };

    await createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.AUDIT_LOGS_PURGED,
      ...buildAuditContextFromRequest(req),
      targetType: 'AuditLog',
      targetId: null,
      metadata: {
        cutoffDate: preview.cutoffDate,
        olderThanDays: preview.olderThanDays,
        candidateCount: preview.candidateCount,
        deletedCount: deleteResult.count || 0,
        maxBatch: policy.purgeMaxBatch,
        retentionDays: policy.retentionDays,
        purgeMinAgeDays: policy.purgeMinAgeDays
      }
    });

    return {
      cutoffDate: preview.cutoffDate,
      olderThanDays: preview.olderThanDays,
      candidateCount: preview.candidateCount,
      deletedCount: deleteResult.count || 0,
      maxBatch: policy.purgeMaxBatch,
      auditEventType: AUDIT_EVENT_TYPES.AUDIT_LOGS_PURGED
    };
  };

  return {
    createAuditLog,
    createAuditLogSafely,
    listAuditLogs,
    getAuditLogById,
    previewAuditLogPurge,
    purgeAuditLogs
  };
}

module.exports = {
  ...createAuditLogService(),
  createAuditLogService,
  AuditLogServiceError,
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  redactMetadata,
  serializeAuditLog,
  AUDIT_PURGE_CONFIRMATION,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizePurgeRequest
};
