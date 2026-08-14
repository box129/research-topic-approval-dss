const { DIMENSION, documentMetadata } = require('../../../src/services/voyageEmbedding.service');
const { sourceHash } = require('../../../src/services/topicSemanticRepresentation.service');
const { assertPerformanceDatabase, targetRowCount, identityDecision, collectionRows, validateFixture, requireSourceTopics, fixedQueryVector, summary, cloneData, batches } = require('../lib');
const { failureType } = require('../run-provider-latency-benchmark');

function validTopic(overrides = {}) {
  const topic = { id: 1, title: 'Stored topic', population: 'Students', embedding: Array(DIMENSION).fill(0.1), ...overrides };
  return { ...topic, ...documentMetadata(topic, topic.embedding) };
}

describe('C4 production-scale helpers', () => {
  test('refuses absent, development, or normal database targets without revealing URLs', () => {
    expect(() => assertPerformanceDatabase({})).toThrow('PERF_DATABASE_URL is required');
    expect(() => assertPerformanceDatabase({ PERF_DATABASE_URL: 'postgres://topic_similarity_v1_dev' })).toThrow('development database');
    expect(() => assertPerformanceDatabase({ DATABASE_URL: 'postgres://same', PERF_DATABASE_URL: 'postgres://same' })).toThrow('matches DATABASE_URL');
  });

  test('counts empty and populated lifecycle target rows correctly', () => {
    expect(targetRowCount({ historicalTopic: [], currentSessionTopic: [], underReviewTopic: [] })).toBe(0);
    expect(targetRowCount({ historicalTopic: [{ id: 1 }], currentSessionTopic: [{ id: 1 }, { id: 2 }], underReviewTopic: [{ id: 1 }] })).toBe(4);
  });

  test('requires an actual dedicated performance database identity distinct from source', () => {
    const source = { databaseName: 'topic_similarity_source', serverAddress: '127.0.0.1', serverPort: 5432 };
    const target = { databaseName: 'topic_similarity_c4_perf', serverAddress: '127.0.0.1', serverPort: 5433 };
    expect(identityDecision(source, target).target.databaseName).toBe('topic_similarity_c4_perf');
    expect(() => identityDecision(source, { ...target, databaseName: 'topic_similarity_v1_dev' })).toThrow('development database');
    expect(() => identityDecision(source, { ...source, databaseName: 'topic_similarity_c4_perf' })).not.toThrow();
    expect(() => identityDecision({ ...source, databaseName: 'topic_similarity_c4_perf' }, { ...target, serverPort: 5432 })).toThrow('same database identity');
    expect(() => identityDecision(source, { ...target, databaseName: 'unrelated_perf' })).toThrow('must identify');
  });

  test('keeps active lifecycle rows and validates genuine stored-vector metadata', () => {
    const now = Date.now(); const historical = validTopic(); const current = validTopic({ id: 1, title: 'Current topic' });
    const review = validTopic({ id: 1, title: 'Review topic', reviewStartedAt: new Date(now) });
    const expiredReview = validTopic({ id: 2, title: 'Expired review', reviewStartedAt: new Date(now - 49 * 60 * 60 * 1000) });
    const topics = collectionRows({ historicalTopic: [historical], currentSessionTopic: [current], underReviewTopic: [review, expiredReview] }, now);
    expect(topics).toHaveLength(3);
    expect(topics.map(topic => topic.collection)).toEqual(['HISTORICAL', 'CURRENT_SESSION', 'UNDER_REVIEW']);
    expect(validateFixture(topics, 3, now)).toEqual({ searchableRecords: 3, validVectors: 3, failures: 0 });
  });

  test('rejects missing source provenance and preserves semantic fields when cloning', () => {
    const topic = validTopic(); const invalid = { ...topic, embeddingSourceHash: sourceHash({ ...topic, title: 'Changed' }) };
    expect(() => validateFixture([{ ...invalid, collection: 'HISTORICAL' }], 1)).toThrow('failed Voyage metadata');
    const clone = cloneData({ ...topic, collection: 'HISTORICAL' }, 'HISTORICAL');
    expect(clone.id).toBeUndefined();
    expect(clone.title).toBe(topic.title); expect(clone.embedding).toEqual(topic.embedding); expect(clone.embeddingSourceHash).toBe(topic.embeddingSourceHash);
  });

  test('rejects an empty source and partitions deterministic insert batches', () => {
    expect(() => requireSourceTopics([])).toThrow('contains no eligible searchable');
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('uses a deterministic 1024D query probe and stable percentile summaries', () => {
    expect(fixedQueryVector()).toEqual(fixedQueryVector()); expect(fixedQueryVector()).toHaveLength(1024);
    expect(summary([1, 2, 3, 4, 5])).toMatchObject({ min: 1, p50: 3, p95: 5, max: 5, mean: 3 });
  });

  test('categorizes later provider failures without making a provider request', () => {
    expect(failureType({ status: 429 }).kind).toBe('http_429');
    expect(failureType({ status: 503 }).kind).toBe('http_5xx');
    expect(failureType(new (require('../../../src/services/voyageEmbedding.service').VoyageProviderError)('transport'))).toMatchObject({ kind: 'provider_or_transport', status: null });
  });
});
