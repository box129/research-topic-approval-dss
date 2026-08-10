const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { formatStructuredContext, calculateClassStatistics, calculateSpearman, calculateConcordance, calculateClassMargins } = require('../evaluation/sbertInputRepresentation.helpers');
const { PROVIDERS, ADAPTERS, cosineSimilarity } = require('../evaluation/managedEmbeddingProviders');

const root = path.join(__dirname, '..', '..');
const backend = path.join(__dirname, '..');
const datasetPath = path.join(backend, 'evaluation', 'datasets', 'pilot-topic-pairs.json');
const sbertPath = path.join(backend, 'evaluation', 'results', 'sbert-input-representation-pilot.json');
const outputPath = path.join(backend, 'evaluation', 'results', 'managed-embedding-pilot.json');
const markdownPath = path.join(root, 'docs', 'testing', 'managed-embedding-pilot.md');

const round = value => Math.round(value * 1e6) / 1e6;
const percentile = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * 0.95) - 1]; };
const commit = () => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };

async function timed(fn) { const start = process.hrtime.bigint(); const result = await fn(); return { result, milliseconds: Number(process.hrtime.bigint() - start) / 1e6 }; }
function latencySummary(values) { return { requests: values.length, successCount: values.length, failureCount: 0, retries: 0, meanMilliseconds: round(values.reduce((a, b) => a + b, 0) / values.length), medianMilliseconds: round([...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]), p95Milliseconds: round(percentile(values)), minimumMilliseconds: round(Math.min(...values)), maximumMilliseconds: round(Math.max(...values)) }; }
function modelMetrics(results, key) { const stats = calculateClassStatistics(results, key); return { classStatistics: stats, spearman: calculateSpearman(results, key), concordance: calculateConcordance(results, key), classMargins: calculateClassMargins(stats) }; }
function storage(dimension) { const one = dimension * 4; return { float32BytesPerEmbedding: one, float32BytesFor5000Embeddings: one * 5000, excludes: ['PostgreSQL row overhead', 'vector-index overhead', 'metadata', 'replication', 'database page overhead'] }; }

async function evaluateProvider(key, cases, representative) {
  const adapter = ADAPTERS[key];
  const inputs = cases.flatMap(item => [item.representations.structured_context.topic_a, item.representations.structured_context.topic_b]);
  const outcome = { requestCount: 0, successCount: 0, failureCount: 0, retries: 0, errors: [] };
  try {
    const bulk = await timed(() => adapter(inputs));
    outcome.requestCount += key === 'gemini' ? inputs.length : 1;
    outcome.successCount += key === 'gemini' ? inputs.length : 1;
    const vectors = bulk.result.vectors;
    const dimension = vectors[0].length;
    const results = cases.map((item, index) => ({ ...item, scores: { [key]: round(cosineSimilarity(vectors[index * 2], vectors[index * 2 + 1])) } }));
    let warmupMilliseconds = null;
    const latencyValues = [];
    try {
      const warmup = await timed(() => adapter([representative]));
      warmupMilliseconds = round(warmup.milliseconds); outcome.requestCount += 1; outcome.successCount += 1;
      for (let index = 0; index < 10; index += 1) { const sample = await timed(() => adapter([representative])); latencyValues.push(sample.milliseconds); outcome.requestCount += 1; outcome.successCount += 1; }
    } catch (error) { outcome.failureCount += 1; outcome.errors.push({ type: error.status ? 'http' : 'provider', status: error.status || null, message: error.status ? `HTTP ${error.status}` : 'provider request failed' }); }
    const usage = bulk.result.usage;
    return { provider: PROVIDERS[key], status: 'SUCCESS', dimension, storage: storage(dimension), results, metrics: modelMetrics(results, key), latency: latencyValues.length ? { warmupMilliseconds, ...latencySummary(latencyValues), failureCount: outcome.failureCount, retries: outcome.retries } : { warmupMilliseconds, requests: 0, successCount: 0, failureCount: outcome.failureCount, retries: outcome.retries, status: 'incomplete' }, consumption: { apiCalls: outcome.requestCount, measuredInputTokens: usage.inputTokens, averageTokensPerStructuredTopic: Number.isFinite(usage.inputTokens) ? round(usage.inputTokens / inputs.length) : null, providerUsageMetadata: usage.raw, datedPricingSnapshotUsdPerMillionInputTokens: PROVIDERS[key].pricePerMillionTokens, estimatedBulkInputCostUsd: Number.isFinite(usage.inputTokens) ? round((usage.inputTokens / 1e6) * PROVIDERS[key].pricePerMillionTokens) : null }, observedErrors: outcome.errors };
  } catch (error) {
    outcome.failureCount += 1; outcome.errors.push({ type: error.status ? 'http' : 'provider', status: error.status || null, message: error.status ? `HTTP ${error.status}` : 'provider request failed' });
    return { provider: PROVIDERS[key], status: 'FAILED', metrics: null, latency: { requests: 0, successCount: 0, failureCount: 1, retries: 0 }, consumption: { apiCalls: outcome.requestCount, measuredInputTokens: null, averageTokensPerStructuredTopic: null, providerUsageMetadata: null, datedPricingSnapshotUsdPerMillionInputTokens: PROVIDERS[key].pricePerMillionTokens, estimatedBulkInputCostUsd: null }, observedErrors: outcome.errors };
  }
}

function render(report) {
  const models = Object.entries(report.models).filter(([, value]) => value.status === 'SUCCESS');
  const rows = models.map(([key, value]) => `| ${key} | ${value.dimension} | ${value.metrics.spearman.coefficient} | ${value.metrics.concordance.overall.rate} | ${value.metrics.classMargins.highMinusLow} | ${value.latency.meanMilliseconds ?? value.latency.status ?? 'not measured'} |`).join('\n');
  const stats = models.map(([key, value]) => ['LOW', 'MEDIUM', 'HIGH'].map(label => { const x = value.metrics.classStatistics[label]; return `| ${key} | ${label} | ${x.support} | ${x.mean} | ${x.median} | ${x.minimum} | ${x.maximum} | ${x.standardDeviation} |`; }).join('\n')).join('\n');
  return `# Managed Embedding Provider Pilot\n\nThis is 16-case pilot screening only. No provider has been selected for production. The unchanged labels are manually constructed and are not lecturer-reviewed ground truth.\n\n- Structured representation: Title, Population, Location, Study focus; blank fields omitted; metadata excluded.\n- Historical SBERT artifact: invalidated because it was deterministic hash fallback output.\n- Baseline: verified current real-model SBERT structured-context scores from checkpoint \`7158df8\`.\n\n## Semantic comparison\n\n| Model | Dimension | Spearman | Overall concordance | HIGH - LOW margin | Mean latency ms |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n## Class statistics\n\n| Model | Expected class | Support | Mean | Median | Min | Max | SD |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n${stats}\n\n## Recommendation\n\n**${report.recommendation}** — ${report.recommendationRationale}\n\n## Operational notes\n\nManaged providers require server-side keys and create a managed-service dependency; SBERT requires a local model service. Float32 storage is dimension x 4 bytes and excludes database/index/metadata/replication/page overhead. API errors and token metadata are preserved in the JSON artifact; unavailable usage is reported as null, not estimated. Pricing is the dated snapshot supplied in the experiment brief.\n\n## Limitations\n\n${report.limitations.map(item => `- ${item}`).join('\n')}\n`;
}

async function main() {
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const sbert = JSON.parse(fs.readFileSync(sbertPath, 'utf8'));
  const baseCases = dataset.cases.map(item => ({ id: item.id, category: item.category, expected_class: item.expected_class, rationale: item.rationale, representations: { structured_context: { topic_a: formatStructuredContext(item.submitted), topic_b: formatStructuredContext(item.existing) } } }));
  const sbertScores = new Map(sbert.caseResults.map(item => [item.id, item.scores.structured_context]));
  const sbertResults = baseCases.map(item => ({ ...item, scores: { sbert: sbertScores.get(item.id) } }));
  const representative = baseCases[0].representations.structured_context.topic_a;
  const models = { sbert: { provider: { name: 'SBERT', model: 'sentence-transformers/all-MiniLM-L6-v2' }, status: 'SUCCESS', dimension: 384, storage: storage(384), results: sbertResults, metrics: modelMetrics(sbertResults, 'sbert'), latency: { status: 'not_measured_in_this_run' }, consumption: { apiCalls: 0, measuredInputTokens: null, averageTokensPerStructuredTopic: null }, observedErrors: [] } };
  for (const key of ['openai', 'voyage', 'gemini']) models[key] = await evaluateProvider(key, baseCases, representative);
  const successfulManaged = Object.entries(models).filter(([key, value]) => key !== 'sbert' && value.status === 'SUCCESS');
  const ranked = [...Object.entries(models).filter(([, value]) => value.status === 'SUCCESS')].sort((a, b) => (b[1].metrics.spearman.coefficient - a[1].metrics.spearman.coefficient) || (b[1].metrics.concordance.overall.rate - a[1].metrics.concordance.overall.rate) || (b[1].metrics.classMargins.highMinusLow - a[1].metrics.classMargins.highMinusLow));
  const winner = ranked[0];
  const conclusion = successfulManaged.length === 3 && winner ? (winner[0] === 'openai' ? 'OPENAI_LEADS_PILOT' : winner[0] === 'voyage' ? 'VOYAGE_LEADS_PILOT' : winner[0] === 'gemini' ? 'GEMINI_LEADS_PILOT' : 'SBERT_LEADS_PILOT') : 'INCONCLUSIVE';
  const report = { experiment: { id: 'managed-embedding-pilot', version: '1.0.0', generatedAt: new Date().toISOString(), commitHash: commit(), scope: 'Evaluation-only pilot screening; no production provider selected.' }, dataset: { path: 'backend/evaluation/datasets/pilot-topic-pairs.json', version: dataset.version, totalCases: dataset.cases.length, provenance: dataset.provenance }, representation: { canonical: 'Title: <title>\\nPopulation: <population>\\nLocation: <location>\\nStudy focus: <study_focus>', blankFields: 'omitted', excluded: ['keywords', 'expected labels/classes', 'rationale', 'category', 'tags', 'notes', 'source_classification'] }, sbertBaseline: { source: 'backend/evaluation/results/sbert-input-representation-pilot.json', verification: 'Checkpoint 7158df8 verified current real SentenceTransformer behavior against direct model execution; historical artifact invalidated.' }, models, recommendation: conclusion, recommendationRationale: conclusion === 'INCONCLUSIVE' ? 'At least one managed provider did not complete the full semantic and latency pilot, so the pilot cannot support a four-model lead.' : `${winner[1].provider.name} leads this 16-case pilot on the predeclared threshold-independent semantic ordering metrics. This is not a production selection.`, limitations: ['Sixteen cases are manually constructed pilot data, not final lecturer-reviewed ground truth.', 'The latency sample is 10 measured requests and is only observed pilot latency.', 'Provider response dimensions, token metadata, availability, and pricing can vary by account, region, and time.', 'No arbitrary shared semantic thresholds, precision, recall, or F1 were used.'] };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, render(report));
  console.log(`Wrote ${path.relative(root, outputPath)} and ${path.relative(root, markdownPath)}`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { evaluateProvider, latencySummary, render };
