#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { retrieve, classify } = require('../../src/services/voyageSemanticSimilarity.service');
const { COLLECTIONS, argument, positiveInteger, assertPerformanceDatabase, performanceClient, collectionRows, validateFixture, fixedQueryVector, durationMs, summary, environmentMetadata } = require('./lib');

async function loadTopics(client) { return Object.fromEntries(await Promise.all(COLLECTIONS.map(async ([, key]) => [key, await client[key].findMany()]))); }
async function oneIteration(client, query, expectedSize) {
  const totalStart = process.hrtime.bigint();
  const retrievalStart = process.hrtime.bigint(); const rows = await loadTopics(client); const databaseRetrievalMs = durationMs(retrievalStart);
  const assemblyStart = process.hrtime.bigint(); const topics = collectionRows(rows); const lifecycleAssemblyMs = durationMs(assemblyStart);
  if (topics.length !== expectedSize) throw new Error(`Searchable record count changed during benchmark: expected ${expectedSize}, found ${topics.length}.`);
  const similarityStart = process.hrtime.bigint(); const matches = retrieve(query, topics, 5); const similarityRankingMs = durationMs(similarityStart);
  const classificationStart = process.hrtime.bigint(); classify(matches[0]?.score ?? 0); matches.map(match => classify(match.score)); const classificationMs = durationMs(classificationStart);
  return { databaseRetrievalMs, lifecycleAssemblyMs, similarityRankingMs, classificationMs, totalLocalProcessingMs: durationMs(totalStart), searchableRecords: topics.length, validVectors: topics.length, failures: 0 };
}
async function recordedIteration(client, query, expectedSize) {
  try { return await oneIteration(client, query, expectedSize); }
  catch (error) { return { failure: error.message }; }
}
async function main() {
  const perfUrl = assertPerformanceDatabase(); const scale = argument('--scale') || 'small'; const expectedSize = scale === 'small' ? null : positiveInteger(scale, '--scale');
  if (expectedSize && ![1000, 5000, 10000].includes(expectedSize)) throw new Error('--scale must be small, 1000, 5000, or 10000.');
  const warmups = positiveInteger(argument('--warmups') || '3', '--warmups'); const iterations = positiveInteger(argument('--iterations') || '30', '--iterations'); const concurrency = positiveInteger(argument('--concurrency') || '1', '--concurrency');
  if (![1, 5, 10].includes(concurrency)) throw new Error('--concurrency must be 1, 5, or 10.');
  const client = performanceClient(PrismaClient, perfUrl); const query = fixedQueryVector();
  try {
    const initial = collectionRows(await loadTopics(client)); const corpusSize = expectedSize || initial.length; validateFixture(initial, corpusSize);
    for (let index = 0; index < warmups; index += 1) await oneIteration(client, query, corpusSize);
    const memoryBeforeMeasuredPhase = process.memoryUsage().rss; let maximumObservedRss = memoryBeforeMeasuredPhase; const raw = []; const batches = [];
    for (let index = 0; index < iterations; index += concurrency) {
      maximumObservedRss = Math.max(maximumObservedRss, process.memoryUsage().rss); const batchStart = process.hrtime.bigint();
      const samples = await Promise.all(Array.from({ length: Math.min(concurrency, iterations - index) }, () => recordedIteration(client, query, corpusSize)));
      const wallClockMs = durationMs(batchStart); maximumObservedRss = Math.max(maximumObservedRss, process.memoryUsage().rss); raw.push(...samples); batches.push({ requestCount: samples.length, wallClockMs, checksPerSecond: samples.length / (wallClockMs / 1000), failureCount: samples.filter(sample => sample.failure).length });
    }
    const memoryAfterMeasuredPhase = process.memoryUsage().rss;
    const successful = raw.filter(sample => !sample.failure); if (!successful.length) throw new Error('All measured local iterations failed; resolve fixture validation before benchmarking.');
    const metric = key => summary(successful.map(sample => sample[key]));
    const result = { ...environmentMetadata(), benchmark: 'warm/repeated local persisted-vector retrieval only; no provider latency', scale, corpusSize, warmups, iterations, concurrency, metrics: { databaseRetrievalMs: metric('databaseRetrievalMs'), lifecycleAssemblyMs: metric('lifecycleAssemblyMs'), similarityRankingMs: metric('similarityRankingMs'), classificationMs: metric('classificationMs'), totalLocalProcessingMs: metric('totalLocalProcessingMs'), processMemoryRssBytes: { beforeMeasuredPhase: memoryBeforeMeasuredPhase, afterMeasuredPhase: memoryAfterMeasuredPhase, maximumAtBatchBoundaries: maximumObservedRss }, throughputChecksPerSecond: summary(batches.map(batch => batch.checksPerSecond)) }, searchableRecords: successful[0].searchableRecords, validVectors: successful[0].validVectors, failureCount: raw.filter(sample => sample.failure).length, rawMeasurements: raw, rawBatches: batches };
    const output = argument('--output'); if (output) { fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2)); }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally { await client.$disconnect(); }
}
main().catch(error => { process.stderr.write(`C4 local benchmark failed: ${error.message}\n`); process.exitCode = 1; });
