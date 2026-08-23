const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  createAuthService,
  hashLoginIdentifier,
  hashResetToken,
  serializeUser,
  validatePasswordPolicy
} = require('./auth.service');

const authConfig = {
  jwtSecret: 'test-secret',
  jwtExpiresIn: '24h',
  resetTokenExpiresMinutes: 30
};

function createPrismaMock(overrides = {}) {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      ...overrides.user
    }
  };
}

describe('auth.service', () => {
  test('validates documented password policy', () => {
    expect(validatePasswordPolicy('password')).toBe(false);
    expect(validatePasswordPolicy('short1')).toBe(false);
    expect(validatePasswordPolicy('Password1')).toBe(true);
  });

  test('serializes users without password or token fields', () => {
    expect(serializeUser({
      id: 1,
      name: 'Admin User',
      email: 'admin.demo@uniosun.edu.ng',
      passwordHash: 'hidden',
      resetTokenHash: 'hidden',
      role: 'ADMIN',
      status: 'ACTIVE',
      credentialVersion: 3
    })).toEqual({
      id: 1,
      name: 'Admin User',
      email: 'admin.demo@uniosun.edu.ng',
      role: 'admin',
      status: 'active',
      matricNumber: null,
      mustChangePassword: false
    });
  });

  test('logs in active users and returns a signed token carrying the credential version', async () => {
    const passwordHash = await bcrypt.hash('Password1', 4);
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 2,
          name: 'Lecturer Demo',
          email: 'lecturer.demo@uniosun.edu.ng',
          passwordHash,
          role: 'LECTURER',
          status: 'ACTIVE',
          credentialVersion: 4,
          mustChangePassword: true
        })
      }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig });

    const result = await service.login({
      email: 'LECTURER.DEMO@UNIOSUN.EDU.NG',
      password: 'Password1'
    });

    expect(result.user.role).toBe('lecturer');
    expect(result.user.mustChangePassword).toBe(true);
    expect(jwt.verify(result.token, authConfig.jwtSecret)).toMatchObject({
      sub: '2',
      role: 'lecturer',
      cv: 4
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'lecturer.demo@uniosun.edu.ng' }
    });
  });

  test('records failed logins with a hashed attempted identifier and no credentials or session material', async () => {
    const attemptedEmail = 'Unrecognized.Attempt@uniosun.edu.ng';
    const attemptedPassword = 'LoginPasswordSentinel9';
    const sessionToken = 'session-token-sentinel-that-must-not-be-audited';
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const prisma = createPrismaMock({
      user: { findUnique: jest.fn().mockResolvedValue(null) }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig, audit });

    await expect(service.login({
      email: attemptedEmail,
      password: attemptedPassword,
      req: {
        ip: '203.0.113.24',
        headers: {
          cookie: `session=${sessionToken}`,
          authorization: `Bearer ${sessionToken}`
        }
      }
    })).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });

    const event = audit.createAuditLogSafely.mock.calls[0][0];
    expect(event).toMatchObject({
      eventType: 'AUTH_LOGIN_FAILED',
      targetType: 'Authentication',
      targetId: null,
      ipAddress: '203.0.113.24',
      metadata: {
        reason: 'invalid-credentials',
        attemptedEmailHash: hashLoginIdentifier(attemptedEmail)
      }
    });
    expect(event.metadata).not.toHaveProperty('email');
    expect(event.metadata).not.toHaveProperty('password');
    expect(event.metadata).not.toHaveProperty('sessionToken');
    const eventJson = JSON.stringify(event);
    expect(eventJson).not.toContain(attemptedEmail);
    expect(eventJson).not.toContain(attemptedPassword);
    expect(eventJson).not.toContain(sessionToken);
  });

  test('records login and logout without including passwords or session tokens', async () => {
    const password = 'ValidPasswordSentinel9';
    const passwordHash = await bcrypt.hash(password, 4);
    const sessionToken = 'session-token-sentinel-that-must-not-be-audited';
    const user = {
      id: 21,
      name: 'Audited Lecturer',
      email: 'audited.lecturer@uniosun.edu.ng',
      passwordHash,
      role: 'LECTURER',
      status: 'ACTIVE',
      credentialVersion: 2,
      mustChangePassword: false
    };
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const prisma = createPrismaMock({
      user: { findUnique: jest.fn().mockResolvedValue(user) }
    });
    const request = {
      ip: '203.0.113.25',
      headers: {
        cookie: `session=${sessionToken}`,
        authorization: `Bearer ${sessionToken}`
      }
    };
    const service = createAuthService({ prismaClient: prisma, authConfig, audit });

    const loginResult = await service.login({
      email: user.email,
      password,
      req: request
    });
    await service.recordLogout({ user: loginResult.user, req: request });

    expect(audit.createAuditLogSafely).toHaveBeenCalledTimes(2);
    const [loginEvent, logoutEvent] = audit.createAuditLogSafely.mock.calls.map(([event]) => event);
    expect(loginEvent).toMatchObject({
      eventType: 'AUTH_LOGIN',
      actorId: user.id,
      targetId: String(user.id),
      metadata: { method: 'password' }
    });
    expect(logoutEvent).toMatchObject({
      eventType: 'AUTH_LOGOUT',
      actorId: user.id,
      targetId: String(user.id),
      metadata: { method: 'session-cookie-cleared' }
    });

    const eventsJson = JSON.stringify([loginEvent, logoutEvent]);
    expect(eventsJson).not.toContain(password);
    expect(eventsJson).not.toContain(sessionToken);
    expect(eventsJson).not.toContain(loginResult.token);
  });

  test('authenticateToken accepts tokens matching the stored credential version', async () => {
    const user = {
      id: 7,
      name: 'Student Demo',
      email: 'student.demo@uniosun.edu.ng',
      role: 'STUDENT',
      status: 'ACTIVE',
      credentialVersion: 2,
      mustChangePassword: false
    };
    const prisma = createPrismaMock({
      user: { findUnique: jest.fn().mockResolvedValue(user) }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig });
    const token = jwt.sign({ sub: '7', role: 'student', cv: 2 }, authConfig.jwtSecret);

    await expect(service.authenticateToken(token)).resolves.toMatchObject({
      id: 7,
      role: 'student'
    });
  });

  test('authenticateToken rejects tokens issued before a credential change', async () => {
    const user = {
      id: 7,
      role: 'STUDENT',
      status: 'ACTIVE',
      credentialVersion: 3
    };
    const prisma = createPrismaMock({
      user: { findUnique: jest.fn().mockResolvedValue(user) }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig });

    const staleToken = jwt.sign({ sub: '7', role: 'student', cv: 2 }, authConfig.jwtSecret);
    await expect(service.authenticateToken(staleToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_SESSION'
    });

    const legacyTokenWithoutVersion = jwt.sign({ sub: '7', role: 'student' }, authConfig.jwtSecret);
    await expect(service.authenticateToken(legacyTokenWithoutVersion)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_SESSION'
    });
  });

  test('rejects inactive users', async () => {
    const passwordHash = await bcrypt.hash('Password1', 4);
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 3,
          email: 'student.demo@uniosun.edu.ng',
          passwordHash,
          role: 'STUDENT',
          status: 'SUSPENDED'
        })
      }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig });

    await expect(service.login({
      email: 'student.demo@uniosun.edu.ng',
      password: 'Password1'
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_INACTIVE'
    });
  });

  test('forgot password stores only hashed reset tokens', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          name: 'Admin Demo',
          email: 'admin.demo@uniosun.edu.ng',
          role: 'ADMIN',
          status: 'ACTIVE'
        }),
        update: jest.fn().mockResolvedValue({})
      }
    });
    const emailProvider = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue({})
    };
    const notificationEvents = {
      notifyPasswordResetRequestedSafely: jest.fn().mockResolvedValue({ created: 1 })
    };
    const service = createAuthService({
      prismaClient: prisma,
      emailProvider,
      authConfig,
      notificationEvents
    });

    await service.requestPasswordReset({ email: 'admin.demo@uniosun.edu.ng' });

    const updateData = prisma.user.update.mock.calls[0][0].data;
    const emailArgs = emailProvider.sendPasswordResetEmail.mock.calls[0][0];
    const emailedToken = emailArgs.token;

    expect(updateData.resetTokenHash).toBe(hashResetToken(emailedToken));
    expect(updateData.resetTokenHash).not.toBe(emailedToken);
    expect(updateData.resetTokenExpiresAt).toBeInstanceOf(Date);
    expect(emailArgs).toMatchObject({
      to: 'admin.demo@uniosun.edu.ng',
      name: 'Admin Demo',
      token: emailedToken
    });
    expect(emailArgs.resetTokenHash).toBeUndefined();
    expect(JSON.stringify(emailArgs)).not.toContain(updateData.resetTokenHash);
    expect(notificationEvents.notifyPasswordResetRequestedSafely).toHaveBeenCalledWith({
      user: expect.objectContaining({
        id: 4,
        email: 'admin.demo@uniosun.edu.ng',
        status: 'ACTIVE'
      })
    });
  });

  test('forgot password response is generic for unknown emails', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      }
    });
    const emailProvider = {
      sendPasswordResetEmail: jest.fn()
    };
    const notificationEvents = {
      notifyPasswordResetRequestedSafely: jest.fn()
    };
    const service = createAuthService({
      prismaClient: prisma,
      emailProvider,
      authConfig,
      notificationEvents
    });

    await expect(service.requestPasswordReset({ email: 'missing@example.test' }))
      .resolves.toEqual({ message: 'If that email exists, a password reset link has been sent.' });
    expect(emailProvider.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(notificationEvents.notifyPasswordResetRequestedSafely).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('forgot password stays materially indistinguishable when the provider fails for an existing account', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          name: 'Admin Demo',
          email: 'admin.demo@uniosun.edu.ng',
          role: 'ADMIN',
          status: 'ACTIVE'
        }),
        update: jest.fn().mockResolvedValue({})
      }
    });
    const providerFailure = Object.assign(new Error('SMTP email delivery failed.'), {
      name: 'EmailServiceError',
      code: 'EMAIL_DELIVERY_FAILED',
      reasonCode: 'smtp-connect-failed',
      statusCode: 503
    });
    const emailProvider = {
      sendPasswordResetEmail: jest.fn().mockRejectedValue(providerFailure)
    };
    const notificationEvents = {
      notifyPasswordResetRequestedSafely: jest.fn()
    };
    const log = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const service = createAuthService({
      prismaClient: prisma,
      emailProvider,
      authConfig,
      notificationEvents,
      log
    });

    // Identical resolved value to both the success path and the
    // unknown-email path: the requester cannot distinguish provider failure
    // from normal acceptance, so account existence never leaks through
    // delivery behavior.
    await expect(service.requestPasswordReset({ email: 'admin.demo@uniosun.edu.ng' }))
      .resolves.toEqual({ message: 'If that email exists, a password reset link has been sent.' });

    // The failure remains internally observable without token material.
    expect(log.warn).toHaveBeenCalledWith('Password reset email could not be delivered', {
      reasonCode: 'smtp-connect-failed',
      userId: 4
    });
    const emailedToken = emailProvider.sendPasswordResetEmail.mock.calls[0][0].token;
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain(emailedToken);
  });

  test('forgot password response for a disabled provider matches the unknown-email response', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          name: 'Admin Demo',
          email: 'admin.demo@uniosun.edu.ng',
          role: 'ADMIN',
          status: 'ACTIVE'
        }),
        update: jest.fn().mockResolvedValue({})
      }
    });
    const emailProvider = {
      sendPasswordResetEmail: jest.fn().mockRejectedValue(Object.assign(new Error('Email delivery is disabled.'), {
        name: 'EmailServiceError',
        code: 'EMAIL_PROVIDER_DISABLED'
      }))
    };
    const service = createAuthService({
      prismaClient: prisma,
      emailProvider,
      authConfig,
      notificationEvents: { notifyPasswordResetRequestedSafely: jest.fn() },
      log: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
    });

    await expect(service.requestPasswordReset({ email: 'admin.demo@uniosun.edu.ng' }))
      .resolves.toEqual({ message: 'If that email exists, a password reset link has been sent.' });
  });

  test('reset password clears token fields, forced-change state, and invalidates prior sessions', async () => {
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const prisma = createPrismaMock({
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest.fn().mockResolvedValue({})
      }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig, audit });

    await service.resetPassword({
      token: 'valid-reset-token',
      password: 'NewPass123'
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        resetTokenHash: hashResetToken('valid-reset-token'),
        resetTokenExpiresAt: {
          gt: expect.any(Date)
        }
      }
    });
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      mustChangePassword: false,
      credentialVersion: { increment: 1 }
    });
    expect(prisma.user.update.mock.calls[0][0].data.passwordHash).not.toBe('NewPass123');
    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('PASSWORD_CHANGED');
    expect(JSON.stringify(auditEvent)).not.toContain('NewPass123');
  });

  describe('changePassword', () => {
    const buildUser = async (overrides = {}) => ({
      id: 9,
      name: 'Student Demo',
      email: 'student.demo@uniosun.edu.ng',
      passwordHash: await bcrypt.hash('TempPass123', 4),
      role: 'STUDENT',
      status: 'ACTIVE',
      credentialVersion: 1,
      mustChangePassword: true,
      ...overrides
    });

    test('verifies current credential, replaces hash, clears forced state, bumps version', async () => {
      const user = await buildUser();
      const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
      const prisma = createPrismaMock({
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
          update: jest.fn().mockResolvedValue({
            ...user,
            mustChangePassword: false,
            credentialVersion: 2
          })
        }
      });
      const service = createAuthService({ prismaClient: prisma, authConfig, audit });

      const result = await service.changePassword({
        userId: 9,
        currentPassword: 'TempPass123',
        newPassword: 'PrivatePass9'
      });

      const updateData = prisma.user.update.mock.calls[0][0].data;
      expect(updateData.mustChangePassword).toBe(false);
      expect(updateData.credentialVersion).toEqual({ increment: 1 });
      expect(updateData.resetTokenHash).toBeNull();
      expect(updateData.passwordHash).not.toBe('PrivatePass9');
      expect(await bcrypt.compare('PrivatePass9', updateData.passwordHash)).toBe(true);
      expect(result.user.mustChangePassword).toBe(false);
      expect(jwt.verify(result.token, authConfig.jwtSecret)).toMatchObject({ sub: '9', cv: 2 });
      const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
      expect(auditEvent.eventType).toBe('PASSWORD_CHANGED');
      expect(auditEvent.metadata.method).toBe('forced-initial-change');
      expect(JSON.stringify(auditEvent)).not.toContain('PrivatePass9');
      expect(JSON.stringify(auditEvent)).not.toContain('TempPass123');
    });

    test('rejects an incorrect current password', async () => {
      const user = await buildUser();
      const prisma = createPrismaMock({
        user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() }
      });
      const service = createAuthService({ prismaClient: prisma, authConfig });

      await expect(service.changePassword({
        userId: 9,
        currentPassword: 'WrongPass123',
        newPassword: 'PrivatePass9'
      })).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CURRENT_PASSWORD' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    test('enforces the password policy on the new password', async () => {
      const service = createAuthService({ prismaClient: createPrismaMock(), authConfig });

      await expect(service.changePassword({
        userId: 9,
        currentPassword: 'TempPass123',
        newPassword: 'nodigits'
      })).rejects.toMatchObject({ statusCode: 400, code: 'WEAK_PASSWORD' });
    });

    test('rejects reusing the current password', async () => {
      const user = await buildUser();
      const prisma = createPrismaMock({
        user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() }
      });
      const service = createAuthService({ prismaClient: prisma, authConfig });

      await expect(service.changePassword({
        userId: 9,
        currentPassword: 'TempPass123',
        newPassword: 'TempPass123'
      })).rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_UNCHANGED' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    test('rejects suspended accounts even with a valid credential', async () => {
      const user = await buildUser({ status: 'SUSPENDED' });
      const prisma = createPrismaMock({
        user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() }
      });
      const service = createAuthService({ prismaClient: prisma, authConfig });

      await expect(service.changePassword({
        userId: 9,
        currentPassword: 'TempPass123',
        newPassword: 'PrivatePass9'
      })).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_SESSION' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
