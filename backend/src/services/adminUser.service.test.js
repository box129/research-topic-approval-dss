const {
  AdminUserServiceError,
  createAdminUserService
} = require('./adminUser.service');
const { AUDIT_EVENT_TYPES } = require('./auditLog.service');

const adminUser = {
  id: 1,
  name: 'Admin Demo User',
  email: 'admin.demo@uniosun.edu.ng',
  passwordHash: 'secret-hash',
  role: 'ADMIN',
  status: 'ACTIVE',
  resetTokenHash: 'reset-secret',
  resetTokenExpiresAt: new Date('2026-06-06T10:00:00.000Z'),
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  updatedAt: new Date('2026-06-02T10:00:00.000Z')
};

const lecturerUser = {
  id: 2,
  name: 'Lecturer Demo User',
  email: 'lecturer.demo@uniosun.edu.ng',
  passwordHash: 'secret-hash',
  role: 'LECTURER',
  status: 'ACTIVE',
  resetTokenHash: null,
  resetTokenExpiresAt: null,
  createdAt: new Date('2026-06-03T10:00:00.000Z'),
  updatedAt: new Date('2026-06-04T10:00:00.000Z')
};

function createPrismaMock({ users = [adminUser, lecturerUser] } = {}) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
      count: jest.fn().mockResolvedValue(users.length),
      findUnique: jest.fn(({ where }) => Promise.resolve(users.find((user) => user.id === where.id) || null)),
      update: jest.fn(({ where, data }) => {
        const existing = users.find((user) => user.id === where.id);
        return Promise.resolve({
          ...existing,
          ...data,
          updatedAt: new Date('2026-06-05T10:00:00.000Z')
        });
      })
    }
  };
}

describe('adminUser.service', () => {
  test('lists users with safe serialized fields only', async () => {
    const service = createAdminUserService({
      prismaClient: createPrismaMock(),
      audit: { createAuditLogSafely: jest.fn() }
    });

    const result = await service.listUsers({ page: '1', limit: '10' });

    expect(result.data.items).toEqual([
      {
        id: 1,
        name: 'Admin Demo User',
        email: 'admin.demo@uniosun.edu.ng',
        role: 'admin',
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-02T10:00:00.000Z'
      },
      {
        id: 2,
        name: 'Lecturer Demo User',
        email: 'lecturer.demo@uniosun.edu.ng',
        role: 'lecturer',
        status: 'active',
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-04T10:00:00.000Z'
      }
    ]);
    expect(result.data.items[0]).not.toHaveProperty('passwordHash');
    expect(result.data.items[0]).not.toHaveProperty('resetTokenHash');
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
  });

  test('normalizes search, filters, sorting, and pagination for Prisma', async () => {
    const prisma = createPrismaMock();
    const service = createAdminUserService({
      prismaClient: prisma,
      audit: { createAuditLogSafely: jest.fn() }
    });

    await service.listUsers({
      role: 'lecturer',
      status: 'active',
      search: 'demo',
      page: '2',
      limit: '5',
      sort: 'email',
      direction: 'asc'
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: 'LECTURER',
        status: 'ACTIVE',
        OR: [
          { name: { contains: 'demo', mode: 'insensitive' } },
          { email: { contains: 'demo', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { email: 'asc' },
      skip: 5,
      take: 5
    });
  });

  test('rejects invalid list filters', async () => {
    const service = createAdminUserService({
      prismaClient: createPrismaMock(),
      audit: { createAuditLogSafely: jest.fn() }
    });

    await expect(service.listUsers({ role: 'owner' })).rejects.toMatchObject({
      code: 'ADMIN_USER_INVALID_ROLE',
      field: 'role'
    });
    await expect(service.listUsers({ status: 'disabled' })).rejects.toMatchObject({
      code: 'ADMIN_USER_INVALID_STATUS',
      field: 'status'
    });
    await expect(service.listUsers({ sort: 'passwordHash' })).rejects.toMatchObject({
      code: 'ADMIN_USER_INVALID_SORT',
      field: 'sort'
    });
    await expect(service.listUsers({ limit: '101' })).rejects.toBeInstanceOf(AdminUserServiceError);
  });

  test('gets user detail safely', async () => {
    const service = createAdminUserService({
      prismaClient: createPrismaMock(),
      audit: { createAuditLogSafely: jest.fn() }
    });

    const user = await service.getUserById('2');

    expect(user).toMatchObject({
      id: 2,
      email: 'lecturer.demo@uniosun.edu.ng',
      role: 'lecturer',
      status: 'active'
    });
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('resetTokenHash');
  });

  test('updates another user status and emits USER_STATUS_CHANGED audit event', async () => {
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const prisma = createPrismaMock();
    const service = createAdminUserService({ prismaClient: prisma, audit });

    const updated = await service.updateUserStatus({
      id: '2',
      status: 'suspended',
      actor: { id: 1, role: 'admin', email: 'admin.demo@uniosun.edu.ng' },
      req: {
        user: { id: 1, role: 'admin', email: 'admin.demo@uniosun.edu.ng' },
        ip: '127.0.0.1',
        get: jest.fn((name) => (name === 'user-agent' ? 'jest' : null)),
        headers: {}
      }
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: 'SUSPENDED' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    expect(updated).toMatchObject({
      id: 2,
      status: 'suspended'
    });
    expect(audit.createAuditLogSafely).toHaveBeenCalledWith(expect.objectContaining({
      eventType: AUDIT_EVENT_TYPES.USER_STATUS_CHANGED,
      actorId: 1,
      actorRole: 'admin',
      actorEmail: 'admin.demo@uniosun.edu.ng',
      targetType: 'User',
      targetId: '2',
      metadata: {
        oldStatus: 'ACTIVE',
        newStatus: 'SUSPENDED',
        targetUserId: 2,
        targetUserRole: 'LECTURER',
        targetUserEmail: 'lecturer.demo@uniosun.edu.ng'
      }
    }));
  });

  test('rejects self-suspension', async () => {
    const service = createAdminUserService({
      prismaClient: createPrismaMock(),
      audit: { createAuditLogSafely: jest.fn() }
    });

    await expect(service.updateUserStatus({
      id: '1',
      status: 'SUSPENDED',
      actor: { id: 1 },
      req: { user: { id: 1 } }
    })).rejects.toMatchObject({
      code: 'ADMIN_USER_SELF_SUSPENSION_FORBIDDEN',
      statusCode: 409
    });
  });

  test('returns null when updating a missing user', async () => {
    const service = createAdminUserService({
      prismaClient: createPrismaMock({ users: [] }),
      audit: { createAuditLogSafely: jest.fn() }
    });

    await expect(service.updateUserStatus({
      id: '99',
      status: 'active',
      actor: { id: 1 },
      req: { user: { id: 1 } }
    })).resolves.toBeNull();
  });
});
