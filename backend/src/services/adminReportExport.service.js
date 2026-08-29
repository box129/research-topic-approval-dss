const prisma = require('../config/database');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');

const MAX_EXPORT_ROWS = 1000;
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

const EXPORT_TYPES = Object.freeze({
  users: 'users',
  submissions: 'submissions',
  topics: 'topics',
  'similarity-snapshots': 'similarity-snapshots',
  'audit-logs': 'audit-logs',
  'supervisee-assignments': 'supervisee-assignments'
});

class AdminReportExportServiceError extends Error {
  constructor(message, { code = 'ADMIN_REPORT_EXPORT_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'AdminReportExportServiceError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function normalizeExportType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (!Object.values(EXPORT_TYPES).includes(normalized)) {
    throw new AdminReportExportServiceError('Unsupported report export type.', {
      code: 'ADMIN_REPORT_EXPORT_INVALID_TYPE',
      field: 'type'
    });
  }

  return normalized;
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

function parseDate(value, field) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new AdminReportExportServiceError(`${field} must be a valid ISO date.`, {
      code: 'ADMIN_REPORT_EXPORT_INVALID_DATE',
      field
    });
  }

  return date;
}

function toIso(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toClientEnum(value) {
  return String(value || '').toLowerCase();
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function createCsv(headers, rows) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ];

  return `${lines.join('\n')}\n`;
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function createFilename(type, date = new Date()) {
  return `admin-${type}-export-${safeTimestamp(date)}.csv`;
}

function sanitizeFilters(query = {}) {
  const safeKeys = [
    'role',
    'status',
    'lifecycle',
    'category',
    'sessionYear',
    'actorRole',
    'eventType',
    'dateFrom',
    'dateTo'
  ];

  return safeKeys.reduce((filters, key) => {
    const value = normalizeString(query[key]);
    if (value) {
      filters[key] = value;
    }
    return filters;
  }, {});
}

function buildDateWhere(field, query = {}) {
  const dateFrom = parseDate(query.dateFrom, 'dateFrom');
  const dateTo = parseDate(query.dateTo, 'dateTo');

  if (!dateFrom && !dateTo) {
    return {};
  }

  return {
    [field]: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {})
    }
  };
}

function normalizeRole(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const role = normalized.toUpperCase();
  if (!['STUDENT', 'LECTURER', 'ADMIN'].includes(role)) {
    throw new AdminReportExportServiceError('Unsupported role filter.', {
      code: 'ADMIN_REPORT_EXPORT_INVALID_ROLE',
      field: 'role'
    });
  }

  return role;
}

function normalizeUserStatus(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const status = normalized.toUpperCase();
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    throw new AdminReportExportServiceError('Unsupported status filter.', {
      code: 'ADMIN_REPORT_EXPORT_INVALID_STATUS',
      field: 'status'
    });
  }

  return status;
}

function normalizeSubmissionStatus(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const status = normalized.replace(/-/g, '_').toUpperCase();
  if (!['PENDING_REVIEW', 'AWAITING_REVISION', 'APPROVED', 'REJECTED'].includes(status)) {
    throw new AdminReportExportServiceError('Unsupported submission status filter.', {
      code: 'ADMIN_REPORT_EXPORT_INVALID_STATUS',
      field: 'status'
    });
  }

  return status;
}

function normalizeLifecycle(value) {
  const normalized = normalizeString(value);
  if (!normalized || normalized === 'all') {
    return null;
  }

  const lifecycle = normalized.toLowerCase().replace(/_/g, '-');
  if (!['historical', 'current-session', 'under-review'].includes(lifecycle)) {
    throw new AdminReportExportServiceError('Unsupported topic lifecycle filter.', {
      code: 'ADMIN_REPORT_EXPORT_INVALID_LIFECYCLE',
      field: 'lifecycle'
    });
  }

  return lifecycle;
}

function contains(value) {
  return {
    contains: value,
    mode: 'insensitive'
  };
}

function createAdminReportExportService({
  prismaClient = prisma,
  audit = { createAuditLogSafely }
} = {}) {
  const exportUsers = async (query) => {
    const role = normalizeRole(query.role);
    const status = normalizeUserStatus(query.status);
    const rows = await prismaClient.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {})
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS
    });

    return {
      headers: ['id', 'name', 'email', 'role', 'status', 'createdAt', 'updatedAt'],
      rows: rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: toClientEnum(user.role),
        status: toClientEnum(user.status),
        createdAt: toIso(user.createdAt),
        updatedAt: toIso(user.updatedAt)
      }))
    };
  };

  const exportSubmissions = async (query) => {
    const status = normalizeSubmissionStatus(query.status);
    const category = normalizeString(query.category);
    const rows = await prismaClient.submission.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(category ? { category: contains(category) } : {}),
        ...buildDateWhere('submittedAt', query)
      },
      select: {
        id: true,
        title: true,
        category: true,
        keywords: true,
        status: true,
        submittedAt: true,
        decidedAt: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        decidedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' },
      take: MAX_EXPORT_ROWS
    });

    return {
      headers: [
        'id',
        'title',
        'category',
        'keywords',
        'status',
        'studentId',
        'studentName',
        'studentEmail',
        'decidedById',
        'decidedByName',
        'decidedByEmail',
        'submittedAt',
        'decidedAt'
      ],
      rows: rows.map((submission) => ({
        id: submission.id,
        title: submission.title,
        category: submission.category,
        keywords: submission.keywords,
        status: toClientEnum(submission.status),
        studentId: submission.student?.id,
        studentName: submission.student?.name,
        studentEmail: submission.student?.email,
        decidedById: submission.decidedBy?.id,
        decidedByName: submission.decidedBy?.name,
        decidedByEmail: submission.decidedBy?.email,
        submittedAt: toIso(submission.submittedAt),
        decidedAt: toIso(submission.decidedAt)
      }))
    };
  };

  const exportTopics = async (query) => {
    const lifecycle = normalizeLifecycle(query.lifecycle);
    const category = normalizeString(query.category);
    const sessionYear = normalizeString(query.sessionYear);
    const where = {
      ...(category ? { category: contains(category) } : {}),
      ...(sessionYear ? { sessionYear: contains(sessionYear) } : {})
    };
    const configs = {
      historical: ['historical', 'historicalTopic'],
      'current-session': ['current-session', 'currentSessionTopic'],
      'under-review': ['under-review', 'underReviewTopic']
    };
    const entries = lifecycle ? [configs[lifecycle]] : Object.values(configs);
    const groups = await Promise.all(entries.map(async ([label, model]) => {
      const rows = await prismaClient[model].findMany({
        where,
        select: {
          id: true,
          title: true,
          keywords: true,
          category: true,
          sessionYear: true,
          supervisorName: true,
          sourceType: true,
          sourceFilename: true,
          importBatchId: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        take: MAX_EXPORT_ROWS
      });

      return rows.map((topic) => ({
        lifecycle: label,
        ...topic
      }));
    }));
    const rows = groups.flat().slice(0, MAX_EXPORT_ROWS);

    return {
      headers: [
        'id',
        'lifecycle',
        'title',
        'keywords',
        'category',
        'sessionYear',
        'supervisorName',
        'sourceType',
        'sourceFilename',
        'importBatchId',
        'createdAt',
        'updatedAt'
      ],
      rows: rows.map((topic) => ({
        ...topic,
        createdAt: toIso(topic.createdAt),
        updatedAt: toIso(topic.updatedAt)
      }))
    };
  };

  const exportSimilaritySnapshots = async (query) => {
    const responseStatus = normalizeString(query.status);
    const risk = normalizeString(query.risk);
    const rows = await prismaClient.similarityCheckSnapshot.findMany({
      where: {
        ...(responseStatus ? { responseStatus: contains(responseStatus) } : {}),
        ...(risk ? { overallRisk: contains(risk) } : {}),
        ...buildDateWhere('createdAt', query)
      },
      select: {
        id: true,
        submissionId: true,
        checkedById: true,
        responseStatus: true,
        overallRisk: true,
        maxSimilarity: true,
        createdAt: true,
        checkedBy: {
          select: {
            name: true,
            email: true
          }
        },
        submission: {
          select: {
            title: true,
            category: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS
    });

    return {
      headers: [
        'id',
        'submissionId',
        'submissionTitle',
        'submissionCategory',
        'submissionStatus',
        'checkedById',
        'checkedByName',
        'checkedByEmail',
        'responseStatus',
        'overallRisk',
        'maxSimilarity',
        'createdAt'
      ],
      rows: rows.map((snapshot) => ({
        id: snapshot.id,
        submissionId: snapshot.submissionId,
        submissionTitle: snapshot.submission?.title,
        submissionCategory: snapshot.submission?.category,
        submissionStatus: toClientEnum(snapshot.submission?.status),
        checkedById: snapshot.checkedById,
        checkedByName: snapshot.checkedBy?.name,
        checkedByEmail: snapshot.checkedBy?.email,
        responseStatus: snapshot.responseStatus,
        overallRisk: snapshot.overallRisk,
        maxSimilarity: snapshot.maxSimilarity,
        createdAt: toIso(snapshot.createdAt)
      }))
    };
  };

  const exportAuditLogs = async (query) => {
    const actorRole = normalizeString(query.actorRole);
    const eventType = normalizeString(query.eventType);
    const rows = await prismaClient.auditLog.findMany({
      where: {
        ...(actorRole ? { actorRole } : {}),
        ...(eventType ? { eventType } : {}),
        ...buildDateWhere('createdAt', query)
      },
      select: {
        id: true,
        eventType: true,
        actorId: true,
        actorRole: true,
        actorEmail: true,
        targetType: true,
        targetId: true,
        requestId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS
    });

    return {
      headers: [
        'id',
        'eventType',
        'actorId',
        'actorRole',
        'actorEmail',
        'targetType',
        'targetId',
        'requestId',
        'createdAt'
      ],
      rows: rows.map((log) => ({
        ...log,
        createdAt: toIso(log.createdAt)
      }))
    };
  };

  const exportSuperviseeAssignments = async (query) => {
    const status = normalizeString(query.status);
    if (status && !['active', 'ended', 'all'].includes(status.toLowerCase())) {
      throw new AdminReportExportServiceError('Unsupported assignment status filter.', {
        code: 'ADMIN_REPORT_EXPORT_INVALID_STATUS',
        field: 'status'
      });
    }

    const rows = await prismaClient.lecturerSuperviseeAssignment.findMany({
      where: {
        ...(status && status.toLowerCase() !== 'all' ? { isActive: status.toLowerCase() === 'active' } : {}),
        ...buildDateWhere('assignedAt', query)
      },
      include: {
        lecturer: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, matricNumber: true, email: true } },
        assignedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: [
        { isActive: 'desc' },
        { assignedAt: 'desc' }
      ],
      take: MAX_EXPORT_ROWS
    });

    return {
      headers: [
        'id',
        'status',
        'lecturerId',
        'lecturerName',
        'lecturerEmail',
        'studentId',
        'studentName',
        'studentMatricNumber',
        'studentEmail',
        'assignedById',
        'assignedByName',
        'assignedByEmail',
        'assignedAt',
        'endedAt'
      ],
      rows: rows.map((assignment) => ({
        id: assignment.id,
        status: assignment.isActive ? 'active' : 'ended',
        lecturerId: assignment.lecturer?.id,
        lecturerName: assignment.lecturer?.name,
        lecturerEmail: assignment.lecturer?.email,
        studentId: assignment.student?.id,
        studentName: assignment.student?.name,
        studentMatricNumber: assignment.student?.matricNumber || null,
        studentEmail: assignment.student?.email,
        assignedById: assignment.assignedBy?.id,
        assignedByName: assignment.assignedBy?.name,
        assignedByEmail: assignment.assignedBy?.email,
        assignedAt: toIso(assignment.assignedAt),
        endedAt: toIso(assignment.endedAt)
      }))
    };
  };

  const exporters = {
    users: exportUsers,
    submissions: exportSubmissions,
    topics: exportTopics,
    'similarity-snapshots': exportSimilaritySnapshots,
    'audit-logs': exportAuditLogs,
    'supervisee-assignments': exportSuperviseeAssignments
  };

  const exportReport = async ({ type, query = {}, req } = {}) => {
    const exportType = normalizeExportType(type);
    const generatedAt = new Date();
    const result = await exporters[exportType](query);
    const body = createCsv(result.headers, result.rows);
    const filters = sanitizeFilters(query);

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.REPORT_EXPORTED,
      ...buildAuditContextFromRequest(req),
      targetType: 'AdminReportExport',
      targetId: exportType,
      metadata: {
        exportType,
        rowCount: result.rows.length,
        filters,
        maxRows: MAX_EXPORT_ROWS
      }
    });

    return {
      body,
      contentType: CSV_CONTENT_TYPE,
      filename: createFilename(exportType, generatedAt),
      rowCount: result.rows.length,
      type: exportType
    };
  };

  return {
    exportReport
  };
}

module.exports = {
  ...createAdminReportExportService(),
  createAdminReportExportService,
  AdminReportExportServiceError,
  CSV_CONTENT_TYPE,
  EXPORT_TYPES,
  MAX_EXPORT_ROWS,
  createCsv,
  csvEscape
};
