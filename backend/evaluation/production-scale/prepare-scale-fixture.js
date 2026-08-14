#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { COLLECTIONS, SCALE_FIXTURE_LABEL, argument, flag, positiveInteger, assertPerformanceDatabase, targetRowCount, identityDecision, connectedDatabaseIdentity, performanceClient, collectionRows, validateFixture, requireSourceTopics, cloneData, batches } = require('./lib');

async function readRows(client) {
  const pairs = await Promise.all(COLLECTIONS.map(async ([, key]) => [key, await client[key].findMany()]));
  return Object.fromEntries(pairs);
}
function scaleSize(value, sourceCount) {
  if (value === 'small') return sourceCount;
  const size = positiveInteger(value, '--size');
  if (![1000, 5000, 10000].includes(size)) throw new Error('--size must be small, 1000, 5000, or 10000.');
  return size;
}
async function main() {
  const perfUrl = assertPerformanceDatabase(process.env, { destructive: true });
  const source = performanceClient(PrismaClient, process.env.SOURCE_DATABASE_URL);
  const target = performanceClient(PrismaClient, perfUrl);
  try {
    identityDecision(await connectedDatabaseIdentity(source), await connectedDatabaseIdentity(target));
    const sourceRows = await readRows(source);
    const sourceTopics = collectionRows(sourceRows);
    requireSourceTopics(sourceTopics);
    validateFixture(sourceTopics, sourceTopics.length);
    const targetSize = scaleSize(argument('--size') || 'small', sourceTopics.length);
    const existingCount = targetRowCount(await readRows(target));
    if (existingCount && !flag('--replace')) throw new Error(`Performance database already contains ${existingCount} lifecycle record(s). Re-run with --replace only after confirming this is the dedicated C4 database.`);
    if (flag('--replace')) await Promise.all([...COLLECTIONS].reverse().map(([, key]) => target[key].deleteMany()));
    const byCollection = Object.fromEntries(COLLECTIONS.map(([collection]) => [collection, []]));
    for (let index = 0; index < targetSize; index += 1) {
      const sourceTopic = sourceTopics[index % sourceTopics.length];
      byCollection[sourceTopic.collection].push(cloneData(sourceTopic, sourceTopic.collection));
    }
    const batchSize = positiveInteger(argument('--batch-size') || '250', '--batch-size');
    for (const [collection, key] of COLLECTIONS) for (const batch of batches(byCollection[collection], batchSize)) await target[key].createMany({ data: batch });
    const generated = collectionRows(await readRows(target));
    validateFixture(generated, targetSize);
    process.stdout.write(JSON.stringify({ status: 'prepared', fixture: SCALE_FIXTURE_LABEL, targetSize, sourceRecords: sourceTopics.length, note: 'Records are cloned technical scale fixtures, not real departmental distribution data.' }) + '\n');
  } finally { await Promise.allSettled([source.$disconnect(), target.$disconnect()]); }
}
main().catch(error => { process.stderr.write(`C4 fixture preparation failed: ${error.message}\n`); process.exitCode = 1; });
