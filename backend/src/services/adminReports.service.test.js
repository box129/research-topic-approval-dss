const {
  DATA_COVERAGE,
  SOURCE_TABLES,
  createAdminReportsService
} = require('./adminReports.service');

function createPrismaMock({
  userCounts = [6, 3, 2, 1, 5, 1],
  submissionCounts = [8, 4, 1, 2, 1],
  topicCounts = [30, 10, 5],
  snapshotCount = 7,
  riskGroups = [
    { overallRisk: 'HIGH', _count: { _all: 1 } },
    { overallRisk: 'MEDIUM', _count: { _all: 2 } },
    { overallRisk: 'LOW', _count: { _all: 3 } },
    { overallRisk: null, _count: { _all: 1 } }
  ],
  responseStatusGroups = [
    { responseStatus: 'success', _count: { _all: 5 } },
    { responseStatus: 'partial_success', _count: { _all: 2 } }
  ],
  auditLogCount = 4,
  auditEventGroups = [
    { eventType: 'TOPIC_IMPORT_COMMITTED', _count: { _all: 1 } },
    { eventType: 'USER_STATUS_CHANGED', _count: { _all: 3 } }
  ],
  auditActorRoleGroups = [
    { actorRole: 'admin', _count: { _all: 3 } },
    { actorRole: null, _count: { _all: 1 } }
  ]
} = {}) {
  return {
    user: {
      count: jest.fn()
        .mockResolvedValueOnce(userCounts[0])
        .mockResolvedValueOnce(userCounts[1])
        .mockResolvedValueOnce(userCounts[2])
        .mockResolvedValueOnce(userCounts[3])
        .mockResolvedValueOnce(userCounts[4])
        .mockResolvedValueOnce(userCounts[5])
    },
    submission: {
      count: jest.fn()
        .mockResolvedValueOnce(submissionCounts[0])
        .mockResolvedValueOnce(submissionCounts[1])
        .mockResolvedValueOnce(submissionCounts[2])
        .mockResolvedValueOnce(submissionCounts[3])
        .mockResolvedValueOnce(submissionCounts[4])
    },
    historicalTopic: {
      count: jest.fn().mockResolvedValue(topicCounts[0])
    },
    currentSessionTopic: {
      count: jest.fn().mockResolvedValue(topicCounts[1])
    },
    underReviewTopic: {
      count: jest.fn().mockResolvedValue(topicCounts[2])
    },
    similarityCheckSnapshot: {
      count: jest.fn().mockResolvedValue(snapshotCount),
      groupBy: jest.fn()
        .mockResolvedValueOnce(riskGroups)
        .mockResolvedValueOnce(responseStatusGroups)
    },
    auditLog: {
      count: jest.fn().mockResolvedValue(auditLogCount),
      groupBy: jest.fn()
        .mockResolvedValueOnce(auditEventGroups)
        .mockResolvedValueOnce(auditActorRoleGroups)
    }
  };
}

describe('adminReports.service', () => {
  test('aggregates real read-only counts from existing tables', async () => {
    const prisma = createPrismaMock();
    const service = createAdminReportsService({ prismaClient: prisma });

    const result = await service.getReportsSummary();

    expect(result.data).toMatchObject({
      users: {
        total: 6,
        byRole: {
          students: 3,
          lecturers: 2,
          admins: 1
        },
        byStatus: {
          active: 5,
          suspended: 1
        }
      },
      submissions: {
        total: 8,
        byStatus: {
          pendingReview: 4,
          awaitingRevision: 1,
          approved: 2,
          rejected: 1
        },
        decisionCoverage: {
          decided: 4,
          pending: 4
        }
      },
      topics: {
        total: 45,
        byLifecycle: {
          historical: 30,
          currentSession: 10,
          underReview: 5
        }
      },
      similarityChecks: {
        snapshots: 7,
        byRisk: {
          high: 1,
          medium: 2,
          low: 3,
          unknown: 1
        },
        byResponseStatus: {
          success: 5,
          partialSuccess: 2,
          error: 0,
          other: 0
        }
      },
      auditLogs: {
        total: 4,
        byActorRole: {
          admin: 3,
          lecturer: 0,
          student: 0,
          unknown: 1
        },
        topEventTypes: [
          { eventType: 'USER_STATUS_CHANGED', count: 3 },
          { eventType: 'TOPIC_IMPORT_COMMITTED', count: 1 }
        ]
      },
      exports: {
        status: 'deferred'
      }
    });
    expect(result.meta).toEqual({
      generatedAt: expect.any(String),
      dataCoverage: DATA_COVERAGE,
      sourceTables: SOURCE_TABLES,
      exportStatus: 'deferred'
    });
    expect(result.data).not.toHaveProperty('items');
    expect(result.data).not.toHaveProperty('rawRecords');
    expect(result.data).not.toHaveProperty('embedding');
  });

  test('returns honest zero aggregates for an empty database', async () => {
    const service = createAdminReportsService({
      prismaClient: createPrismaMock({
        userCounts: [0, 0, 0, 0, 0, 0],
        submissionCounts: [0, 0, 0, 0, 0],
        topicCounts: [0, 0, 0],
        snapshotCount: 0,
        riskGroups: [],
        responseStatusGroups: [],
        auditLogCount: 0,
        auditEventGroups: [],
        auditActorRoleGroups: []
      })
    });

    const result = await service.getReportsSummary();

    expect(result.data.users.total).toBe(0);
    expect(result.data.submissions.total).toBe(0);
    expect(result.data.topics.total).toBe(0);
    expect(result.data.similarityChecks.snapshots).toBe(0);
    expect(result.data.auditLogs.total).toBe(0);
    expect(result.data.auditLogs.topEventTypes).toEqual([]);
    expect(result.data.exports.status).toBe('deferred');
  });

  test('queries only aggregate methods and does not request raw rows', async () => {
    const prisma = createPrismaMock();
    const service = createAdminReportsService({ prismaClient: prisma });

    await service.getReportsSummary();

    expect(prisma.user.count).toHaveBeenCalled();
    expect(prisma.submission.count).toHaveBeenCalled();
    expect(prisma.similarityCheckSnapshot.groupBy).toHaveBeenCalledWith({
      by: ['overallRisk'],
      _count: { _all: true }
    });
    expect(prisma.auditLog.groupBy).toHaveBeenCalledWith({
      by: ['eventType'],
      _count: { _all: true }
    });
    expect(prisma.user.findMany).toBeUndefined();
    expect(prisma.auditLog.findMany).toBeUndefined();
  });
});
