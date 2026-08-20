const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn(),
  changePassword: jest.fn(),
  getClearCookieOptions: jest.fn(() => ({ httpOnly: true, sameSite: 'lax', secure: false })),
  getCookieOptions: jest.fn(() => ({ httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 })),
  login: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn()
}));

const authService = require('../services/auth.service');
const app = require('../server');

const pendingPasswordChangeUser = {
  id: 12,
  name: 'Provisioned Student',
  email: 'provisioned.student@uniosun.edu.ng',
  role: 'student',
  status: 'active',
  matricNumber: 'CSC/21/0451',
  mustChangePassword: true
};

describe('forced password change enforcement (server-side)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normal protected APIs return 403 PASSWORD_CHANGE_REQUIRED while the change is pending', async () => {
    authService.authenticateToken.mockResolvedValue(pendingPasswordChangeUser);

    const routes = [
      ['get', '/api/v1/submissions'],
      ['post', '/api/v1/submissions'],
      ['get', '/api/v1/notifications'],
      ['get', '/api/v1/admin/users']
    ];

    for (const [method, route] of routes) {
      const response = await request(app)[method](route)
        .set('Cookie', ['rtadss_session=temp-credential-token']);
      expect(response.status).toBe(403);
      expect(response.body.details.error_code).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  test('/auth/me stays reachable so the client can detect the forced-change state', async () => {
    authService.authenticateToken.mockResolvedValue(pendingPasswordChangeUser);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', ['rtadss_session=temp-credential-token'])
      .expect(200);

    expect(response.body.data.user.mustChangePassword).toBe(true);
  });

  test('/auth/change-password stays reachable while the change is pending', async () => {
    authService.authenticateToken.mockResolvedValue(pendingPasswordChangeUser);
    authService.changePassword.mockResolvedValue({
      token: 'new-session-token',
      user: { ...pendingPasswordChangeUser, mustChangePassword: false },
      message: 'Password has been changed.'
    });

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', ['rtadss_session=temp-credential-token'])
      .send({ currentPassword: 'TempPass123', newPassword: 'PrivatePass9' })
      .expect(200);

    expect(response.body.data.user.mustChangePassword).toBe(false);
    expect(response.headers['set-cookie'][0]).toContain('rtadss_session=new-session-token');
  });

  test('users without a pending change pass through normal guards unchanged', async () => {
    authService.authenticateToken.mockResolvedValue({
      ...pendingPasswordChangeUser,
      mustChangePassword: false
    });

    // Role guard should now be the deciding factor, not the password gate.
    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', ['rtadss_session=normal-token']);

    expect(response.status).toBe(403);
    expect(response.body.details.error_code).toBe('FORBIDDEN');
  });

  test('unauthenticated requests still receive 401', async () => {
    authService.authenticateToken.mockRejectedValue(Object.assign(
      new Error('Authentication required.'),
      { statusCode: 401, code: 'AUTHENTICATION_REQUIRED' }
    ));

    const response = await request(app).get('/api/v1/submissions');
    expect(response.status).toBe(401);
  });
});
