const {
  SIMILARITY_SCORING_CONTRACT
} = require('../config/similarityScoring.config');

const RISK_CLASSES = ['LOW', 'MEDIUM', 'HIGH'];

const PRODUCTION_RISK_THRESHOLDS = {
  medium: SIMILARITY_SCORING_CONTRACT.thresholds.medium,
  high: SIMILARITY_SCORING_CONTRACT.thresholds.high
};

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function normalizeScore(score, options = {}) {
  if (score === null || score === undefined) {
    return null;
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return null;
  }

  const normalizedScore = options.allowAboveOne
    ? Math.max(0, numericScore)
    : Math.max(0, Math.min(1, numericScore > 1 ? numericScore / 100 : numericScore));

  return normalizedScore;
}

function classifyRisk(score, thresholds = PRODUCTION_RISK_THRESHOLDS, options = {}) {
  const normalizedScore = normalizeScore(score, { allowAboveOne: options.allowAboveOne });
  if (normalizedScore === null) {
    return null;
  }

  if (normalizedScore >= thresholds.high) {
    return 'HIGH';
  }

  if (normalizedScore >= thresholds.medium) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function labelFromRisk(risk) {
  if (risk === 'LOW') {
    return 'not_similar';
  }

  if (risk === 'MEDIUM' || risk === 'HIGH') {
    return 'similar';
  }

  return null;
}

function buildPrediction(score, options = {}) {
  const normalizedScore = normalizeScore(score, { allowAboveOne: options.allowAboveOne });
  const risk = classifyRisk(normalizedScore, options.thresholds, { allowAboveOne: options.allowAboveOne });

  return {
    score: roundMetric(normalizedScore),
    risk,
    label: labelFromRisk(risk),
    status: risk ? 'predicted' : 'skipped',
    reason: risk ? null : options.reason || 'missing_score'
  };
}

function buildSkippedPrediction(reason) {
  return {
    score: null,
    risk: null,
    label: null,
    status: 'skipped',
    reason
  };
}

function buildFailedPrediction(reason, errorClass) {
  return {
    score: null,
    risk: null,
    label: null,
    status: 'failed',
    reason,
    errorClass: errorClass || 'unknown'
  };
}

function normalizeRiskClass(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return RISK_CLASSES.includes(normalized) ? normalized : null;
}

function getExpectedClass(evaluationCase) {
  return normalizeRiskClass(evaluationCase.expected_class || evaluationCase.expected_risk);
}

function validateEvaluationDataset(dataset) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const support = RISK_CLASSES.reduce((counts, riskClass) => {
    counts[riskClass] = 0;
    return counts;
  }, {});

  if (!dataset || !Array.isArray(dataset.cases)) {
    return {
      valid: false,
      errors: ['Dataset must include a cases array.'],
      warnings,
      support,
      totalCases: 0,
      validCases: 0
    };
  }

  dataset.cases.forEach((evaluationCase, index) => {
    const prefix = evaluationCase?.id || `case_at_index_${index}`;
    const caseId = evaluationCase?.id;
    const expectedClass = getExpectedClass(evaluationCase);
    const submittedTitle = evaluationCase?.submitted?.title;
    const existingTitle = evaluationCase?.existing?.title;

    if (!caseId) {
      errors.push(`Case at index ${index} is missing id.`);
    } else if (seenIds.has(caseId)) {
      errors.push(`Duplicate case id: ${caseId}.`);
    } else {
      seenIds.add(caseId);
    }

    if (!expectedClass) {
      errors.push(`${prefix} has invalid expected_class/expected_risk.`);
    } else {
      support[expectedClass] += 1;
    }

    if (!submittedTitle || !submittedTitle.trim()) {
      errors.push(`${prefix} is missing submitted.title.`);
    }

    if (!existingTitle || !existingTitle.trim()) {
      errors.push(`${prefix} is missing existing.title.`);
    }

    if (!evaluationCase?.source_classification) {
      warnings.push(`${prefix} is missing source_classification.`);
    }

    if (!Array.isArray(evaluationCase?.tags)) {
      warnings.push(`${prefix} is missing tags array.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    support,
    totalCases: dataset.cases.length,
    validCases: errors.length === 0 ? dataset.cases.length : 0
  };
}

function buildMulticlassConfusionMatrix(caseResults, scorerKey) {
  const matrix = RISK_CLASSES.reduce((rows, expectedClass) => {
    rows[expectedClass] = RISK_CLASSES.reduce((columns, predictedClass) => {
      columns[predictedClass] = 0;
      return columns;
    }, {});
    return rows;
  }, {});

  caseResults.forEach(result => {
    const expectedClass = normalizeRiskClass(result.expected_class);
    const predictedClass = normalizeRiskClass(result.predictions?.[scorerKey]?.risk);

    if (!expectedClass || !predictedClass) {
      return;
    }

    matrix[expectedClass][predictedClass] += 1;
  });

  return matrix;
}

function countPredictions(caseResults, scorerKey) {
  return caseResults.reduce((count, result) => {
    return result.predictions?.[scorerKey]?.risk ? count + 1 : count;
  }, 0);
}

function calculateClassMetrics(confusionMatrix) {
  const perClass = {};
  let correct = 0;
  let total = 0;

  RISK_CLASSES.forEach(riskClass => {
    const truePositive = confusionMatrix[riskClass][riskClass];
    const falseNegative = RISK_CLASSES.reduce((sum, predictedClass) => {
      return predictedClass === riskClass ? sum : sum + confusionMatrix[riskClass][predictedClass];
    }, 0);
    const falsePositive = RISK_CLASSES.reduce((sum, expectedClass) => {
      return expectedClass === riskClass ? sum : sum + confusionMatrix[expectedClass][riskClass];
    }, 0);
    const support = RISK_CLASSES.reduce((sum, predictedClass) => {
      return sum + confusionMatrix[riskClass][predictedClass];
    }, 0);
    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    correct += truePositive;
    total += support;

    perClass[riskClass] = {
      support,
      precision: roundMetric(precision),
      recall: roundMetric(recall),
      f1: roundMetric(f1)
    };
  });

  const macroPrecision = RISK_CLASSES.reduce((sum, riskClass) => sum + perClass[riskClass].precision, 0) / RISK_CLASSES.length;
  const macroRecall = RISK_CLASSES.reduce((sum, riskClass) => sum + perClass[riskClass].recall, 0) / RISK_CLASSES.length;
  const macroF1 = RISK_CLASSES.reduce((sum, riskClass) => sum + perClass[riskClass].f1, 0) / RISK_CLASSES.length;
  const weightedPrecision = total === 0
    ? 0
    : RISK_CLASSES.reduce((sum, riskClass) => sum + perClass[riskClass].precision * perClass[riskClass].support, 0) / total;
  const weightedRecall = total === 0
    ? 0
    : RISK_CLASSES.reduce((sum, riskClass) => sum + perClass[riskClass].recall * perClass[riskClass].support, 0) / total;
  const weightedF1 = total === 0
    ? 0
    : RISK_CLASSES.reduce((sum, riskClass) => sum + perClass[riskClass].f1 * perClass[riskClass].support, 0) / total;

  return {
    total,
    accuracy: total === 0 ? 0 : roundMetric(correct / total),
    macro: {
      precision: roundMetric(macroPrecision),
      recall: roundMetric(macroRecall),
      f1: roundMetric(macroF1)
    },
    weighted: {
      precision: roundMetric(weightedPrecision),
      recall: roundMetric(weightedRecall),
      f1: roundMetric(weightedF1)
    },
    perClass
  };
}

function calculateMethodMetrics(caseResults, scorerKey, totalValidCases = caseResults.length) {
  const confusionMatrix = buildMulticlassConfusionMatrix(caseResults, scorerKey);
  const predictedCount = countPredictions(caseResults, scorerKey);
  const skippedCount = Math.max(0, totalValidCases - predictedCount);
  const evaluatedResults = caseResults.filter(result => result.predictions?.[scorerKey]?.risk);
  const metrics = calculateClassMetrics(confusionMatrix);
  const zeroSupport = predictedCount === 0;

  return {
    status: zeroSupport ? 'NOT_EVALUATED' : 'EVALUATED',
    total: totalValidCases,
    support: predictedCount,
    evaluated: predictedCount,
    predicted: predictedCount,
    skipped: skippedCount,
    failed: caseResults.reduce((count, result) => {
      return result.predictions?.[scorerKey]?.status === 'failed' ? count + 1 : count;
    }, 0),
    coverageRate: totalValidCases === 0 ? 0 : roundMetric(predictedCount / totalValidCases),
    datasetClassSupport: RISK_CLASSES.reduce((support, riskClass) => {
      support[riskClass] = caseResults.filter(result => result.expected_class === riskClass).length;
      return support;
    }, {}),
    evaluatedClassSupport: RISK_CLASSES.reduce((support, riskClass) => {
      support[riskClass] = evaluatedResults.filter(result => result.expected_class === riskClass).length;
      return support;
    }, {}),
    confusionMatrix,
    accuracy: zeroSupport ? null : metrics.accuracy,
    macro: zeroSupport
      ? { precision: null, recall: null, f1: null }
      : metrics.macro,
    weighted: zeroSupport
      ? { precision: null, recall: null, f1: null }
      : metrics.weighted,
    perClass: zeroSupport
      ? RISK_CLASSES.reduce((perClass, riskClass) => {
        perClass[riskClass] = {
          support: 0,
          precision: null,
          recall: null,
          f1: null
        };
        return perClass;
      }, {})
      : metrics.perClass
  };
}

module.exports = {
  RISK_CLASSES,
  PRODUCTION_RISK_THRESHOLDS,
  roundMetric,
  normalizeScore,
  classifyRisk,
  labelFromRisk,
  buildPrediction,
  buildSkippedPrediction,
  buildFailedPrediction,
  normalizeRiskClass,
  getExpectedClass,
  validateEvaluationDataset,
  buildMulticlassConfusionMatrix,
  calculateClassMetrics,
  calculateMethodMetrics
};
