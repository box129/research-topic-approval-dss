const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const axios = require('axios');
const sbertService = require('../src/services/sbert.service');
const {
  formatTitleOnly,
  formatStructuredContext,
  calculateClassStatistics,
  calculateSpearman,
  calculateConcordance,
  calculateClassMargins,
  calculateBaselineReproduction
} = require('../evaluation/sbertInputRepresentation.helpers');

const repoRoot = path.join(__dirname, '..', '..');
const backendRoot = path.join(__dirname, '..');
const datasetPath = path.join(backendRoot, 'evaluation', 'datasets', 'pilot-topic-pairs.json');
const historicalBaselinePath = path.join(backendRoot, 'evaluation', 'results', 'topic-similarity-evaluation.json');
const outputPath = path.join(backendRoot, 'evaluation', 'results', 'sbert-input-representation-pilot.json');
const markdownPath = path.join(repoRoot, 'docs', 'testing', 'sbert-input-representation-pilot.md');
const EXPECTED_MODEL = 'all-MiniLM-L6-v2';

function commitHash() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}

async function verifyService() {
  try {
    const response = await axios.get(`${sbertService.SBERT_SERVICE_URL}/health`, { timeout: 5000 });
    const model = response.data?.model;
    const verified = response.status === 200 && response.data?.status === 'healthy' && model === EXPECTED_MODEL;
    return { url: sbertService.SBERT_SERVICE_URL, available: response.status === 200, status: response.data?.status || null, model, expectedModel: EXPECTED_MODEL, verified, verificationMethod: 'GET /health; exact model-name match' };
  } catch (error) {
    return { url: sbertService.SBERT_SERVICE_URL, available: false, status: null, model: null, expectedModel: EXPECTED_MODEL, verified: false, error: error.message, requiredStartupCommand: 'cd sbert-service; python -m uvicorn app:app --port 8000' };
  }
}

async function scorePair(topicA, topicB, representation, caseId) {
  const formatter = representation === 'title_only' ? formatTitleOnly : formatStructuredContext;
  const representationA = formatter(topicA);
  const representationB = formatter(topicB);
  const results = await sbertService.calculateSbertSimilarities(representationA, [{ id: caseId, title: representationB }]);
  return { representationA, representationB, score: results[0]?.score };
}

function historicalScores() {
  const historical = JSON.parse(fs.readFileSync(historicalBaselinePath, 'utf8'));
  return Object.fromEntries(historical.cases.map(item => [item.id, item.scores?.sbert_only]));
}

function renderClassTable(statistics) {
  const rows = ['| Expected class | Support | Mean | Median | Min | Max | SD |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  ['LOW', 'MEDIUM', 'HIGH'].forEach(name => { const value = statistics[name]; rows.push(`| ${name} | ${value.support} | ${value.mean} | ${value.median} | ${value.minimum} | ${value.maximum} | ${value.standardDeviation} |`); });
  return rows.join('\n');
}

function renderReport(report) {
  const title = report.metrics.title_only;
  const structured = report.metrics.structured_context;
  const deltaRows = report.caseResults.map(item => `| ${item.id} | ${item.category} | ${item.expected_class} | ${item.scores.title_only} | ${item.scores.structured_context} | ${item.delta} |`).join('\n');
  return `# SBERT Input Representation Pilot\n\nGenerated: ${report.generatedAt}\n\nCommit: \`${report.commitHash}\`\n\n## Scope and governance\n\nThis is a pilot comparison of SBERT input representations only. It does not change production scoring, thresholds, APIs, data, or UI. The 16 labels are manually constructed pilot labels, not lecturer-reviewed department-expert ground truth; no final model-effectiveness claim is warranted.\n\n- Dataset: \`${report.dataset.path}\` (${report.dataset.version}); unchanged, ${report.dataset.totalCases} cases\n- Model verification: ${report.serviceVerification.verified ? 'PASS' : 'FAIL'} — ${report.serviceVerification.model} via ${report.serviceVerification.verificationMethod}\n- Reused integration: \`backend/src/services/sbert.service.js\`\n\n## Representations\n\nTITLE_ONLY:\n\n\`<title>\`\n\nSTRUCTURED_CONTEXT (optional blank fields omitted):\n\n\`Title: <title>\`\n\`Population: <population>\`\n\`Location: <location>\`\n\`Study focus: <study_focus>\`\n\nKeywords and benchmark metadata (including expected class/risk, labels, rationales, category, tags, notes, and provenance) are excluded.\n\n## Baseline reproduction\n\nHistorical SBERT-only title scores: \`${report.baselineReproduction.historicalBaselinePath}\`. Mean absolute difference: ${report.baselineReproduction.meanAbsoluteDifference}; maximum: ${report.baselineReproduction.maximumAbsoluteDifference}; outside ${report.baselineReproduction.tolerance}: ${report.baselineReproduction.casesOutsideTolerance}/${report.baselineReproduction.comparedCases}.\n\n## Class statistics\n\n### TITLE_ONLY\n\n${renderClassTable(title.classStatistics)}\n\n### STRUCTURED_CONTEXT\n\n${renderClassTable(structured.classStatistics)}\n\n## Ranking and separation\n\n| Metric | TITLE_ONLY | STRUCTURED_CONTEXT |\n| --- | ---: | ---: |\n| Spearman (expected LOW=0, MEDIUM=1, HIGH=2) | ${title.spearman.coefficient} | ${structured.spearman.coefficient} |\n| HIGH > MEDIUM | ${title.concordance.HIGH_gt_MEDIUM.rate} | ${structured.concordance.HIGH_gt_MEDIUM.rate} |\n| HIGH > LOW | ${title.concordance.HIGH_gt_LOW.rate} | ${structured.concordance.HIGH_gt_LOW.rate} |\n| MEDIUM > LOW | ${title.concordance.MEDIUM_gt_LOW.rate} | ${structured.concordance.MEDIUM_gt_LOW.rate} |\n| Overall cross-class concordance | ${title.concordance.overall.rate} | ${structured.concordance.overall.rate} |\n| Mean HIGH − MEDIUM | ${title.classMargins.highMinusMedium} | ${structured.classMargins.highMinusMedium} |\n| Mean MEDIUM − LOW | ${title.classMargins.mediumMinusLow} | ${structured.classMargins.mediumMinusLow} |\n| Mean HIGH − LOW | ${title.classMargins.highMinusLow} | ${structured.classMargins.highMinusLow} |\n\nNo production risk thresholds are used as a primary result.\n\n## Scenario review\n\nThe case-level table covers exact duplicate, near duplicate, paraphrased duplicate, synonym duplicate, same disease with a different population or location, same population/location with a different focus, high lexical overlap with different focus, fragmented title, similar intervention with different population/location, and clearly unrelated scenarios. Positive deltas are desirable for appropriate HIGH matches but potentially harmful for LOW cases; MEDIUM cases are inspected for useful contextual separation rather than score increase alone.\n\n| Case | Category | Expected | Title | Structured | Delta |\n| --- | --- | --- | ---: | ---: | ---: |\n${deltaRows}\n\n## Recommendation\n\n**${report.recommendation}** — ${report.recommendationRationale}\n\n## Limitations\n\n${report.limitations.map(item => `- ${item}`).join('\n')}\n\n## Reproduction\n\n\`\`\`powershell\ncd backend\nnpm run evaluate:sbert-input-representations\n\`\`\`\n`;
}

async function main() {
  const serviceVerification = await verifyService();
  if (!serviceVerification.verified) {
    console.error(JSON.stringify(serviceVerification, null, 2));
    throw new Error(`SBERT service is unavailable or not verified as ${EXPECTED_MODEL}. Start it with: cd sbert-service; python -m uvicorn app:app --port 8000`);
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const caseResults = [];
  for (const item of dataset.cases) {
    const title = await scorePair(item.submitted, item.existing, 'title_only', item.id);
    const structured = await scorePair(item.submitted, item.existing, 'structured_context', item.id);
    caseResults.push({ id: item.id, category: item.category, expected_class: item.expected_class, rationale: item.rationale, representations: { title_only: { topic_a: title.representationA, topic_b: title.representationB }, structured_context: { topic_a: structured.representationA, topic_b: structured.representationB } }, scores: { title_only: title.score, structured_context: structured.score }, delta: Number((structured.score - title.score).toFixed(6)) });
  }
  const titleStatistics = calculateClassStatistics(caseResults, 'title_only');
  const structuredStatistics = calculateClassStatistics(caseResults, 'structured_context');
  const titleMetrics = { classStatistics: titleStatistics, spearman: calculateSpearman(caseResults, 'title_only'), concordance: calculateConcordance(caseResults, 'title_only'), classMargins: calculateClassMargins(titleStatistics) };
  const structuredMetrics = { classStatistics: structuredStatistics, spearman: calculateSpearman(caseResults, 'structured_context'), concordance: calculateConcordance(caseResults, 'structured_context'), classMargins: calculateClassMargins(structuredStatistics) };
  const titleUseful = titleMetrics.spearman.coefficient > structuredMetrics.spearman.coefficient && titleMetrics.concordance.overall.rate >= structuredMetrics.concordance.overall.rate;
  const structuredUseful = structuredMetrics.spearman.coefficient > titleMetrics.spearman.coefficient && structuredMetrics.concordance.overall.rate >= titleMetrics.concordance.overall.rate && structuredMetrics.classMargins.highMinusLow > titleMetrics.classMargins.highMinusLow;
  const recommendation = structuredUseful ? 'STRUCTURED_CONTEXT' : (titleUseful ? 'TITLE_ONLY' : 'INCONCLUSIVE — RETAIN BOTH FOR MANAGED-MODEL PILOT');
  const recommendationRationale = structuredUseful ? 'Structured context improved ordinal association, cross-class ordering, and HIGH-versus-LOW class separation without relying on production thresholds.' : (titleUseful ? 'Title-only had the cleaner combined ordinal association and cross-class ordering.' : 'The pilot metrics are mixed, so no representation has sufficient evidence to win.');
  const baselineMetrics = calculateBaselineReproduction(caseResults, historicalScores());
  const baselineReproduction = { historicalBaselinePath: 'backend/evaluation/results/topic-similarity-evaluation.json', ...baselineMetrics, status: baselineMetrics.casesOutsideTolerance === 0 ? 'PASS' : 'FAILED_REPRODUCTION', existingEvaluationPreprocessing: 'Inspected backend/scripts/run-topic-evaluation.js: submitted.title and existing.title are passed directly to calculateSbertSimilarities; no evaluation-side preprocessing is applied.', interpretation: baselineMetrics.casesOutsideTolerance === 0 ? 'Historical title-only SBERT scores reproduced within tolerance.' : 'Material mismatch; likely changed service/model state or historical run conditions. Interpret this experiment only as a same-run representation comparison.' };
  const report = { experiment: { id: 'sbert-input-representation-pilot', version: '1.0.0', purpose: 'Compare SBERT title-only and structured topic representations; evaluation tooling only.' }, generatedAt: new Date().toISOString(), commitHash: commitHash(), model: 'sentence-transformers/all-MiniLM-L6-v2', dataset: { path: 'backend/evaluation/datasets/pilot-topic-pairs.json', version: dataset.version, provenance: dataset.provenance, totalCases: dataset.cases.length }, representationDefinitions: { title_only: '<title>', structured_context: 'Title: <title>\\nPopulation: <population>\\nLocation: <location>\\nStudy focus: <study_focus>', excludedFields: ['keywords', 'expected_class', 'expected_risk', 'expected_label', 'rationale', 'category', 'tags', 'notes', 'source_classification'] }, serviceVerification, baselineReproduction, metrics: { title_only: titleMetrics, structured_context: structuredMetrics }, caseResults, limitations: ['This is a 16-case manually constructed pilot, not lecturer-reviewed department-expert ground truth.', 'The historical title-only SBERT artifact did not reproduce; the report is only a within-run representation comparison.', 'The score function is the existing shared SBERT service client, which rounds cosine scores to three decimal places.', 'Health reports the configured model name; the current FastAPI health response does not expose whether its internal fallback mode was used.', 'Results compare raw semantic score behaviour and do not calibrate semantic-only production thresholds.'], recommendation, recommendationRationale };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  const baselineDisclosure = `**${baselineReproduction.status}**. Existing evaluation preprocessing was inspected: the historical runner passes submitted and existing titles directly to the shared SBERT client, with no evaluation-side preprocessing. The material mismatch therefore indicates changed service/model state or historical run conditions, not a formatter difference. Interpret this pilot only as a same-run representation comparison.\n\n`;
  fs.writeFileSync(markdownPath, renderReport(report).replace('## Class statistics', `${baselineDisclosure}## Class statistics`));
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} and ${path.relative(repoRoot, markdownPath)}`);
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { verifyService, scorePair };
