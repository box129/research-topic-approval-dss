const { EventEmitter } = require('events');
const { startServer } = require('./server');

// Production readiness lifecycle: a fresh process must deliberately build its
// initial resident corpus and converge to readiness on its own — never
// depending on a user's similarity request to wake the corpus up, and never
// holding the process open or storming retries while it cannot build.
function createFakeApplication() {
  const server = new EventEmitter();
  server.close = jest.fn((callback) => { server.emit('close'); callback?.(); });
  return { server, application: { listen: jest.fn(() => server) } };
}

function createHarness({ corpus } = {}) {
  const { server, application } = createFakeApplication();
  const scheduled = [];
  const cleared = [];
  const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const handle = startServer({
    application,
    runtimeConfig: { port: 0, env: 'test', apiVersion: 'v1', shutdownGracePeriodMs: 50 },
    prismaClient: { $disconnect: jest.fn().mockResolvedValue(undefined) },
    log,
    processRef: new EventEmitter(),
    exit: jest.fn(),
    corpus,
    corpusInitRetryDelayMs: 1234,
    corpusSetTimeout: (fn, ms) => { const timer = { fn, ms, unref: jest.fn() }; scheduled.push(timer); return timer; },
    corpusClearTimeout: (timer) => { cleared.push(timer); }
  });

  return { handle, server, log, scheduled, cleared };
}

describe('startup resident corpus initialization', () => {
  test('a fresh process deliberately builds the initial corpus without any similarity request', async () => {
    const corpus = {
      refresh: jest.fn().mockResolvedValue({
        topics: [{ id: 1 }, { id: 2 }],
        sourceTopicCount: 2,
        skippedInvalidEmbeddingCount: 0
      })
    };
    const { handle, log, scheduled } = createHarness({ corpus });

    await handle.corpusInitialization.whenIdle();

    expect(corpus.refresh).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls.map(([message]) => message)).toEqual(
      expect.arrayContaining([expect.stringMatching(/initial snapshot built/i)])
    );
    const initLine = log.info.mock.calls.find(([message]) => /initial snapshot built/i.test(message));
    expect(initLine[1]).toEqual({
      sourceTopicCount: 2,
      admittedTopicCount: 2,
      skippedInvalidEmbeddingCount: 0
    });
    // Success ends the initialization loop: nothing left scheduled.
    expect(scheduled).toHaveLength(0);
    handle.corpusInitialization.stop();
  });

  test('a failed initial build retries on the injected timer and converges without any user request', async () => {
    const corpus = {
      refresh: jest.fn()
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValue({ topics: [], sourceTopicCount: 0, skippedInvalidEmbeddingCount: 0 })
    };
    const { handle, log, scheduled } = createHarness({ corpus });

    await handle.corpusInitialization.whenIdle();
    expect(corpus.refresh).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ms).toBe(1234);
    expect(scheduled[0].unref).toHaveBeenCalled();

    // The retry fires; the second attempt succeeds and the loop ends.
    scheduled[0].fn();
    await handle.corpusInitialization.whenIdle();

    expect(corpus.refresh).toHaveBeenCalledTimes(2);
    expect(scheduled).toHaveLength(1);
    expect(log.info.mock.calls.some(([message]) => /initial snapshot built/i.test(message))).toBe(true);
    // No secret/topic content in the startup log metadata: counts only.
    expect(JSON.stringify(log.info.mock.calls) + JSON.stringify(log.warn.mock.calls))
      .not.toMatch(/title|embedding\":|password|token/i);
    handle.corpusInitialization.stop();
  });

  test('stop() clears a pending retry so no timer or handle outlives the server', async () => {
    const corpus = { refresh: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const { handle, scheduled, cleared } = createHarness({ corpus });

    await handle.corpusInitialization.whenIdle();
    expect(scheduled).toHaveLength(1);

    handle.corpusInitialization.stop();
    expect(cleared).toEqual([scheduled[0]]);

    // A late timer callback after stop performs no further attempts.
    scheduled[0].fn();
    await handle.corpusInitialization.whenIdle();
    expect(corpus.refresh).toHaveBeenCalledTimes(1);
  });

  test('closing the HTTP server stops initialization retries automatically', async () => {
    const corpus = { refresh: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const { handle, server, scheduled, cleared } = createHarness({ corpus });

    await handle.corpusInitialization.whenIdle();
    expect(scheduled).toHaveLength(1);

    server.emit('close');
    expect(cleared).toEqual([scheduled[0]]);

    scheduled[0].fn();
    await handle.corpusInitialization.whenIdle();
    expect(corpus.refresh).toHaveBeenCalledTimes(1);
    handle.corpusInitialization.stop();
  });
});
