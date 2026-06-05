const auditLogService = require('../services/auditLog.service');

function buildErrorResponse(code, message, field) {
  const error = {
    code,
    message
  };

  if (field) {
    error.field = field;
  }

  return {
    success: false,
    error
  };
}

function getFilters(query = {}) {
  return {
    eventType: query.eventType,
    actorRole: query.actorRole,
    actorId: query.actorId,
    targetType: query.targetType,
    targetId: query.targetId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    search: query.search
  };
}

function sendAuditLogError(res, error) {
  if (error instanceof auditLogService.AuditLogServiceError) {
    return res.status(error.statusCode).json(
      buildErrorResponse(error.code, error.message, error.field)
    );
  }

  throw error;
}

async function listAuditLogs(req, res, next) {
  try {
    const result = await auditLogService.listAuditLogs({
      filters: getFilters(req.query),
      page: req.query.page,
      limit: req.query.limit
    });

    return res.status(200).json({
      success: true,
      data: {
        items: result.items
      },
      meta: {
        pagination: result.pagination,
        filters: result.filters
      }
    });
  } catch (error) {
    try {
      return sendAuditLogError(res, error);
    } catch (unhandledError) {
      return next(unhandledError);
    }
  }
}

async function getAuditLogById(req, res, next) {
  try {
    const auditLog = await auditLogService.getAuditLogById(req.params.id);

    if (!auditLog) {
      return res.status(404).json(
        buildErrorResponse('AUDIT_LOG_NOT_FOUND', 'Audit log not found.')
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        audit_log: auditLog
      }
    });
  } catch (error) {
    try {
      return sendAuditLogError(res, error);
    } catch (unhandledError) {
      return next(unhandledError);
    }
  }
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  buildErrorResponse,
  getFilters
};
