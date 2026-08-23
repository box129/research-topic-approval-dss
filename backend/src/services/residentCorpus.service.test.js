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

    expect(corpus.stats()).toEqual({ built: false, topics: null, searchable: null, builtAt: null, lastRefreshError: null });

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
});
