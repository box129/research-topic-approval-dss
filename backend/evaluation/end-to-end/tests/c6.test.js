const { executionOptions, prepareResidentCorpus, localWarmups, measuredAttempts, evidence } = require('../harness');

const corpus = { databaseLoadMs: 1, validationMs: 2, totalBuildMs: 3, memory: { beforeDatabaseLoad: { rss: 1 }, immediatePostBuild: { rss: 2 } }, representation: 'ordinary JavaScript numeric arrays from persisted JSON' };
const fixtureIntegrity = { expectedRecords: 5000, loadedRecords: 5000, admittedRecords: 5000, rejectedRecords: 0, searchableRecordsAtStart: 5000 };
function result() { return { searchableRecords: 5000, overallRisk: 'HIGH', matches: [{ topic: { collection: 'HISTORICAL', id: 1 }, score: 0.7, similarityClass: 'HIGH' }] }; }
function clock(values) { const numbers = [...values]; return () => BigInt(numbers.shift()); }

describe('C6 end-to-end harness', () => {
  test('requires explicit provider execution authorization and run controls', () => {
    expect(() => executionOptions({ execute: false, runs: 10, delayMs: 21000 })).toThrow('--execute');
    expect(() => executionOptions({ execute: true, runs: undefined, delayMs: 21000 })).toThrow('--runs');
    expect(() => executionOptions({ execute: true, runs: 10, delayMs: undefined })).toThrow('--delay-ms');
  });

  test('performs local warm-ups without calling embedQuery', async () => {
    const check = jest.fn(() => result()); const embed = jest.fn(); await localWarmups(corpus, Array(1024).fill(0.1), 3, check); expect(check).toHaveBeenCalledTimes(3); expect(embed).not.toHaveBeenCalled();
  });

  test('loads the corpus once and verifies fixture integrity before provider work can begin', async () => {
    const guard = jest.fn().mockResolvedValue(); const load = jest.fn().mockResolvedValue(corpus); const integrity = jest.fn().mockReturnValue(fixtureIntegrity); await expect(prepareResidentCorpus({ client: {}, assertConnectedDatabase: guard, loadCorpus: load, assertFixtureIntegrity: integrity, expectedRecords: 5000 })).resolves.toMatchObject({ corpus, fixtureIntegrity }); expect(guard).toHaveBeenCalledTimes(1); expect(load).toHaveBeenCalledTimes(1); expect(integrity).toHaveBeenCalledWith(corpus, 5000);
    const rejected = jest.fn(() => { throw new Error('fixture integrity failed'); }); await expect(prepareResidentCorpus({ client: {}, assertConnectedDatabase: guard, loadCorpus: load, assertFixtureIntegrity: rejected, expectedRecords: 5000 })).rejects.toThrow('fixture integrity failed');
  });

  test('records distinct direct provider, local, and end-to-end timings without serializing vectors', async () => {
    const embed = jest.fn().mockResolvedValue(Array(1024).fill(0.123)); const check = jest.fn(() => result()); const measurements = await measuredAttempts({ corpus, runs: 1, delayMs: 0, embedQuery: embed, inMemoryCheck: check, now: clock([0, 0, 10e6, 10e6, 15e6, 20e6]) });
    expect(embed).toHaveBeenCalledTimes(1); expect(check).toHaveBeenCalledTimes(1); expect(measurements[0]).toMatchObject({ status: 'success', providerLatencyMs: 10, localProcessingMs: 5, endToEndLatencyMs: 20, searchableRecords: 5000, topMatch: { collection: 'HISTORICAL', id: 1 } });
    const output = evidence({ metadata: { gitCommit: 'test' }, fixtureIntegrity, corpus, localWarmups: 3, runs: 1, delayMs: 0, measurements }); expect(JSON.stringify(output)).not.toContain('0.123'); expect(output.endToEndLatencyMs).toMatchObject({ p50: 20, p95: 20 });
  });

  test('records failures, does not retry, and keeps inter-run delay outside measured timings', async () => {
    const embed = jest.fn().mockRejectedValue({ status: 429 }); const check = jest.fn(); const wait = jest.fn().mockResolvedValue(); const measurements = await measuredAttempts({ corpus, runs: 2, delayMs: 21000, embedQuery: embed, inMemoryCheck: check, wait, now: clock([0, 0, 30e6, 30e6]) });
    expect(embed).toHaveBeenCalledTimes(2); expect(check).not.toHaveBeenCalled(); expect(wait).toHaveBeenCalledTimes(1); expect(wait).toHaveBeenCalledWith(21000); expect(measurements).toEqual([{ status: 'failure', httpStatus: 429, failureKind: 'http_429' }, { status: 'failure', httpStatus: 429, failureKind: 'http_429' }]); const output = evidence({ metadata: {}, fixtureIntegrity, corpus, localWarmups: 3, runs: 2, delayMs: 21000, measurements }); expect(output).toMatchObject({ successCount: 0, failureCount: 2, http429Count: 2, providerLatencyMs: null, endToEndLatencyMs: null });
  });

  test('summarizes directly observed end-to-end samples rather than adding component percentiles', () => {
    const measurements = [
      { status: 'success', providerLatencyMs: 10, localProcessingMs: 5, endToEndLatencyMs: 17, searchableRecords: 5000, overallRisk: 'LOW', topMatch: null },
      { status: 'success', providerLatencyMs: 50, localProcessingMs: 20, endToEndLatencyMs: 99, searchableRecords: 5000, overallRisk: 'LOW', topMatch: null }
    ]; const output = evidence({ metadata: {}, fixtureIntegrity, corpus, localWarmups: 3, runs: 2, delayMs: 21000, measurements }); expect(output.providerLatencyMs.p95).toBe(50); expect(output.localProcessingMs.p95).toBe(20); expect(output.endToEndLatencyMs.p95).toBe(99); expect(output.endToEndLatencyMs.p95).not.toBe(70);
  });
});
