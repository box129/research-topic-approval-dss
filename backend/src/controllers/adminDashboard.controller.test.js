const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminDashboard.service', () => ({
  getDashboardSummary: jest.fn()
}));

const authService = require('../services/auth.service');
const adminDashboardService = require('../services/adminDashboard.service');
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

const dashboardSummary = {
  data: {
    users: {
      total: 6,
      students: 3,
      lecturers: 2,
      admins: 1,
      active: 5,
      suspended: 1,
      status: 'available'
    },
    submissions: {
      total: 8,
      pendingReview: 4,
      awaitingRevision: 1,
      approved: 2,
      rejected: 1,
      status: 'available'
    },
    topics: {
      total: 45,
      historical: 30,
      currentSession: 10,
      underReview: 5,
      status: 'available'
    },
    similarityChecks: {
      snapshots: 7,
      highRisk: 1,
      mediumRisk: 2,
      lowRisk: 4,
      status: 'available',
      notes: ['Risk distribution includes stored lecturer similarity snapshots only.']
    },
    serviceHealth: {
      api: { status: 'available', message: 'API process responded.' },
      database: { status: 'available', message: 'Database counts were read.' },
      semanticProvider: {
        status: 'unknown',
        provider: 'voyage',
        model: 'voyage-4-large',
        message: 'Voyage semantic provider (voyage-4-large) health is not checked by this dashboard endpoint yet.'
      }
    },
    warnings: []
  },
  meta: {
    generatedAt: '2026-06-05T15:37:00.000Z',
    dataCoverage: 'Read-only counts from existing tables.'
  }
};

describe('Admin dashboard summary API route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can read dashboard summary counts', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminDashboardService.getDashboardSummary.mockResolvedValue(dashboardSummary);

    const response = await request(app)
      .get('/api/v1/admin/dashboard/summary')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: dashboardSummary.data,
      meta: dashboardSummary.meta
    });
    expect(adminDashboardService.getDashboardSummary).toHaveBeenCalledTimes(1);
  });

  test('non-admin cannot read dashboard summary', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/dashboard/summary')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(adminDashboardService.getDashboardSummary).not.toHaveBeenCalled();
  });

  test('unauthenticated users cannot read dashboard summary', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/admin/dashboard/summary')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(adminDashboardService.getDashboardSummary).not.toHaveBeenCalled();
  });

  test('dashboard summary route is read-only and does not expose admin mutation affordances', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminDashboardService.getDashboardSummary.mockResolvedValue(dashboardSummary);

    const response = await request(app)
      .get('/api/v1/admin/dashboard/summary')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).not.toHaveProperty('data.reports');
    expect(response.body).not.toHaveProperty('data.exports');
    expect(response.body).not.toHaveProperty('data.actions');
    expect(adminDashboardService.getDashboardSummary).toHaveBeenCalledTimes(1);
  });
});
