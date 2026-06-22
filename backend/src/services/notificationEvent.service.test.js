const {
  NOTIFICATION_EVENT_TYPES,
  buildDecisionText,
  createNotificationEventService,
  pickImportReportCounts
} = require('./notificationEvent.service');

function createPrismaMock(overrides = {}) {
  return {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      ...overrides.user
    },
    notification: {
      create: jest.fn(),
      ...overrides.notification
    }
  };
}

const silentLogger = {
  warn: jest.fn()
};

describe('notificationEvent.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notifies active lecturer and admin reviewers when a student submits a topic', async () => {
    const createdAt = new Date('2026-06-22T10:00:00.000Z');
    const prisma = createPrismaMock({
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 2, role: 'LECTURER' },
          { id: 1, role: 'ADMIN' }
        ]),
        findUnique: jest.fn(({ where }) => Promise.resolve({ id: where.id }))
      },
      notification: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: data.userId,
          ...data,
          readAt: null,
          createdAt,
          updatedAt: createdAt
        }))
      }
    });
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyReviewersOfSubmissionCreatedSafely({
      submission: {
        id: 11,
        studentId: 7,
        sessionId: 3,
        title: 'Knowledge of malaria prevention among undergraduate public health students',
        category: 'Public Health'
      },
      actorUser: { id: 7, role: 'student' }
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: {
          in: ['LECTURER', 'ADMIN']
        },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        role: true
      }
    });
    expect(result).toMatchObject({
      created: 2,
      failed: 0,
      recipientCount: 2
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 2,
        type: NOTIFICATION_EVENT_TYPES.SUBMISSION_CREATED,
        title: 'New topic pending review',
        linkPath: '/lecturer/pending-reviews',
        metadata: expect.objectContaining({
          submissionId: 11,
          studentId: 7,
          reviewerRole: 'lecturer'
        })
      })
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        linkPath: '/admin/dashboard',
        metadata: expect.objectContaining({
          reviewerRole: 'admin'
        })
      })
    });
  });

  test('skips new-submission notifications when no real reviewers are found', async () => {
    const prisma = createPrismaMock({
      user: {
        findMany: jest.fn().mockResolvedValue([])
      }
    });
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyReviewersOfSubmissionCreatedSafely({
      submission: { id: 11, title: 'A real submitted topic title' }
    });

    expect(result).toEqual({
      created: 0,
      skipped: true,
      reason: 'no_active_reviewers'
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('skips new-submission notifications when submission context is missing', async () => {
    const prisma = createPrismaMock();
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyReviewersOfSubmissionCreatedSafely({});

    expect(result).toEqual({
      created: 0,
      skipped: true,
      reason: 'missing_submission'
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  test('returns a failed notification result without throwing when notification creation fails', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    });
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyStudentOfSubmissionDecisionSafely({
      submission: {
        id: 21,
        studentId: 999,
        status: 'APPROVED'
      }
    });

    expect(result).toMatchObject({
      created: 0,
      failed: 1
    });
    expect(silentLogger.warn).toHaveBeenCalledWith('Notification event creation failed', {
      type: NOTIFICATION_EVENT_TYPES.SUBMISSION_DECISION,
      userId: 999,
      errorName: 'NotificationServiceError',
      errorCode: 'NOTIFICATION_USER_NOT_FOUND'
    });
  });

  test('notifies the student when a lecturer records a decision', async () => {
    const createdAt = new Date('2026-06-22T10:00:00.000Z');
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 7 })
      },
      notification: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: 1,
          ...data,
          readAt: null,
          createdAt,
          updatedAt: createdAt
        }))
      }
    });
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyStudentOfSubmissionDecisionSafely({
      submission: {
        id: 21,
        studentId: 7,
        status: 'AWAITING_REVISION',
        decidedById: 9,
        decidedAt: new Date('2026-06-22T09:30:00.000Z')
      }
    });

    expect(result.created).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        type: NOTIFICATION_EVENT_TYPES.SUBMISSION_DECISION,
        title: 'Topic revision requested',
        message: expect.stringContaining('needs revision'),
        linkPath: '/student/my-submissions',
        metadata: {
          submissionId: 21,
          status: 'awaiting_revision',
          decidedById: 9,
          decidedAt: '2026-06-22T09:30:00.000Z'
        }
      })
    });
  });

  test('skips lecturer-decision notification when submission owner is missing', async () => {
    const prisma = createPrismaMock();
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyStudentOfSubmissionDecisionSafely({
      submission: { id: 21, status: 'APPROVED' }
    });

    expect(result).toEqual({
      created: 0,
      skipped: true,
      reason: 'missing_submission_owner'
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('notifies admin actor for import preview and commit using only real report counts', async () => {
    const createdAt = new Date('2026-06-22T10:00:00.000Z');
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 })
      },
      notification: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: data.userId,
          ...data,
          readAt: null,
          createdAt,
          updatedAt: createdAt
        }))
      }
    });
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    await service.notifyAdminImportPreviewedSafely({
      actorUser: { id: 1, role: 'admin' },
      fileName: 'topics.xlsx',
      importBatchId: 'batch-1',
      report: {
        total_rows: 4,
        accepted_rows: 3,
        skipped_rows: 1
      }
    });
    await service.notifyAdminImportCommittedSafely({
      actorUser: { id: 1, role: 'admin' },
      fileName: 'topics.xlsx',
      importBatchId: 'batch-1',
      report: {
        total_rows: 4,
        accepted_rows: 3,
        skipped_rows: 1
      },
      persistenceReport: {
        inserted_records: 3,
        failed_records: 0
      }
    });

    expect(prisma.notification.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        type: NOTIFICATION_EVENT_TYPES.TOPIC_IMPORT_PREVIEWED,
        metadata: expect.objectContaining({
          fileName: 'topics.xlsx',
          importBatchId: 'batch-1',
          report: {
            totalRows: 4,
            acceptedRows: 3,
            skippedRows: 1,
            insertedRecords: null,
            failedRecords: null
          }
        })
      })
    });
    expect(prisma.notification.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        type: NOTIFICATION_EVENT_TYPES.TOPIC_IMPORT_COMMITTED,
        metadata: expect.objectContaining({
          persistenceReport: expect.objectContaining({
            insertedRecords: 3,
            failedRecords: 0
          })
        })
      })
    });
  });

  test('skips import notification when admin actor context is missing', async () => {
    const prisma = createPrismaMock();
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyAdminImportPreviewedSafely({
      actorUser: null,
      report: {}
    });

    expect(result).toEqual({
      created: 0,
      skipped: true,
      reason: 'missing_admin_actor'
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('skips import commit notification when admin actor context is missing', async () => {
    const prisma = createPrismaMock();
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    const result = await service.notifyAdminImportCommittedSafely({
      actorUser: { id: 2, role: 'lecturer' },
      persistenceReport: {}
    });

    expect(result).toEqual({
      created: 0,
      skipped: true,
      reason: 'missing_admin_actor'
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('records a safe password reset request notification without reset tokens', async () => {
    const createdAt = new Date('2026-06-22T10:00:00.000Z');
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 4 })
      },
      notification: {
        create: jest.fn(({ data }) => Promise.resolve({
          id: 1,
          ...data,
          readAt: null,
          createdAt,
          updatedAt: createdAt
        }))
      }
    });
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    await service.notifyPasswordResetRequestedSafely({
      user: {
        id: 4,
        status: 'ACTIVE',
        email: 'admin.demo@uniosun.edu.ng',
        resetTokenHash: 'secret-hash'
      }
    });

    const data = prisma.notification.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 4,
      type: NOTIFICATION_EVENT_TYPES.PASSWORD_RESET_REQUESTED,
      title: 'Password reset requested',
      metadata: {
        userId: 4,
        emailDelivery: 'requested'
      }
    });
    expect(JSON.stringify(data)).not.toContain('secret-hash');
    expect(JSON.stringify(data)).not.toContain('resetToken');
  });

  test('skips password reset notification for inactive or missing user context', async () => {
    const prisma = createPrismaMock();
    const service = createNotificationEventService({ prismaClient: prisma, serviceLogger: silentLogger });

    await expect(service.notifyPasswordResetRequestedSafely({
      user: { id: 4, status: 'SUSPENDED' }
    })).resolves.toEqual({
      created: 0,
      skipped: true,
      reason: 'missing_active_user'
    });
    await expect(service.notifyPasswordResetRequestedSafely()).resolves.toEqual({
      created: 0,
      skipped: true,
      reason: 'missing_active_user'
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('helpers preserve documented status and count mappings', () => {
    expect(buildDecisionText('APPROVED').title).toBe('Topic approved');
    expect(buildDecisionText('REJECTED').title).toBe('Topic rejected');
    expect(buildDecisionText('UNKNOWN').title).toBe('Topic decision updated');
    expect(pickImportReportCounts({
      total_rows: 2,
      inserted_records: 1
    })).toEqual({
      totalRows: 2,
      acceptedRows: null,
      skippedRows: null,
      insertedRecords: 1,
      failedRecords: null
    });
  });
});
