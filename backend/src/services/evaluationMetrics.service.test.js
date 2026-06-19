const {
  PRODUCTION_SCORING_CONTRACT
} = require('../config/similarityScoring.config');

const {
  CURRENT_IMPLEMENTATION_CONTRACT
} = require('../../scripts/run-topic-evaluation');

const {
  normalizeScore,
  classifyRisk,
  labelFromRisk,
  buildPrediction,
  buildSkippedPrediction,
  buildFailedPrediction,
  validateEvaluationDataset,
  buildMulticlassConfusionMatrix,
  calculateMethodMetrics
} = require('./evaluationMetrics.service');

describe('Evaluation Metrics Service', () => {
  describe('normalizeScore', () => {
    test('should keep 0-1 scores on the normalized scale', () => {
      expect(normalizeScore(0)).toBe(0);
      expect(normalizeScore(0.42)).toBe(0.42);
      expect(normalizeScore(1)).toBe(1);
    });

    test('should convert 0-100 percentage scores to 0-1 by default', () => {
      expect(normalizeScore(42)).toBe(0.42);
      expect(normalizeScore(100)).toBe(1);
    });

    test('should allow production combined scores above 1 when requested', () => {
      expect(normalizeScore(1.71, { allowAboveOne: true })).toBe(1.71);
    });

    test('should return null for missing or invalid scores', () => {
      expect(normalizeScore(null)).toBeNull();
      expect(normalizeScore(undefined)).toBeNull();
      expect(normalizeScore('not a score')).toBeNull();
    });
  });

  describe('classifyRisk', () => {
    test('should classify production threshold boundaries', () => {
      expect(classifyRisk(0)).toBe('LOW');
      expect(classifyRisk(0.399999)).toBe('LOW');
      expect(classifyRisk(0.40)).toBe('MEDIUM');
      expect(classifyRisk(0.699999)).toBe('MEDIUM');
      expect(classifyRisk(0.70)).toBe('HIGH');
      expect(classifyRisk(1.0)).toBe('HIGH');
    });

    test('should classify percentage-style scores after normalization', () => {
      expect(classifyRisk(39)).toBe('LOW');
      expect(classifyRisk(40)).toBe('MEDIUM');
      expect(classifyRisk(70)).toBe('HIGH');
    });
  });

  test('should map risk to legacy binary labels for compatibility', () => {
    expect(labelFromRisk('LOW')).toBe('not_similar');
    expect(labelFromRisk('MEDIUM')).toBe('similar');
    expect(labelFromRisk('HIGH')).toBe('similar');
    expect(labelFromRisk(null)).toBeNull();
  });

  test('should build normalized prediction objects', () => {
    expect(buildPrediction(75)).toEqual({
      score: 0.75,
      risk: 'HIGH',
      label: 'similar',
      status: 'predicted',
      reason: null
    });
  });

  test('should build skipped predictions for unavailable methods', () => {
    expect(buildSkippedPrediction('sbert_unavailable')).toEqual({
      score: null,
      risk: null,
      label: null,
      status: 'skipped',
      reason: 'sbert_unavailable'
    });
  });

  test('should build failed predictions with failure classes', () => {
    expect(buildFailedPrediction('request_timeout', 'timeout')).toEqual({
      score: null,
      risk: null,
      label: null,
      status: 'failed',
      reason: 'request_timeout',
      errorClass: 'timeout'
    });
  });

  test('should detect duplicate ids, invalid labels, blank topics, and missing governance fields', () => {
    const validation = validateEvaluationDataset({
      cases: [
        {
          id: 'case-001',
          expected_class: 'HIGH',
          submitted: { title: 'Valid title' },
          existing: { title: 'Other title' },
          source_classification: 'manual',
          tags: ['valid']
        },
        {
          id: 'case-001',
          expected_class: 'UNCLEAR',
          submitted: { title: ' ' },
          existing: { title: '' }
        }
      ]
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      'Duplicate case id: case-001.',
      'case-001 has invalid expected_class/expected_risk.',
      'case-001 is missing submitted.title.',
      'case-001 is missing existing.title.'
    ]));
    expect(validation.warnings).toEqual(expect.arrayContaining([
      'case-001 is missing source_classification.',
      'case-001 is missing tags array.'
    ]));
  });

  test('should build multiclass confusion matrix counts', () => {
    const caseResults = [
      { expected_class: 'HIGH', predictions: { final: { risk: 'HIGH' } } },
      { expected_class: 'MEDIUM', predictions: { final: { risk: 'LOW' } } },
      { expected_class: 'LOW', predictions: { final: { risk: 'MEDIUM' } } },
      { expected_class: 'LOW', predictions: { final: { risk: null } } }
    ];

    expect(buildMulticlassConfusionMatrix(caseResults, 'final')).toEqual({
      LOW: { LOW: 0, MEDIUM: 1, HIGH: 0 },
      MEDIUM: { LOW: 1, MEDIUM: 0, HIGH: 0 },
      HIGH: { LOW: 0, MEDIUM: 0, HIGH: 1 }
    });
  });

  test('should calculate perfect multiclass metrics', () => {
    const caseResults = [
      { expected_class: 'LOW', predictions: { final: { risk: 'LOW' } } },
      { expected_class: 'MEDIUM', predictions: { final: { risk: 'MEDIUM' } } },
      { expected_class: 'HIGH', predictions: { final: { risk: 'HIGH' } } }
    ];

    expect(calculateMethodMetrics(caseResults, 'final')).toMatchObject({
      status: 'EVALUATED',
      support: 3,
      evaluated: 3,
      predicted: 3,
      skipped: 0,
      coverageRate: 1,
      accuracy: 1,
      macro: { precision: 1, recall: 1, f1: 1 },
      weighted: { precision: 1, recall: 1, f1: 1 }
    });
  });

  test('should calculate all-wrong metrics without division errors', () => {
    const caseResults = [
      { expected_class: 'LOW', predictions: { final: { risk: 'HIGH' } } },
      { expected_class: 'MEDIUM', predictions: { final: { risk: 'LOW' } } },
      { expected_class: 'HIGH', predictions: { final: { risk: 'MEDIUM' } } }
    ];

    expect(calculateMethodMetrics(caseResults, 'final')).toMatchObject({
      evaluated: 3,
      predicted: 3,
      skipped: 0,
      coverageRate: 1,
      accuracy: 0,
      macro: { precision: 0, recall: 0, f1: 0 },
      weighted: { precision: 0, recall: 0, f1: 0 }
    });
  });

  test('should handle missing predicted classes and zero-support classes', () => {
    const caseResults = [
      { expected_class: 'LOW', predictions: { final: { risk: 'LOW' } } },
      { expected_class: 'LOW', predictions: { final: { risk: 'LOW' } } },
      { expected_class: 'MEDIUM', predictions: { final: buildSkippedPrediction('method_unavailable') } }
    ];

    const metrics = calculateMethodMetrics(caseResults, 'final');

    expect(metrics.predicted).toBe(2);
    expect(metrics.skipped).toBe(1);
    expect(metrics.coverageRate).toBe(0.667);
    expect(metrics.datasetClassSupport).toEqual({ LOW: 2, MEDIUM: 1, HIGH: 0 });
    expect(metrics.evaluatedClassSupport).toEqual({ LOW: 2, MEDIUM: 0, HIGH: 0 });
    expect(metrics.perClass.HIGH.support).toBe(0);
    expect(metrics.perClass.HIGH.precision).toBe(0);
    expect(metrics.perClass.HIGH.recall).toBe(0);
  });

  test('should mark zero-support metric groups as not evaluated instead of zero performance', () => {
    const caseResults = [
      { expected_class: 'LOW', predictions: { fallback: buildSkippedPrediction('not_a_fallback_case') } },
      { expected_class: 'MEDIUM', predictions: { fallback: buildSkippedPrediction('not_a_fallback_case') } },
      { expected_class: 'HIGH', predictions: { fallback: buildSkippedPrediction('not_a_fallback_case') } }
    ];

    const metrics = calculateMethodMetrics(caseResults, 'fallback');

    expect(metrics).toMatchObject({
      status: 'NOT_EVALUATED',
      support: 0,
      evaluated: 0,
      predicted: 0,
      skipped: 3,
      coverageRate: 0,
      accuracy: null,
      macro: { precision: null, recall: null, f1: null },
      weighted: { precision: null, recall: null, f1: null }
    });
    expect(metrics.perClass).toEqual({
      LOW: { support: 0, precision: null, recall: null, f1: null },
      MEDIUM: { support: 0, precision: null, recall: null, f1: null },
      HIGH: { support: 0, precision: null, recall: null, f1: null }
    });
  });

  test('should keep evaluator current-production snapshot aligned with exported production constants', () => {
    expect(CURRENT_IMPLEMENTATION_CONTRACT.thresholds).toEqual(PRODUCTION_SCORING_CONTRACT.thresholds);
    expect(CURRENT_IMPLEMENTATION_CONTRACT.configuredWeights).toEqual(PRODUCTION_SCORING_CONTRACT.configuredWeights);
    expect(CURRENT_IMPLEMENTATION_CONTRACT.observedBehavior).toEqual(PRODUCTION_SCORING_CONTRACT.observedBehavior);
  });
});
