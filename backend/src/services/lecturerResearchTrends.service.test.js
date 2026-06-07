const {
  DATA_COVERAGE,
  SOURCE_TABLES,
  createLecturerResearchTrendsService
} = require('./lecturerResearchTrends.service');

function createPrismaMock({
  topicCounts = [30, 10, 5],
  topicCategoryGroups = [
    [{ category: 'Public Health', _count: { _all: 12 } }, { category: null, _count: { _all: 1 } }],
    [{ category: 'Software Engineering', _count: { _all: 6 } }],
    [{ category: 'Public Health', _count: { _all: 2 } }]
  ],
  topicSessionGroups = [
    [{ sessionYear: '2024/2025', _count: { _all: 12 } }],
    [{ sessionYear: '2025/2026', _count: { _all: 8 } }],
    [{ sessionYear: '2025/2026', _count: { _all: 3 } }]
  ],
  submissionCounts = [8, 2, 1, 4, 1],
  submissionCategoryGroups = [
    { category: 'Public Health', _count: { _all: 3 } },
    { category: null, _count: { _all: 1 } }
  ],
  snapshotCount = 7,
  riskGroups = [
    { overallRisk: 'HIGH', _count: { _all: 1 } },
    { overallRisk: 'medium', _count: { _all: 2 } },
    { overallRisk: null, _count: { _all: 1 } }
  ],
  responseStatusGroups = [
    { responseStatus: 'success', _count: { _all: 5 } },
    { responseStatus: 'partial_success', _count: { _all: 2 } }
  ]
} = {}) {
  return {
    historicalTopic: {
      count: jest.fn().mockResolvedValue(topicCounts[0]),
      groupBy: jest.fn()
        .mockResolvedValueOnce(topicCategoryGroups[0])
        .mockResolvedValueOnce(topicSessionGroups[0])
    },
    currentSessionTopic: {
      count: jest.fn().mockResolvedValue(topicCounts[1]),
      groupBy: jest.fn()
        .mockResolvedValueOnce(topicCategoryGroups[1])
        .mockResolvedValueOnce(topicSessionGroups[1])
    },
    underReviewTopic: {
      count: jest.fn().mockResolvedValue(topicCounts[2]),
      groupBy: jest.fn()
        .mockResolvedValueOnce(topicCategoryGroups[2])
        .mockResolvedValueOnce(topicSessionGroups[2])
    },
    submission: {
      count: jest.fn()
        .mockResolvedValueOnce(submissionCounts[0])
        .mockResolvedValueOnce(submissionCounts[1])
        .mockResolvedValueOnce(submissionCounts[2])
        .mockResolvedValueOnce(submissionCounts[3])
        .mockResolvedValueOnce(submissionCounts[4]),
      groupBy: jest.fn().mockResolvedValue(submissionCategoryGroups)
    },
    similarityCheckSnapshot: {
      count: jest.fn().mockResolvedValue(snapshotCount),
      groupBy: jest.fn()
        .mockResolvedValueOnce(riskGroups)
        .mockResolvedValueOnce(responseStatusGroups)
    }
  };
}

describe('lecturerResearchTrends.service', () => {
  test('aggregates safe real-data trend counts from existing tables', async () => {
    const prisma = createPrismaMock();
    const service = createLecturerResearchTrendsService({ prismaClient: prisma });

    const result = await service.getResearchTrends();

    expect(result.data).toMatchObject({
      topics: {
        total: 45,
        byLifecycle: {
          historical: 30,
          currentSession: 10,
          underReview: 5
        },
        byCategory: [
          { category: 'Public Health', count: 14 },
          { category: 'Software Engineering', count: 6 },
          { category: 'Uncategorised', count: 1 }
        ],
        bySessionYear: [
          { sessionYear: '2024/2025', count: 12 },
          { sessionYear: '2025/2026', count: 11 }
        ]
      },
      submissions: {
        total: 8,
        byStatus: {
          pendingReview: 2,
          awaitingRevision: 1,
          approved: 4,
          rejected: 1
        },
        decisionCoverage: {
          decided: 6,
          pending: 2
        },
        byCategory: [
          { category: 'Public Health', count: 3 },
          { category: 'Uncategorised', count: 1 }
        ]
      },
      similarityChecks: {
        snapshots: 7,
        byRisk: {
          high: 1,
          medium: 2,
          low: 0,
          unknown: 1
        },
        byResponseStatus: {
          success: 5,
          partialSuccess: 2,
          error: 0,
          other: 0
        }
      },
      keywordTrends: {
        status: 'deferred'
      },
      recommendations: {
        status: 'deferred'
      }
    });
    expect(result.meta).toEqual({
      generatedAt: expect.any(String),
      dataCoverage: DATA_COVERAGE,
      sourceTables: SOURCE_TABLES,
      analyticsStatus: 'read_only_aggregates'
    });
    expect(result.data).not.toHaveProperty('fakeInsights');
    expect(result.data).not.toHaveProperty('recommendedTopics');
    expect(result.data).not.toHaveProperty('chartData');
  });

  test('returns honest zero aggregates when no records exist', async () => {
    const service = createLecturerResearchTrendsService({
      prismaClient: createPrismaMock({
        topicCounts: [0, 0, 0],
        topicCategoryGroups: [[], [], []],
        topicSessionGroups: [[], [], []],
        submissionCounts: [0, 0, 0, 0, 0],
        submissionCategoryGroups: [],
        snapshotCount: 0,
        riskGroups: [],
        responseStatusGroups: []
      })
    });

    const result = await service.getResearchTrends();

    expect(result.data.topics.total).toBe(0);
    expect(result.data.topics.byCategory).toEqual([]);
    expect(result.data.submissions.total).toBe(0);
    expect(result.data.similarityChecks.snapshots).toBe(0);
    expect(result.data.keywordTrends.message).toMatch(/No fake keywords/i);
  });

  test('uses aggregate reads only and does not inspect raw rows or mutate records', async () => {
    const prisma = createPrismaMock();
    const service = createLecturerResearchTrendsService({ prismaClient: prisma });

    await service.getResearchTrends();

    expect(prisma.historicalTopic.count).toHaveBeenCalled();
    expect(prisma.historicalTopic.groupBy).toHaveBeenCalledWith({
      by: ['category'],
      _count: { _all: true }
    });
    expect(prisma.similarityCheckSnapshot.groupBy).toHaveBeenCalledWith({
      by: ['overallRisk'],
      _count: { _all: true }
    });
    expect(prisma.historicalTopic.findMany).toBeUndefined();
    expect(prisma.currentSessionTopic.findMany).toBeUndefined();
    expect(prisma.underReviewTopic.findMany).toBeUndefined();
    expect(prisma.submission.findMany).toBeUndefined();
    expect(prisma.similarityCheckSnapshot.findMany).toBeUndefined();
    expect(prisma.submission.create).toBeUndefined();
    expect(prisma.submission.update).toBeUndefined();
  });
});
