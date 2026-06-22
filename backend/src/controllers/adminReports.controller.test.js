const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminReports.service', () => ({
  getReportsSummary: jest.fn()
}));

jest.mock('../services/adminReportExport.service', () => {
  class AdminReportExportServiceError extends Error {
    constructor(message, { code = 'ADMIN_REPORT_EXPORT_ERROR', field, statusCode = 400 } = {}) {
      super(message);
      this.name = 'AdminReportExportServiceError';
      this.code = code;
      this.field = field;
      this.statusCode = statusCode;
    }
  }

  return {
    AdminReportExportServiceError,
    exportReport: jest.fn()
  };
});

const authService = require('../services/auth.service');
const adminReportsService = require('../services/adminReports.service');
const adminReportExportService = require('../services/adminReportExport.service');
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

const reportsSummary = {
  data: {
    users: {
      total: 6,
      byRole: {
        students: 3,
        lecturers: 2,
        admins: 1
      },
      byStatus: {
        active: 5,
        suspended: 1
      }
    },
    submissions: {
      total: 8,
      byStatus: {
        pendingReview: 4,
        awaitingRevision: 1,
        approved: 2,
        rejected: 1
      },
      decisionCoverage: {
        decided: 4,
        pending: 4
      }
    },
    topics: {
      total: 45,
      byLifecycle: {
        historical: 30,
        currentSession: 10,
        underReview: 5
      }
    },
    similarityChecks: {
      snapshots: 7,
      byRisk: {
        high: 1,
        medium: 2,
        low: 4,
        unknown: 0
      },
      byResponseStatus: {
        success: 6,
        partialSuccess: 1,
        error: 0,
        other: 0
      },
      notes: ['Similarity report counts use stored lecturer snapshots only.']
    },
    auditLogs: {
      total: 4,
      byActorRole: {
        admin: 4,
        lecturer: 0,
        student: 0,
        unknown: 0
      },
      topEventTypes: [
        { eventType: 'USER_STATUS_CHANGED', count: 2 }
      ]
    },
    exports: {
      status: 'csv_available',
      message: 'CSV exports are available for safe admin report categories. PDF exports remain deferred.'
    },
    warnings: []
  },
  meta: {
    generatedAt: '2026-06-06T12:00:00.000Z',
    dataCoverage: 'Read-only report aggregates from existing tables.',
    sourceTables: ['User', 'Submission'],
    exportStatus: 'csv_available_pdf_deferred'
  }
};

describe('Admin reports API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can read report summary aggregates', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminReportsService.getReportsSummary.mockResolvedValue(reportsSummary);

    const response = await request(app)
      .get('/api/v1/admin/reports/summary')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: reportsSummary.data,
      meta: reportsSummary.meta
    });
    expect(adminReportsService.getReportsSummary).toHaveBeenCalledTimes(1);
  });

  test('non-admin users cannot read report summary', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/reports/summary')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(adminReportsService.getReportsSummary).not.toHaveBeenCalled();
  });

  test('unauthenticated users cannot read report summary', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/admin/reports/summary')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(adminReportsService.getReportsSummary).not.toHaveBeenCalled();
  });

  test('report summary route remains read-only and exposes no inline export file', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminReportsService.getReportsSummary.mockResolvedValue(reportsSummary);

    const response = await request(app)
      .get('/api/v1/admin/reports/summary')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body.data.exports).toEqual(expect.objectContaining({
      status: 'csv_available'
    }));
    expect(response.body.data).not.toHaveProperty('downloadUrl');
    expect(response.body.data).not.toHaveProperty('exportFile');
    expect(response.body.data).not.toHaveProperty('actions');
  });

  test('admin can export report CSV', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminReportExportService.exportReport.mockResolvedValue({
      body: 'id,name\n1,Ada Admin\n',
      contentType: 'text/csv; charset=utf-8',
      filename: 'admin-users-export-2026-06-22.csv',
      rowCount: 1,
      type: 'users'
    });

    const response = await request(app)
      .get('/api/v1/admin/reports/export/users')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.headers['content-disposition']).toBe('attachment; filename="admin-users-export-2026-06-22.csv"');
    expect(response.headers['x-report-export-type']).toBe('users');
    expect(response.headers['x-report-export-row-count']).toBe('1');
    expect(response.text).toBe('id,name\n1,Ada Admin\n');
    expect(adminReportExportService.exportReport).toHaveBeenCalledWith(expect.objectContaining({
      type: 'users',
      query: {},
      req: expect.any(Object)
    }));
  });

  test('non-admin users cannot export reports', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/reports/export/users')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(adminReportExportService.exportReport).not.toHaveBeenCalled();
  });

  test('invalid report export type is rejected', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminReportExportService.exportReport.mockRejectedValue(
      new adminReportExportService.AdminReportExportServiceError('Unsupported report export type.', {
        code: 'ADMIN_REPORT_EXPORT_INVALID_TYPE',
        field: 'type',
        statusCode: 400
      })
    );

    const response = await request(app)
      .get('/api/v1/admin/reports/export/pdf')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ADMIN_REPORT_EXPORT_INVALID_TYPE',
        message: 'Unsupported report export type.',
        field: 'type'
      }
    });
  });
});
