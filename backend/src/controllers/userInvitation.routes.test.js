const request = require('supertest');

jest.mock('../services/auth.service', () => {
  const actual = jest.requireActual('../services/auth.service');
  return {
    ...actual,
    authenticateToken: jest.fn()
  };
});

jest.mock('../services/userInvitation.service', () => {
  const actual = jest.requireActual('../services/userInvitation.service');
  return {
    ...actual,
    issueInvitation: jest.fn(),
    sendBulkInvitations: jest.fn(),
    validateInvitationToken: jest.fn(),
    acceptInvitation: jest.fn()
  };
});

const authService = require('../services/auth.service');
const userInvitationService = require('../services/userInvitation.service');
const { UserInvitationError } = jest.requireActual('../services/userInvitation.service');
const app = require('../server');

const adminUser = { id: 1, name: 'Admin', email: 'admin@uniosun.edu.ng', role: 'admin', status: 'active' };
const studentUser = { ...adminUser, id: 2, role: 'student', email: 'student@uniosun.edu.ng' };
const lecturerUser = { ...adminUser, id: 3, role: 'lecturer', email: 'lecturer@uniosun.edu.ng' };

const sentResult = {
  user: {
    id: 5,
    name: 'Synthetic Student',
    email: 'synthetic.student@uniosun.edu.ng',
    role: 'student',
    status: 'active',
    matricNumber: null,
    mustChangePassword: true,
    invitation: { status: 'pending', lastSentAt: '2026-08-23T10:00:00.000Z', lastAttemptAt: '2026-08-23T10:00:00.000Z', acceptedAt: null, expiresAt: '2026-08-30T10:00:00.000Z', lastError: null }
  },
  invitation: { status: 'pending' },
  delivery: { status: 'sent', provider: 'smtp', providerStatus: 'sent' }
};

describe('invitation routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userInvitationService.issueInvitation.mockResolvedValue(sentResult);
    userInvitationService.sendBulkInvitations.mockResolvedValue({
      summary: { requested: 2, sent: 2, failed: 0, skipped: 0 },
      results: [
        { userId: 5, status: 'sent', email: 'a@uniosun.edu.ng' },
        { userId: 6, status: 'sent', email: 'b@uniosun.edu.ng' }
      ]
    });
    userInvitationService.validateInvitationToken.mockResolvedValue({
      valid: true,
      account: { name: 'Synthetic Student', email: 'synthetic.student@uniosun.edu.ng', role: 'student' },
      expiresAt: '2026-08-30T10:00:00.000Z'
    });
    userInvitationService.acceptInvitation.mockResolvedValue({
      token: 'signed.jwt.session',
      user: { id: 5, name: 'Synthetic Student', email: 'synthetic.student@uniosun.edu.ng', role: 'student', status: 'active', matricNumber: null, mustChangePassword: false },
      message: 'Your password has been set. You are now signed in.'
    });
  });

  describe('admin authorization on invitation sending', () => {
    test.each([
      ['individual', () => request(app).post('/api/v1/admin/users/5/invite')],
      ['bulk', () => request(app).post('/api/v1/admin/users/invitations/bulk').send({ userIds: [5] })]
    ])('unauthenticated %s invitation is denied', async (_label, makeRequest) => {
      authService.authenticateToken.mockRejectedValue({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' });

      const response = await makeRequest().expect(401);
      expect(response.body.details.error_code).toBe('AUTHENTICATION_REQUIRED');
      expect(userInvitationService.issueInvitation).not.toHaveBeenCalled();
      expect(userInvitationService.sendBulkInvitations).not.toHaveBeenCalled();
    });

    test.each([
      ['student', studentUser, 'individual', () => request(app).post('/api/v1/admin/users/5/invite')],
      ['student', studentUser, 'bulk', () => request(app).post('/api/v1/admin/users/invitations/bulk').send({ userIds: [5] })],
      ['lecturer', lecturerUser, 'individual', () => request(app).post('/api/v1/admin/users/5/invite')],
      ['lecturer', lecturerUser, 'bulk', () => request(app).post('/api/v1/admin/users/invitations/bulk').send({ userIds: [5] })]
    ])('%s cannot trigger %s invitations', async (_role, user, _label, makeRequest) => {
      authService.authenticateToken.mockResolvedValue(user);

      const response = await makeRequest().set('Cookie', ['rtadss_session=token']).expect(403);
      expect(response.body.details.error_code).toBe('FORBIDDEN');
      expect(userInvitationService.issueInvitation).not.toHaveBeenCalled();
      expect(userInvitationService.sendBulkInvitations).not.toHaveBeenCalled();
    });

    test('admin invitation returns delivery status with no-store semantics and no token material', async () => {
      authService.authenticateToken.mockResolvedValue(adminUser);

      const response = await request(app)
        .post('/api/v1/admin/users/5/invite')
        .set('Cookie', ['rtadss_session=token'])
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body.data.delivery.status).toBe('sent');
      const payload = JSON.stringify(response.body);
      expect(payload).not.toContain('invitationTokenHash');
      expect(payload).not.toMatch(/token"/i);
    });

    test('admin bulk invitation reports truthful counts', async () => {
      authService.authenticateToken.mockResolvedValue(adminUser);

      const response = await request(app)
        .post('/api/v1/admin/users/invitations/bulk')
        .set('Cookie', ['rtadss_session=token'])
        .send({ userIds: [5, 6] })
        .expect(200);

      expect(response.body.data.summary).toEqual({ requested: 2, sent: 2, failed: 0, skipped: 0 });
      expect(userInvitationService.sendBulkInvitations).toHaveBeenCalledWith(expect.objectContaining({
        userIds: [5, 6],
        actor: adminUser
      }));
    });

    test('failed delivery is reported truthfully, not as success', async () => {
      authService.authenticateToken.mockResolvedValue(adminUser);
      userInvitationService.issueInvitation.mockResolvedValue({
        ...sentResult,
        delivery: { status: 'failed', reasonCode: 'smtp-connect-failed' }
      });

      const response = await request(app)
        .post('/api/v1/admin/users/5/invite')
        .set('Cookie', ['rtadss_session=token'])
        .expect(200);

      expect(response.body.data.delivery).toEqual({ status: 'failed', reasonCode: 'smtp-connect-failed' });
      expect(response.body.meta.deliveryNotice).toMatch(/could NOT be delivered/);
    });

    test('ineligible targets map to admin-surface errors', async () => {
      authService.authenticateToken.mockResolvedValue(adminUser);
      userInvitationService.issueInvitation.mockRejectedValue(
        new UserInvitationError('Only student or lecturer accounts can be invited.', { code: 'USER_INVITATION_ROLE_NOT_ALLOWED', statusCode: 403 })
      );

      const response = await request(app)
        .post('/api/v1/admin/users/1/invite')
        .set('Cookie', ['rtadss_session=token'])
        .expect(403);
      expect(response.body.error.code).toBe('USER_INVITATION_ROLE_NOT_ALLOWED');
    });
  });

  describe('public acceptance endpoints', () => {
    test('validate requires no session and returns only display identity with no-store', async () => {
      const response = await request(app)
        .post('/api/v1/auth/invitation/validate')
        .send({ token: 'a'.repeat(43) })
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body.data.account).toEqual({
        name: 'Synthetic Student',
        email: 'synthetic.student@uniosun.edu.ng',
        role: 'student'
      });
      expect(authService.authenticateToken).not.toHaveBeenCalled();
    });

    test('invalid tokens produce a neutral 400 without account information', async () => {
      userInvitationService.validateInvitationToken.mockRejectedValue(
        new UserInvitationError('This invitation link is invalid or has expired. Ask an administrator to send a new invitation.', { code: 'INVITATION_INVALID', statusCode: 400 })
      );

      const response = await request(app)
        .post('/api/v1/auth/invitation/validate')
        .send({ token: 'b'.repeat(43) })
        .expect(400);

      expect(response.body.details.error_code).toBe('INVITATION_INVALID');
      expect(JSON.stringify(response.body)).not.toContain('@');
    });

    test('accept establishes the standard session cookie and returns the signed-in user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/invitation/accept')
        .send({ token: 'c'.repeat(43), password: 'ValidPass123' })
        .expect(200);

      const setCookie = (response.headers['set-cookie'] || []).join(';');
      expect(setCookie).toContain('rtadss_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body.data.user.mustChangePassword).toBe(false);
      // The session JWT is delivered via cookie, not the response body.
      expect(JSON.stringify(response.body)).not.toContain('signed.jwt.session');
    });

    test('no public registration surface exists', async () => {
      for (const url of ['/api/v1/auth/register', '/api/v1/auth/signup', '/api/v1/register', '/api/v1/users']) {
        const response = await request(app).post(url).send({ email: 'x@example.edu', password: 'Pass1234' });
        expect(response.status).toBe(404);
      }
    });
  });
});
