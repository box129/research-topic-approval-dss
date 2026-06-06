const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminReports.service', () => ({
  getReportsSummary: jest.fn()
}));

const authService = require('../services/auth.service');
const adminReportsService = require('../services/adminReports.service');
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
      status: 'deferred',
      message: 'Report export generation is not implemented.'
    },
    warnings: []
  },
  meta: {
    generatedAt: '2026-06-06T12:00:00.000Z',
    dataCoverage: 'Read-only report aggregates from existing tables.',
    sourceTables: ['User', 'Submission'],
    exportStatus: 'deferred'
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

  test('report summary route is read-only and exposes no export action', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminReportsService.getReportsSummary.mockResolvedValue(reportsSummary);

    const response = await request(app)
      .get('/api/v1/admin/reports/summary')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body.data.exports).toEqual(expect.objectContaining({
      status: 'deferred'
    }));
    expect(response.body.data).not.toHaveProperty('downloadUrl');
    expect(response.body.data).not.toHaveProperty('exportFile');
    expect(response.body.data).not.toHaveProperty('actions');
  });
});
