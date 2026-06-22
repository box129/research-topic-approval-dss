const {
  validateLecturerBenchmark,
  hasSuspiciousIdentifier
} = require('./lecturerBenchmarkValidation.service');

function baseBenchmark(overrides = {}) {
  return {
    benchmark_id: 'synthetic-unreviewed-validation-fixture',
    created_at: '2026-06-22T00:00:00.000Z',
    reviewer_type: 'lecturer',
    review_status: 'unreviewed_template_fixture',
    source_dataset: 'synthetic-fixture',
    topic_pairs: [
      {
        pair_id: 'synthetic-pair-001',
        query: {
          title: 'Knowledge of malaria prevention among mothers in Osogbo',
          population: 'Mothers',
          location: 'Osogbo',
          study_focus: 'Malaria prevention',
          keywords: ['malaria', 'prevention']
        },
        candidate: {
          title: 'Malaria prevention awareness among mothers in Osogbo',
          population: 'Mothers',
          location: 'Osogbo',
          study_focus: 'Malaria prevention',
          keywords: ['malaria', 'awareness']
        },
        system_prediction: {
          predicted_label: 'HIGH',
          combined_score: 0.82,
          jaccard_score: 0.74,
          tfidf_score: 0.8,
          sbert_score: 0.88
        },
        lecturer_review: {
          reviewer_label: '',
          reviewer_confidence: '',
          reviewer_notes: '',
          review_date: '',
          reviewer_code: ''
        },
        privacy: {
          anonymized: true,
          contains_direct_identifiers: false
        }
      }
    ],
    ...overrides
  };
}

describe('lecturer benchmark validation service', () => {
  test('accepts an unreviewed fixture without fabricating labels', () => {
    const result = validateLecturerBenchmark(baseBenchmark());

    expect(result.valid).toBe(true);
    expect(result.summary.totalPairs).toBe(1);
    expect(result.summary.reviewedPairs).toBe(0);
    expect(result.summary.unreviewedPairs).toBe(1);
    expect(result.summary.metricsStatus).toBe('NOT_READY_FOR_FINAL_METRICS');
  });

  test('summarizes reviewed labels and confidence values', () => {
    const fixture = baseBenchmark({
      review_status: 'lecturer_reviewed'
    });
    fixture.topic_pairs[0].lecturer_review = {
      reviewer_label: 'HIGH',
      reviewer_confidence: '5',
      reviewer_notes: 'Same title meaning and context.',
      review_date: '2026-06-22',
      reviewer_code: 'LREV-001'
    };

    const result = validateLecturerBenchmark(fixture);

    expect(result.valid).toBe(true);
    expect(result.summary.reviewedPairs).toBe(1);
    expect(result.summary.labelDistribution).toEqual({ HIGH: 1 });
    expect(result.summary.confidenceDistribution).toEqual({ 5: 1 });
    expect(result.summary.metricsStatus).toBe('READY_FOR_METRIC_COMPARISON');
  });

  test('rejects duplicate ids, blank titles, invalid labels, and missing completed labels', () => {
    const result = validateLecturerBenchmark(baseBenchmark({
      review_status: 'lecturer_reviewed',
      topic_pairs: [
        {
          pair_id: 'dup-001',
          query: { title: '' },
          candidate: { title: 'Candidate title' },
          lecturer_review: { reviewer_label: 'VERY_HIGH' }
        },
        {
          pair_id: 'dup-001',
          query: { title: 'Query title' },
          candidate: { title: '' },
          lecturer_review: { reviewer_label: '' }
        }
      ]
    }));

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('query.title is required'),
      expect.stringContaining('Invalid reviewer_label'),
      expect.stringContaining('Duplicate pair_id'),
      expect.stringContaining('candidate.title is required'),
      expect.stringContaining('reviewer_label is required')
    ]));
  });

  test('detects possible direct identifiers without exposing sensitive data', () => {
    expect(hasSuspiciousIdentifier('student.name@example.edu')).toBe(true);
    expect(hasSuspiciousIdentifier('PH/2021/12345')).toBe(true);
    expect(hasSuspiciousIdentifier('synthetic public health topic')).toBe(false);

    const fixture = baseBenchmark();
    fixture.topic_pairs[0].lecturer_review.reviewer_notes = 'Remove PH/2021/12345 before review.';

    const result = validateLecturerBenchmark(fixture);

    expect(result.valid).toBe(true);
    expect(result.privacyWarnings).toHaveLength(1);
  });
});
