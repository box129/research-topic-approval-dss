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
jest.mock('../config/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const { embedQuery, embedDocument } = require('../services/voyageEmbedding.service');
const { retrieve } = require('../services/voyageSemanticSimilarity.service');
const { checkSimilarity } = require('./similarity.controller');

describe('Voyage production similarity controller', () => {
  test('uses one new-topic query embedding and no reverse/document embedding calls', async () => {
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
    expect(retrieve).toHaveBeenCalledWith(queryVector, [], 5);
    expect(res.json.mock.calls[0][0]).toMatchObject({ status: 'success', semanticAvailable: true, semanticProvider: 'voyage' });
    expect(res.json.mock.calls[0][0].data.matches).toEqual([
      { id: 1, title: 'Historical topic', category: null, collection: 'HISTORICAL', semantic_score: 0.7, similarity_class: 'LOW' },
      { id: 1, title: 'Current-session topic', category: null, collection: 'CURRENT_SESSION', semantic_score: 0.6, similarity_class: 'LOW' }
    ]);
  });
  test('returns semantic_unavailable for a Voyage transport failure', async () => {
    embedQuery.mockRejectedValue(new (require('../services/voyageEmbedding.service').VoyageProviderError)('transport failed'));
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await checkSimilarity({ body: { topic: 'New topic' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'semantic_unavailable', semanticAvailable: false }));
  });
});
