const {
  createSimilaritySnapshotService,
  buildResultSummary,
  shouldStoreSimilarityResponse,
  MAX_TOP_MATCHES_PER_TIER
} = require('./similaritySnapshot.service');

function createPrismaMock() {
  return {
    similarityCheckSnapshot: {
      create: jest.fn()
    }
  };
}

const successResponse = {
  status: 'success',
  data: {
    overall_risk: 'HIGH',
    max_similarity: 81.4,
    recommendation: 'High similarity detected.',
    tier1_historical: [
      { id: 1, title: 'Historical Match 1', jaccard: 55.2, tfidf: 61.3, sbert: 81.4 },
      { id: 2, title: 'Historical Match 2', jaccard: 44.1, tfidf: 50.2, sbert: 65.8 },
      { id: 3, title: 'Historical Match 3', jaccard: 40, tfidf: 42, sbert: 60 },
      { id: 4, title: 'Historical Match 4', jaccard: 30, tfidf: 32, sbert: 45 }
    ],
    tier2_current: [
      { id: 5, title: 'Current Match', jaccard: 30, tfidf: 38, sbert: 70 }
    ],
    tier3_under_review: [
      { id: 6, title: 'Under Review Match', jaccard: 33, tfidf: 39, sbert: 71 }
    ]
  }
};

describe('similaritySnapshot.service', () => {
  test('identifies storable similarity response statuses', () => {
    expect(shouldStoreSimilarityResponse({ status: 'success' })).toBe(true);
    expect(shouldStoreSimilarityResponse({ status: 'partial_success' })).toBe(true);
    expect(shouldStoreSimilarityResponse({ status: 'error' })).toBe(false);
    expect(shouldStoreSimilarityResponse(null)).toBe(false);
  });

  test('builds compact result summary with tier counts and top matches', () => {
    const summary = buildResultSummary(successResponse);

    expect(summary).toEqual({
      tierCounts: {
        historical: 4,
        currentSession: 1,
        underReview: 1
      },
      topMatches: {
        historical: [
          { id: 1, title: 'Historical Match 1', score: 81.4 },
          { id: 2, title: 'Historical Match 2', score: 65.8 },
          { id: 3, title: 'Historical Match 3', score: 60 }
        ],
        currentSession: [
          { id: 5, title: 'Current Match', score: 70 }
        ],
        underReview: [
          { id: 6, title: 'Under Review Match', score: 71 }
        ]
      },
      hasSbertScores: true
    });
    expect(summary.topMatches.historical).toHaveLength(MAX_TOP_MATCHES_PER_TIER);
  });

  test('creates snapshot for success response', async () => {
    const prisma = createPrismaMock();
    prisma.similarityCheckSnapshot.create.mockResolvedValue({ id: 12 });
    const service = createSimilaritySnapshotService({ prismaClient: prisma });

    const result = await service.createSnapshotFromSimilarityResponse({
      submissionId: 5,
      checkedById: 8,
      similarityResponse: successResponse
    });

    expect(result).toEqual({ id: 12 });
    expect(prisma.similarityCheckSnapshot.create).toHaveBeenCalledWith({
      data: {
        submissionId: 5,
        checkedById: 8,
        responseStatus: 'success',
        overallRisk: 'HIGH',
        maxSimilarity: 81.4,
        recommendation: 'High similarity detected.',
        resultSummary: buildResultSummary(successResponse)
      }
    });
  });

  test('creates snapshot for partial_success response', async () => {
    const prisma = createPrismaMock();
    prisma.similarityCheckSnapshot.create.mockResolvedValue({ id: 13 });
    const service = createSimilaritySnapshotService({ prismaClient: prisma });
    const partialSuccessResponse = {
      status: 'partial_success',
      data: {
        overall_risk: 'MEDIUM',
        max_similarity: 58.2,
        tier1_historical: [],
        tier2_current: [],
        tier3_under_review: []
      }
    };

    await service.createSnapshotFromSimilarityResponse({
      submissionId: 6,
      checkedById: 9,
      similarityResponse: partialSuccessResponse
    });

    expect(prisma.similarityCheckSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submissionId: 6,
        checkedById: 9,
        responseStatus: 'partial_success',
        overallRisk: 'MEDIUM',
        maxSimilarity: 58.2,
        recommendation: null,
        resultSummary: expect.objectContaining({
          hasSbertScores: false
        })
      })
    });
  });

  test('does not create snapshot for error response', async () => {
    const prisma = createPrismaMock();
    const service = createSimilaritySnapshotService({ prismaClient: prisma });

    const result = await service.createSnapshotFromSimilarityResponse({
      submissionId: 5,
      checkedById: 8,
      similarityResponse: {
        status: 'error',
        message: 'Invalid request.'
      }
    });

    expect(result).toBeNull();
    expect(prisma.similarityCheckSnapshot.create).not.toHaveBeenCalled();
  });

  test('stores summary fields without full raw response', async () => {
    const prisma = createPrismaMock();
    prisma.similarityCheckSnapshot.create.mockResolvedValue({ id: 14 });
    const service = createSimilaritySnapshotService({ prismaClient: prisma });

    await service.createSnapshotFromSimilarityResponse({
      submissionId: 5,
      checkedById: 8,
      similarityResponse: successResponse
    });

    const snapshotData = prisma.similarityCheckSnapshot.create.mock.calls[0][0].data;
    expect(snapshotData.resultSummary).toHaveProperty('tierCounts');
    expect(snapshotData.resultSummary).toHaveProperty('topMatches');
    expect(snapshotData.resultSummary).not.toHaveProperty('tier1_historical');
    expect(snapshotData.resultSummary).not.toHaveProperty('input_topic');
  });
});
