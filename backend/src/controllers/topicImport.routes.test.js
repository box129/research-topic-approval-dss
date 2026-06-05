const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/topicImportFile.service', () => ({
  normalizeTopicImportFile: jest.fn()
}));

jest.mock('../services/topicImportPersistence.service', () => ({
  persistNormalizedTopicImport: jest.fn()
}));

jest.mock('../services/auditLog.service', () => ({
  AUDIT_EVENT_TYPES: {
    TOPIC_IMPORT_PREVIEWED: 'TOPIC_IMPORT_PREVIEWED',
    TOPIC_IMPORT_COMMITTED: 'TOPIC_IMPORT_COMMITTED'
  },
  buildAuditContextFromRequest: jest.fn((req) => ({
    actorId: req.user?.id,
    actorRole: req.user?.role,
    actorEmail: req.user?.email
  })),
  createAuditLogSafely: jest.fn()
}));

const authService = require('../services/auth.service');
const topicImportFileService = require('../services/topicImportFile.service');
const topicImportPersistenceService = require('../services/topicImportPersistence.service');
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

function createSuccessImportResult() {
  return {
    metadata: {
      sheet_name: 'Topics',
      total_parsed_rows: 1,
      warnings: []
    },
    records: [
      {
        title: 'Imported Topic',
        lifecycle_bucket: 'historical',
        raw_record: { session_year: '2024/2025' },
        warnings: []
      }
    ],
    report: {
      total_rows: 1,
      accepted_rows: 1,
      skipped_rows: 0,
      missing_title_rows: 0,
      incomplete_context_rows: 0,
      duplicate_title_rows: 0
    }
  };
}

describe('Admin-protected topic import routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    topicImportFileService.normalizeTopicImportFile.mockResolvedValue(createSuccessImportResult());
    topicImportPersistenceService.persistNormalizedTopicImport.mockResolvedValue({
      attempted_records: 1,
      inserted_records: 1,
      failed_records: 0,
      skipped_records: 0,
      inserted_by_bucket: {
        historical: 1,
        current_session: 0,
        under_review: 0
      },
      warnings: [],
      errors: []
    });
  });

  test('unauthenticated users cannot call operational import preview', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .post('/api/v1/admin/import/topics/preview')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(topicImportFileService.normalizeTopicImportFile).not.toHaveBeenCalled();
  });

  test('non-admin users cannot call operational import commit', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .post('/api/v1/admin/import/topics/commit')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(topicImportPersistenceService.persistNormalizedTopicImport).not.toHaveBeenCalled();
  });

  test('admin preview route parses file and emits import preview audit event', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);

    const response = await request(app)
      .post('/api/v1/admin/import/topics/preview')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .field('sheetName', 'Topics')
      .attach('file', Buffer.from('xlsx-placeholder'), {
        filename: 'topics.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        mode: 'preview',
        import_report: {
          accepted_rows: 1
        }
      }
    });
    expect(auditLogService.createAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TOPIC_IMPORT_PREVIEWED',
        actorId: adminUser.id,
        actorRole: 'admin',
        actorEmail: adminUser.email,
        targetType: 'TopicImport',
        metadata: expect.objectContaining({
          mode: 'preview',
          filename: 'topics.xlsx',
          report: expect.objectContaining({
            acceptedRows: 1
          })
        })
      })
    );
  });

  test('admin commit route persists records and emits import commit audit event', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);

    const response = await request(app)
      .post('/api/v1/admin/import/topics/commit')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .field('importBatchId', 'batch-2026')
      .attach('file', Buffer.from('xlsx-placeholder'), {
        filename: 'topics.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        mode: 'commit',
        persistence_report: {
          inserted_records: 1
        }
      }
    });
    expect(auditLogService.createAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TOPIC_IMPORT_COMMITTED',
        actorId: adminUser.id,
        actorRole: 'admin',
        actorEmail: adminUser.email,
        targetType: 'TopicImport',
        targetId: 'batch-2026',
        metadata: expect.objectContaining({
          mode: 'commit',
          filename: 'topics.xlsx',
          importBatchId: 'batch-2026',
          persistenceReport: expect.objectContaining({
            insertedRecords: 1
          })
        })
      })
    );
  });
});
