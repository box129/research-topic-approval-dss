const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminSettings.service', () => ({
  listSettings: jest.fn()
}));

const authService = require('../services/auth.service');
const adminSettingsService = require('../services/adminSettings.service');
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

const settingsList = {
  data: {
    items: [
      {
        key: 'demo_auth_users_notice',
        value: 'Demo users are local-only and unsafe for production.',
        updatedAt: '2026-06-06T10:00:00.000Z',
        updatedBy: null
      }
    ]
  },
  meta: {
    generatedAt: '2026-06-06T10:00:00.000Z',
    dataCoverage: 'Read-only settings from SystemSetting table.',
    mutationStatus: 'Settings updates remain deferred until key-specific validation is approved.'
  }
};

describe('Admin settings API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can list system settings', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminSettingsService.listSettings.mockResolvedValue(settingsList);

    const response = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: settingsList.data,
      meta: settingsList.meta
    });
    expect(adminSettingsService.listSettings).toHaveBeenCalledTimes(1);
  });

  test('admin settings list can return an empty real-data response', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminSettingsService.listSettings.mockResolvedValue({
      ...settingsList,
      data: { items: [] }
    });

    const response = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body.data.items).toEqual([]);
  });

  test('non-admin users cannot list system settings', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(adminSettingsService.listSettings).not.toHaveBeenCalled();
  });

  test('unauthenticated users cannot list system settings', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/admin/settings')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(adminSettingsService.listSettings).not.toHaveBeenCalled();
  });

  test('settings endpoint does not expose mutation affordances', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminSettingsService.listSettings.mockResolvedValue(settingsList);

    const response = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).not.toHaveProperty('data.actions');
    expect(response.body).not.toHaveProperty('data.thresholdControls');
    expect(response.body.meta.mutationStatus).toMatch(/deferred/i);
  });
});
