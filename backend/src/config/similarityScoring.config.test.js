const {
  SIMILARITY_SCORING_CONTRACT,
  PRODUCTION_SCORING_CONTRACT,
  calculateWeightedCombinedScore,
  calculateFallbackCombinedScore,
  classifySimilarityRisk
} = require('./similarityScoring.config');

describe('Similarity Scoring Contract', () => {
  test('should expose exact approved normal and fallback weights', () => {
    expect(SIMILARITY_SCORING_CONTRACT.weights).toEqual({
      jaccard: 0.20,
      tfidf: 0.30,
      sbert: 0.50
    });
    expect(SIMILARITY_SCORING_CONTRACT.fallbackWeights).toEqual({
      jaccard: 0.40,
      tfidf: 0.60
    });
  });

  test('should keep normal and fallback weights normalized to 1.0', () => {
    const normalTotal = Object.values(SIMILARITY_SCORING_CONTRACT.weights)
      .reduce((total, weight) => total + weight, 0);
    const fallbackTotal = Object.values(SIMILARITY_SCORING_CONTRACT.fallbackWeights)
      .reduce((total, weight) => total + weight, 0);

    expect(normalTotal).toBeCloseTo(1);
    expect(fallbackTotal).toBeCloseTo(1);
  });

  test('should calculate approved weighted tri-algorithm score with known inputs', () => {
    expect(calculateWeightedCombinedScore({
      jaccard: 0.80,
      tfidf: 0.60,
      sbert: 0.40
    })).toBeCloseTo(0.54);
  });

  test('should calculate approved fallback score with known inputs', () => {
    expect(calculateFallbackCombinedScore({
      jaccard: 0.30,
      tfidf: 0.50
    })).toBeCloseTo(0.42);
  });

  test('should classify LOW, MEDIUM, and HIGH at approved boundaries', () => {
    expect(classifySimilarityRisk(0)).toBe('LOW');
    expect(classifySimilarityRisk(0.399999)).toBe('LOW');
    expect(classifySimilarityRisk(0.40)).toBe('MEDIUM');
    expect(classifySimilarityRisk(0.699999)).toBe('MEDIUM');
    expect(classifySimilarityRisk(0.70)).toBe('HIGH');
    expect(classifySimilarityRisk(1.0)).toBe('HIGH');
  });

  test('should expose the same immutable contract snapshot used by reporting', () => {
    expect(PRODUCTION_SCORING_CONTRACT.thresholds).toEqual({
      medium: 0.40,
      high: 0.70,
      tierMinimum: 0.10,
      semanticTierCombinedMinimum: 0.60,
      semanticTierSbertMinimum: 0.60
    });
    expect(PRODUCTION_SCORING_CONTRACT.configuredWeights).toMatchObject({
      jaccard: 0.20,
      tfidf: 0.30,
      sbert: 0.50,
      jaccardFallback: 0.40,
      tfidfFallback: 0.60
    });
  });
});
