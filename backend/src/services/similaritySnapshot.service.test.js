jest.mock('./voyageEmbedding.service', () => ({
  embedQuery: jest.fn(),
  VoyageProviderError: class VoyageProviderError extends Error {}
}));
jest.mock('./voyageSemanticSimilarity.service', () => ({
  retrieve: jest.fn(),
  classify: jest.fn()
}));
jest.mock('./residentCorpus.service', () => ({
  residentCorpus: {
    get: jest.fn(),
    searchable: jest.fn()
  }
}));
jest.mock('../config/logger', () => ({ error: jest.fn() }));

const {
  createSimilaritySnapshotService,
  buildResultSummary,
  shouldStoreSimilarityResponse,
  serializeSimilaritySnapshot,
  CURRENT_SCORING_CONTRACT,
  DEFAULT_SNAPSHOT_HISTORY_LIMIT,
  MAX_TOP_MATCHES_PER_TIER
} = require('./similaritySnapshot.service');
const { checkSimilarity } = require('../controllers/similarity.controller');
const { embedQuery } = require('./voyageEmbedding.service');
const { retrieve, classify } = require('./voyageSemanticSimilarity.service');
const { residentCorpus } = require('./residentCorpus.service');

function createPrismaMock() {
  return {
    similarityCheckSnapshot: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  };
}

const successResponse = {
  status: 'success',
  data: {
    overall_risk: 'HIGH',
    max_similarity: 0.814,
    recommendation: 'High similarity detected.',
    matches: [
      { id: 1, title: 'Historical Match 1', collection: 'HISTORICAL', semantic_score: 0.814, similarity_class: 'HIGH' },
      { id: 2, title: 'Historical Match 2', collection: 'HISTORICAL', semantic_score: 0.658, similarity_class: 'MEDIUM' },
      { id: 3, title: 'Historical Match 3', collection: 'HISTORICAL', semantic_score: 0.6, similarity_class: 'MEDIUM' },
      { id: 4, title: 'Historical Match 4', collection: 'HISTORICAL', semantic_score: 0.45, similarity_class: 'LOW' },
      { id: 5, title: 'Current Match', collection: 'CURRENT_SESSION', semantic_score: 0.7, similarity_class: 'MEDIUM' },
      { id: 6, title: 'Under Review Match', collection: 'UNDER_REVIEW', semantic_score: 0.71, similarity_class: 'MEDIUM' }
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

  test('builds compact result summary from current production matches across all collections', () => {
    const summary = buildResultSummary(successResponse);

    expect(summary).toEqual({
      tierCounts: {
        historical: 4,
        currentSession: 1,
        underReview: 1
      },
      topMatches: {
        historical: [
          { id: 1, title: 'Historical Match 1', score: 0.814 },
          { id: 2, title: 'Historical Match 2', score: 0.658 },
          { id: 3, title: 'Historical Match 3', score: 0.6 }
        ],
        currentSession: [
          { id: 5, title: 'Current Match', score: 0.7 }
        ],
        underReview: [
          { id: 6, title: 'Under Review Match', score: 0.71 }
        ]
      },
      hasSbertScores: true
    });
    expect(summary.topMatches.historical).toHaveLength(MAX_TOP_MATCHES_PER_TIER);
  });

  test('persists evidence from the actual current similarity controller output', async () => {
    const prisma = createPrismaMock();
    prisma.similarityCheckSnapshot.create.mockResolvedValue({ id: 15 });
    const service = createSimilaritySnapshotService({ prismaClient: prisma });
    const corpus = [
      { id: 11, title: 'Historical Match', collection: 'HISTORICAL' },
      { id: 12, title: 'Current Match', collection: 'CURRENT_SESSION' },
      { id: 13, title: 'Under Review Match', collection: 'UNDER_REVIEW' }
    ];
    const response = { json: jest.fn() };

    residentCorpus.get.mockResolvedValue({ topics: corpus });
    residentCorpus.searchable.mockReturnValue(corpus);
    embedQuery.mockResolvedValue([0, 1]);
    retrieve.mockReturnValue([
      { topic: corpus[0], score: 0.88 },
      { topic: corpus[1], score: 0.72 },
      { topic: corpus[2], score: 0.65 }
    ]);
    classify.mockReturnValue('HIGH');

    await checkSimilarity({ body: { topic: 'Proposed topic' } }, response, jest.fn());
    const similarityResponse = response.json.mock.calls[0][0];
    await service.createSnapshotFromSimilarityResponse({
      submissionId: 5,
      checkedById: 8,
      similarityResponse
    });

    expect(prisma.similarityCheckSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        overallRisk: 'HIGH',
        scoringContract: 'voyage-raw-cosine-v1',
        maxSimilarity: 0.88,
        resultSummary: expect.objectContaining({
          tierCounts: { historical: 1, currentSession: 1, underReview: 1 },
          topMatches: {
            historical: [{ id: 11, title: 'Historical Match', score: 0.88 }],
            currentSession: [{ id: 12, title: 'Current Match', score: 0.72 }],
            underReview: [{ id: 13, title: 'Under Review Match', score: 0.65 }]
          }
        })
      })
    }));
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
        scoringContract: 'voyage-raw-cosine-v1',
        maxSimilarity: 0.814,
        recommendation: 'High similarity detected.',
        resultSummary: buildResultSummary(successResponse)
      }
    });
    expect(CURRENT_SCORING_CONTRACT).toBe('voyage-raw-cosine-v1');
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
        matches: []
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
        scoringContract: CURRENT_SCORING_CONTRACT,
        maxSimilarity: 58.2,
        recommendation: null,
        resultSummary: expect.objectContaining({
          hasSbertScores: false
        })
      })
    });
  });

  test('safely ignores missing, malformed, and unknown-collection matches', () => {
    expect(buildResultSummary({
      status: 'success',
      data: {
        matches: [null, 'not a match', { collection: 'UNKNOWN', semantic_score: 0.9 }]
      }
    })).toEqual({
      tierCounts: {
        historical: 0,
        currentSession: 0,
        underReview: 0
      },
      topMatches: {
        historical: [],
        currentSession: [],
        underReview: []
      },
      hasSbertScores: true
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

  test('serializes snapshot with checker details', () => {
    const createdAt = new Date('2026-05-22T12:00:00Z');

    expect(serializeSimilaritySnapshot({
      id: 21,
      checkedById: 8,
      checkedBy: {
        id: 8,
        name: 'Lecturer Demo',
        email: 'lecturer.demo@uniosun.edu.ng'
      },
      responseStatus: 'success',
      overallRisk: 'HIGH',
      maxSimilarity: 81.4,
      recommendation: 'High similarity detected.',
      resultSummary: {
        tierCounts: {
          historical: 3,
          currentSession: 1,
          underReview: 2
        }
      },
      createdAt
    })).toEqual({
      id: 21,
      checked_by: {
        id: 8,
        name: 'Lecturer Demo',
        email: 'lecturer.demo@uniosun.edu.ng'
      },
      response_status: 'success',
      overall_risk: 'HIGH',
      // The fixture predates contract stamping, so its contract is unknown and
      // must serialize as null — never a guessed identifier.
      scoring_contract: null,
      max_similarity: 81.4,
      recommendation: 'High similarity detected.',
      result_summary: {
        tierCounts: {
          historical: 3,
          currentSession: 1,
          underReview: 2
        }
      },
      created_at: '2026-05-22T12:00:00.000Z'
    });
  });

  test('serializes the stored scoring contract for stamped rows and null for unmarked rows', () => {
    const base = {
      id: 22,
      checkedById: 8,
      responseStatus: 'success',
      overallRisk: 'LOW',
      maxSimilarity: 0.623,
      recommendation: null,
      resultSummary: null,
      createdAt: new Date('2026-09-01T09:00:00Z')
    };

    expect(serializeSimilaritySnapshot({
      ...base,
      scoringContract: CURRENT_SCORING_CONTRACT
    }).scoring_contract).toBe('voyage-raw-cosine-v1');

    // Prisma returns null (not undefined) for pre-migration rows; both must
    // serialize to the same explicit contract-unknown null.
    expect(serializeSimilaritySnapshot({
      ...base,
      scoringContract: null
    }).scoring_contract).toBeNull();
  });

  test('lists snapshots for submission newest first with checker details', async () => {
    const prisma = createPrismaMock();
    const newest = new Date('2026-05-22T12:30:00Z');
    prisma.similarityCheckSnapshot.findMany.mockResolvedValue([
      {
        id: 31,
        checkedById: 8,
        checkedBy: {
          id: 8,
          name: 'Lecturer Demo',
          email: 'lecturer.demo@uniosun.edu.ng'
        },
        responseStatus: 'success',
        overallRisk: 'HIGH',
        maxSimilarity: 81.4,
        recommendation: 'High similarity detected.',
        resultSummary: { tierCounts: { historical: 5 } },
        createdAt: newest
      }
    ]);
    const service = createSimilaritySnapshotService({ prismaClient: prisma });

    const snapshots = await service.listSnapshotsForSubmission({
      submissionId: 5
    });

    expect(prisma.similarityCheckSnapshot.findMany).toHaveBeenCalledWith({
      where: {
        submissionId: 5
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: DEFAULT_SNAPSHOT_HISTORY_LIMIT,
      include: {
        checkedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    expect(snapshots).toEqual([
      expect.objectContaining({
        id: 31,
        response_status: 'success',
        checked_by: {
          id: 8,
          name: 'Lecturer Demo',
          email: 'lecturer.demo@uniosun.edu.ng'
        }
      })
    ]);
  });

  test('allows custom snapshot list limit', async () => {
    const prisma = createPrismaMock();
    prisma.similarityCheckSnapshot.findMany.mockResolvedValue([]);
    const service = createSimilaritySnapshotService({ prismaClient: prisma });

    await service.listSnapshotsForSubmission({
      submissionId: 5,
      limit: 3
    });

    expect(prisma.similarityCheckSnapshot.findMany.mock.calls[0][0].take).toBe(3);
  });
});
