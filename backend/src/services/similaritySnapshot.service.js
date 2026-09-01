const prisma = require('../config/database');

const STORABLE_RESPONSE_STATUSES = new Set(['success', 'partial_success']);
// The scoring contract every snapshot written by this service records its
// numbers under: Voyage voyage-4-large embeddings of the structured-context-v1
// representation, scored as raw cosine and classified against the frozen
// C1.5 thresholds. Stored rows keep the identifier they were stamped with, so
// any change to that meaning must introduce a NEW identifier rather than
// editing this one. Rows with a NULL scoring_contract predate stamping: their
// contract was never recorded and must not be inferred from the stored values.
const CURRENT_SCORING_CONTRACT = 'voyage-raw-cosine-v1';
const MAX_TOP_MATCHES_PER_TIER = 3;
const DEFAULT_SNAPSHOT_HISTORY_LIMIT = 10;
const COLLECTION_TIER_BY_VALUE = Object.freeze({
  HISTORICAL: 'historical',
  CURRENT_SESSION: 'currentSession',
  UNDER_REVIEW: 'underReview'
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeNullableString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeNullableNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getMatchScore(match) {
  return normalizeNullableNumber(match?.semantic_score);
}

function summarizeTopMatches(matches) {
  return asArray(matches)
    .slice(0, MAX_TOP_MATCHES_PER_TIER)
    .map((match) => ({
      id: match?.id ?? null,
      title: match?.title || null,
      score: getMatchScore(match)
    }));
}

function buildResultSummary(similarityResponse) {
  const data = similarityResponse?.data || {};
  const matches = asArray(data.matches);
  const matchesForTier = (tier) => matches.filter((match) => COLLECTION_TIER_BY_VALUE[match?.collection] === tier);
  const historicalMatches = matchesForTier('historical');
  const currentSessionMatches = matchesForTier('currentSession');
  const underReviewMatches = matchesForTier('underReview');

  return {
    tierCounts: {
      historical: historicalMatches.length,
      currentSession: currentSessionMatches.length,
      underReview: underReviewMatches.length
    },
    topMatches: {
      historical: summarizeTopMatches(historicalMatches),
      currentSession: summarizeTopMatches(currentSessionMatches),
      underReview: summarizeTopMatches(underReviewMatches)
    },
    hasSbertScores: similarityResponse?.status === 'success'
  };
}

function shouldStoreSimilarityResponse(similarityResponse) {
  return STORABLE_RESPONSE_STATUSES.has(similarityResponse?.status);
}

function serializeSimilaritySnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    id: snapshot.id,
    checked_by: {
      id: snapshot.checkedBy?.id || snapshot.checkedById,
      name: snapshot.checkedBy?.name || null,
      email: snapshot.checkedBy?.email || null
    },
    response_status: snapshot.responseStatus,
    overall_risk: snapshot.overallRisk,
    scoring_contract: snapshot.scoringContract ?? null,
    max_similarity: snapshot.maxSimilarity,
    recommendation: snapshot.recommendation,
    result_summary: snapshot.resultSummary,
    created_at: snapshot.createdAt?.toISOString?.() || snapshot.createdAt
  };
}

function createSimilaritySnapshotService({ prismaClient = prisma } = {}) {
  const createSnapshotFromSimilarityResponse = async ({
    submissionId,
    checkedById,
    similarityResponse
  }) => {
    if (!shouldStoreSimilarityResponse(similarityResponse)) {
      return null;
    }

    const data = similarityResponse?.data || {};

    return prismaClient.similarityCheckSnapshot.create({
      data: {
        submissionId,
        checkedById,
        responseStatus: similarityResponse.status,
        overallRisk: normalizeNullableString(data.overall_risk),
        scoringContract: CURRENT_SCORING_CONTRACT,
        maxSimilarity: normalizeNullableNumber(data.max_similarity),
        recommendation: normalizeNullableString(data.recommendation),
        resultSummary: buildResultSummary(similarityResponse)
      }
    });
  };

  const listSnapshotsForSubmission = async ({
    submissionId,
    limit = DEFAULT_SNAPSHOT_HISTORY_LIMIT
  }) => {
    const snapshots = await prismaClient.similarityCheckSnapshot.findMany({
      where: {
        submissionId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
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

    return snapshots.map(serializeSimilaritySnapshot);
  };

  return {
    createSnapshotFromSimilarityResponse,
    listSnapshotsForSubmission
  };
}

module.exports = {
  ...createSimilaritySnapshotService(),
  createSimilaritySnapshotService,
  buildResultSummary,
  shouldStoreSimilarityResponse,
  serializeSimilaritySnapshot,
  CURRENT_SCORING_CONTRACT,
  MAX_TOP_MATCHES_PER_TIER,
  DEFAULT_SNAPSHOT_HISTORY_LIMIT
};
