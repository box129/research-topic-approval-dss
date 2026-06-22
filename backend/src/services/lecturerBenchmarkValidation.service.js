const VALID_REVIEW_LABELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'UNSURE']);
const VALID_CONFIDENCE_TEXT = new Set(['LOW', 'MEDIUM', 'HIGH']);
const REVIEWED_STATUSES = new Set(['lecturer_reviewed', 'finalized']);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MATRIC_PATTERN = /\b(?:[A-Z]{2,5}[\/-])?\d{2,4}[\/-](?:[A-Z]{2,5}[\/-])?\d{2,5}\b/i;
const LONG_ID_PATTERN = /\b\d{7,}\b/;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeUpper(value) {
  const text = normalizeText(value);
  return text ? text.toUpperCase() : '';
}

function isBlank(value) {
  return normalizeText(value).length === 0;
}

function getPairTitle(pair, side) {
  return pair?.[side]?.title;
}

function hasSuspiciousIdentifier(value) {
  const text = normalizeText(value);
  if (!text) {
    return false;
  }

  return EMAIL_PATTERN.test(text) || MATRIC_PATTERN.test(text) || LONG_ID_PATTERN.test(text);
}

function collectTextFields(pair) {
  const values = [
    pair?.pair_id,
    pair?.query?.title,
    pair?.query?.population,
    pair?.query?.location,
    pair?.query?.study_focus,
    pair?.query?.keywords,
    pair?.candidate?.title,
    pair?.candidate?.population,
    pair?.candidate?.location,
    pair?.candidate?.study_focus,
    pair?.candidate?.keywords,
    pair?.lecturer_review?.reviewer_notes,
    pair?.lecturer_review?.reviewer_code
  ];

  return values.filter(value => value !== undefined && value !== null);
}

function increment(counts, key) {
  const normalizedKey = key || 'MISSING';
  counts[normalizedKey] = (counts[normalizedKey] || 0) + 1;
}

function validateConfidence(confidence) {
  const text = normalizeText(confidence);
  if (!text) {
    return true;
  }

  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return true;
  }

  return VALID_CONFIDENCE_TEXT.has(text.toUpperCase());
}

function validateLecturerBenchmark(benchmark) {
  const errors = [];
  const privacyWarnings = [];
  const seenPairIds = new Set();
  const duplicatePairIds = new Set();
  const labelDistribution = {};
  const confidenceDistribution = {};
  const invalidRows = [];
  let reviewedPairs = 0;
  let unreviewedPairs = 0;

  if (!benchmark || typeof benchmark !== 'object' || Array.isArray(benchmark)) {
    return {
      valid: false,
      errors: ['Benchmark file must contain a JSON object.'],
      warnings: [],
      privacyWarnings: [],
      summary: {
        totalPairs: 0,
        reviewedPairs: 0,
        unreviewedPairs: 0,
        labelDistribution: {},
        confidenceDistribution: {},
        invalidRows: []
      }
    };
  }

  if (isBlank(benchmark.benchmark_id)) {
    errors.push('benchmark_id is required.');
  }

  if (isBlank(benchmark.review_status)) {
    errors.push('review_status is required and must explicitly describe whether review is complete.');
  }

  if (!Array.isArray(benchmark.topic_pairs)) {
    errors.push('topic_pairs must be an array.');
  }

  const pairs = Array.isArray(benchmark.topic_pairs) ? benchmark.topic_pairs : [];
  const requiresCompletedLabels = REVIEWED_STATUSES.has(normalizeText(benchmark.review_status).toLowerCase());

  pairs.forEach((pair, index) => {
    const rowErrors = [];
    const pairId = normalizeText(pair?.pair_id);
    const rowName = pairId || `topic_pairs[${index}]`;
    const queryTitle = getPairTitle(pair, 'query');
    const candidateTitle = getPairTitle(pair, 'candidate');
    const review = pair?.lecturer_review || {};
    const reviewerLabel = normalizeUpper(review.reviewer_label);
    const reviewerConfidence = normalizeText(review.reviewer_confidence);

    if (!pairId) {
      rowErrors.push('pair_id is required.');
    } else if (seenPairIds.has(pairId)) {
      duplicatePairIds.add(pairId);
      rowErrors.push(`Duplicate pair_id: ${pairId}.`);
    } else {
      seenPairIds.add(pairId);
    }

    if (isBlank(queryTitle)) {
      rowErrors.push('query.title is required.');
    }

    if (isBlank(candidateTitle)) {
      rowErrors.push('candidate.title is required.');
    }

    if (reviewerLabel && !VALID_REVIEW_LABELS.has(reviewerLabel)) {
      rowErrors.push(`Invalid reviewer_label: ${review.reviewer_label}.`);
    }

    if (!reviewerLabel) {
      unreviewedPairs += 1;
      if (requiresCompletedLabels) {
        rowErrors.push('reviewer_label is required when review_status is lecturer_reviewed or finalized.');
      }
    } else if (VALID_REVIEW_LABELS.has(reviewerLabel)) {
      reviewedPairs += 1;
      increment(labelDistribution, reviewerLabel);
    }

    if (reviewerConfidence) {
      if (!validateConfidence(reviewerConfidence)) {
        rowErrors.push(`Invalid reviewer_confidence: ${review.reviewer_confidence}.`);
      } else {
        increment(confidenceDistribution, normalizeUpper(reviewerConfidence));
      }
    }

    collectTextFields(pair).forEach(value => {
      if (hasSuspiciousIdentifier(value)) {
        privacyWarnings.push(`${rowName} contains a possible direct identifier. Remove emails, matric-like numbers, or long student IDs.`);
      }
    });

    if (rowErrors.length) {
      invalidRows.push({
        pair_id: pairId || null,
        index,
        errors: rowErrors
      });
      errors.push(...rowErrors.map(error => `${rowName}: ${error}`));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    privacyWarnings,
    summary: {
      totalPairs: pairs.length,
      reviewedPairs,
      unreviewedPairs,
      duplicatePairIds: Array.from(duplicatePairIds),
      labelDistribution,
      confidenceDistribution,
      invalidRows,
      canComputeFinalMetrics: reviewedPairs > 0 && unreviewedPairs === 0 && errors.length === 0,
      metricsStatus: reviewedPairs > 0 && unreviewedPairs === 0 && errors.length === 0
        ? 'READY_FOR_METRIC_COMPARISON'
        : 'NOT_READY_FOR_FINAL_METRICS'
    }
  };
}

module.exports = {
  VALID_REVIEW_LABELS,
  VALID_CONFIDENCE_TEXT,
  validateLecturerBenchmark,
  hasSuspiciousIdentifier
};
