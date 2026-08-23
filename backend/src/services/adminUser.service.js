const prisma = require('../config/database');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const VALID_ROLES = new Set(['STUDENT', 'LECTURER', 'ADMIN']);
const VALID_STATUSES = new Set(['ACTIVE', 'SUSPENDED']);
const SORT_FIELDS = new Set(['name', 'email', 'role', 'status', 'createdAt', 'updatedAt']);
const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  matricNumber: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  // Invitation lifecycle fields. The token hash is selected only so the
  // serializer can derive a status; it is never included in API output.
  invitationTokenHash: true,
  invitationExpiresAt: true,
  invitationLastAttemptAt: true,
  invitationLastSentAt: true,
  invitationLastError: true,
  invitationAcceptedAt: true
};

class AdminUserServiceError extends Error {
  constructor(message, { code = 'ADMIN_USER_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'AdminUserServiceError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

function normalizeEnum(value, allowed, field) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const enumValue = normalized.replace(/-/g, '_').toUpperCase();
  if (!allowed.has(enumValue)) {
    throw new AdminUserServiceError(`Unsupported ${field} value.`, {
      code: field === 'role' ? 'ADMIN_USER_INVALID_ROLE' : 'ADMIN_USER_INVALID_STATUS',
      field
    });
  }

  return enumValue;
}

function normalizePositiveInteger(value, { defaultValue, field, max }) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AdminUserServiceError(`${field} must be a positive integer.`, {
      code: 'ADMIN_USER_INVALID_PAGINATION',
      field
    });
  }

  if (max && parsed > max) {
    throw new AdminUserServiceError(`${field} cannot exceed ${max}.`, {
      code: 'ADMIN_USER_INVALID_PAGINATION',
      field
    });
  }

  return parsed;
}

function toClientEnum(value) {
  return String(value || '').toLowerCase();
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

function toTime(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function deriveInvitationStatus(user, now = new Date()) {
  if (user.invitationAcceptedAt) {
    return 'accepted';
  }
  if (user.invitationTokenHash && user.invitationLastError) {
    return 'failed';
  }
  const expiresAtTime = toTime(user.invitationExpiresAt);
  if (user.invitationTokenHash && expiresAtTime && expiresAtTime > now.getTime()) {
    return 'pending';
  }
  if (user.invitationTokenHash) {
    return 'expired';
  }
  return 'not_invited';
}

// Safe admin-facing invitation summary: derived status, timestamps, and a
// short reason code only — never the token or its hash.
function serializeInvitationState(user, now = new Date()) {
  return {
    status: deriveInvitationStatus(user, now),
    lastAttemptAt: toIso(user.invitationLastAttemptAt),
    lastSentAt: toIso(user.invitationLastSentAt),
    acceptedAt: toIso(user.invitationAcceptedAt),
    expiresAt: toIso(user.invitationExpiresAt),
    lastError: user.invitationLastError || null
  };
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: toClientEnum(user.role),
    status: toClientEnum(user.status),
    matricNumber: user.matricNumber || null,
    mustChangePassword: Boolean(user.mustChangePassword),
    invitation: serializeInvitationState(user),
    createdAt: toIso(user.createdAt),
    updatedAt: toIso(user.updatedAt)
  };
}

function normalizeListQuery(query = {}) {
  const page = normalizePositiveInteger(query.page, {
    defaultValue: DEFAULT_PAGE,
    field: 'page'
  });
  const limit = normalizePositiveInteger(query.limit, {
    defaultValue: DEFAULT_LIMIT,
    field: 'limit',
    max: MAX_LIMIT
  });
  const sort = normalizeString(query.sort) || 'createdAt';
  if (!SORT_FIELDS.has(sort)) {
    throw new AdminUserServiceError('Unsupported user sort field.', {
      code: 'ADMIN_USER_INVALID_SORT',
      field: 'sort'
    });
  }

  const direction = (normalizeString(query.direction) || 'desc').toLowerCase();
  if (!['asc', 'desc'].includes(direction)) {
    throw new AdminUserServiceError('Sort direction must be asc or desc.', {
      code: 'ADMIN_USER_INVALID_SORT',
      field: 'direction'
    });
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort,
    direction,
    role: normalizeEnum(query.role, VALID_ROLES, 'role'),
    status: normalizeEnum(query.status, VALID_STATUSES, 'status'),
    search: normalizeString(query.search)
  };
}

function contains(value) {
  return {
    contains: value,
    mode: 'insensitive'
  };
}

function buildWhere(filters) {
  const where = {};

  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.search) {
    where.OR = [
      { name: contains(filters.search) },
      { email: contains(filters.search) },
      { matricNumber: contains(filters.search) }
    ];
  }

  return where;
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

function createFiltersMeta(filters) {
  return {
    role: filters.role ? toClientEnum(filters.role) : null,
    status: filters.status ? toClientEnum(filters.status) : null,
    search: filters.search || null,
    sort: filters.sort,
    direction: filters.direction
  };
}

function createAdminUserService({
  prismaClient = prisma,
  audit = { createAuditLogSafely }
} = {}) {
  const listUsers = async (query = {}) => {
    const filters = normalizeListQuery(query);
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      prismaClient.user.findMany({
        where,
        select: USER_SAFE_SELECT,
        orderBy: {
          [filters.sort]: filters.direction
        },
        skip: filters.skip,
        take: filters.limit
      }),
      prismaClient.user.count({ where })
    ]);

    return {
      data: {
        items: items.map(serializeUser)
      },
      meta: {
        pagination: createPagination({
          page: filters.page,
          limit: filters.limit,
          total
        }),
        filters: createFiltersMeta(filters),
        generatedAt: new Date().toISOString(),
        dataCoverage: 'Read-only users from existing User records.'
      }
    };
  };

  const getUserById = async (idValue) => {
    const id = Number.parseInt(idValue, 10);
    if (!Number.isInteger(id) || id < 1) {
      throw new AdminUserServiceError('User id must be a positive integer.', {
        code: 'ADMIN_USER_INVALID_ID',
        field: 'id'
      });
    }

    const user = await prismaClient.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT
    });

    return serializeUser(user);
  };

  const updateUserStatus = async ({ id: idValue, status, actor, req }) => {
    const id = Number.parseInt(idValue, 10);
    if (!Number.isInteger(id) || id < 1) {
      throw new AdminUserServiceError('User id must be a positive integer.', {
        code: 'ADMIN_USER_INVALID_ID',
        field: 'id'
      });
    }

    const newStatus = normalizeEnum(status, VALID_STATUSES, 'status');
    if (!newStatus) {
      throw new AdminUserServiceError('status is required.', {
        code: 'ADMIN_USER_STATUS_REQUIRED',
        field: 'status'
      });
    }

    if (Number(actor?.id) === id && newStatus === 'SUSPENDED') {
      throw new AdminUserServiceError('Admins cannot suspend their own active account.', {
        code: 'ADMIN_USER_SELF_SUSPENSION_FORBIDDEN',
        field: 'status',
        statusCode: 409
      });
    }

    const existing = await prismaClient.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT
    });

    if (!existing) {
      return null;
    }

    const statusChanged = existing.status !== newStatus;
    const updated = await prismaClient.user.update({
      where: { id },
      data: {
        status: newStatus,
        ...(statusChanged
          ? {
            // Suspension must invalidate already-issued sessions. Otherwise a
            // cookie issued before suspension becomes valid again on a later
            // reactivation. Suspend also kills pending recovery/invitation
            // credentials tied to the account.
            credentialVersion: { increment: 1 },
            ...(newStatus === 'SUSPENDED'
              ? {
                resetTokenHash: null,
                resetTokenExpiresAt: null,
                invitationTokenHash: null,
                invitationExpiresAt: null
              }
              : {})
          }
          : {})
      },
      select: USER_SAFE_SELECT
    });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.USER_STATUS_CHANGED,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(id),
      metadata: {
        oldStatus: existing.status,
        newStatus,
        targetUserId: existing.id,
        targetUserRole: existing.role,
        targetUserEmail: existing.email,
        priorSessionsInvalidated: statusChanged,
        recoveryCredentialsInvalidated: statusChanged && newStatus === 'SUSPENDED'
      }
    });

    return serializeUser(updated);
  };

  return {
    listUsers,
    getUserById,
    updateUserStatus
  };
}

module.exports = {
  ...createAdminUserService(),
  createAdminUserService,
  AdminUserServiceError,
  serializeUser,
  serializeInvitationState,
  deriveInvitationStatus,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
