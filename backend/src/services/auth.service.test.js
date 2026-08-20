const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  createAuthService,
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
