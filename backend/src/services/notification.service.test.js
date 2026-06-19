const {
  createNotificationService,
  sanitizeMetadata,
  serializeNotification
} = require('./notification.service');

function createPrismaMock(overrides = {}) {
  return {
    user: {
      findUnique: jest.fn(),
      ...overrides.user
    },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      ...overrides.notification
    }
  };
}

describe('notification.service', () => {
  test('creates a notification only for a real user id and redacts sensitive metadata', async () => {
    const createdAt = new Date('2026-06-19T10:00:00.000Z');
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 7 })
      },
      notification: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 1,
          ...data,
          readAt: null,
          createdAt,
          updatedAt: createdAt
        }))
      }
    });
    const service = createNotificationService({ prismaClient: prisma });

    const item = await service.createNotification({
      userId: 7,
      type: 'SUBMISSION_CREATED',
      title: 'Submission received',
      message: 'Your topic submission was received.',
      linkPath: '/student/my-submissions',
      metadata: {
        submissionId: 12,
        resetTokenHash: 'secret-hash',
        nested: {
          passwordHash: 'secret-password-hash'
        }
      }
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { id: true }
    });
    expect(prisma.notification.create.mock.calls[0][0].data.metadata).toMatchObject({
      submissionId: 12,
      resetTokenHash: '[redacted]',
      nested: {
        passwordHash: '[redacted]'
      }
    });
    expect(item).toMatchObject({
      id: 1,
      userId: 7,
      type: 'SUBMISSION_CREATED',
      metadata: {
        resetTokenHash: '[redacted]'
      }
    });
  });

  test('rejects notification creation for a missing user', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    });
    const service = createNotificationService({ prismaClient: prisma });

    await expect(service.createNotification({
      userId: 999,
      type: 'SYSTEM',
      title: 'Missing user',
      message: 'This should not be created.'
    })).rejects.toMatchObject({
      name: 'NotificationServiceError',
      code: 'NOTIFICATION_USER_NOT_FOUND',
      statusCode: 404
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('lists notifications for one user with empty-state pagination', async () => {
    const prisma = createPrismaMock({
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
      }
    });
    const service = createNotificationService({ prismaClient: prisma });

    const result = await service.listNotificationsForUser(7);

    expect(result.data.items).toEqual([]);
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(result.meta.unreadCount).toBe(0);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ userId: 7 });
  });

  test('marks only an owned notification as read', async () => {
    const createdAt = new Date('2026-06-19T10:00:00.000Z');
    const prisma = createPrismaMock({
      notification: {
        findFirst: jest.fn().mockResolvedValue({
          id: 3,
          userId: 7,
          type: 'SYSTEM',
          title: 'Notice',
          message: 'A real notice.',
          readAt: null,
          createdAt,
          updatedAt: createdAt
        }),
        update: jest.fn().mockResolvedValue({
          id: 3,
          userId: 7,
          type: 'SYSTEM',
          title: 'Notice',
          message: 'A real notice.',
          readAt: new Date('2026-06-19T10:05:00.000Z'),
          createdAt,
          updatedAt: createdAt
        })
      }
    });
    const service = createNotificationService({ prismaClient: prisma });

    const item = await service.markNotificationRead({ id: 3, userId: 7 });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: 3,
        userId: 7
      }
    });
    expect(prisma.notification.update.mock.calls[0][0]).toMatchObject({
      where: { id: 3 },
      data: { readAt: expect.any(Date) }
    });
    expect(item.readAt).toBe('2026-06-19T10:05:00.000Z');
  });

  test('does not mark another user notification as read', async () => {
    const prisma = createPrismaMock({
      notification: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    });
    const service = createNotificationService({ prismaClient: prisma });

    await expect(service.markNotificationRead({ id: 3, userId: 7 })).resolves.toBeNull();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  test('marks all unread notifications for the authenticated user', async () => {
    const prisma = createPrismaMock({
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      }
    });
    const service = createNotificationService({ prismaClient: prisma });

    const result = await service.markAllNotificationsRead(7);

    expect(prisma.notification.updateMany.mock.calls[0][0]).toMatchObject({
      where: {
        userId: 7,
        readAt: null
      },
      data: { readAt: expect.any(Date) }
    });
    expect(result.updatedCount).toBe(2);
    expect(result.readAt).toMatch(/^2026-|^2027-|^20/);
  });

  test('serializes notifications without sensitive metadata', () => {
    const item = serializeNotification({
      id: 1,
      userId: 7,
      type: 'SYSTEM',
      title: 'Notice',
      message: 'A real notice.',
      metadata: {
        token: 'secret-token',
        safe: 'value'
      },
      readAt: null,
      createdAt: new Date('2026-06-19T10:00:00.000Z'),
      updatedAt: new Date('2026-06-19T10:00:00.000Z')
    });

    expect(item.metadata).toEqual({
      token: '[redacted]',
      safe: 'value'
    });
    expect(JSON.stringify(item)).not.toContain('secret-token');
  });

  test('sanitizeMetadata redacts nested auth secrets', () => {
    expect(sanitizeMetadata({
      keep: 'safe',
      nested: {
        authToken: 'secret'
      }
    })).toEqual({
      keep: 'safe',
      nested: {
        authToken: '[redacted]'
      }
    });
  });
});
