const os = require('os');
const { execFileSync } = require('child_process');
const { validStoredEmbedding } = require('../../src/services/voyageEmbedding.service');

const COLLECTIONS = [
  ['HISTORICAL', 'historicalTopic'],
  ['CURRENT_SESSION', 'currentSessionTopic'],
  ['UNDER_REVIEW', 'underReviewTopic']
];
const SCALE_FIXTURE_LABEL = 'c4-cloned-voyage-scale-fixture-v1';
const ELIGIBLE_REVIEW_MS = 48 * 60 * 60 * 1000;

function argument(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}
function flag(name, args = process.argv.slice(2)) { return args.includes(name); }
function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}
function assertPerformanceDatabase(env = process.env, { destructive = false } = {}) {
  const target = env.PERF_DATABASE_URL;
  if (!target) throw new Error('PERF_DATABASE_URL is required; DATABASE_URL is never used as a C4 target.');
  if (env.DATABASE_URL && target === env.DATABASE_URL) throw new Error('Refusing C4 operation: PERF_DATABASE_URL matches DATABASE_URL.');
  if (/topic_similarity_v1_dev/i.test(target)) throw new Error('Refusing C4 operation: development database is not a performance-fixture target.');
  if (destructive && !env.SOURCE_DATABASE_URL) throw new Error('SOURCE_DATABASE_URL is required to prepare a cloned scale fixture.');
  if (env.SOURCE_DATABASE_URL && target === env.SOURCE_DATABASE_URL) throw new Error('Refusing C4 operation: source and performance databases must differ.');
  return target;
}
function targetRowCount(rowsByCollection) { return Object.values(rowsByCollection).reduce((total, rows) => total + rows.length, 0); }
function identityDecision(source, target) {
  if (!source?.databaseName || !target?.databaseName) throw new Error('Source and performance database identities are required.');
  if (target.databaseName === 'topic_similarity_v1_dev') throw new Error('Refusing C4 fixture operation: connected target is the development database.');
  if (!/topic_similarity_c4_perf/i.test(target.databaseName)) throw new Error('Refusing C4 fixture operation: target database name must identify topic_similarity_c4_perf.');
  const sameName = source.databaseName === target.databaseName;
  const endpointsKnown = source.serverAddress && source.serverPort && target.serverAddress && target.serverPort;
  if (sameName && (!endpointsKnown || (source.serverAddress === target.serverAddress && source.serverPort === target.serverPort))) throw new Error('Refusing C4 fixture operation: source and target resolve to the same database identity.');
  return { source: { databaseName: source.databaseName, serverAddress: source.serverAddress || null, serverPort: source.serverPort || null }, target: { databaseName: target.databaseName, serverAddress: target.serverAddress || null, serverPort: target.serverPort || null } };
}
async function connectedDatabaseIdentity(client) {
  const rows = await client.$queryRawUnsafe('SELECT current_database() AS "databaseName", inet_server_addr()::text AS "serverAddress", inet_server_port() AS "serverPort"');
  return rows[0];
}
function performanceClient(PrismaClient, url) { return new PrismaClient({ datasources: { db: { url } } }); }
function isEligibleUnderReview(topic, now = Date.now()) {
  return topic.reviewStartedAt && new Date(topic.reviewStartedAt).getTime() > now - ELIGIBLE_REVIEW_MS;
}
function collectionRows(rowsByCollection, now = Date.now()) {
  return COLLECTIONS.flatMap(([collection, key]) => (rowsByCollection[key] || [])
    .filter(topic => collection !== 'UNDER_REVIEW' || isEligibleUnderReview(topic, now))
    .map(topic => ({ ...topic, collection })));
}
function validateFixture(topics, expectedSize, now = Date.now()) {
  if (topics.length !== expectedSize) throw new Error(`Scale fixture contains ${topics.length} searchable records; expected ${expectedSize}.`);
  const invalid = topics.filter(topic => !validStoredEmbedding(topic) || (topic.collection === 'UNDER_REVIEW' && !isEligibleUnderReview(topic, now)));
  if (invalid.length) throw new Error(`Scale fixture is invalid: ${invalid.length} record(s) failed Voyage metadata, 1024D vector, source-hash, or lifecycle eligibility validation.`);
  return { searchableRecords: topics.length, validVectors: topics.length, failures: 0 };
}
function requireSourceTopics(topics) { if (!topics.length) throw new Error('Source database contains no eligible searchable lifecycle records with valid Voyage embeddings.'); return topics; }
function fixedQueryVector() { return Array.from({ length: 1024 }, (_, index) => (((index * 37) % 101) - 50) / 50); }
function durationMs(start) { return Number(process.hrtime.bigint() - start) / 1e6; }
function summary(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / samples.length;
  return { min: sorted[0], p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1), mean, standardDeviation: Math.sqrt(variance) };
}
function environmentMetadata() {
  let gitCommit = 'unavailable';
  try { gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { /* best-effort metadata */ }
  return { timestamp: new Date().toISOString(), nodeVersion: process.version, platform: `${process.platform} ${os.release()}`, cpu: os.cpus()?.[0]?.model || 'unavailable', cpuCount: os.cpus()?.length || 0, totalMemoryBytes: os.totalmem(), gitCommit, fixtureProvenance: 'cloned valid Voyage-embedded demo records; technical scale fixture only, not a departmental distribution' };
}
function cloneData(topic, collection) {
  const copy = { ...topic };
  delete copy.id; delete copy.createdAt; delete copy.updatedAt; delete copy.collection;
  copy.importBatchId = SCALE_FIXTURE_LABEL;
  if (collection === 'UNDER_REVIEW') copy.reviewStartedAt = new Date();
  return copy;
}
function batches(items, size = 250) {
  const batchSize = positiveInteger(size, 'batch size'); const output = [];
  for (let index = 0; index < items.length; index += batchSize) output.push(items.slice(index, index + batchSize));
  return output;
}
module.exports = { COLLECTIONS, SCALE_FIXTURE_LABEL, argument, flag, positiveInteger, assertPerformanceDatabase, targetRowCount, identityDecision, connectedDatabaseIdentity, performanceClient, isEligibleUnderReview, collectionRows, validateFixture, requireSourceTopics, fixedQueryVector, durationMs, summary, environmentMetadata, cloneData, batches };
