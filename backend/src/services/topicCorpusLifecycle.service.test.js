jest.mock('../config/database', () => ({}));
jest.mock('./residentCorpus.service', () => ({
  residentCorpus: { refresh: jest.fn() }
}));
jest.mock('../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const logger = require('../config/logger');
const { residentCorpus } = require('./residentCorpus.service');
const {
  retryVoyageCall,
  prepareDocumentEmbedding,
  buildSubmissionTopicShape,
  refreshResidentCorpusSafely,
  MAX_VOYAGE_ATTEMPTS
} = require('./topicCorpusLifecycle.service');
const { validStoredEmbedding, VoyageProviderError, MODEL, DIMENSION } = require('./voyageEmbedding.service');
const { REPRESENTATION_ID, sourceHash } = require('./topicSemanticRepresentation.service');

const TEST_VECTOR = Array.from({ length: 1024 }, (_, index) => (index === 0 ? 1 : 0));
const noSleep = () => Promise.resolve();

describe('topicCorpusLifecycle service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryVoyageCall', () => {
    test('returns the first successful result without retrying', async () => {
      const task = jest.fn().mockResolvedValue('ok');

      await expect(retryVoyageCall(task, { sleepImpl: noSleep })).resolves.toBe('ok');
      expect(task).toHaveBeenCalledTimes(1);
    });

    test('retries transient provider statuses and succeeds', async () => {
      const task = jest.fn()
        .mockRejectedValueOnce(new VoyageProviderError('Voyage embedding request failed (503).', 503))
        .mockRejectedValueOnce(new VoyageProviderError('Voyage embedding request failed (429).', 429))
        .mockResolvedValue(TEST_VECTOR);
      const sleepImpl = jest.fn().mockResolvedValue(undefined);

      await expect(retryVoyageCall(task, { sleepImpl })).resolves.toBe(TEST_VECTOR);
      expect(task).toHaveBeenCalledTimes(3);
      expect(sleepImpl).toHaveBeenCalledTimes(2);
    });

    test('gives up after the bounded number of attempts', async () => {
      const failure = new VoyageProviderError('Voyage embedding request failed (503).', 503);
      const task = jest.fn().mockRejectedValue(failure);

      await expect(retryVoyageCall(task, { sleepImpl: noSleep })).rejects.toBe(failure);
      expect(task).toHaveBeenCalledTimes(MAX_VOYAGE_ATTEMPTS);
    });

    test('does not retry non-transient provider failures', async () => {
      const failure = new VoyageProviderError('Voyage embedding request failed (401).', 401);
      const task = jest.fn().mockRejectedValue(failure);

      await expect(retryVoyageCall(task, { sleepImpl: noSleep })).rejects.toBe(failure);
      expect(task).toHaveBeenCalledTimes(1);
    });
  });

  describe('prepareDocumentEmbedding', () => {
    const topic = {
      title: 'Assessment of Malaria Prevention Awareness Among Final Year Students',
      keywords: 'malaria, prevention',
      category: 'Public Health',
      population: null,
      location: null,
      studyFocus: null
    };

    test('returns the exact stored-embedding metadata contract', async () => {
      const embedImpl = jest.fn().mockResolvedValue(TEST_VECTOR);

      const metadata = await prepareDocumentEmbedding(topic, { embedImpl, sleepImpl: noSleep });

      expect(metadata).toMatchObject({
        embedding: TEST_VECTOR,
        embeddingProvider: 'voyage',
        embeddingModel: MODEL,
        embeddingDimension: DIMENSION,
        embeddingRepresentation: REPRESENTATION_ID,
        embeddingSourceHash: sourceHash(topic)
      });
      expect(metadata.embeddedAt).toBeInstanceOf(Date);
      expect(validStoredEmbedding({ ...topic, ...metadata })).toBe(true);
    });

    test('propagates provider failure without producing a fallback vector', async () => {
      const failure = new VoyageProviderError('Voyage embedding request failed (503).', 503);
      const embedImpl = jest.fn().mockRejectedValue(failure);

      await expect(prepareDocumentEmbedding(topic, { embedImpl, sleepImpl: noSleep })).rejects.toBe(failure);
      expect(embedImpl).toHaveBeenCalledTimes(MAX_VOYAGE_ATTEMPTS);
    });

    test('rejects a malformed provider vector instead of storing it', async () => {
      const embedImpl = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);

      await expect(prepareDocumentEmbedding(topic, { embedImpl, sleepImpl: noSleep }))
        .rejects.toThrow('Generated embedding failed stored-embedding validation.');
    });
  });

  describe('buildSubmissionTopicShape', () => {
    test('maps submission fields onto the frozen structured-context representation shape', () => {
      expect(buildSubmissionTopicShape({
        title: 'A Study of Topic Approval Workflows in Nigerian Universities Today',
        keywords: 'workflow, approval',
        category: 'Education'
      })).toEqual({
        title: 'A Study of Topic Approval Workflows in Nigerian Universities Today',
        keywords: 'workflow, approval',
        category: 'Education',
        population: null,
        location: null,
        studyFocus: null
      });
    });

    test('normalizes absent optional fields to null', () => {
      expect(buildSubmissionTopicShape({ title: 'Title only' })).toMatchObject({
        keywords: null,
        category: null
      });
    });
  });

  describe('refreshResidentCorpusSafely', () => {
    test('returns true when the corpus refresh succeeds', async () => {
      residentCorpus.refresh.mockResolvedValue({ topics: [] });

      await expect(refreshResidentCorpusSafely('unit test')).resolves.toBe(true);
      expect(residentCorpus.refresh).toHaveBeenCalledTimes(1);
    });

    test('returns false and warns instead of throwing when the refresh fails', async () => {
      residentCorpus.refresh.mockRejectedValue(new Error('database unavailable'));

      await expect(refreshResidentCorpusSafely('unit test')).resolves.toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unit test'));
    });
  });
});
