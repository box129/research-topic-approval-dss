const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');
const { formatStructuredContext } = require('../evaluation/sbertInputRepresentation.helpers');
const { ADAPTERS, PROVIDERS } = require('../evaluation/managedEmbeddingProviders');
const { canonicalTopics, reconstruct, metrics, crossValidate, contextGroups, scenario } = require('../evaluation/expandedSemanticModelEvaluation.helpers');
const { identityFor, loadCheckpoint, saveCheckpoint } = require('../evaluation/expandedSemanticModelCheckpoint');

const root = path.join(__dirname, '..', '..');
const backend = path.join(root, 'backend');
const datasetPath = path.join(backend, 'evaluation', 'datasets', 'expanded-semantic-benchmark.json');
const outPath = path.join(backend, 'evaluation', 'results', 'expanded-semantic-model-evaluation.json');
const docPath = path.join(root, 'docs', 'testing', 'expanded-semantic-model-evaluation.md');
const VOYAGE_MAX_TEXTS_PER_REQUEST = 1000;
const GEMINI_DEFAULT_BATCH_SIZE = 32;
const GEMINI_INTER_BATCH_PACING_MS = 1000;

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const round = value => Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null;
const commit = () => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const storage = dimension => ({ float32BytesPerEmbedding: dimension * 4, float32BytesFor5000Embeddings: dimension * 4 * 5000, excludes: ['PostgreSQL row overhead', 'pgvector index overhead', 'metadata', 'replication', 'page/storage overhead'] });

function validate(dataset) {
  const support = dataset.cases.reduce((counts, item) => { counts[item.expected_class] += 1; return counts; }, { LOW: 0, MEDIUM: 0, HIGH: 0 });
  if (dataset.cases.length !== 120 || support.LOW !== 39 || support.MEDIUM !== 41 || support.HIGH !== 40) throw new Error('Frozen benchmark support mismatch.');
  const incomplete = dataset.cases.filter(item => ['submitted', 'existing'].some(side => ['population', 'location', 'study_focus'].some(field => !item[side][field])));
  if (incomplete.length !== 15) throw new Error('Frozen benchmark missing-context mismatch.');
  if (dataset.provenance?.source_classification !== 'manually_constructed_expanded_benchmark' || dataset.provenance?.validation_status !== 'not_department_expert_validated') throw new Error('Frozen benchmark provenance mismatch.');
  return support;
}

function directSbert(texts) {
  const script = path.join(backend, 'evaluation', 'direct_sbert_embed.py');
  const result = spawnSync('python', [script], { input: JSON.stringify({ model: 'sentence-transformers/all-MiniLM-L6-v2', texts }), encoding: 'utf8', cwd: root, maxBuffer: 1024 * 1024 * 128, timeout: 300000 });
  if (result.error || result.status !== 0) throw new Error(`Direct SentenceTransformer failed: ${result.error?.message || result.stderr || 'unknown error'}`);
  const body = JSON.parse(result.stdout);
  if (body.model !== 'sentence-transformers/all-MiniLM-L6-v2' || body.dimension !== 384 || body.vectors.length !== texts.length) throw new Error('Direct SentenceTransformer verification failed.');
  return body;
}

function retryCategory(error) {
  if (!error.status) return 'temporary_network';
  if (error.status === 408) return 'http_408';
  if (error.status === 429) return 'http_429';
  if (error.status >= 500 && error.status <= 599) return 'http_5xx';
  return 'permanent_http';
}

function retryDelayMilliseconds(error, retryNumber) {
  const retryAfter = error.retryAfterMilliseconds;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter;
  const base = error.status === 429 ? [15000, 30000, 60000][retryNumber - 1] : [1000, 2000, 4000][retryNumber - 1];
  return base + ((retryNumber * 137) % 251);
}

async function retry(fn, usage, context, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try { return await fn(); }
    catch (error) {
      const category = retryCategory(error);
      const retryable = ['temporary_network', 'http_408', 'http_429', 'http_5xx'].includes(category);
      const exhausted = attempt === 4 || !retryable;
      const delayMilliseconds = exhausted ? null : retryDelayMilliseconds(error, attempt);
      const event = { provider: context.provider, model: context.model, batchIndex: context.batchIndex, attempt, errorCategory: category, status: error.status || null, retryAfterSupplied: Number.isFinite(error.retryAfterMilliseconds), delayMilliseconds, outcome: exhausted ? 'failed' : 'retrying' };
      usage.retryEvents.push(event);
      usage.failures += 1;
      if (exhausted) {
        error.retryEvents = usage.retryEvents;
        error.provider = context.provider;
        error.model = context.model;
        error.attemptCount = attempt;
        throw error;
      }
      usage.retries += 1;
      await sleep(delayMilliseconds);
    }
  }
}

function planManagedBatches(key, texts, { geminiBatchSize = GEMINI_DEFAULT_BATCH_SIZE } = {}) {
  if (key === 'voyage') {
    if (texts.length > VOYAGE_MAX_TEXTS_PER_REQUEST) throw new Error(`Voyage request exceeds the ${VOYAGE_MAX_TEXTS_PER_REQUEST}-text limit.`);
    return [texts];
  }
  const batchSize = key === 'gemini' ? geminiBatchSize : 64;
  return Array.from({ length: Math.ceil(texts.length / batchSize) }, (_, index) => texts.slice(index * batchSize, (index + 1) * batchSize));
}

function checkpointIdentity(key, inputs, benchmarkSha256) {
  const settings = {
    sbert: { model: 'sentence-transformers/all-MiniLM-L6-v2', dimension: 384, configuration: {} },
    openai: { model: PROVIDERS.openai.model, dimension: 3072, configuration: {} },
    voyage: { model: PROVIDERS.voyage.model, dimension: 1024, configuration: { input_type: null } },
    gemini: { model: PROVIDERS.gemini.model, dimension: 3072, configuration: { instruction: 'task: sentence similarity | query: {canonical structured content}' } }
  }[key];
  return identityFor({ benchmarkSha256, canonicalInputs: inputs, provider: key, ...settings });
}

async function managed(key, texts, { geminiBatchSize = GEMINI_DEFAULT_BATCH_SIZE, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds),), checkpoint = null } = {}) {
  if (checkpoint) {
    const cached = loadCheckpoint(checkpoint, texts);
    if (cached.valid) return { vectors: cached.payload.vectors, usage: { inputTokens: null, retryEvents: [], checkpointRetryEvents: cached.payload.retryEvents || [], checkpointCreatedAt: cached.payload.createdAt, embeddingSource: 'validated_checkpoint' } };
  }
  const usage = { requests: 0, successfulRequests: 0, failures: 0, retries: 0, retryEvents: [], inputTokens: 0, tokenAvailable: true };
  const vectors = [];
  const batches = planManagedBatches(key, texts, { geminiBatchSize });
  for (const [batchOffset, batch] of batches.entries()) {
    const result = await retry(async () => {
      usage.requests += 1;
      const response = await ADAPTERS[key](batch);
      usage.successfulRequests += 1;
      return response;
    }, usage, { provider: PROVIDERS[key].name, model: PROVIDERS[key].model, batchIndex: batchOffset + 1 }, sleep);
    if (!Array.isArray(result.vectors) || result.vectors.length !== batch.length) throw new Error(`${PROVIDERS[key].name} returned an unexpected embedding count.`);
    if (key === 'voyage' && result.vectors.some(vector => vector.length !== 1024)) throw new Error('Voyage returned an unexpected embedding dimension.');
    if (key === 'gemini' && result.vectors.some(vector => vector.length !== 3072)) throw new Error('Gemini returned an unexpected embedding dimension.');
    vectors.push(...result.vectors);
    if (Number.isFinite(result.usage.inputTokens)) usage.inputTokens += result.usage.inputTokens;
    else usage.tokenAvailable = false;
    if (key === 'gemini' && batchOffset + 1 < batches.length) await sleep(GEMINI_INTER_BATCH_PACING_MS);
  }
  const completedUsage = { ...usage, inputTokens: usage.tokenAvailable ? usage.inputTokens : null, embeddingSource: 'fresh_execution' };
  if (checkpoint) saveCheckpoint(checkpoint, texts, vectors, { usage: { inputTokens: completedUsage.inputTokens }, runtime: { requests: usage.requests }, retryEvents: usage.retryEvents });
  return { vectors, usage: completedUsage };
}

function modelRecord(key, cases, inputs, vectors, extra = {}) {
  const vectorMap = new Map(inputs.map((input, index) => [input, vectors[index]]));
  const rawCaseResults = reconstruct(cases, formatStructuredContext, vectorMap, key);
  return { provider: key === 'sbert' ? { name: 'SBERT', model: 'sentence-transformers/all-MiniLM-L6-v2' } : PROVIDERS[key], status: 'SUCCESS', dimension: vectors[0].length, storage: storage(vectors[0].length), rawCaseResults, metrics: metrics(rawCaseResults, key), exploratoryCrossValidatedClassification: crossValidate(rawCaseResults, key), completeVsIncomplete: contextGroups(rawCaseResults, key), scenarioAnalysis: scenario(rawCaseResults, key), ...extra };
}

function markdown(report) {
  const rows = Object.entries(report.models).map(([key, model]) => `| ${key} | ${model.dimension} | ${model.metrics.spearman.coefficient} | ${model.metrics.concordance.overall.rate} | ${model.metrics.classMargins.highMinusLow} | ${model.exploratoryCrossValidatedClassification.overall.macroF1} |`).join('\n');
  return `# Expanded Semantic Model Evaluation\n\nEvaluation-only comparison on a frozen manually constructed 120-pair benchmark.\n\n- Benchmark SHA-256 before/after: \`${report.benchmark.sha256Before}\` / \`${report.benchmark.sha256After}\`\n- Support: 39 LOW, 41 MEDIUM, 40 HIGH; 15 deliberate missing-context pairs.\n\n| Model | Dimension | Spearman | Overall concordance | HIGH-LOW margin | Exploratory CV macro F1 |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n**${report.recommendation}** — leading candidate on the manually constructed 120-pair expanded benchmark; this is not a final production model selection.\n`;
}

async function main() {
  const sha256Before = sha(datasetPath);
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const support = validate(dataset);
  const inputs = canonicalTopics(dataset.cases, formatStructuredContext);
  const report = { experiment: { id: 'expanded-semantic-model-evaluation', generatedAt: new Date().toISOString(), commitHash: commit(), scope: 'Evaluation only; no production selection.' }, benchmark: { path: 'backend/evaluation/datasets/expanded-semantic-benchmark.json', sha256Before, support, totalCases: 120, missingContextPairs: 15, provenance: dataset.provenance }, representation: { canonical: 'Title: <title>\\nPopulation: <population>\\nLocation: <location>\\nStudy focus: <study_focus>', blankFields: 'omitted' }, inputDeduplication: { totalTopicSides: 240, uniqueCanonicalInputs: inputs.length, duplicatesAvoided: 240 - inputs.length }, models: {} };
  const sbertCheckpoint = checkpointIdentity('sbert', inputs, sha256Before); const cachedSbert = loadCheckpoint(sbertCheckpoint, inputs); const sbertStarted = Date.now();
  const sbert = cachedSbert.valid ? { vectors: cachedSbert.payload.vectors, environment: null, checkpoint: cachedSbert.payload } : directSbert(inputs);
  if (!cachedSbert.valid) saveCheckpoint(sbertCheckpoint, inputs, sbert.vectors, { runtime: { method: 'direct SentenceTransformer' } });
  report.models.sbert = modelRecord('sbert', dataset.cases, inputs, sbert.vectors, { embeddingSource: cachedSbert.valid ? 'validated_checkpoint' : 'fresh_execution', checkpointCreatedAt: cachedSbert.valid ? cachedSbert.payload.createdAt : null, execution: { method: cachedSbert.valid ? 'validated checkpoint' : 'direct SentenceTransformer', environment: sbert.environment, wallClockMilliseconds: Date.now() - sbertStarted, verifiedRealModel: !cachedSbert.valid, noHashFallback: true }, consumption: { apiRequests: 0, embeddingInputs: inputs.length, successfulRequests: 0, failures: 0, retries: 0, retryEvents: cachedSbert.valid ? [] : [] } });
  for (const key of ['openai', 'voyage', 'gemini']) {
    const started = Date.now();
    const response = await managed(key, inputs, { checkpoint: checkpointIdentity(key, inputs, sha256Before) });
    report.models[key] = modelRecord(key, dataset.cases, inputs, response.vectors, { embeddingSource: response.usage.embeddingSource, checkpointCreatedAt: response.usage.checkpointCreatedAt || null, checkpointRetryEvents: response.usage.checkpointRetryEvents || [], execution: { wallClockMilliseconds: Date.now() - started }, consumption: { apiRequests: response.usage.requests || 0, embeddingInputs: inputs.length, successfulRequests: response.usage.successfulRequests || 0, failures: response.usage.failures || 0, retries: response.usage.retries || 0, retryEvents: response.usage.retryEvents || [], reportedInputTokens: response.usage.inputTokens, estimatedListPriceUsd: response.usage.inputTokens === null ? null : round(response.usage.inputTokens / 1e6 * PROVIDERS[key].pricePerMillionTokens), pricingSnapshot: 'August 2026 list-price snapshot' } });
  }
  report.benchmark.sha256After = sha(datasetPath);
  if (sha256Before !== report.benchmark.sha256After) throw new Error('Benchmark-integrity failure: SHA-256 changed.');
  const winner = Object.entries(report.models).sort((a, b) => (b[1].metrics.spearman.coefficient - a[1].metrics.spearman.coefficient) || (b[1].metrics.concordance.overall.rate - a[1].metrics.concordance.overall.rate) || (b[1].metrics.classMargins.highMinusLow - a[1].metrics.classMargins.highMinusLow))[0][0].toUpperCase();
  report.recommendation = `${winner}_LEADS_EXPANDED_BENCHMARK`;
  report.pilotComparison = { source: 'backend/evaluation/results/managed-embedding-pilot.json', previousConclusion: 'SBERT_LEADS_PILOT', separateDatasets: true };
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(docPath, markdown(report));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { validate, directSbert, managed, checkpointIdentity, planManagedBatches, retry, retryCategory, retryDelayMilliseconds, VOYAGE_MAX_TEXTS_PER_REQUEST, GEMINI_DEFAULT_BATCH_SIZE, GEMINI_INTER_BATCH_PACING_MS };
