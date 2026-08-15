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
});
