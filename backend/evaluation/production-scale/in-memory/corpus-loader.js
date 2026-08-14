const { validStoredEmbedding } = require('../../../src/services/voyageEmbedding.service');
const { retrieve, classify } = require('../../../src/services/voyageSemanticSimilarity.service');
const { COLLECTIONS, isEligibleUnderReview, durationMs } = require('../lib');

function memorySnapshot() { const memory = process.memoryUsage(); return { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal }; }

async function loadRows(prisma) {
  return Object.fromEntries(await Promise.all(COLLECTIONS.map(async ([, key]) => [key, await prisma[key].findMany()])));
}
function withCollection(rowsByCollection) {
  return COLLECTIONS.flatMap(([collection, key]) => (rowsByCollection[key] || []).map(topic => ({ ...topic, collection, studyFocus: topic.studyFocus ?? topic.study_focus })));
}
function buildCorpusFromRows(rowsByCollection, { now = Date.now() } = {}) {
  const validationStart = process.hrtime.bigint(); const allTopics = withCollection(rowsByCollection);
  const admittedTopics = allTopics.filter(validStoredEmbedding);
  return {
    status: 'ready', representation: 'ordinary JavaScript numeric arrays from persisted JSON embeddings', builtAt: new Date(now).toISOString(),
    topics: admittedTopics, counts: { loaded: allTopics.length, admitted: admittedTopics.length, rejected: allTopics.length - admittedTopics.length },
    validationMs: durationMs(validationStart)
  };
}
async function loadCorpus(prisma, { now = Date.now() } = {}) {
  const beforeDatabaseLoad = memorySnapshot(); const buildStart = process.hrtime.bigint();
  const databaseStart = process.hrtime.bigint(); const rows = await loadRows(prisma); const databaseLoadMs = durationMs(databaseStart);
  const corpus = buildCorpusFromRows(rows, { now });
  const immediatePostBuild = memorySnapshot();
  return { ...corpus, databaseLoadMs, totalBuildMs: durationMs(buildStart), memory: { beforeDatabaseLoad, immediatePostBuild, delta: { rss: immediatePostBuild.rss - beforeDatabaseLoad.rss, heapUsed: immediatePostBuild.heapUsed - beforeDatabaseLoad.heapUsed, heapTotal: immediatePostBuild.heapTotal - beforeDatabaseLoad.heapTotal } } };
}
function eligibleTopics(corpus, now = Date.now()) {
  if (!corpus || corpus.status !== 'ready') throw new Error('In-memory corpus is unavailable.');
  return corpus.topics.filter(topic => topic.collection !== 'UNDER_REVIEW' || isEligibleUnderReview(topic, now));
}
function inMemoryCheck(corpus, query, { now = Date.now(), topK = 5 } = {}) {
  const totalStart = process.hrtime.bigint(); const lifecycleStart = process.hrtime.bigint(); const topics = eligibleTopics(corpus, now); const lifecycleAssemblyMs = durationMs(lifecycleStart);
  const rankingStart = process.hrtime.bigint(); const matches = retrieve(query, topics, topK); const similarityRankingMs = durationMs(rankingStart);
  const classificationStart = process.hrtime.bigint(); const overallRisk = classify(matches[0]?.score ?? 0); const classifiedMatches = matches.map(match => ({ ...match, similarityClass: classify(match.score) })); const classificationMs = durationMs(classificationStart);
  return { overallRisk, matches: classifiedMatches, searchableRecords: topics.length, lifecycleAssemblyMs, similarityRankingMs, classificationMs, totalInMemoryProcessingMs: durationMs(totalStart) };
}
class CorpusStore {
  constructor() { this.corpus = null; this.status = 'uninitialized'; this.lastRefreshError = null; }
  get() { if (!this.corpus) throw new Error(`In-memory corpus is unavailable (${this.status}).`); return this.corpus; }
  async refresh(build) {
    try { const next = await build(); if (!next || next.status !== 'ready') throw new Error('Corpus refresh did not produce a ready corpus.'); this.corpus = next; this.status = 'ready'; this.lastRefreshError = null; return next; }
    catch (error) { this.status = this.corpus ? 'stale_refresh_failed' : 'unavailable'; this.lastRefreshError = error.message; throw error; }
  }
}
function sameArrivalBatch(corpus, query, count, { now = Date.now(), check = inMemoryCheck } = {}) {
  return new Promise(resolve => setImmediate(() => {
    const releasedAt = process.hrtime.bigint(); const samples = []; let pending = count;
    for (let index = 0; index < count; index += 1) setImmediate(() => {
      try { const result = check(corpus, query, { now }); samples.push({ ...result, serviceProcessingMs: result.totalInMemoryProcessingMs, requestLatencyMs: durationMs(releasedAt) }); }
      catch (error) { samples.push({ failure: error.message, requestLatencyMs: durationMs(releasedAt) }); }
      pending -= 1; if (!pending) resolve({ samples, wallClockMs: durationMs(releasedAt) });
    });
  }));
}
module.exports = { memorySnapshot, loadRows, withCollection, buildCorpusFromRows, loadCorpus, eligibleTopics, inMemoryCheck, CorpusStore, sameArrivalBatch };
