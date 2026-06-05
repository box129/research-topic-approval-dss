const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/auditLog.service', () => {
  class AuditLogServiceError extends Error {
    constructor(message, statusCode, code, field) {
      super(message);
      this.name = 'AuditLogServiceError';
      this.statusCode = statusCode;
      this.code = code;
      this.field = field;
    }
  }

  return {
    AuditLogServiceError,
    listAuditLogs: jest.fn(),
    getAuditLogById: jest.fn(),
    createAuditLogSafely: jest.fn(),
    AUDIT_EVENT_TYPES: {
      TOPIC_IMPORT_PREVIEWED: 'TOPIC_IMPORT_PREVIEWED',
      TOPIC_IMPORT_COMMITTED: 'TOPIC_IMPORT_COMMITTED'
    },
    buildAuditContextFromRequest: jest.fn(() => ({
      actorId: 1,
      actorRole: 'admin',
      actorEmail: 'admin.demo@uniosun.edu.ng'
    }))
  };
});

const authService = require('../services/auth.service');
const auditLogService = require('../services/auditLog.service');
const app = require('../server');

const adminUser = {
  id: 1,
  name: 'Admin Demo',
  email: 'admin.demo@uniosun.edu.ng',
  role: 'admin',
  status: 'active'
};

const lecturerUser = {
  id: 2,
  name: 'Lecturer Demo',
  email: 'lecturer.demo@uniosun.edu.ng',
  role: 'lecturer',
  status: 'active'
};

describe('Admin audit log API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can list audit logs with pagination metadata', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    auditLogService.listAuditLogs.mockResolvedValue({
      items: [
        {
          id: 10,
          event_type: 'TOPIC_IMPORT_PREVIEWED',
          actor: { id: 1, role: 'admin', email: 'admin.demo@uniosun.edu.ng' },
          target: { type: 'TopicImport', id: null },
          request: { id: null, ip_address: '127.0.0.1', user_agent: 'jest' },
          metadata: { filename: 'topics.xlsx' },
          created_at: '2026-06-05T15:37:00.000Z'
        }
      ],
      pagination: {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      },
      filters: {
        eventType: 'TOPIC_IMPORT_PREVIEWED'
      }
    });

    const response = await request(app)
      .get('/api/v1/admin/audit-logs?eventType=TOPIC_IMPORT_PREVIEWED')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        items: expect.any(Array)
      },
      meta: {
        pagination: expect.objectContaining({ total: 1 }),
        filters: expect.objectContaining({ eventType: 'TOPIC_IMPORT_PREVIEWED' })
      }
    });
    expect(auditLogService.listAuditLogs).toHaveBeenCalledWith({
      filters: expect.objectContaining({ eventType: 'TOPIC_IMPORT_PREVIEWED' }),
      page: undefined,
      limit: undefined
    });
  });

  test('non-admin cannot list audit logs', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(auditLogService.listAuditLogs).not.toHaveBeenCalled();
  });

  test('unauthenticated users cannot list audit logs', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(auditLogService.listAuditLogs).not.toHaveBeenCalled();
  });

  test('admin can read audit log detail', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    auditLogService.getAuditLogById.mockResolvedValue({
      id: 10,
      event_type: 'TOPIC_IMPORT_COMMITTED',
      metadata: { insertedRecords: 1 },
      created_at: '2026-06-05T15:37:00.000Z'
    });

    const response = await request(app)
      .get('/api/v1/admin/audit-logs/10')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        audit_log: expect.objectContaining({
          id: 10,
          event_type: 'TOPIC_IMPORT_COMMITTED'
        })
      }
    });
    expect(auditLogService.getAuditLogById).toHaveBeenCalledWith('10');
  });

  test('missing audit log detail returns not found', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    auditLogService.getAuditLogById.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/admin/audit-logs/404')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'AUDIT_LOG_NOT_FOUND',
        message: 'Audit log not found.'
      }
    });
  });

  test('invalid audit log id returns validation error', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    auditLogService.getAuditLogById.mockRejectedValue(
      new auditLogService.AuditLogServiceError(
        'Audit log id must be a positive integer.',
        400,
        'INVALID_AUDIT_LOG_ID',
        'id'
      )
    );

    const response = await request(app)
      .get('/api/v1/admin/audit-logs/not-a-number')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_AUDIT_LOG_ID',
        message: 'Audit log id must be a positive integer.',
        field: 'id'
      }
    });
  });
});
