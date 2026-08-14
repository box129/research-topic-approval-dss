#!/usr/bin/env node
const { embedQuery, VoyageProviderError } = require('../../src/services/voyageEmbedding.service');
const { argument, flag, positiveInteger, durationMs, summary, environmentMetadata } = require('./lib');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function failureType(error) { const status = Number(error?.status); return { status: Number.isInteger(status) ? status : null, kind: status === 429 ? 'http_429' : status >= 500 && status < 600 ? 'http_5xx' : error instanceof VoyageProviderError ? 'provider_or_transport' : 'unexpected' }; }
async function main() {
  if (!flag('--execute')) throw new Error('Provider latency is intentionally disabled. Review rate limits, then re-run with --execute.');
  const runs = positiveInteger(argument('--runs') || '10', '--runs'); const delayValue = argument('--delay-ms'); if (delayValue === undefined) throw new Error('--delay-ms is required after Voyage account rate limits have been reviewed.'); const delayMs = Number(delayValue); if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('--delay-ms must be zero or a positive number.');
  const successes = []; const failures = [];
  for (let index = 0; index < runs; index += 1) {
    const start = process.hrtime.bigint();
    try { await embedQuery({ title: 'C4 provider-latency measurement topic', population: 'University students', location: 'Test environment', studyFocus: 'Technical latency measurement only' }); successes.push(durationMs(start)); }
    catch (error) { failures.push(failureType(error)); }
    if (index < runs - 1 && delayMs) await delay(delayMs);
  }
  const count = kind => failures.filter(failure => failure.kind === kind).length;
  process.stdout.write(JSON.stringify({ ...environmentMetadata(), benchmark: 'Voyage query embedding latency only; no database writes or document re-embedding', provider: 'voyage', model: 'voyage-4-large', inputType: 'query', runs, delayMs, successCount: successes.length, failureCount: failures.length, rawSuccessfulLatencyMs: successes, failures, http429Count: count('http_429'), http5xxCount: count('http_5xx'), providerOrTransportFailureCount: count('provider_or_transport'), unexpectedFailureCount: count('unexpected'), latencyMs: summary(successes) }, null, 2) + '\n');
}
if (require.main === module) main().catch(error => { process.stderr.write(`C4 provider latency benchmark failed: ${error.message}\n`); process.exitCode = 1; });
module.exports = { failureType };
