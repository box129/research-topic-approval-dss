const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogService,
  redactMetadata
} = require('./auditLog.service');

function createPrismaMock(overrides = {}) {
  return {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
      ...overrides.auditLog
    }
  };
}

describe('auditLog.service', () => {
  test('creates a safe audit event with redacted metadata', async () => {
    const prisma = createPrismaMock({
      auditLog: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_PREVIEWED,
          actorId: 10,
          actorRole: 'admin',
          actorEmail: 'admin.demo@uniosun.edu.ng',
          targetType: 'TopicImport',
          targetId: 'batch-1',
          metadata: {
            filename: 'topics.xlsx',
            password: '[redacted]',
            nested: {
              resetToken: '[redacted]'
            }
          },
          createdAt: new Date('2026-06-05T15:37:00.000Z')
        })
      }
    });
    const service = createAuditLogService({ prismaClient: prisma, log: { warn: jest.fn() } });

    await service.createAuditLog({
      eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_PREVIEWED,
      actorId: 10,
      actorRole: 'admin',
      actorEmail: 'admin.demo@uniosun.edu.ng',
      targetType: 'TopicImport',
      targetId: 'batch-1',
      metadata: {
        filename: 'topics.xlsx',
        password: 'DemoPass123',
        nested: {
          resetToken: 'secret-reset-token'
        }
      }
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_PREVIEWED,
        actorId: 10,
        actorRole: 'admin',
        actorEmail: 'admin.demo@uniosun.edu.ng',
        targetType: 'TopicImport',
        targetId: 'batch-1',
        metadata: {
          filename: 'topics.xlsx',
          password: '[redacted]',
          nested: {
            resetToken: '[redacted]'
          }
        }
      })
    });
  });

  test('redacts sensitive metadata recursively without removing safe summaries', () => {
    expect(redactMetadata({
      filename: 'topics.xlsx',
      token: 'secret',
      rows: [
        {
          title: 'Safe Topic',
          passwordHash: 'hash'
        }
      ],
      nested: {
        authorization: 'Bearer secret',
        acceptedRows: 4
      }
    })).toEqual({
      filename: 'topics.xlsx',
      token: '[redacted]',
      rows: [
        {
          title: 'Safe Topic',
          passwordHash: '[redacted]'
        }
      ],
      nested: {
        authorization: '[redacted]',
        acceptedRows: 4
      }
    });
  });

  test('uses Express canonical req.ip rather than a client-supplied forwarding header', () => {
    const context = buildAuditContextFromRequest({
      user: { id: 7, role: 'admin', email: 'admin@example.edu' },
      ip: '203.0.113.55',
      headers: {
        'x-forwarded-for': '198.51.100.99, 198.51.100.98',
        'user-agent': 'fallback-agent',
        'x-request-id': 'fallback-request-id'
      },
      get: jest.fn((name) => {
        if (name === 'user-agent') return 'trusted-agent';
        if (name === 'x-request-id') return 'trusted-request-id';
        return undefined;
      })
    });

    expect(context).toEqual({
      actorId: 7,
      actorRole: 'admin',
      actorEmail: 'admin@example.edu',
      ipAddress: '203.0.113.55',
      userAgent: 'trusted-agent',
      requestId: 'trusted-request-id'
    });

    expect(buildAuditContextFromRequest({
      headers: { 'x-forwarded-for': '198.51.100.99' }
    }).ipAddress).toBeNull();
  });

  test('safe audit creation logs and continues when persistence fails', async () => {
    const log = { warn: jest.fn() };
    const service = createAuditLogService({
      prismaClient: createPrismaMock({
        auditLog: {
          create: jest.fn().mockRejectedValue(new Error('database unavailable'))
        }
      }),
      log
    });

    await expect(service.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_COMMITTED
    })).resolves.toBeNull();
    expect(log.warn).toHaveBeenCalledWith('Audit log creation failed', {
      eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_COMMITTED,
      error: 'database unavailable'
    });
  });

  test('previews eligible old audit logs without deleting or returning metadata bodies', async () => {
    const prisma = createPrismaMock({
      auditLog: {
        count: jest.fn().mockResolvedValue(2),
        groupBy: jest.fn()
          .mockResolvedValueOnce([
            { eventType: 'USER_STATUS_CHANGED', _count: { _all: 2 } }
          ])
          .mockResolvedValueOnce([
            { actorRole: 'admin', _count: { _all: 2 } }
          ])
      }
    });
    const service = createAuditLogService({
      prismaClient: prisma,
      retentionPolicy: {
        retentionDays: 365,
        purgeMinAgeDays: 90,
        purgeMaxBatch: 1000
      }
    });

    const result = await service.previewAuditLogPurge(
      { olderThanDays: 365 },
      { now: new Date('2026-06-22T12:00:00.000Z') }
    );

    expect(result).toEqual({
      cutoffDate: '2025-06-22T12:00:00.000Z',
      olderThanDays: 365,
      candidateCount: 2,
      maxBatch: 1000,
      willDeleteCount: 2,
      policy: {
        retentionDays: 365,
        purgeMinAgeDays: 90,
        confirmationPhrase: 'CONFIRM_AUDIT_PURGE'
      },
      summary: {
        byEventType: [
          { eventType: 'USER_STATUS_CHANGED', count: 2 }
        ],
        byActorRole: [
          { actorRole: 'admin', count: 2 }
        ]
      }
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: new Date('2025-06-22T12:00:00.000Z')
        }
      }
    });
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('metadata');
    expect(result.summary).not.toHaveProperty('metadata');
  });

  test('rejects purge preview when cutoff is too recent', async () => {
    const service = createAuditLogService({
      prismaClient: createPrismaMock(),
      retentionPolicy: {
        retentionDays: 365,
        purgeMinAgeDays: 90,
        purgeMaxBatch: 1000
      }
    });

    await expect(service.previewAuditLogPurge(
      { olderThanDays: 30 },
      { now: new Date('2026-06-22T12:00:00.000Z') }
    )).rejects.toMatchObject({
      code: 'AUDIT_PURGE_CUTOFF_TOO_RECENT',
      field: 'olderThanDays'
    });
  });

  test('purge requires explicit confirmation phrase', async () => {
    const service = createAuditLogService({
      prismaClient: createPrismaMock(),
      retentionPolicy: {
        retentionDays: 365,
        purgeMinAgeDays: 90,
        purgeMaxBatch: 1000
      }
    });

    await expect(service.purgeAuditLogs({
      input: {
        olderThanDays: 365,
        confirmation: 'DELETE'
      }
    })).rejects.toMatchObject({
      code: 'AUDIT_PURGE_CONFIRMATION_REQUIRED',
      field: 'confirmation'
    });
  });

  test('purge respects max batch and creates audit event after deletion', async () => {
    const prisma = createPrismaMock({
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 99 }),
        count: jest.fn().mockResolvedValue(3),
        groupBy: jest.fn()
          .mockResolvedValueOnce([
            { eventType: 'AUTH_LOGIN', _count: { _all: 3 } }
          ])
          .mockResolvedValueOnce([
            { actorRole: 'student', _count: { _all: 3 } }
          ]),
        findMany: jest.fn().mockResolvedValue([
          { id: 1 },
          { id: 2 }
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      }
    });
    const service = createAuditLogService({
      prismaClient: prisma,
      retentionPolicy: {
        retentionDays: 365,
        purgeMinAgeDays: 90,
        purgeMaxBatch: 2
      }
    });

    const result = await service.purgeAuditLogs({
      input: {
        olderThanDays: 365,
        confirmation: 'CONFIRM_AUDIT_PURGE'
      },
      req: {
        user: {
          id: 7,
          role: 'admin',
          email: 'admin@example.edu'
        },
        headers: {},
        get: jest.fn()
      },
      now: new Date('2026-06-22T12:00:00.000Z')
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true },
      take: 2
    }));
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1, 2]
        }
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: AUDIT_EVENT_TYPES.AUDIT_LOGS_PURGED,
        actorId: 7,
        metadata: expect.objectContaining({
          candidateCount: 3,
          deletedCount: 2,
          maxBatch: 2
        })
      })
    });
    expect(prisma.auditLog.create.mock.invocationCallOrder[0]).toBeGreaterThan(
      prisma.auditLog.deleteMany.mock.invocationCallOrder[0]
    );
    expect(result).toMatchObject({
      candidateCount: 3,
      deletedCount: 2,
      auditEventType: AUDIT_EVENT_TYPES.AUDIT_LOGS_PURGED
    });
  });
});
