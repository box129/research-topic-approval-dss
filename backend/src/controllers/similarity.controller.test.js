jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    historicalTopic: { findMany: jest.fn().mockResolvedValue([]) },
    currentSessionTopic: { findMany: jest.fn().mockResolvedValue([]) },
    underReviewTopic: { findMany: jest.fn().mockResolvedValue([]) }
  }))
}), { virtual: true });
jest.mock('../services/voyageEmbedding.service', () => ({
  embedQuery: jest.fn(),
  embedDocument: jest.fn(),
  VoyageProviderError: class VoyageProviderError extends Error {}
}));
jest.mock('../services/voyageSemanticSimilarity.service', () => ({
  retrieve: jest.fn(() => []),
  classify: jest.fn(() => 'LOW')
}));
jest.mock('../services/residentCorpus.service', () => ({ residentCorpus: { get: jest.fn().mockResolvedValue({ topics: [] }), searchable: jest.fn(() => []) } }));
jest.mock('../config/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const { embedQuery, embedDocument } = require('../services/voyageEmbedding.service');
const { retrieve } = require('../services/voyageSemanticSimilarity.service');
const { residentCorpus } = require('../services/residentCorpus.service');

const storedTopic = { id: 9, title: 'Stored eligible topic', collection: 'HISTORICAL', embedding: [] };

describe('Voyage production similarity controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    residentCorpus.get.mockResolvedValue({ topics: [storedTopic] });
    residentCorpus.searchable.mockReturnValue([storedTopic]);
  });

  test('uses one new-topic query embedding and no reverse/document embedding calls', async () => {
    let checkSimilarity; let isolatedRetrieve;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); ({ retrieve: isolatedRetrieve } = require('../services/voyageSemanticSimilarity.service')); });
    const queryVector = Array(1024).fill(0);
    embedQuery.mockResolvedValue(queryVector);
    retrieve.mockReturnValueOnce([
      { topic: { id: 1, title: 'Historical topic', collection: 'HISTORICAL' }, score: 0.7 },
      { topic: { id: 1, title: 'Current-session topic', collection: 'CURRENT_SESSION' }, score: 0.6 }
    ]);
    const res = { json: jest.fn() };
    await checkSimilarity({ body: { topic: 'New topic', population: 'Students' } }, res, jest.fn());
    expect(embedQuery).toHaveBeenCalledTimes(1);
    expect(embedQuery).toHaveBeenCalledWith({ title: 'New topic', population: 'Students', location: undefined, studyFocus: undefined });
    expect(embedDocument).not.toHaveBeenCalled();
    expect(isolatedRetrieve).toHaveBeenCalledWith(queryVector, [storedTopic], 5);
    expect(res.json.mock.calls[0][0]).toMatchObject({ status: 'success', semanticAvailable: true, semanticProvider: 'voyage' });
    expect(res.json.mock.calls[0][0].data.corpus_size).toBe(1);
    expect(res.json.mock.calls[0][0].data.matches).toEqual([
      { id: 1, title: 'Historical topic', category: null, collection: 'HISTORICAL', semantic_score: 0.7, similarity_class: 'LOW' },
      { id: 1, title: 'Current-session topic', category: null, collection: 'CURRENT_SESSION', semantic_score: 0.6, similarity_class: 'LOW' }
    ]);
  });

  test('returns semantic_unavailable for a Voyage transport failure', async () => {
    let checkSimilarity;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); });
    embedQuery.mockRejectedValue(new (require('../services/voyageEmbedding.service').VoyageProviderError)('transport failed'));
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await checkSimilarity({ body: { topic: 'New topic' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'semantic_unavailable', semanticAvailable: false }));
  });

  test('an empty corpus is reported truthfully and never classified as low risk or original', async () => {
    let checkSimilarity;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); });
    residentCorpus.searchable.mockReturnValue([]);
    const res = { json: jest.fn() };

    await checkSimilarity({ body: { topic: 'New topic' } }, res, jest.fn());

    expect(embedQuery).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({ status: 'success', semanticAvailable: true });
    expect(payload.data.corpus_size).toBe(0);
    expect(payload.data.overall_risk).toBeNull();
    expect(payload.data.max_similarity).toBeNull();
    expect(payload.data.matches).toEqual([]);
    expect(payload.data.recommendation).toBe(
      'No eligible stored topics are currently available for comparison. This result does not establish that the topic is new or original.'
    );
  });
});
