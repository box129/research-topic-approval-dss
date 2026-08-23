const { createAdminDashboardService } = require('./adminDashboard.service');

function createCountMock(values = {}) {
  return jest.fn((args = {}) => {
    const key = JSON.stringify(args.where || {});
    return Promise.resolve(values[key] ?? values.default ?? 0);
  });
}

function createPrismaMock(overrides = {}) {
  return {
    user: {
      count: createCountMock({
        default: 6,
        '{"role":"STUDENT"}': 3,
        '{"role":"LECTURER"}': 2,
        '{"role":"ADMIN"}': 1,
        '{"status":"ACTIVE"}': 5,
        '{"status":"SUSPENDED"}': 1
      }),
    },
    submission: {
      count: createCountMock({
        default: 8,
        '{"status":"PENDING_REVIEW"}': 4,
        '{"status":"AWAITING_REVISION"}': 1,
        '{"status":"APPROVED"}': 2,
        '{"status":"REJECTED"}': 1
      })
    },
    historicalTopic: {
      count: jest.fn().mockResolvedValue(30)
    },
    currentSessionTopic: {
      count: jest.fn().mockResolvedValue(10)
    },
    underReviewTopic: {
      count: jest.fn().mockResolvedValue(5)
    },
    similarityCheckSnapshot: {
      count: createCountMock({
        default: 7,
        '{"overallRisk":{"in":["HIGH","high"]}}': 1,
        '{"overallRisk":{"in":["MEDIUM","medium"]}}': 2,
        '{"overallRisk":{"in":["LOW","low"]}}': 4
      })
    },
    ...overrides
  };
}

describe('adminDashboard.service', () => {
  test('aggregates real read-only counts from existing Prisma models', async () => {
    const service = createAdminDashboardService({
      prismaClient: createPrismaMock(),
      log: { warn: jest.fn() }
    });

    const result = await service.getDashboardSummary();

    expect(result.data.users).toEqual({
      total: 6,
      students: 3,
      lecturers: 2,
      admins: 1,
      active: 5,
      suspended: 1,
      status: 'available'
    });
    expect(result.data.submissions).toEqual({
      total: 8,
      pendingReview: 4,
      awaitingRevision: 1,
      approved: 2,
      rejected: 1,
      status: 'available'
    });
    expect(result.data.topics).toEqual({
      total: 45,
      historical: 30,
      currentSession: 10,
      underReview: 5,
      status: 'available'
    });
    expect(result.data.similarityChecks).toEqual({
      snapshots: 7,
      highRisk: 1,
      mediumRisk: 2,
      lowRisk: 4,
      status: 'available',
      notes: ['Risk distribution includes stored lecturer similarity snapshots only.']
    });
    expect(result.data.serviceHealth).toEqual({
      api: expect.objectContaining({ status: 'available' }),
      database: expect.objectContaining({ status: 'available' }),
      semanticProvider: {
        status: 'unknown',
        provider: 'voyage',
        model: 'voyage-4-large',
        message: 'Voyage semantic provider (voyage-4-large) health is not checked by this dashboard endpoint yet.'
      }
    });
    expect(result.data.warnings).toEqual([]);
    expect(result.meta).toEqual({
      generatedAt: expect.any(String),
      dataCoverage: 'Read-only counts from existing tables.'
    });
  });

  test('returns safe zero counts for real empty tables', async () => {
    const emptyPrisma = createPrismaMock({
      user: { count: createCountMock({ default: 0 }) },
      submission: { count: createCountMock({ default: 0 }) },
      historicalTopic: { count: jest.fn().mockResolvedValue(0) },
      currentSessionTopic: { count: jest.fn().mockResolvedValue(0) },
      underReviewTopic: { count: jest.fn().mockResolvedValue(0) },
      similarityCheckSnapshot: { count: createCountMock({ default: 0 }) }
    });
    const service = createAdminDashboardService({
      prismaClient: emptyPrisma,
      log: { warn: jest.fn() }
    });

    const result = await service.getDashboardSummary();

    expect(result.data.users.total).toBe(0);
    expect(result.data.submissions.pendingReview).toBe(0);
    expect(result.data.topics.total).toBe(0);
    expect(result.data.similarityChecks.snapshots).toBe(0);
    expect(result.data.serviceHealth.database.status).toBe('available');
    expect(result.data.warnings).toEqual([]);
  });

  test('marks an unavailable section without fabricating replacement counts', async () => {
    const log = { warn: jest.fn() };
    const prisma = createPrismaMock({
      user: {
        count: jest.fn().mockRejectedValue(new Error('database read failed'))
      }
    });
    const service = createAdminDashboardService({
      prismaClient: prisma,
      log
    });

    const result = await service.getDashboardSummary();

    expect(result.data.users).toEqual({
      total: null,
      students: null,
      lecturers: null,
      admins: null,
      active: null,
      suspended: null,
      status: 'unavailable'
    });
    expect(result.data.submissions.status).toBe('available');
    expect(result.data.serviceHealth.database.status).toBe('unavailable');
    expect(result.data.warnings).toEqual([
      {
        section: 'users',
        code: 'ADMIN_DASHBOARD_USERS_UNAVAILABLE',
        message: 'users counts are unavailable from the database.'
      }
    ]);
    expect(log.warn).toHaveBeenCalledWith('Admin dashboard summary section unavailable', {
      section: 'users',
      error: 'database read failed'
    });
  });
});
