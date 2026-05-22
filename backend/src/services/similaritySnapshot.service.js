const prisma = require('../config/database');

const STORABLE_RESPONSE_STATUSES = new Set(['success', 'partial_success']);
const MAX_TOP_MATCHES_PER_TIER = 3;

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

function getBestMatchScore(match) {
  return [
    match?.sbert,
    match?.tfidf,
    match?.jaccard
  ].reduce((bestScore, value) => {
    const numericValue = normalizeNullableNumber(value);
    if (numericValue === null) {
      return bestScore;
    }

    return bestScore === null ? numericValue : Math.max(bestScore, numericValue);
  }, null);
}

function summarizeTopMatches(matches) {
  return asArray(matches)
    .slice(0, MAX_TOP_MATCHES_PER_TIER)
    .map((match) => ({
      id: match?.id ?? null,
      title: match?.title || null,
      score: getBestMatchScore(match)
    }));
}

function buildResultSummary(similarityResponse) {
  const data = similarityResponse?.data || {};
  const historicalMatches = asArray(data.tier1_historical);
  const currentSessionMatches = asArray(data.tier2_current);
  const underReviewMatches = asArray(data.tier3_under_review);

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
        maxSimilarity: normalizeNullableNumber(data.max_similarity),
        recommendation: normalizeNullableString(data.recommendation),
        resultSummary: buildResultSummary(similarityResponse)
      }
    });
  };

  return {
    createSnapshotFromSimilarityResponse
  };
}

module.exports = {
  ...createSimilaritySnapshotService(),
  createSimilaritySnapshotService,
  buildResultSummary,
  shouldStoreSimilarityResponse,
  MAX_TOP_MATCHES_PER_TIER
};
