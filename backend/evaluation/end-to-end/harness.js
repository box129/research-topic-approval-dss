const { summary } = require('../production-scale/lib');
const { failureType } = require('../production-scale/run-provider-latency-benchmark');

const TECHNICAL_TOPIC = { title: 'C6 end-to-end latency measurement topic', population: 'University students', location: 'Test environment', studyFocus: 'Technical end-to-end latency measurement only' };
const elapsedMs = (start, now = process.hrtime.bigint) => Number(now() - start) / 1e6;
function executionOptions({ execute, runs, delayMs }) {
  if (!execute) throw new Error('C6 provider execution is disabled; re-run with --execute only after review.');
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs is required and must be a positive integer.');
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('--delay-ms is required and must be zero or positive.');
  return { runs, delayMs };
}
function compactSuccess(providerLatencyMs, localProcessingMs, endToEndLatencyMs, result) {
  const top = result.matches[0]; return { status: 'success', providerLatencyMs, localProcessingMs, endToEndLatencyMs, searchableRecords: result.searchableRecords, overallRisk: result.overallRisk, topMatch: top ? { collection: top.topic.collection, id: top.topic.id, rawScore: top.score, similarityClass: top.similarityClass } : null };
}
async function prepareResidentCorpus({ client, assertConnectedDatabase, loadCorpus, assertFixtureIntegrity, expectedRecords }) {
  await assertConnectedDatabase(client); const corpus = await loadCorpus(client); const fixtureIntegrity = assertFixtureIntegrity(corpus, expectedRecords); return { corpus, fixtureIntegrity };
}
async function localWarmups(corpus, query, count, inMemoryCheck) { for (let index = 0; index < count; index += 1) inMemoryCheck(corpus, query); }
async function measuredAttempts({ corpus, topic = TECHNICAL_TOPIC, runs, delayMs, embedQuery, inMemoryCheck, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = process.hrtime.bigint }) {
  const measurements = [];
  for (let index = 0; index < runs; index += 1) {
    const endToEndStart = now(); const providerStart = now();
    try {
      const queryVector = await embedQuery(topic); const providerLatencyMs = elapsedMs(providerStart, now); const localStart = now(); const result = inMemoryCheck(corpus, queryVector); const localProcessingMs = elapsedMs(localStart, now); measurements.push(compactSuccess(providerLatencyMs, localProcessingMs, elapsedMs(endToEndStart, now), result));
    } catch (error) { const failure = failureType(error); measurements.push({ status: 'failure', failureKind: failure.kind, httpStatus: failure.status }); }
    if (index < runs - 1 && delayMs) await wait(delayMs);
  }
  return measurements;
}
function evidence({ metadata, fixtureIntegrity, corpus, localWarmups: warmups, runs, delayMs, measurements }) {
  const successes = measurements.filter(item => item.status === 'success'); const failures = measurements.filter(item => item.status === 'failure'); const count = kind => failures.filter(item => item.failureKind === kind).length;
  return { ...metadata, benchmark: 'direct C6 Voyage query embedding plus resident exact corpus; concurrency 1', provider: 'voyage', model: 'voyage-4-large', inputType: 'query', representation: 'structured-context-v1', dimension: 1024, scale: 5000, fixtureIntegrity, corpusBuild: { databaseLoadMs: corpus.databaseLoadMs, validationMs: corpus.validationMs, totalBuildMs: corpus.totalBuildMs, memory: corpus.memory, representation: corpus.representation }, localWarmups: warmups, runs, delayMs, successCount: successes.length, failureCount: failures.length, http429Count: count('http_429'), http5xxCount: count('http_5xx'), providerOrTransportFailureCount: count('provider_or_transport'), unexpectedFailureCount: count('unexpected'), providerLatencyMs: summary(successes.map(item => item.providerLatencyMs)), localProcessingMs: summary(successes.map(item => item.localProcessingMs)), endToEndLatencyMs: summary(successes.map(item => item.endToEndLatencyMs)), rawMeasurements: measurements };
}
module.exports = { TECHNICAL_TOPIC, executionOptions, prepareResidentCorpus, localWarmups, measuredAttempts, evidence };
