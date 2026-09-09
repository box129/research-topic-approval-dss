jest.mock('../config/database', () => ({}));
jest.mock('./voyageEmbedding.service', () => ({ validStoredEmbedding: topic => Array.isArray(topic.embedding) && topic.embedding.length === 1024 && topic.embeddingSourceHash === 'current' }));
const { ResidentCorpus } = require('./residentCorpus.service');
const vector = value => Array(1024).fill(value);
function client(rows) { return { historicalTopic:{findMany:jest.fn().mockResolvedValue(rows.historical || [])}, currentSessionTopic:{findMany:jest.fn().mockResolvedValue(rows.current || [])}, underReviewTopic:{findMany:jest.fn().mockResolvedValue(rows.review || [])} }; }
describe('ResidentCorpus', () => {
  test('atomically replaces valid searchable snapshots and filters review expiry at check time', async () => {
    const db=client({current:[{id:1,embedding:vector(.1),embeddingSourceHash:'current'}],review:[{id:2,embedding:vector(.2),embeddingSourceHash:'current',reviewStartedAt:new Date()}]}); const corpus=new ResidentCorpus(db);
    const first=await corpus.refresh(); expect(corpus.searchable(first).map(x=>x.id)).toEqual([1,2]);
    db.currentSessionTopic.findMany.mockResolvedValue([{id:1,embedding:vector(.3),embeddingSourceHash:'current'}]); db.underReviewTopic.findMany.mockResolvedValue([{id:2,embedding:vector(.2),embeddingSourceHash:'current',reviewStartedAt:new Date(Date.now()-49*3600000)}]);
    const next=await corpus.refresh(); expect(next).not.toBe(first); expect(corpus.searchable(next).map(x=>x.id)).toEqual([1]); expect(next.topics[0].embedding[0]).toBe(.3);
  });
  test('rejects stale vectors and retains the last snapshot after refresh failure', async () => {
    const db=client({historical:[{id:1,embedding:vector(.1),embeddingSourceHash:'current'}]}); const corpus=new ResidentCorpus(db); const before=await corpus.refresh(); db.historicalTopic.findMany.mockRejectedValue(new Error('database unavailable'));
    await expect(corpus.refresh()).rejects.toThrow('database unavailable'); expect(corpus.snapshot).toBe(before); expect(corpus.searchable().map(x=>x.id)).toEqual([1]);
    const stale=new ResidentCorpus(client({historical:[{id:2,embedding:vector(.1),embeddingSourceHash:'old'}]})); await stale.refresh(); expect(stale.searchable()).toEqual([]);
  });
  test('a process restart reconstructs the same eligible corpus from PostgreSQL state', async () => {
    const rows = {
      historical: [{ id: 1, embedding: vector(.1), embeddingSourceHash: 'current' }],
      current: [{ id: 2, embedding: vector(.2), embeddingSourceHash: 'current' }],
      review: [
        { id: 3, embedding: vector(.3), embeddingSourceHash: 'current', reviewStartedAt: new Date() },
        { id: 4, embedding: vector(.4), embeddingSourceHash: 'current', reviewStartedAt: new Date(Date.now() - 49 * 3600000) },
        { id: 5, embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date() }
      ]
    };
    const beforeRestart = new ResidentCorpus(client(rows));
    const eligibleBefore = beforeRestart.searchable(await beforeRestart.get()).map(topic => `${topic.collection}:${topic.id}`);

    // A restarted process begins with no snapshot; get() must rebuild the exact
    // same eligible corpus from the persisted rows alone.
    const afterRestart = new ResidentCorpus(client(rows));
    expect(afterRestart.snapshot).toBeNull();
    const eligibleAfter = afterRestart.searchable(await afterRestart.get()).map(topic => `${topic.collection}:${topic.id}`);

    expect(eligibleBefore).toEqual(['HISTORICAL:1', 'CURRENT_SESSION:2', 'UNDER_REVIEW:3']);
    expect(eligibleAfter).toEqual(eligibleBefore);
  });

  test('stats reports truthful diagnostic state before and after build without topic content', async () => {
    const log = { info: jest.fn(), error: jest.fn() };
    const corpus = new ResidentCorpus(client({ historical: [{ id: 1, title: 'Sensitive Topic Title', embedding: vector(.1), embeddingSourceHash: 'current' }] }), log);

    expect(corpus.stats()).toEqual({
      built: false,
      topics: null,
      searchable: null,
      builtAt: null,
      sourceTopicCount: null,
      searchableTopicCount: null,
      skippedInvalidEmbeddingCount: null,
      skippedSearchEligibleEmbeddingCount: null,
      lastRefreshError: null
    });

    await corpus.refresh();
    const stats = corpus.stats();
    expect(stats).toMatchObject({ built: true, topics: 1, searchable: 1, lastRefreshError: null });
    expect(typeof stats.builtAt).toBe('string');
    expect(JSON.stringify(stats)).not.toContain('Sensitive Topic Title');
  });

  test('refresh failures log one state-change event per outage and one recovery event', async () => {
    const log = { info: jest.fn(), error: jest.fn() };
    const db = client({ historical: [{ id: 1, embedding: vector(.1), embeddingSourceHash: 'current' }] });
    const corpus = new ResidentCorpus(db, log);
    await corpus.refresh();

    db.historicalTopic.findMany.mockRejectedValue(new Error('database unavailable'));
    await expect(corpus.refresh()).rejects.toThrow('database unavailable');
    await expect(corpus.refresh()).rejects.toThrow('database unavailable');
    // The identical continuing failure is not re-logged on every retry.
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error.mock.calls[0][0]).toMatch(/refresh failed/);
    expect(corpus.stats().lastRefreshError).toBe('database unavailable');

    db.historicalTopic.findMany.mockResolvedValue([{ id: 1, embedding: vector(.1), embeddingSourceHash: 'current' }]);
    await corpus.refresh();
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0][0]).toMatch(/recovered/);
    expect(corpus.stats().lastRefreshError).toBeNull();
  });

  describe('partial-corpus accounting', () => {
    const makeLog = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

    test('an all-valid snapshot reports source == admitted with zero skipped and no warning', async () => {
      const log = makeLog();
      const corpus = new ResidentCorpus(client({
        historical: [{ id: 1, embedding: vector(.1), embeddingSourceHash: 'current' }],
        current: [{ id: 2, embedding: vector(.2), embeddingSourceHash: 'current' }]
      }), log);

      await corpus.refresh();

      expect(corpus.stats()).toMatchObject({
        built: true,
        sourceTopicCount: 2,
        searchableTopicCount: 2,
        skippedInvalidEmbeddingCount: 0
      });
      expect(log.warn).not.toHaveBeenCalled();
    });

    test('rows failing the embedding contract are counted, warned about once, and never described by content', async () => {
      const log = makeLog();
      const corpus = new ResidentCorpus(client({
        historical: [
          { id: 1, title: 'Sensitive Valid Title', embedding: vector(.1), embeddingSourceHash: 'current' },
          { id: 2, title: 'Sensitive Broken Title', embedding: null, embeddingSourceHash: 'current' },
          { id: 3, title: 'Sensitive Stale Title', embedding: vector(.3), embeddingSourceHash: 'old' }
        ]
      }), log);

      await corpus.refresh();

      const stats = corpus.stats();
      expect(stats).toMatchObject({
        sourceTopicCount: 3,
        searchableTopicCount: 1,
        skippedInvalidEmbeddingCount: 2
      });

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn.mock.calls[0][0]).toMatch(/partial/i);
      expect(log.warn.mock.calls[0][1]).toEqual({
        sourceTopicCount: 3,
        admittedTopicCount: 1,
        skippedInvalidEmbeddingCount: 2
      });
      const serializedLogging = JSON.stringify(log.warn.mock.calls) + JSON.stringify(log.info.mock.calls);
      expect(serializedLogging).not.toContain('Sensitive');
      expect(serializedLogging).not.toContain('0.1');
    });

    test('an equivalent partial refresh does not repeat the warning; a changed skipped count warns again', async () => {
      const log = makeLog();
      const db = client({
        historical: [
          { id: 1, embedding: vector(.1), embeddingSourceHash: 'current' },
          { id: 2, embedding: null, embeddingSourceHash: 'current' }
        ]
      });
      const corpus = new ResidentCorpus(db, log);

      await corpus.refresh();
      await corpus.refresh();
      expect(log.warn).toHaveBeenCalledTimes(1);

      db.historicalTopic.findMany.mockResolvedValue([
        { id: 1, embedding: vector(.1), embeddingSourceHash: 'current' },
        { id: 2, embedding: null, embeddingSourceHash: 'current' },
        { id: 3, embedding: null, embeddingSourceHash: 'current' }
      ]);
      await corpus.refresh();
      expect(log.warn).toHaveBeenCalledTimes(2);
      expect(log.warn.mock.calls[1][1].skippedInvalidEmbeddingCount).toBe(2);
    });

    test('recovering full embedding coverage emits one recovery event', async () => {
      const log = makeLog();
      const db = client({
        historical: [
          { id: 1, embedding: vector(.1), embeddingSourceHash: 'current' },
          { id: 2, embedding: null, embeddingSourceHash: 'current' }
        ]
      });
      const corpus = new ResidentCorpus(db, log);
      await corpus.refresh();

      db.historicalTopic.findMany.mockResolvedValue([
        { id: 1, embedding: vector(.1), embeddingSourceHash: 'current' },
        { id: 2, embedding: vector(.2), embeddingSourceHash: 'current' }
      ]);
      await corpus.refresh();

      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info.mock.calls[0][0]).toMatch(/full embedding coverage/i);
      await corpus.refresh();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(corpus.stats().skippedInvalidEmbeddingCount).toBe(0);
    });

    test('a zero-row database still produces a successfully built empty snapshot, never "never built"', async () => {
      const log = makeLog();
      const corpus = new ResidentCorpus(client({}), log);

      expect(corpus.stats().built).toBe(false);
      await corpus.refresh();

      expect(corpus.stats()).toMatchObject({
        built: true,
        sourceTopicCount: 0,
        searchableTopicCount: 0,
        skippedInvalidEmbeddingCount: 0,
        lastRefreshError: null
      });
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
    });

    test('admitted rows and currently-searchable rows are distinct: expired under-review rows stay admitted but not searchable', async () => {
      const log = makeLog();
      const corpus = new ResidentCorpus(client({
        current: [{ id: 1, embedding: vector(.1), embeddingSourceHash: 'current' }],
        review: [
          // Valid embedding but past the 48-hour eligibility window: frozen
          // into the snapshot (admitted) yet excluded from current search.
          { id: 2, embedding: vector(.2), embeddingSourceHash: 'current', reviewStartedAt: new Date(Date.now() - 49 * 3600000) },
          { id: 3, embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date() }
        ]
      }), log);

      await corpus.refresh();

      const stats = corpus.stats();
      expect(stats).toMatchObject({
        sourceTopicCount: 3,
        topics: 2,
        searchableTopicCount: 1,
        skippedInvalidEmbeddingCount: 1
      });
      // The partial warning names the frozen admitted count, not the
      // time-dependent searchable count.
      expect(log.warn.mock.calls[0][1]).toEqual({
        sourceTopicCount: 3,
        admittedTopicCount: 2,
        skippedInvalidEmbeddingCount: 1
      });
    });

    test('an invalid row in any collection counts as search-eligible skipped', async () => {
      const corpus = new ResidentCorpus(client({
        historical: [
          { id: 1, embedding: vector(.1), embeddingSourceHash: 'current' },
          { id: 2, embedding: null, embeddingSourceHash: 'current' }
        ],
        current: [{ id: 3, embedding: vector(.3), embeddingSourceHash: 'old' }],
        review: [{ id: 4, embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date() }]
      }), makeLog());

      await corpus.refresh();

      expect(corpus.stats()).toMatchObject({
        sourceTopicCount: 4,
        searchableTopicCount: 1,
        skippedInvalidEmbeddingCount: 3,
        skippedSearchEligibleEmbeddingCount: 3
      });
    });

    test('an invalid under-review row past the 48-hour window is skipped but not search-eligible', async () => {
      // Had this row's embedding been valid it still would not be compared:
      // the gap cannot change any similarity result, so it must not count as
      // search-eligible (and must not gate readiness or checks).
      const corpus = new ResidentCorpus(client({
        historical: [{ id: 1, embedding: vector(.1), embeddingSourceHash: 'current' }],
        review: [{ id: 2, embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date(Date.now() - 49 * 3600000) }]
      }), makeLog());

      await corpus.refresh();

      expect(corpus.stats()).toMatchObject({
        skippedInvalidEmbeddingCount: 1,
        skippedSearchEligibleEmbeddingCount: 0
      });
    });

    test('the search-eligible skipped count ages out on the SAME snapshot with no rebuild', async () => {
      const reviewStartedAt = new Date('2026-09-01T00:00:00Z');
      const db = client({ review: [{ id: 1, embedding: null, embeddingSourceHash: 'current', reviewStartedAt }] });
      const corpus = new ResidentCorpus(db, makeLog());
      await corpus.refresh();
      const snapshot = corpus.snapshot;

      const withinWindow = reviewStartedAt.getTime() + 47 * 3600000 + 59 * 60000;
      const afterWindow = reviewStartedAt.getTime() + 49 * 3600000;

      expect(corpus.stats(withinWindow).skippedSearchEligibleEmbeddingCount).toBe(1);
      expect(corpus.stats(afterWindow).skippedSearchEligibleEmbeddingCount).toBe(0);
      // Same frozen snapshot, one set of database reads: the count is derived
      // at call time, never frozen at build time.
      expect(corpus.snapshot).toBe(snapshot);
      expect(db.underReviewTopic.findMany).toHaveBeenCalledTimes(1);
    });

    test('search-eligible skipped rows can never exceed total skipped rows', async () => {
      const corpus = new ResidentCorpus(client({
        historical: [{ id: 1, embedding: null, embeddingSourceHash: 'current' }],
        review: [
          { id: 2, embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date() },
          { id: 3, embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date(Date.now() - 49 * 3600000) }
        ]
      }), makeLog());

      await corpus.refresh();

      const stats = corpus.stats();
      expect(stats.skippedInvalidEmbeddingCount).toBe(3);
      expect(stats.skippedSearchEligibleEmbeddingCount).toBe(2);
      expect(stats.skippedSearchEligibleEmbeddingCount).toBeLessThanOrEqual(stats.skippedInvalidEmbeddingCount);
    });

    test('excluded-row descriptors retain only collection and review start — no content, vectors, or identities', async () => {
      const corpus = new ResidentCorpus(client({
        historical: [{
          id: 7,
          title: 'Sensitive Broken Title',
          population: 'Sensitive population',
          location: 'Sensitive location',
          studyFocus: 'Sensitive focus',
          category: 'Sensitive category',
          keywords: 'sensitive keywords',
          studentId: 'PHS/22/0042',
          embedding: null,
          embeddingSourceHash: 'current'
        }],
        review: [{ id: 8, title: 'Sensitive Review Title', embedding: null, embeddingSourceHash: 'current', reviewStartedAt: new Date('2026-09-01T00:00:00Z') }]
      }), makeLog());

      await corpus.refresh();

      const descriptors = corpus.snapshot.skippedDescriptors;
      expect(descriptors).toHaveLength(2);
      for (const descriptor of descriptors) {
        expect(Object.keys(descriptor).sort()).toEqual(['collection', 'reviewStartedAt']);
      }
      expect(descriptors.map(descriptor => descriptor.collection)).toEqual(['HISTORICAL', 'UNDER_REVIEW']);
      expect(descriptors[0].reviewStartedAt).toBeNull();
      const serialized = JSON.stringify(descriptors);
      expect(serialized).not.toContain('Sensitive');
      expect(serialized).not.toContain('PHS/22/0042');
    });

    test('a failed replacement build preserves the active snapshot and its counts', async () => {
      const log = makeLog();
      const db = client({
        historical: [
          { id: 1, embedding: vector(.1), embeddingSourceHash: 'current' },
          { id: 2, embedding: null, embeddingSourceHash: 'current' }
        ]
      });
      const corpus = new ResidentCorpus(db, log);
      const active = await corpus.refresh();

      db.historicalTopic.findMany.mockRejectedValue(new Error('database unavailable'));
      await expect(corpus.refresh()).rejects.toThrow('database unavailable');

      expect(corpus.snapshot).toBe(active);
      expect(corpus.stats()).toMatchObject({
        built: true,
        sourceTopicCount: 2,
        searchableTopicCount: 1,
        skippedInvalidEmbeddingCount: 1,
        lastRefreshError: 'database unavailable'
      });
    });
  });
});

describe('refresh serialization (single-flight)', () => {
  const { REFRESH_INTERVAL_MS } = require('./residentCorpus.service');
  const makeLog = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });
  const tick = () => new Promise(resolve => setImmediate(resolve));

  // A client whose reads are manually gated: each refresh attempt parks its
  // three findMany promises in `pending` until the test releases them, so
  // attempt ordering is fully deterministic with no real sleeps.
  function gatedClient() {
    const pending = [];
    let calls = 0;
    const client = {};
    for (const key of ['historicalTopic', 'currentSessionTopic', 'underReviewTopic']) {
      client[key] = {
        findMany: jest.fn(() => {
          calls += 1;
          return new Promise((resolve, reject) => pending.push({ key, resolve, reject }));
        })
      };
    }
    return {
      client,
      pending,
      callCount: () => calls,
      take() { return pending.splice(0, pending.length); },
      release(reads, worldRows) {
        for (const entry of reads) entry.resolve(entry.key === 'currentSessionTopic' ? worldRows : []);
      },
      fail(reads, error) {
        for (const entry of reads) entry.reject(error);
      }
    };
  }

  const world = (...ids) => ids.map(id => ({ id, embedding: vector(id / 10), embeddingSourceHash: 'current' }));

  test('1) concurrent stale get() calls share exactly one attempt and one set of reads', async () => {
    const gate = gatedClient();
    const corpus = new ResidentCorpus(gate.client, makeLog());

    const first = corpus.get();
    const second = corpus.get();
    await tick();

    expect(gate.callCount()).toBe(3);
    gate.release(gate.take(), world(1));

    const [snapshotA, snapshotB] = await Promise.all([first, second]);
    expect(snapshotA).toBe(snapshotB);
    expect(snapshotA.sourceTopicCount).toBe(1);
  });

  test('2) explicit refresh during a running attempt resolves only from a post-request build', async () => {
    const gate = gatedClient();
    const corpus = new ResidentCorpus(gate.client, makeLog());

    const attemptA = corpus.refresh();
    await tick();
    const readsA = gate.take(); // A read the OLD world (before the caller's write)

    let explicitSettled = false;
    const explicitB = corpus.refresh().finally(() => { explicitSettled = true; });
    await tick();
    // No concurrent reads: B queued instead of starting a second attempt.
    expect(gate.callCount()).toBe(3);

    gate.release(readsA, world(1));
    await attemptA;
    await tick();
    // A settled but B must NOT have resolved from A's pre-write build.
    expect(explicitSettled).toBe(false);
    expect(corpus.snapshot.sourceTopicCount).toBe(1);

    // The follow-up now reads the NEW world (the committed write is visible).
    const readsB = gate.take();
    expect(readsB).toHaveLength(3);
    gate.release(readsB, world(1, 2));
    await explicitB;

    expect(explicitSettled).toBe(true);
    expect(corpus.snapshot.sourceTopicCount).toBe(2);
    expect(gate.callCount()).toBe(6);
  });

  test('3) multiple explicit refreshes during one attempt coalesce into a single follow-up', async () => {
    const gate = gatedClient();
    const corpus = new ResidentCorpus(gate.client, makeLog());

    corpus.refresh();
    await tick();
    const readsA = gate.take();

    const explicitB = corpus.refresh();
    const explicitC = corpus.refresh();
    expect(explicitB).toBe(explicitC);

    gate.release(readsA, world(1));
    await tick();
    gate.release(gate.take(), world(1, 2));
    await Promise.all([explicitB, explicitC]);

    // Exactly two attempts total: A plus one shared follow-up.
    expect(gate.callCount()).toBe(6);
    expect(corpus.snapshot.sourceTopicCount).toBe(2);
  });

  test('4) an explicit refresh arriving while the follow-up runs queues another and is never lost', async () => {
    const gate = gatedClient();
    const corpus = new ResidentCorpus(gate.client, makeLog());

    const attemptA = corpus.refresh();
    await tick();
    const readsA = gate.take();

    const explicitB = corpus.refresh();
    gate.release(readsA, world(1));
    await attemptA;
    await tick();
    const readsB = gate.take(); // follow-up B is now running

    const explicitD = corpus.refresh(); // arrives DURING B
    expect(explicitD).not.toBe(explicitB);
    await tick();
    expect(gate.callCount()).toBe(6); // D queued, not concurrent

    gate.release(readsB, world(1, 2));
    await explicitB;
    await tick();
    const readsD = gate.take();
    expect(readsD).toHaveLength(3);
    gate.release(readsD, world(1, 2, 3));
    await explicitD;

    expect(corpus.snapshot.sourceTopicCount).toBe(3);
    expect(gate.callCount()).toBe(9);
  });

  test('5) attempts are serialized, so an older build can never overwrite a newer one', async () => {
    const gate = gatedClient();
    const corpus = new ResidentCorpus(gate.client, makeLog());

    corpus.refresh();
    await tick();
    const readsA = gate.take();

    const explicitB = corpus.refresh();
    await tick();
    // The audit's race precondition (two attempts reading concurrently) is
    // structurally impossible now: only A's reads exist until A settles.
    expect(gate.callCount()).toBe(3);
    expect(gate.pending).toHaveLength(0);

    gate.release(readsA, world(1));
    await tick();
    const atAfterA = corpus.lastRefreshAt;
    gate.release(gate.take(), world(1, 2));
    await explicitB;

    // Final state is the newest serialized build, monotonically.
    expect(corpus.snapshot.sourceTopicCount).toBe(2);
    expect(corpus.lastRefreshAt).toBeGreaterThanOrEqual(atAfterA);
  });

  test('6) joiners of a failing shared attempt all reject while the previous snapshot and counts survive', async () => {
    const gate = gatedClient();
    const log = makeLog();
    const corpus = new ResidentCorpus(gate.client, log);

    const boot = corpus.refresh();
    await tick();
    gate.release(gate.take(), world(1));
    await boot;
    const activeSnapshot = corpus.snapshot;

    // Force staleness deterministically (no real sleeps), then join two reads.
    corpus.lastRefreshAt = Date.now() - REFRESH_INTERVAL_MS - 1;
    const readOne = corpus.get();
    const readTwo = corpus.get();
    await tick();
    expect(gate.callCount()).toBe(6); // one shared attempt for both joiners

    gate.fail(gate.take(), new Error('database unavailable'));
    await expect(readOne).rejects.toThrow('database unavailable');
    await expect(readTwo).rejects.toThrow('database unavailable');

    expect(corpus.snapshot).toBe(activeSnapshot);
    expect(corpus.stats()).toMatchObject({ built: true, sourceTopicCount: 1, lastRefreshError: 'database unavailable' });
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test('7) a follow-up queued behind a failing attempt still runs and recovers truthfully', async () => {
    const gate = gatedClient();
    const log = makeLog();
    const corpus = new ResidentCorpus(gate.client, log);

    const attemptA = corpus.refresh();
    await tick();
    const readsA = gate.take();

    const explicitB = corpus.refresh();
    gate.fail(readsA, new Error('database unavailable'));
    await expect(attemptA).rejects.toThrow('database unavailable');
    await tick();

    // B runs despite A's failure and does not inherit A's rejection.
    const readsB = gate.take();
    expect(readsB).toHaveLength(3);
    gate.release(readsB, world(1, 2));
    await expect(explicitB).resolves.toMatchObject({ sourceTopicCount: 2 });

    expect(corpus.stats()).toMatchObject({ built: true, sourceTopicCount: 2, lastRefreshError: null });
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls.some(([message]) => /recovered/.test(message))).toBe(true);
  });
});
