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
