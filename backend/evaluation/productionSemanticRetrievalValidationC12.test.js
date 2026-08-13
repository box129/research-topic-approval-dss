const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadPlan, summarize, expected, batches, estimateTokens, plannedRoleBatches,
  executeRoleValidation, executeProviderValidation
} = require('../scripts/run-production-semantic-retrieval-validation-c1.2');
const {
  atomicWrite, limiter, loadCheckpoint, missing, validateBatch, execute
} = require('./productionSemanticRetrievalC12.helpers');

function temporaryCheckpoint() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'c1-2-local-'));
  return { directory, file: path.join(directory, 'checkpoint.json') };
}

function removeTemporaryCheckpoint(temp) {
  fs.rmSync(temp.directory, { recursive: true, force: true });
}

function vectors(batch, dimension) {
  return batch.map(item => Array.from({ length: dimension }, (_, index) => index === 0 ? item.canonicalTopicId : 0));
}

function item(index, tokens = 1) {
  return {
    provider: 'test', model: 'test-model', dimension: 2, dtype: 'float', role: 'query',
    representationId: 'structured-context-v1', configurationId: 'test', sourceHash: `topic-${index}`,
    canonicalTopicId: index, estimatedTokens: tokens
  };
}

function fakeClock() {
  let time = 0;
  const waits = [];
  return { now: () => time, waits, sleep: async delay => { waits.push(delay); time += delay; } };
}

describe('C1.2 local readiness execution path', () => {
  test('preserves frozen deterministic plan and current empty-cache dry run', () => {
    // Arrange
    const plan = loadPlan();
    const summary = summarize(plan);

    // Assert
    expect(plan.values).toHaveLength(229);
    expect(summary.benchmarkSha).toBe('b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0');
    expect(summary.voyage.queryDocumentBatches.map(x => x.batches.map(batch => batch.topics))).toEqual([[115, 114], [115, 114]]);
    expect(summary.voyage.queryDocumentBatches[0].batches.map(batch => batch.estimatedTokens)).toEqual([3749, 4043]);
    expect(summary.gemini.queryDocumentBatches.flatMap(x => x.batches.map(batch => batch.topics))).toEqual([24,24,24,24,24,24,24,24,24,13,24,24,24,24,24,24,24,24,24,13]);
    expect(summary.paths.c11WillNotBeOverwritten).toBe(true);
  });

  test('completes all 20 mocked Gemini batches through real atomic checkpoints', async () => {
    // Arrange
    const plan = loadPlan();
    const temp = temporaryCheckpoint();
    const requests = [];
    const originalFetch = global.fetch;
    const networkGuard = jest.fn(() => { throw new Error('External network access is forbidden in local tests.'); });
    global.fetch = networkGuard;
    const transport = async (role, batch) => {
      requests.push({ role, size: batch.length });
      return vectors(batch, 3072);
    };

    // Act
    let result;
    let reloaded;
    let summary;
    try {
      result = await executeProviderValidation({
        plan, provider: 'gemini', checkpoint: { entries: [] }, transport, checkpointFile: temp.file,
        limitFactory: () => limiter({ maxRequests: 100, maxTokens: 1000000 })
      });
      reloaded = loadCheckpoint(temp.file);
      summary = summarize(plan, reloaded);
    } finally {
      global.fetch = originalFetch;
    }

    // Assert
    expect(result.status).toBe('COMPLETE');
    expect(networkGuard).not.toHaveBeenCalled();
    expect(requests).toHaveLength(20);
    expect(requests.filter(x => x.role === 'query').reduce((sum, x) => sum + x.size, 0)).toBe(229);
    expect(requests.filter(x => x.role === 'document').reduce((sum, x) => sum + x.size, 0)).toBe(229);
    expect(missing(expected(plan).gemini, reloaded)).toHaveLength(0);
    expect(summary.gemini.queryDocumentBatches.map(x => x.missing)).toEqual([0, 0]);
    removeTemporaryCheckpoint(temp);
  });

  test('persists partial Gemini query work and resumes only missing query topics', async () => {
    // Arrange
    const plan = loadPlan();
    const temp = temporaryCheckpoint();
    let calls = 0;
    const stopOnFifth = async batch => {
      calls += 1;
      if (calls === 5) throw Object.assign(new Error('terminal'), { status: 400 });
      return vectors(batch, 3072);
    };

    // Act
    const partial = await executeRoleValidation({
      plan, provider: 'gemini', role: 'query', checkpoint: { entries: [] }, transport: stopOnFifth,
      write: value => atomicWrite(temp.file, value), limit: limiter({ maxRequests: 100, maxTokens: 1000000 })
    });
    const restarted = loadCheckpoint(temp.file);
    const resumed = await executeRoleValidation({
      plan, provider: 'gemini', role: 'query', checkpoint: restarted,
      transport: async batch => vectors(batch, 3072), write: value => atomicWrite(temp.file, value),
      limit: limiter({ maxRequests: 100, maxTokens: 1000000 })
    });

    // Assert
    expect(partial.status).toBe('VALIDATION_INCOMPLETE');
    expect(restarted.entries).toHaveLength(96);
    expect(plannedRoleBatches(plan, 'gemini', 'query', restarted).flat()).toHaveLength(133);
    expect(resumed.status).toBe('COMPLETE');
    expect(missing(expected(plan).gemini.filter(x => x.role === 'query'), loadCheckpoint(temp.file))).toHaveLength(0);
    removeTemporaryCheckpoint(temp);
  });

  test.each([
    ['persistent 429', { status: 429 }, 6],
    ['persistent 503', { status: 503 }, 6],
    ['persistent timeout', { code: 'ETIMEDOUT' }, 6],
    ['persistent connection reset', { code: 'ECONNRESET' }, 6],
    ['daily quota', { status: 429, dailyQuota: true }, 1],
    ['400', { status: 400 }, 1],
    ['401', { status: 401 }, 1],
    ['403', { status: 403 }, 1]
  ])('returns controlled incomplete state for %s', async (_, properties, expectedCalls) => {
    // Arrange
    const clock = fakeClock();
    let calls = 0;
    const batch = [[item(1, 10)]];
    const error = Object.assign(new Error('mock failure'), properties);
    const rateLimit = limiter({ maxRequests: 20, maxTokens: 1000, now: clock.now });

    // Act
    const result = await execute({
      items: batch, expectedDimension: 2, checkpoint: { entries: [] }, limit: rateLimit,
      transport: async () => { calls += 1; throw error; }, write: () => {}, now: clock.now, sleep: clock.sleep
    });

    // Assert
    expect(result.status).toBe('VALIDATION_INCOMPLETE');
    expect(result.checkpoint.entries).toHaveLength(0);
    expect(calls).toBe(expectedCalls);
    expect(rateLimit.usage().requests).toBe(expectedCalls);
  });

  test.each([500, 502, 503, 'ETIMEDOUT', 'ECONNRESET', 'ETEMPORARY'])('retries transient %s then succeeds', async statusOrCode => {
    // Arrange
    let calls = 0;
    const clock = fakeClock();
    const transient = typeof statusOrCode === 'number' ? { status: statusOrCode } : { code: statusOrCode };
    const rateLimit = limiter({ maxRequests: 10, maxTokens: 1000, now: clock.now });

    // Act
    const result = await execute({
      items: [[item(1, 10)]], expectedDimension: 2, checkpoint: { entries: [] }, limit: rateLimit,
      transport: async batch => { calls += 1; if (calls === 1) throw Object.assign(new Error('transient'), transient); return vectors(batch, 2); },
      write: () => {}, now: clock.now, sleep: clock.sleep
    });

    // Assert
    expect(result.status).toBe('COMPLETE');
    expect(calls).toBe(2);
    expect(rateLimit.usage().requests).toBe(2);
  });

  test('retries 429 without Retry-After using deterministic exponential backoff for both providers', async () => {
    for (const provider of ['voyage', 'gemini']) {
      // Arrange
      const clock = fakeClock();
      let calls = 0;
      const rateLimit = limiter({ maxRequests: 10, maxTokens: 1000, now: clock.now });

      // Act
      const result = await execute({
        items: [[item(1, 10)]], expectedDimension: 2, checkpoint: { entries: [] }, limit: rateLimit,
        transport: async batch => { calls += 1; if (calls === 1) throw Object.assign(new Error(provider), { status: 429 }); return vectors(batch, 2); },
        write: () => {}, now: clock.now, sleep: clock.sleep, jitter: () => 3
      });

      // Assert
      expect(result.status).toBe('COMPLETE');
      expect(clock.waits).toEqual([8]);
    }
  });

  test('rejects malformed and misaligned success responses without checkpointing', async () => {
    const invalid = [undefined, [], 'not-an-array', [[1, 'x']], [[1]], [[1, 2], [3, 4]], [[1, 2], [3, 4], [5, 6]]];
    for (const response of invalid) {
      // Act
      const result = await execute({
        items: [[item(1)]], expectedDimension: 2, checkpoint: { entries: [] }, limit: limiter({ maxRequests: 10, maxTokens: 100 }),
        transport: async () => response, write: () => {}
      });

      // Assert
      expect(result.status).toBe('VALIDATION_INCOMPLETE');
      expect(result.checkpoint.entries).toHaveLength(0);
    }
    expect(() => validateBatch([Array(1023).fill(0)], 1024, 1)).toThrow('Invalid returned embedding');
    expect(() => validateBatch([Array(3071).fill(0)], 3072, 1)).toThrow('Invalid returned embedding');
  });

  test('real atomicWrite replaces complete state and preserves old target on failures', () => {
    // Arrange
    const temp = temporaryCheckpoint();
    const oldState = { entries: [{ value: 'old' }] };
    const newState = { entries: [{ value: 'new' }] };
    atomicWrite(temp.file, oldState);
    atomicWrite(temp.file, newState);

    // Act and Assert: write failure
    const writeFailure = { ...fs, writeFileSync: () => { throw new Error('write failed'); } };
    expect(() => atomicWrite(temp.file, { entries: [{ value: 'bad' }] }, { fsOps: writeFailure })).toThrow('write failed');
    expect(JSON.parse(fs.readFileSync(temp.file))).toEqual(newState);

    // Act and Assert: replacement failure
    const renameFailure = { ...fs, renameSync: () => { throw new Error('rename failed'); } };
    expect(() => atomicWrite(temp.file, { entries: [{ value: 'bad' }] }, { fsOps: renameFailure })).toThrow('rename failed');
    expect(JSON.parse(fs.readFileSync(temp.file))).toEqual(newState);
    expect(fs.existsSync(`${temp.file}.tmp`)).toBe(false);
    removeTemporaryCheckpoint(temp);
  });

  test('real checkpoint-after-batch chain reloads 115 Voyage vectors and resumes 114 only', async () => {
    // Arrange
    const plan = loadPlan();
    const temp = temporaryCheckpoint();
    let calls = 0;
    const initial = await executeRoleValidation({
      plan, provider: 'voyage', role: 'query', checkpoint: { entries: [] },
      transport: async batch => { calls += 1; if (calls === 2) throw Object.assign(new Error('stop'), { status: 400 }); return vectors(batch, 1024); },
      write: value => atomicWrite(temp.file, value), limit: limiter({ maxRequests: 10, maxTokens: 100000 })
    });
    const restarted = loadCheckpoint(temp.file);

    // Act
    const resumed = await executeRoleValidation({
      plan, provider: 'voyage', role: 'query', checkpoint: restarted, transport: async batch => vectors(batch, 1024),
      write: value => atomicWrite(temp.file, value), limit: limiter({ maxRequests: 10, maxTokens: 100000 })
    });

    // Assert
    expect(initial.status).toBe('VALIDATION_INCOMPLETE');
    expect(restarted.entries).toHaveLength(115);
    expect(plannedRoleBatches(plan, 'voyage', 'query', restarted).map(batch => batch.length)).toEqual([114]);
    expect(resumed.status).toBe('COMPLETE');
    expect(loadCheckpoint(temp.file).entries).toHaveLength(229);
    removeTemporaryCheckpoint(temp);
  });

  test('batching changes transport only, not canonical vector reconstruction', async () => {
    // Arrange
    const source = [item(0), item(1), item(2), item(3)];
    const run = async batchesToRun => {
      const result = await execute({ items: batchesToRun, expectedDimension: 2, checkpoint: { entries: [] }, limit: limiter({ maxRequests: 10, maxTokens: 100 }), transport: async batch => vectors(batch, 2), write: () => {} });
      return new Map(result.checkpoint.entries.map(entry => [entry.canonicalTopicId, entry.embedding]));
    };

    // Act
    const oneBatch = await run([source]);
    const currentBoundaries = await run(batches(source, 2));

    // Assert
    expect(currentBoundaries).toEqual(oneBatch);
  });

  test.each([
    ['Voyage RPM', 2, 9000, [100, 100, 100]],
    ['Voyage TPM', 3, 9000, [5000, 5000]],
    ['Gemini RPM', 24, 24000, Array(25).fill(1)],
    ['Gemini TPM', 25, 24000, [13000, 13000]]
  ])('%s saturation waits under actual execution workflow', async (_, maxRequests, maxTokens, tokenGroups) => {
    // Arrange
    const clock = fakeClock();
    const items = tokenGroups.map((tokens, index) => [item(index, tokens)]);
    const rateLimit = limiter({ maxRequests, maxTokens, now: clock.now });

    // Act
    const result = await execute({
      items, expectedDimension: 2, checkpoint: { entries: [] }, limit: rateLimit,
      transport: async batch => vectors(batch, 2), write: () => {}, now: clock.now, sleep: clock.sleep
    });

    // Assert
    expect(result.status).toBe('COMPLETE');
    expect(clock.waits.some(wait => wait >= 60000)).toBe(true);
  });

  test('a retry waits for the same saturated rolling limiter before transport is retried', async () => {
    // Arrange
    const clock = fakeClock();
    const rateLimit = limiter({ maxRequests: 1, maxTokens: 100, now: clock.now });
    let calls = 0;

    // Act
    const result = await execute({
      items: [[item(1, 10)]], expectedDimension: 2, checkpoint: { entries: [] }, limit: rateLimit,
      transport: async batch => { calls += 1; if (calls === 1) throw Object.assign(new Error('retry'), { status: 429 }); return vectors(batch, 2); },
      write: () => {}, now: clock.now, sleep: clock.sleep
    });

    // Assert
    expect(result.status).toBe('COMPLETE');
    expect(calls).toBe(2);
    expect(clock.waits).toEqual([5, 59996]);
  });
});
