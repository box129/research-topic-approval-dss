const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn(),
  forgotPassword: jest.fn(),
  getClearCookieOptions: jest.fn(() => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  })),
  getCookieOptions: jest.fn(() => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  })),
  login: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn()
}));

const authService = require('../services/auth.service');
const app = require('../server');

describe('Auth API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/v1/auth/login sets httpOnly session cookie and returns user profile', async () => {
    authService.login.mockResolvedValue({
      token: 'signed-test-token',
      user: {
        id: 1,
        name: 'Admin Demo',
        email: 'admin.demo@uniosun.edu.ng',
        role: 'admin',
        status: 'active'
      }
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.demo@uniosun.edu.ng',
        password: 'DemoPass123'
      })
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      data: {
        user: {
          id: 1,
          name: 'Admin Demo',
          email: 'admin.demo@uniosun.edu.ng',
          role: 'admin',
          status: 'active'
        }
      }
    });
    expect(response.headers['set-cookie'][0]).toContain('rtadss_session=signed-test-token');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
  });

  test('does not expose an unexpected authentication service error', async () => {
    authService.login.mockRejectedValue(new Error('database password or internal host detail'));

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'ExamplePass123' })
      .expect(500);

    expect(response.body).toEqual({
      status: 'error',
      message: 'Authentication service is temporarily unavailable.',
      details: { error_code: 'AUTH_SERVICE_UNAVAILABLE' }
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|internal host/i);
  });

  test('POST /api/v1/auth/logout clears the session cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'success');
    expect(response.headers['set-cookie'][0]).toContain('rtadss_session=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  test('GET /api/v1/auth/me returns the authenticated user', async () => {
    authService.authenticateToken.mockResolvedValue({
      id: 2,
      name: 'Lecturer Demo',
      email: 'lecturer.demo@uniosun.edu.ng',
      role: 'lecturer',
      status: 'active'
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', ['rtadss_session=signed-test-token'])
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      data: {
        user: {
          id: 2,
          name: 'Lecturer Demo',
          email: 'lecturer.demo@uniosun.edu.ng',
          role: 'lecturer',
          status: 'active'
        }
      }
    });
    expect(authService.authenticateToken).toHaveBeenCalledWith('signed-test-token');
  });

  test('GET /api/v1/auth/me rejects missing sessions', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
  });

  test('POST /api/v1/auth/forgot-password returns generic success', async () => {
    authService.requestPasswordReset.mockResolvedValue({
      message: 'If that email exists, a password reset link has been sent.'
    });

    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'student.demo@uniosun.edu.ng' })
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      message: 'If that email exists, a password reset link has been sent.'
    });
  });

  test('POST /api/v1/auth/reset-password supports reset flow', async () => {
    authService.resetPassword.mockResolvedValue({
      message: 'Password has been reset.'
    });

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'reset-token',
        password: 'NewPass123'
      })
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      message: 'Password has been reset.'
    });
  });
});
