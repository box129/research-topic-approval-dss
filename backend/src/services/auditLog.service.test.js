const {
  AUDIT_EVENT_TYPES,
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
});
