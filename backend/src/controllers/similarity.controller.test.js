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
      // These corpus rows carry no optional context, so every context field
      // serialises as null rather than '', undefined or a missing key.
      { id: 1, title: 'Historical topic', category: null, collection: 'HISTORICAL', session_year: null, supervisor_name: null, population: null, location: null, study_focus: null, semantic_score: 0.7, similarity_class: 'LOW' },
      { id: 1, title: 'Current-session topic', category: null, collection: 'CURRENT_SESSION', session_year: null, supervisor_name: null, population: null, location: null, study_focus: null, semantic_score: 0.6, similarity_class: 'LOW' }
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

  test('maps a malformed Voyage provider body to semantic_unavailable', async () => {
    let checkSimilarity;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); });
    const ProviderError = require('../services/voyageEmbedding.service').VoyageProviderError;
    embedQuery.mockRejectedValue(new ProviderError('Voyage returned malformed embedding data.'));
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await checkSimilarity({ body: { topic: 'New topic' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'semantic_unavailable',
      semanticAvailable: false,
      semanticProvider: 'voyage'
    }));
    expect(retrieve).not.toHaveBeenCalled();
  });

  test('maps a bounded Voyage timeout to semantic_unavailable without a fallback result', async () => {
    let checkSimilarity;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); });
    const TimeoutError = require('../services/voyageEmbedding.service').VoyageProviderError;
    const timeout = new TimeoutError('Voyage embedding request timed out.');
    timeout.code = 'VOYAGE_TIMEOUT';
    embedQuery.mockRejectedValue(timeout);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await checkSimilarity({ body: { topic: 'New topic' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'semantic_unavailable',
      semanticAvailable: false,
      semanticProvider: 'voyage'
    }));
    expect(retrieve).not.toHaveBeenCalled();
  });

  test('rejects oversized similarity context before provider work', async () => {
    let checkSimilarity;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await checkSimilarity({ body: { topic: 'New topic', population: 'x'.repeat(1001) } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      details: { field: 'population', error_code: 'SIMILARITY_INPUT_TOO_LARGE' }
    }));
    expect(embedQuery).not.toHaveBeenCalled();
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

describe('similarity match context serialization', () => {
  // A resident-corpus row is a whole table row, so this fixture deliberately
  // carries the fields that must never reach a client alongside the ones that
  // must.
  const fullCorpusRow = {
    id: 42,
    title: 'Malaria prevention knowledge among rural caregivers',
    category: 'Public Health',
    collection: 'HISTORICAL',
    sessionYear: '2021/2022',
    supervisorName: 'Dr A. Adeyemi',
    population: 'Rural caregivers',
    location: 'Osun State',
    studyFocus: 'Preventive knowledge and practice',
    embedding: Array(1024).fill(0.01),
    embeddingProvider: 'voyage',
    embeddingModel: 'voyage-4-large',
    embeddingDimension: 1024,
    embeddingRepresentation: 'structured-context-v1',
    embeddingSourceHash: 'a'.repeat(64),
    embeddedAt: new Date('2026-01-01T00:00:00Z'),
    rawRecord: { secret: 'internal import payload' },
    importWarnings: ['something'],
    sourceFilename: 'internal-import.xlsx',
    importBatchId: 'batch-77',
    sourceFingerprint: 'fingerprint-77',
    studentId: 'PHS/22/0042',
    submissionId: 903
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // A non-empty corpus, so the controller reaches ranking instead of taking
    // the honest empty-corpus path.
    residentCorpus.get.mockResolvedValue({ topics: [storedTopic] });
    residentCorpus.searchable.mockReturnValue([storedTopic]);
  });

  async function runCheckWith(matchTopic) {
    let checkSimilarity;
    jest.isolateModules(() => { ({ checkSimilarity } = require('./similarity.controller')); });
    embedQuery.mockResolvedValue(Array(1024).fill(0));
    retrieve.mockReturnValueOnce([{ topic: matchTopic, score: 0.66 }]);
    const res = { json: jest.fn() };
    await checkSimilarity({ body: { topic: 'A new proposed topic' } }, res, jest.fn());
    return res.json.mock.calls[0][0].data.matches[0];
  }

  test('approved context fields reach the client', async () => {
    const match = await runCheckWith(fullCorpusRow);

    expect(match).toMatchObject({
      id: 42,
      title: 'Malaria prevention knowledge among rural caregivers',
      category: 'Public Health',
      collection: 'HISTORICAL',
      session_year: '2021/2022',
      supervisor_name: 'Dr A. Adeyemi',
      population: 'Rural caregivers',
      location: 'Osun State',
      study_focus: 'Preventive knowledge and practice'
    });
  });

  test('embedding, provenance and student fields are never exposed', async () => {
    const match = await runCheckWith(fullCorpusRow);

    for (const forbidden of [
      'embedding', 'embeddingProvider', 'embeddingModel', 'embeddingDimension',
      'embeddingRepresentation', 'embeddingSourceHash', 'embeddedAt',
      'rawRecord', 'importWarnings', 'sourceFilename', 'importBatchId',
      'sourceFingerprint', 'studentId', 'submissionId', 'student_id'
    ]) {
      expect(match).not.toHaveProperty(forbidden);
    }

    // The serialized payload is an exact allowlist, not a filtered row.
    expect(Object.keys(match).sort()).toEqual([
      'category', 'collection', 'id', 'location', 'population',
      'semantic_score', 'session_year', 'similarity_class', 'study_focus',
      'supervisor_name', 'title'
    ]);
  });

  test('absent and blank context collapses to null so the UI never renders empty labels', async () => {
    // Submission-sourced under-review rows store '' for supervisor name.
    const match = await runCheckWith({
      id: 7,
      title: 'Under-review proposal',
      collection: 'UNDER_REVIEW',
      sessionYear: '',
      supervisorName: '   ',
      population: null,
      location: undefined
    });

    expect(match.session_year).toBeNull();
    expect(match.supervisor_name).toBeNull();
    expect(match.population).toBeNull();
    expect(match.location).toBeNull();
    expect(match.study_focus).toBeNull();
  });

  test('scoring and classification are untouched by the widened payload', async () => {
    const match = await runCheckWith(fullCorpusRow);

    expect(match.semantic_score).toBe(0.66);
    expect(match.similarity_class).toBe('LOW');
  });
});
