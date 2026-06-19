const SIMILARITY_SCORING_CONTRACT = Object.freeze({
  weights: Object.freeze({
    jaccard: 0.20,
    tfidf: 0.30,
    sbert: 0.50
  }),
  fallbackWeights: Object.freeze({
    jaccard: 0.40,
    tfidf: 0.60
  }),
  thresholds: Object.freeze({
    medium: 0.40,
    high: 0.70,
    tierMinimum: 0.10,
    semanticTierCombinedMinimum: 0.60,
    semanticTierSbertMinimum: 0.60
  })
});

const PRODUCTION_SCORING_CONTRACT = Object.freeze({
  thresholds: Object.freeze({
    medium: SIMILARITY_SCORING_CONTRACT.thresholds.medium,
    high: SIMILARITY_SCORING_CONTRACT.thresholds.high,
    tierMinimum: SIMILARITY_SCORING_CONTRACT.thresholds.tierMinimum,
    semanticTierCombinedMinimum: SIMILARITY_SCORING_CONTRACT.thresholds.semanticTierCombinedMinimum,
    semanticTierSbertMinimum: SIMILARITY_SCORING_CONTRACT.thresholds.semanticTierSbertMinimum
  }),
  configuredWeights: Object.freeze({
    jaccard: SIMILARITY_SCORING_CONTRACT.weights.jaccard,
    tfidf: SIMILARITY_SCORING_CONTRACT.weights.tfidf,
    sbert: SIMILARITY_SCORING_CONTRACT.weights.sbert,
    jaccardFallback: SIMILARITY_SCORING_CONTRACT.fallbackWeights.jaccard,
    tfidfFallback: SIMILARITY_SCORING_CONTRACT.fallbackWeights.tfidf
  }),
  observedBehavior: Object.freeze({
    normalCombinedScore: 'weighted jaccard * 0.20 + tfidf * 0.30 + sbert * 0.50',
    fallbackCombinedScore: 'weighted jaccard * 0.40 + tfidf * 0.60 when SBERT is unavailable',
    normalRanking: 'descending approved weighted combined score',
    fallbackRanking: 'descending approved fallback combined score',
    normalOverallRisk: 'highest eligible weighted combined score across returned tiers',
    fallbackOverallRisk: 'highest eligible fallback combined score across returned tiers',
    tierMinimum: 'combined score >= 0.10',
    tier23Requirement: 'combined score >= 0.60 and sbert score >= 0.60 when SBERT is available'
  })
});

function assertFiniteScore(score, scoreName) {
  if (!Number.isFinite(score)) {
    throw new Error(`${scoreName} must be a finite numeric score`);
  }
}

function calculateWeightedCombinedScore({ jaccard, tfidf, sbert }) {
  assertFiniteScore(jaccard, 'jaccard');
  assertFiniteScore(tfidf, 'tfidf');
  assertFiniteScore(sbert, 'sbert');

  const { weights } = SIMILARITY_SCORING_CONTRACT;
  return (jaccard * weights.jaccard) +
    (tfidf * weights.tfidf) +
    (sbert * weights.sbert);
}

function calculateFallbackCombinedScore({ jaccard, tfidf }) {
  assertFiniteScore(jaccard, 'jaccard');
  assertFiniteScore(tfidf, 'tfidf');

  const { fallbackWeights } = SIMILARITY_SCORING_CONTRACT;
  return (jaccard * fallbackWeights.jaccard) +
    (tfidf * fallbackWeights.tfidf);
}

function classifySimilarityRisk(score) {
  assertFiniteScore(score, 'score');

  const { thresholds } = SIMILARITY_SCORING_CONTRACT;
  if (score >= thresholds.high) {
    return 'HIGH';
  }

  if (score >= thresholds.medium) {
    return 'MEDIUM';
  }

  return 'LOW';
}

module.exports = {
  SIMILARITY_SCORING_CONTRACT,
  PRODUCTION_SCORING_CONTRACT,
  calculateWeightedCombinedScore,
  calculateFallbackCombinedScore,
  classifySimilarityRisk
};
