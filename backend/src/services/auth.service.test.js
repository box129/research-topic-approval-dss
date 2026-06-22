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
      status: 'ACTIVE'
    })).toEqual({
      id: 1,
      name: 'Admin User',
      email: 'admin.demo@uniosun.edu.ng',
      role: 'admin',
      status: 'active'
    });
  });

  test('logs in active users and returns a signed token', async () => {
    const passwordHash = await bcrypt.hash('Password1', 4);
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 2,
          name: 'Lecturer Demo',
          email: 'lecturer.demo@uniosun.edu.ng',
          passwordHash,
          role: 'LECTURER',
          status: 'ACTIVE'
        })
      }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig });

    const result = await service.login({
      email: 'LECTURER.DEMO@UNIOSUN.EDU.NG',
      password: 'Password1'
    });

    expect(result.user.role).toBe('lecturer');
    expect(jwt.verify(result.token, authConfig.jwtSecret)).toMatchObject({
      sub: '2',
      role: 'lecturer'
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'lecturer.demo@uniosun.edu.ng' }
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

  test('reset password clears token fields after valid reset', async () => {
    const prisma = createPrismaMock({
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest.fn().mockResolvedValue({})
      }
    });
    const service = createAuthService({ prismaClient: prisma, authConfig });

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
      resetTokenExpiresAt: null
    });
    expect(prisma.user.update.mock.calls[0][0].data.passwordHash).not.toBe('NewPass123');
  });
});
