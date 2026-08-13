const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { formatStructuredContext, calculateClassStatistics, calculateSpearman, calculateConcordance, calculateClassMargins } = require('../evaluation/sbertInputRepresentation.helpers');
const { buildComponents, groupedFolds, assertNoTopicLeakage, groupedCrossValidate, componentBootstrap } = require('../evaluation/groupedCrossValidation.helpers');
const { voyageText, geminiQuery, geminiDocument, pairScores } = require('../evaluation/productionSemanticRetrievalValidation.helpers');

const root = path.join(__dirname, '..', '..');
const backend = path.join(root, 'backend');
const results = path.join(backend, 'evaluation', 'results');
const benchmarkPath = path.join(backend, 'evaluation', 'datasets', 'expanded-semantic-benchmark.json');
const oldPath = path.join(results, 'expanded-semantic-model-evaluation.json');
const completedPath = path.join(results, 'production-semantic-retrieval-validation-completed.json');
const documentationPath = path.join(root, 'docs', 'testing', 'production-semantic-retrieval-validation-completed.md');
const selectionPath = path.join(root, 'docs', 'research', 'semantic-provider-selection-final.md');
const requiredSha = 'b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const rolePath = (provider, role) => path.join(results, `c1.2-${provider}-${role}-embeddings.json`);

function batches(values, size) { return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size)); }
function estimateTokens(text) { return Math.ceil(text.length / 4); }
function safeError(error) { return { status: error.status || null, code: error.code || null, message: String(error.message || 'Provider request failed.').slice(0, 500) }; }
function verifyVectors(vectors, count, dimension, provider) {
  if (!Array.isArray(vectors) || vectors.length !== count) throw new Error(`${provider} returned an unexpected embedding count.`);
  if (vectors.some(vector => !Array.isArray(vector) || vector.length !== dimension || vector.some(value => !Number.isFinite(value)))) throw new Error(`${provider} returned malformed embeddings.`);
  return vectors;
}

function loadPlan() {
  const bytes = fs.readFileSync(benchmarkPath);
  if (sha(bytes) !== requiredSha) throw new Error('Frozen benchmark SHA mismatch.');
  const benchmark = JSON.parse(bytes);
  if (benchmark.cases.length !== 120) throw new Error('Expected 120 benchmark pairs.');
  const topicMap = new Map();
  benchmark.cases.forEach(item => [item.submitted, item.existing].forEach(topic => topicMap.set(formatStructuredContext(topic), topic)));
  if (topicMap.size !== 229) throw new Error(`Expected 229 canonical topics, got ${topicMap.size}.`);
  const values = [...topicMap.values()];
  const components = buildComponents(benchmark.cases, formatStructuredContext);
  if (components.length !== 113) throw new Error(`Expected 113 connected components, got ${components.length}.`);
  const folds = groupedFolds(components); assertNoTopicLeakage(folds);
  return { benchmark, values, components, folds };
}

function dryRun(plan) {
  return {
    dryRun: true, benchmarkSha: requiredSha, pairCount: plan.benchmark.cases.length, canonicalTopics: plan.values.length,
    voyage: ['query', 'document'].map(role => ({ role, batches: batches(plan.values.map(voyageText), 115).map(batch => ({ topics: batch.length, estimatedTokens: batch.reduce((sum, text) => sum + estimateTokens(text), 0) })) })),
    gemini: ['query', 'document'].map(role => ({ role, batches: batches(plan.values.map(role === 'query' ? geminiQuery : geminiDocument), 24).map(batch => ({ topics: batch.length, estimatedTokens: batch.reduce((sum, text) => sum + estimateTokens(text), 0) })) })),
    outputPaths: { completedPath, c11WillNotBeOverwritten: !completedPath.endsWith('production-semantic-retrieval-validation.json') }
  };
}

async function postJson(url, headers, body) {
  const started = Date.now();
  let response;
  try { response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }); }
  catch (error) { error.code = error.code || 'ETEMPORARY'; throw error; }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Provider HTTP ${response.status}: ${json?.error?.message || 'request rejected'}`);
    error.status = response.status;
    const retryAfter = response.headers.get('retry-after');
    error.retryAfterMs = Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : null;
    error.dailyQuota = /daily|per day|rpd/i.test(JSON.stringify(json));
    throw error;
  }
  return { json, elapsedMs: Date.now() - started };
}

async function requestWithPolicy(request, stats, provider) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    stats.requests += 1;
    try { return await request(); }
    catch (error) {
      if (error.status === 429) stats.rateLimits += 1;
      const retryable = error.status === 429 || [500, 502, 503].includes(error.status) || ['ETIMEDOUT', 'ECONNRESET', 'ETEMPORARY'].includes(error.code);
      if (!retryable || error.dailyQuota || attempt === 2) { stats.failures += 1; throw error; }
      stats.retries += 1;
      const wait = error.retryAfterMs ?? (provider === 'voyage' ? 61000 : 6000);
      stats.pacingMs += wait;
      await pause(wait);
    }
  }
}

async function embedRole(provider, role, plan, stats) {
  const dimension = provider === 'voyage' ? 1024 : 3072;
  const size = provider === 'voyage' ? 115 : 24;
  const serializer = provider === 'voyage' ? voyageText : (role === 'query' ? geminiQuery : geminiDocument);
  const texts = plan.values.map(serializer);
  const output = [];
  for (const batch of batches(texts, size)) {
    const result = await requestWithPolicy(async () => {
      if (provider === 'voyage') return postJson('https://api.voyageai.com/v1/embeddings', { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, 'Content-Type': 'application/json' }, { model: 'voyage-4-large', input: batch, input_type: role, output_dtype: 'float' });
      return postJson('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents', { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' }, { requests: batch.map(text => ({ model: 'models/gemini-embedding-2', content: { parts: [{ text }] }, outputDimensionality: 3072 })) });
    }, stats, provider);
    const vectors = provider === 'voyage' ? result.json?.data?.sort((a, b) => a.index - b.index).map(item => item.embedding) : result.json?.embeddings?.map(item => item.values);
    verifyVectors(vectors, batch.length, dimension, provider);
    output.push(...vectors);
    stats.successfulRequests += 1;
    stats.providerProcessingMs += result.elapsedMs;
    if (provider === 'voyage' && Number.isFinite(result.json?.usage?.total_tokens)) stats.inputTokens += result.json.usage.total_tokens;
    if (provider === 'gemini' && Number.isFinite(result.json?.usageMetadata?.promptTokenCount)) stats.inputTokens += result.json.usageMetadata.promptTokenCount;
    if (provider === 'gemini' && output.length < texts.length) { stats.pacingMs += 3000; await pause(3000); }
  }
  verifyVectors(output, 229, dimension, provider);
  const artifact = { provider, model: provider === 'voyage' ? 'voyage-4-large' : 'gemini-embedding-2', dimension, dtype: 'float', role, representation: 'structured-context-v1', canonicalTopics: plan.values.map((topic, index) => ({ canonicalTopicId: index, sourceHash: sha(formatStructuredContext(topic)) })), embeddings: output };
  fs.writeFileSync(rolePath(provider, role), `${JSON.stringify(artifact)}\n`);
  return artifact;
}

function report(rows) { const stats = calculateClassStatistics(rows, 'value'); return { classStatistics: stats, spearman: calculateSpearman(rows, 'value'), concordance: calculateConcordance(rows, 'value'), classMargins: calculateClassMargins(stats) }; }
function direction(rows) { const values = rows.map(row => row.directionDifference).sort((a, b) => a - b); const percentile = value => values[Math.floor((values.length - 1) * value)]; const summary = source => ({ mean: source.reduce((sum, value) => sum + value, 0) / source.length, median: source[Math.floor((source.length - 1) / 2)], p90: source[Math.floor((source.length - 1) * .9)], p95: source[Math.floor((source.length - 1) * .95)], maximum: source.at(-1) }); return { all: summary(values), byClass: Object.fromEntries(['LOW', 'MEDIUM', 'HIGH'].map(label => [label, summary(rows.filter(row => row.expected_class === label).map(row => row.directionDifference).sort((a,b)=>a-b))])) }; }

function scoreProvider(provider, query, document, plan, stats) {
  const byTopic = new Map(plan.values.map((topic, index) => [formatStructuredContext(topic), { query: query.embeddings[index], document: document.embeddings[index] }]));
  const rows = pairScores(plan.benchmark.cases, byTopic);
  return { status: 'COMPLETE', configuration: { provider, model: query.model, query: provider === 'voyage' ? { input_type: 'query' } : 'task: search result | query: structured-context-v1', document: provider === 'voyage' ? { input_type: 'document' } : 'title: title | text: population/location/study_focus or title', dimension: query.dimension, dtype: 'float', representation: 'structured-context-v1' }, rows, metrics: report(rows), directionSensitivity: direction(rows), grouped: groupedCrossValidate(rows, plan.folds, 'value'), operational: { ...stats, queryEmbeddings: query.embeddings.length, documentEmbeddings: document.embeddings.length } };
}

function oldRows(source, name) { return source.models[name].rawCaseResults.map(row => ({ id: row.id, expected_class: row.expected_class, scores: { value: row.scores[name] } })); }
function writeDocuments(result) {
  const lines = ['# C1.2 Production Semantic Retrieval Validation', '', `Benchmark SHA: \`${result.benchmark.sha256After}\`.`, '', 'Live provider details, direction sensitivity, semantic metrics, grouped validation, and bootstrap intervals are in the JSON artifact.'];
  fs.writeFileSync(documentationPath, `${lines.join('\n')}\n`);
  fs.writeFileSync(selectionPath, '# Final Semantic Provider Selection\n\nProvider selection is recorded in the C1.2 completed evaluation artifact. Thresholds remain unfrozen.\n');
}

async function main() {
  const plan = loadPlan();
  if (process.argv.includes('--dry-run')) { process.stdout.write(`${JSON.stringify(dryRun(plan), null, 2)}\n`); return; }
  if (!process.env.VOYAGE_API_KEY || !process.env.GEMINI_API_KEY) throw new Error('Authorized provider API key missing.');
  const before = sha(fs.readFileSync(benchmarkPath));
  const result = { experiment: { id: 'production-semantic-retrieval-validation-c1.2', generatedAt: new Date().toISOString(), scope: 'Controlled live Voyage and Gemini retrieval validation.' }, benchmark: { sha256Before: before, support: { LOW: 39, MEDIUM: 41, HIGH: 40 } }, representation: 'structured-context-v1', uniqueCanonicalTopicCount: 229, grouping: { componentCount: 113, folds: plan.folds.map(fold => ({ fold: fold.fold, caseIds: fold.caseIds, componentIds: fold.componentIds })), leakage: 'PASS' }, providers: {} };
  const old = JSON.parse(fs.readFileSync(oldPath));
  for (const provider of ['voyage', 'gemini']) {
    const stats = { requests: 0, successfulRequests: 0, rateLimits: 0, retries: 0, failures: 0, inputTokens: 0, providerProcessingMs: 0, pacingMs: 0 };
    try {
      const query = await embedRole(provider, 'query', plan, stats);
      if (provider === 'voyage') { stats.pacingMs += 61000; await pause(61000); }
      const document = await embedRole(provider, 'document', plan, stats);
      const scored = scoreProvider(provider, query, document, plan, stats);
      const oldProvider = oldRows(old, provider);
      const oldGrouped = groupedCrossValidate(oldProvider, plan.folds, 'value');
      const bootstrap = componentBootstrap({ voyage: scored.rows, sbert: oldRows(old, 'sbert'), openai: oldRows(old, 'openai'), gemini: oldProvider }, { voyage: scored.grouped.predictions, sbert: groupedCrossValidate(oldRows(old, 'sbert'), plan.folds, 'value').predictions, openai: groupedCrossValidate(oldRows(old, 'openai'), plan.folds, 'value').predictions, gemini: oldGrouped.predictions }, plan.components, { seed: 20260810, replicates: 5000 });
      scored.oldVsNew = { oldMetrics: report(oldProvider), oldGrouped, paired95Interval: bootstrap.voyageMinus.gemini };
      result.providers[provider] = scored;
    } catch (error) { result.providers[provider] = { status: 'VALIDATION_INCOMPLETE', error: safeError(error) }; }
  }
  result.benchmark.sha256After = sha(fs.readFileSync(benchmarkPath));
  if (result.benchmark.sha256After !== before) throw new Error('Benchmark changed during execution.');
  if (result.providers.voyage?.status === 'COMPLETE' && result.providers.gemini?.status === 'COMPLETE') {
    const rows = { sbert: oldRows(old, 'sbert'), openai: oldRows(old, 'openai'), voyage: result.providers.voyage.rows, gemini: result.providers.gemini.rows };
    const grouped = Object.fromEntries(Object.entries(rows).map(([name, value]) => [name, groupedCrossValidate(value, plan.folds, 'value')]));
    result.fourProviderComparison = {
      models: Object.fromEntries(Object.entries(rows).map(([name, value]) => [name, { metrics: report(value), grouped: grouped[name] }])),
      pairedBootstrap: componentBootstrap(rows, Object.fromEntries(Object.entries(grouped).map(([name, value]) => [name, value.predictions])), plan.components, { seed: 20260810, replicates: 5000 })
    };
  }
  fs.writeFileSync(completedPath, `${JSON.stringify(result, null, 2)}\n`);
  writeDocuments(result);
}
if (require.main === module) main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
module.exports = { loadPlan, dryRun, verifyVectors, scoreProvider, batches, estimateTokens };
