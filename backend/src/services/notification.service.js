const prisma = require('../config/database');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'resettoken',
  'resettokenhash',
  'token',
  'authtoken',
  'jwt',
  'secret',
  'apikey',
  'api_key'
]);

class NotificationServiceError extends Error {
  constructor(message, { code = 'NOTIFICATION_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'NotificationServiceError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function normalizePositiveInteger(value, { defaultValue, field, max }) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new NotificationServiceError(`${field} must be a positive integer.`, {
      code: 'NOTIFICATION_INVALID_PAGINATION',
      field
    });
  }

  if (max && parsed > max) {
    throw new NotificationServiceError(`${field} cannot exceed ${max}.`, {
      code: 'NOTIFICATION_INVALID_PAGINATION',
      field
    });
  }

  return parsed;
}

function normalizeString(value, { field, required = false, maxLength } = {}) {
  const normalized = String(value || '').trim();
  if (!normalized && required) {
    throw new NotificationServiceError(`${field} is required.`, {
      code: 'NOTIFICATION_REQUIRED_FIELD',
      field
    });
  }

  if (maxLength && normalized.length > maxLength) {
    throw new NotificationServiceError(`${field} is too long.`, {
      code: 'NOTIFICATION_FIELD_TOO_LONG',
      field
    });
  }

  return normalized || null;
}

function normalizeUserId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new NotificationServiceError('userId must be a positive integer.', {
      code: 'NOTIFICATION_INVALID_USER_ID',
      field: 'userId'
    });
  }

  return id;
}

function normalizeNotificationId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new NotificationServiceError('Notification id must be a positive integer.', {
      code: 'NOTIFICATION_INVALID_ID',
      field: 'id'
    });
  }

  return id;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function shouldRedactKey(key) {
  return SENSITIVE_METADATA_KEYS.has(String(key || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
}

function sanitizeMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeMetadata(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((safe, [key, item]) => {
      safe[key] = shouldRedactKey(key) ? '[redacted]' : sanitizeMetadata(item);
      return safe;
    }, {});
  }

  return value;
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

function serializeNotification(notification) {
  if (!notification) {
    return null;
  }

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkPath: notification.linkPath || null,
    metadata: sanitizeMetadata(notification.metadata || null),
    readAt: toIso(notification.readAt),
    createdAt: toIso(notification.createdAt),
    updatedAt: toIso(notification.updatedAt)
  };
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

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

function createNotificationService({ prismaClient = prisma } = {}) {
  const createNotification = async ({
    userId,
    type,
    title,
    message,
    linkPath,
    metadata
  }) => {
    const normalizedUserId = normalizeUserId(userId);
    const user = await prismaClient.user.findUnique({
      where: { id: normalizedUserId },
      select: { id: true }
    });

    if (!user) {
      throw new NotificationServiceError('Notification user does not exist.', {
        code: 'NOTIFICATION_USER_NOT_FOUND',
        field: 'userId',
        statusCode: 404
      });
    }

    const created = await prismaClient.notification.create({
      data: {
        userId: normalizedUserId,
        type: normalizeString(type, { field: 'type', required: true, maxLength: 100 }),
        title: normalizeString(title, { field: 'title', required: true, maxLength: 200 }),
        message: normalizeString(message, { field: 'message', required: true }),
        linkPath: normalizeString(linkPath, { field: 'linkPath' }),
        metadata: metadata === undefined ? undefined : sanitizeMetadata(metadata)
      }
    });

    return serializeNotification(created);
  };

  const listNotificationsForUser = async (userId, query = {}) => {
    const normalizedUserId = normalizeUserId(userId);
    const filters = normalizeListQuery(query);
    const where = { userId: normalizedUserId };
    const [items, total, unreadCount] = await Promise.all([
      prismaClient.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.limit
      }),
      prismaClient.notification.count({ where }),
      prismaClient.notification.count({
        where: {
          userId: normalizedUserId,
          readAt: null
        }
      })
    ]);

    return {
      data: {
        items: items.map(serializeNotification)
      },
      meta: {
        pagination: createPagination({
          page: filters.page,
          limit: filters.limit,
          total
        }),
        unreadCount,
        dataCoverage: total === 0
          ? 'No notifications found for this user.'
          : 'Authenticated user notifications from the Notification table.'
      }
    };
  };

  const markNotificationRead = async ({ id, userId }) => {
    const notificationId = normalizeNotificationId(id);
    const normalizedUserId = normalizeUserId(userId);
    const existing = await prismaClient.notification.findFirst({
      where: {
        id: notificationId,
        userId: normalizedUserId
      }
    });

    if (!existing) {
      return null;
    }

    if (existing.readAt) {
      return serializeNotification(existing);
    }

    const updated = await prismaClient.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() }
    });

    return serializeNotification(updated);
  };

  const markAllNotificationsRead = async (userId) => {
    const normalizedUserId = normalizeUserId(userId);
    const readAt = new Date();
    const result = await prismaClient.notification.updateMany({
      where: {
        userId: normalizedUserId,
        readAt: null
      },
      data: { readAt }
    });

    return {
      updatedCount: result.count,
      readAt: readAt.toISOString()
    };
  };

  return {
    createNotification,
    listNotificationsForUser,
    markNotificationRead,
    markAllNotificationsRead
  };
}

module.exports = {
  ...createNotificationService(),
  NotificationServiceError,
  createNotificationService,
  sanitizeMetadata,
  serializeNotification
};
