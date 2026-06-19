const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const axios = require('axios');
const { calculateJaccard } = require('../src/services/jaccard.service');
const { calculateTfIdfSimilarity } = require('../src/services/tfidf.service');
const sbertService = require('../src/services/sbert.service');
const { PRODUCTION_SCORING_CONTRACT } = require('../src/controllers/similarity.controller');
const {
  RISK_CLASSES,
  normalizeScore,
  buildPrediction,
  buildSkippedPrediction,
  buildFailedPrediction,
  getExpectedClass,
  validateEvaluationDataset,
  calculateMethodMetrics
} = require('../src/services/evaluationMetrics.service');

const repoRoot = path.join(__dirname, '..', '..');
const backendRoot = path.join(__dirname, '..');
const datasetPath = path.join(backendRoot, 'evaluation', 'datasets', 'pilot-topic-pairs.json');
const resultsDir = path.join(backendRoot, 'evaluation', 'results');
const jsonReportPath = path.join(resultsDir, 'topic-similarity-evaluation.json');
const markdownReportPath = path.join(repoRoot, 'docs', 'testing', 'topic-similarity-evaluation-report.md');

const APPROVED_FYP_SPECIFICATION = {
  source: 'PR #105 scoring-contract reconciliation request / approved FYP methodology',
  jaccardWeight: 0.20,
  tfidfWeight: 0.30,
  sbertWeight: 0.50,
  fallbackJaccardWeight: 0.40,
  fallbackTfidfWeight: 0.60,
  low: 'score < 0.40',
  medium: '0.40 <= score < 0.70',
  high: 'score >= 0.70',
  tierMinimum: 0.10,
  tier23Requirement: 'combined >= 0.60 and sbert >= 0.60'
};

const CURRENT_IMPLEMENTATION_CONTRACT = {
  source: 'backend/src/controllers/similarity.controller.js',
  thresholds: PRODUCTION_SCORING_CONTRACT.thresholds,
  configuredWeights: PRODUCTION_SCORING_CONTRACT.configuredWeights,
  observedBehavior: PRODUCTION_SCORING_CONTRACT.observedBehavior,
  implementationNotes: [
    'The production controller defines algorithm weights, but combineAlgorithmResults currently ranks normal results with an unweighted jaccard + tfidf + sbert combinedScore.',
    'When SBERT succeeds, the production response overallRisk is classified from the maximum SBERT score.',
    'When SBERT is unavailable, the production partial_success response overallRisk is classified from the maximum lexical score across Jaccard and TF-IDF.',
    'This evaluation mirrors the current implementation behavior and does not modify production scoring, thresholds, SBERT fallback, imports, API responses, or frontend behavior.'
  ]
};

const SCORING_CONTRACT_COMPARISON = [
  {
    item: 'Jaccard weight',
    approvedFypSpecification: '0.20',
    currentImplementationBehavior: '0.30 configured; not used in current combinedScore calculation',
    evaluationRunnerBehavior: 'mirrors current implementation, not approved weighted formula',
    status: 'DRIFT',
    source: 'backend/src/controllers/similarity.controller.js:15-20,569'
  },
  {
    item: 'TF-IDF weight',
    approvedFypSpecification: '0.30',
    currentImplementationBehavior: '0.30 configured; not used in current combinedScore calculation',
    evaluationRunnerBehavior: 'mirrors current implementation',
    status: 'MATCH',
    source: 'backend/src/controllers/similarity.controller.js:15-20,569'
  },
  {
    item: 'SBERT weight',
    approvedFypSpecification: '0.50',
    currentImplementationBehavior: '0.40 configured; not used in current combinedScore calculation',
    evaluationRunnerBehavior: 'mirrors current implementation, not approved weighted formula',
    status: 'DRIFT',
    source: 'backend/src/controllers/similarity.controller.js:15-20,569'
  },
  {
    item: 'Fallback Jaccard weight',
    approvedFypSpecification: '0.40',
    currentImplementationBehavior: '0.50 configured; fallback final risk uses max lexical score',
    evaluationRunnerBehavior: 'fallback cases use max lexical score',
    status: 'DRIFT',
    source: 'backend/src/controllers/similarity.controller.js:15-22,483-492,571'
  },
  {
    item: 'Fallback TF-IDF weight',
    approvedFypSpecification: '0.60',
    currentImplementationBehavior: '0.50 configured; fallback final risk uses max lexical score',
    evaluationRunnerBehavior: 'fallback cases use max lexical score',
    status: 'DRIFT',
    source: 'backend/src/controllers/similarity.controller.js:15-22,483-492,571'
  },
  {
    item: 'LOW/MEDIUM boundary',
    approvedFypSpecification: 'LOW below 0.40; MEDIUM starts at 0.40',
    currentImplementationBehavior: 'LOW below 0.50; MEDIUM starts at 0.50',
    evaluationRunnerBehavior: 'uses current implementation boundary for production-behavior evidence',
    status: 'DRIFT',
    source: 'backend/src/controllers/similarity.controller.js:9-13,112-120'
  },
  {
    item: 'HIGH boundary',
    approvedFypSpecification: 'HIGH starts at 0.70',
    currentImplementationBehavior: 'HIGH starts at 0.70',
    evaluationRunnerBehavior: 'uses 0.70',
    status: 'MATCH',
    source: 'backend/src/controllers/similarity.controller.js:9-13,112-120'
  },
  {
    item: 'Tier minimum',
    approvedFypSpecification: '0.10',
    currentImplementationBehavior: 'No separate 0.10 tier minimum verified; Tier 2/3 filter is 0.60',
    evaluationRunnerBehavior: 'not evaluated by pairwise runner',
    status: 'NOT VERIFIED',
    source: 'backend/src/controllers/similarity.controller.js:25,628-633'
  },
  {
    item: 'Tier 2/3 SBERT requirement',
    approvedFypSpecification: 'combined >= 0.60 and SBERT >= 0.60',
    currentImplementationBehavior: 'combined >= 0.60 and SBERT >= 0.60 when SBERT is available',
    evaluationRunnerBehavior: 'not evaluated by pairwise runner',
    status: 'MATCH',
    source: 'backend/src/controllers/similarity.controller.js:628-633'
  },
  {
    item: 'Overall production risk',
    approvedFypSpecification: 'weighted tri-algorithm score implied by approved methodology',
    currentImplementationBehavior: 'normal mode uses max SBERT; fallback mode uses max lexical',
    evaluationRunnerBehavior: 'final_production_behavior mirrors max SBERT / max lexical behavior',
    status: 'DRIFT',
    source: 'backend/src/controllers/similarity.controller.js:460-492'
  }
];

const METHOD_KEYS = [
  'jaccard_only',
  'tfidf_only',
  'sbert_only',
  'full_tri_algorithm_cases',
  'fallback_combination_cases',
  'offlineFallbackPolicyEvaluation',
  'final_production_behavior'
];

function loadDataset() {
  return JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
}

function ensureOutputDirectories() {
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.mkdirSync(path.dirname(markdownReportPath), { recursive: true });
}

function getCommitHash() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim();
  } catch (error) {
    try {
      const gitHeadPath = path.join(repoRoot, '.git', 'HEAD');
      const head = fs.readFileSync(gitHeadPath, 'utf8').trim();
      if (head.startsWith('ref:')) {
        const refPath = head.replace('ref:', '').trim();
        return fs.readFileSync(path.join(repoRoot, '.git', refPath), 'utf8').trim().slice(0, 7);
      }
      return head.slice(0, 7);
    } catch (readError) {
      return 'unknown';
    }
  }
}

async function getSbertHealthStatus() {
  try {
    const response = await axios.get(`${sbertService.SBERT_SERVICE_URL}/health`, {
      timeout: 5000
    });

    return {
      url: sbertService.SBERT_SERVICE_URL,
      available: response.status === 200 && response.data?.status === 'healthy',
      statusCode: response.status,
      response: {
        status: response.data?.status || null,
        model: response.data?.model || null
      },
      error: null
    };
  } catch (error) {
    return {
      url: sbertService.SBERT_SERVICE_URL,
      available: false,
      statusCode: error.response?.status || null,
      response: null,
      error: {
        message: error.message,
        class: classifySbertFailure(error)
      }
    };
  }
}

function classifySbertFailure(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  if (code.includes('econnrefused') || message.includes('unavailable') || message.includes('connect')) {
    return 'connection_error';
  }

  if (code.includes('econnaborted') || message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }

  if (message.includes('invalid response') || message.includes('malformed')) {
    return 'malformed_response';
  }

  if (message.includes('service error') || error?.response) {
    return 'service_error';
  }

  if (message.includes('model') || message.includes('embedding')) {
    return 'model_error';
  }

  return 'unknown';
}

function calculateTfIdfPairScore(submittedTitle, existingTitle, caseId) {
  const results = calculateTfIdfSimilarity(submittedTitle, [
    {
      id: caseId,
      title: existingTitle
    }
  ]);

  return results[0]?.score ?? null;
}

async function calculateSbertPairScore(submittedTitle, existingTitle, caseId) {
  const results = await sbertService.calculateSbertSimilarities(submittedTitle, [
    {
      id: caseId,
      title: existingTitle
    }
  ]);

  return results[0]?.score ?? null;
}

function countBy(cases, getValue) {
  return cases.reduce((counts, item) => {
    const value = getValue(item) || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function buildClassSupport(cases) {
  return RISK_CLASSES.reduce((support, riskClass) => {
    support[riskClass] = cases.filter(evaluationCase => getExpectedClass(evaluationCase) === riskClass).length;
    return support;
  }, {});
}

function buildMethodSummary(caseResults, methodKeys) {
  return methodKeys.reduce((summary, methodKey) => {
    summary[methodKey] = calculateMethodMetrics(caseResults, methodKey, caseResults.length);
    return summary;
  }, {});
}

function toPercent(rate) {
  return normalizeScore(rate * 100, { allowAboveOne: true });
}

function renderMetricTable(summary) {
  const rows = [
    '| Method | Evaluated / Total | Coverage | Accuracy | Macro F1 | Weighted F1 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |'
  ];

  Object.entries(summary).forEach(([methodKey, metrics]) => {
    rows.push(`| \`${methodKey}\` | ${metrics.evaluated} / ${metrics.total} | ${metrics.coverageRate} | ${formatNullableMetric(metrics.accuracy)} | ${formatNullableMetric(metrics.macro.f1)} | ${formatNullableMetric(metrics.weighted.f1)} |`);
  });

  return rows.join('\n');
}

function formatNullableMetric(value) {
  return value === null || value === undefined ? 'NOT_EVALUATED' : value;
}

function renderContractComparisonTable(comparison) {
  const rows = [
    '| Item | Approved FYP Specification | Current Implementation Behavior | Evaluation Runner Behavior | Status | Source |',
    '| --- | --- | --- | --- | --- | --- |'
  ];

  comparison.forEach(row => {
    rows.push(`| ${row.item} | ${row.approvedFypSpecification} | ${row.currentImplementationBehavior} | ${row.evaluationRunnerBehavior} | ${row.status} | \`${row.source}\` |`);
  });

  return rows.join('\n');
}

function renderClassSupport(support) {
  return RISK_CLASSES.map(riskClass => `- ${riskClass}: ${support[riskClass]}`).join('\n');
}

function renderSbertFailures(failures) {
  if (!failures.length) {
    return '- None';
  }

  return failures
    .map(failure => `- ${failure.id}: ${failure.failureClass} (${failure.message})`)
    .join('\n');
}

function renderMarkdownReport(report) {
  const finalMetrics = report.summary.final_production_behavior;

  return `# Topic Similarity Evaluation Report

Generated: ${report.generatedAt}

Commit: \`${report.commitHash}\`

Dataset: \`${report.dataset.path}\` (${report.dataset.version})

Mode: ${report.mode}

## Dataset Governance

- Source classification: ${report.dataset.provenance.source_classification}
- Validation status: ${report.dataset.provenance.validation_status}
- Total cases: ${report.dataset.totalCases}
- Valid cases: ${report.dataset.validCases}
- Skipped cases: ${report.dataset.skippedCases}

Class support:

${renderClassSupport(report.dataset.classSupport)}

## SBERT Operational Verification

- Service URL: ${report.sbert.serviceUrl}
- Health available: ${report.sbert.available}
- Health response status: ${report.sbert.healthStatus.response?.status || 'unavailable'}
- Health response model: ${report.sbert.healthStatus.response?.model || 'unavailable'}
- SBERT attempted cases: ${report.sbert.attemptedCases}
- SBERT success cases: ${report.sbert.successCases}
- SBERT failed cases: ${report.sbert.failedCases}
- SBERT unavailable cases: ${report.sbert.unavailableCases}
- SBERT skipped cases: ${report.sbert.skippedCases}
- Full tri-algorithm cases: ${report.coverage.fullTriAlgorithmCases}
- Operational fallback-used cases: ${report.coverage.fallbackCases}
- Partial-success cases: ${report.coverage.partialSuccessCases}
- Full tri-algorithm coverage: ${report.coverage.fullTriAlgorithmCoveragePercent}%
- Operational fallback coverage: ${report.coverage.fallbackCoveragePercent}%

SBERT failures:

${renderSbertFailures(report.sbert.failures)}

## Scoring Contract Comparison

${renderContractComparisonTable(report.scoringContractComparison)}

Drift status: ${report.scoringContractStatus}

Recommendation: ${report.scoringContractRecommendation}

## Current Implementation Contract Used For This Evidence

- High threshold: ${report.productionScoring.thresholds.highTier1}
- Medium threshold: ${report.productionScoring.thresholds.mediumTier1}
- Tier filter threshold: ${report.productionScoring.thresholds.tierFilter}
- Configured weights: Jaccard ${report.productionScoring.configuredWeights.jaccard}, TF-IDF ${report.productionScoring.configuredWeights.tfidf}, SBERT ${report.productionScoring.configuredWeights.sbert}
- Fallback weights configured: Jaccard ${report.productionScoring.configuredWeights.jaccardFallback}, TF-IDF ${report.productionScoring.configuredWeights.tfidfFallback}

Observed controller behavior mirrored by this report:

${report.productionScoring.implementationNotes.map(note => `- ${note}`).join('\n')}

## Results Summary

${renderMetricTable(report.summary)}

## Fallback Evidence Boundary

Operational fallback was triggered in ${report.productionFallback.fallbackUsedCases} of ${report.coverage.totalCases} valid cases.

- Operational fallback metrics status: ${report.summary.fallback_combination_cases.status}
- Operational fallback support: ${report.summary.fallback_combination_cases.support}
- Operational fallback accuracy/F1: ${formatNullableMetric(report.summary.fallback_combination_cases.accuracy)} / ${formatNullableMetric(report.summary.fallback_combination_cases.weighted.f1)}
- Offline fallback-policy evaluation status: ${report.offlineFallbackPolicyEvaluation.status}
- Offline fallback-policy coverage: ${report.offlineFallbackPolicyEvaluation.coveragePercent}%

The offline fallback-policy evaluation applies the current production fallback policy to all valid pilot cases without SBERT output. It is counterfactual evidence only; it is not evidence that runtime fallback was triggered.

Final production behavior across all cases:

- Accuracy: ${finalMetrics.accuracy}
- Macro precision/recall/F1: ${finalMetrics.macro.precision} / ${finalMetrics.macro.recall} / ${finalMetrics.macro.f1}
- Weighted precision/recall/F1: ${finalMetrics.weighted.precision} / ${finalMetrics.weighted.recall} / ${finalMetrics.weighted.f1}
- Coverage rate: ${finalMetrics.coverageRate}

## Limitations

${report.limitations.map(limitation => `- ${limitation}`).join('\n')}

## Reproduction

\`\`\`powershell
cd backend
npm run evaluate:topics
\`\`\`

JSON artifact: \`${path.relative(repoRoot, jsonReportPath).replace(/\\/g, '/')}\`
`;
}

async function evaluateCase(evaluationCase, sbertHealth) {
  const submittedTitle = evaluationCase.submitted.title;
  const existingTitle = evaluationCase.existing.title;
  const jaccardScore = normalizeScore(calculateJaccard(submittedTitle, existingTitle).score);
  const tfidfScore = normalizeScore(calculateTfIdfPairScore(submittedTitle, existingTitle, evaluationCase.id));
  const productionFallbackScore = normalizeScore(Math.max(jaccardScore || 0, tfidfScore || 0));
  let sbertScore = null;
  let sbertStatus = sbertHealth.available ? 'pending' : 'skipped';
  let sbertError = null;
  let sbertFailureClass = null;

  if (sbertHealth.available) {
    try {
      sbertScore = normalizeScore(await calculateSbertPairScore(submittedTitle, existingTitle, evaluationCase.id));
      sbertStatus = sbertScore === null ? 'failed' : 'success';
      if (sbertScore === null) {
        sbertError = 'SBERT returned no score.';
        sbertFailureClass = 'malformed_response';
      }
    } catch (error) {
      sbertStatus = 'failed';
      sbertError = error.message;
      sbertFailureClass = classifySbertFailure(error);
    }
  }

  const productionCombinedScore = sbertStatus === 'success'
    ? normalizeScore((jaccardScore || 0) + (tfidfScore || 0) + (sbertScore || 0), { allowAboveOne: true })
    : null;
  const usedFallback = sbertStatus !== 'success';
  const finalProductionScore = usedFallback ? productionFallbackScore : sbertScore;

  const sbertUnavailableReason = sbertHealth.available ? 'sbert_case_failed' : 'sbert_service_unavailable';
  const sbertPrediction = sbertStatus === 'success'
    ? buildPrediction(sbertScore)
    : (sbertStatus === 'failed'
      ? buildFailedPrediction(sbertError || 'sbert_case_failed', sbertFailureClass)
      : buildSkippedPrediction(sbertUnavailableReason));

  const fullTriPrediction = productionCombinedScore === null
    ? (sbertStatus === 'failed'
      ? buildFailedPrediction(sbertError || 'sbert_case_failed', sbertFailureClass)
      : buildSkippedPrediction(sbertUnavailableReason))
    : buildPrediction(productionCombinedScore, { allowAboveOne: true });

  const fallbackPrediction = usedFallback
    ? buildPrediction(productionFallbackScore)
    : buildSkippedPrediction('not_a_fallback_case');
  const offlineFallbackPrediction = buildPrediction(productionFallbackScore);

  const finalPrediction = buildPrediction(finalProductionScore);
  finalPrediction.fallbackUsed = usedFallback;
  finalPrediction.partialSuccess = usedFallback;

  return {
    id: evaluationCase.id,
    category: evaluationCase.category,
    expected_label: evaluationCase.expected_label,
    expected_risk: evaluationCase.expected_risk,
    expected_class: getExpectedClass(evaluationCase),
    source_classification: evaluationCase.source_classification,
    tags: evaluationCase.tags,
    rationale: evaluationCase.rationale || evaluationCase.notes,
    scores: {
      jaccard_only: jaccardScore,
      tfidf_only: tfidfScore,
      sbert_only: sbertScore,
      full_tri_algorithm_cases: productionCombinedScore,
      fallback_combination_cases: usedFallback ? productionFallbackScore : null,
      offlineFallbackPolicyEvaluation: productionFallbackScore,
      final_production_behavior: finalProductionScore
    },
    predictions: {
      jaccard_only: buildPrediction(jaccardScore),
      tfidf_only: buildPrediction(tfidfScore),
      sbert_only: sbertPrediction,
      full_tri_algorithm_cases: fullTriPrediction,
      fallback_combination_cases: fallbackPrediction,
      offlineFallbackPolicyEvaluation: offlineFallbackPrediction,
      final_production_behavior: finalPrediction
    },
    sbert: {
      status: sbertStatus,
      error: sbertError,
      failureClass: sbertFailureClass
    },
    productionMode: usedFallback ? 'partial_success_fallback' : 'normal_success_sbert'
  };
}

async function runEvaluation() {
  const dataset = loadDataset();
  const validation = validateEvaluationDataset(dataset);

  if (!validation.valid) {
    console.error('Evaluation dataset validation failed.');
    validation.errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  const sbertHealth = await getSbertHealthStatus();
  const caseResults = [];

  for (const evaluationCase of dataset.cases) {
    caseResults.push(await evaluateCase(evaluationCase, sbertHealth));
  }

  const summary = buildMethodSummary(caseResults, METHOD_KEYS);
  const sbertCounts = countBy(caseResults, result => result.sbert.status);
  const fallbackUsedCases = caseResults.filter(result => result.productionMode === 'partial_success_fallback').length;
  const fullTriAlgorithmCases = caseResults.filter(result => result.predictions.full_tri_algorithm_cases.risk).length;
  const sbertFailures = caseResults
    .filter(result => result.sbert.status === 'failed')
    .map(result => ({
      id: result.id,
      failureClass: result.sbert.failureClass,
      message: result.sbert.error
    }));
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    commitHash: getCommitHash(),
    mode: sbertHealth.available ? 'sbert_available_full_tri_evaluation' : 'sbert_unavailable_fallback',
    approvedFypSpecification: APPROVED_FYP_SPECIFICATION,
    productionScoring: CURRENT_IMPLEMENTATION_CONTRACT,
    scoringContractComparison: SCORING_CONTRACT_COMPARISON,
    scoringContractStatus: SCORING_CONTRACT_COMPARISON.some(row => row.status === 'DRIFT') ? 'DRIFT' : 'MATCH',
    scoringContractRecommendation: 'Create a separate scoring-contract correction PR before changing production weights, thresholds, tier minima, or overall-risk behavior.',
    productionScoringUnchanged: true,
    dataset: {
      path: path.relative(repoRoot, datasetPath).replace(/\\/g, '/'),
      schemaVersion: dataset.schema_version || 'legacy',
      version: dataset.version,
      description: dataset.description,
      provenance: dataset.provenance,
      totalCases: dataset.cases.length,
      validCases: caseResults.length,
      skippedCases: dataset.cases.length - caseResults.length,
      validationWarnings: validation.warnings,
      classSupport: buildClassSupport(dataset.cases),
      categoryDistribution: countBy(dataset.cases, evaluationCase => evaluationCase.category),
      sourceClassificationDistribution: countBy(dataset.cases, evaluationCase => evaluationCase.source_classification)
    },
    totals: {
      total: dataset.cases.length,
      valid: caseResults.length,
      skipped: dataset.cases.length - caseResults.length,
      failed: caseResults.filter(result => Object.values(result.predictions).some(prediction => prediction.status === 'failed')).length
    },
    sbert: {
      serviceUrl: sbertService.SBERT_SERVICE_URL,
      available: sbertHealth.available,
      healthStatus: sbertHealth,
      attemptedCases: sbertHealth.available ? caseResults.length : 0,
      successCases: sbertCounts.success || 0,
      failedCases: sbertCounts.failed || 0,
      unavailableCases: sbertHealth.available ? 0 : caseResults.length,
      skippedCases: sbertCounts.skipped || 0,
      coverageRate: caseResults.length === 0 ? 0 : normalizeScore((sbertCounts.success || 0) / caseResults.length),
      coveragePercent: caseResults.length === 0 ? 0 : toPercent((sbertCounts.success || 0) / caseResults.length),
      failures: sbertFailures
    },
    coverage: {
      totalCases: caseResults.length,
      fullTriAlgorithmCases,
      fallbackCases: fallbackUsedCases,
      partialSuccessCases: fallbackUsedCases,
      fullTriAlgorithmCoverageRate: caseResults.length === 0 ? 0 : normalizeScore(fullTriAlgorithmCases / caseResults.length),
      fullTriAlgorithmCoveragePercent: caseResults.length === 0 ? 0 : toPercent(fullTriAlgorithmCases / caseResults.length),
      fallbackCoverageRate: caseResults.length === 0 ? 0 : normalizeScore(fallbackUsedCases / caseResults.length),
      fallbackCoveragePercent: caseResults.length === 0 ? 0 : toPercent(fallbackUsedCases / caseResults.length)
    },
    productionFallback: {
      partialSuccessCases: fallbackUsedCases,
      fallbackUsedCases,
      fallbackRate: caseResults.length === 0 ? 0 : normalizeScore(fallbackUsedCases / caseResults.length),
      fallbackPercent: caseResults.length === 0 ? 0 : toPercent(fallbackUsedCases / caseResults.length)
    },
    offlineFallbackPolicyEvaluation: {
      status: 'COUNTERFACTUAL_EVALUATED',
      support: caseResults.length,
      coverageRate: caseResults.length === 0 ? 0 : 1,
      coveragePercent: caseResults.length === 0 ? 0 : 100,
      operationalFallbackUsedCases: fallbackUsedCases,
      includesSbertOutput: false,
      description: 'Applies the current production fallback policy offline to all valid pilot cases. This is not evidence that runtime fallback was triggered.'
    },
    summary,
    cases: caseResults,
    limitations: [
      'The dataset is a manually constructed pilot benchmark and is not final department or lecturer-reviewed ground truth.',
      'The dataset is insufficient for final effectiveness claims.',
      'Pairwise title evaluation is not identical to the full API tiered comparison workflow against all database topics.',
      'SBERT metrics only use cases where the local SBERT service returned a valid numeric embedding-derived score.',
      'Operational fallback metrics remain separate and are marked NOT_EVALUATED when no runtime fallback cases occur.',
      'Offline fallback-policy metrics are counterfactual and must not be described as observed runtime fallback.',
      'No production similarity scoring, thresholds, imports, database schema, API response shape, or frontend behavior is changed by this evaluation.'
    ],
    reproduction: {
      command: 'cd backend && npm run evaluate:topics',
      sbertServiceUrl: sbertService.SBERT_SERVICE_URL,
      jsonReportPath: path.relative(repoRoot, jsonReportPath).replace(/\\/g, '/'),
      markdownReportPath: path.relative(repoRoot, markdownReportPath).replace(/\\/g, '/')
    }
  };

  ensureOutputDirectories();
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownReportPath, renderMarkdownReport(report));

  console.log(JSON.stringify({
    success: true,
    jsonReportPath: report.reproduction.jsonReportPath,
    markdownReportPath: report.reproduction.markdownReportPath,
    mode: report.mode,
    sbertServiceUrl: report.sbert.serviceUrl,
    sbertAvailable: report.sbert.available,
    sbertSuccessCases: report.sbert.successCases,
    sbertFailedCases: report.sbert.failedCases,
    fullTriAlgorithmCases: report.coverage.fullTriAlgorithmCases,
    fullTriAlgorithmCoveragePercent: report.coverage.fullTriAlgorithmCoveragePercent,
    fallbackUsedCases,
    fallbackCoveragePercent: report.coverage.fallbackCoveragePercent,
    finalProductionAccuracy: report.summary.final_production_behavior.accuracy,
    finalProductionMacroF1: report.summary.final_production_behavior.macro.f1
  }, null, 2));
}

if (require.main === module) {
  runEvaluation().catch(error => {
    console.error('Topic evaluation failed.');
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  APPROVED_FYP_SPECIFICATION,
  CURRENT_IMPLEMENTATION_CONTRACT,
  SCORING_CONTRACT_COMPARISON,
  METHOD_KEYS,
  runEvaluation
};
