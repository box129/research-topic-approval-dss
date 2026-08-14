const { DIMENSION, documentMetadata } = require('../../../../src/services/voyageEmbedding.service');
const { T1, T2, classify } = require('../../../../src/services/voyageSemanticSimilarity.service');
const { loadCorpus, buildCorpusFromRows, eligibleTopics, inMemoryCheck, CorpusStore, sameArrivalBatch } = require('../corpus-loader');
const { databaseBackedCheck, compareChecks, compareCorpusParity, parityQuerySet } = require('../parity');
const { expectedRecords, assertFixtureIntegrity } = require('../integrity');
const { assertConnectedC4bPerformanceDatabase } = require('../safety');

function topic(id, title, vector, overrides = {}) { const base = { id, title, embedding: vector, ...overrides }; return { ...base, ...documentMetadata(base, vector) }; }
function vector(first, second = Math.sqrt(1 - first ** 2)) { return [first, second, ...Array(DIMENSION - 2).fill(0)]; }
function rows({ historical = [], current = [], review = [] } = {}) { return { historicalTopic: historical, currentSessionTopic: current, underReviewTopic: review }; }
const query = [1, ...Array(DIMENSION - 1).fill(0)];

describe('C4B in-memory exact corpus', () => {
  test('admits only valid persisted vectors while retaining currently ineligible under-review rows for later eligibility checks', () => {
    const now = Date.now(); const validHistorical = topic(1, 'Historical', vector(0.8)); const expiredReview = topic(1, 'Review', vector(0.7), { reviewStartedAt: new Date(now - 49 * 60 * 60 * 1000) });
    const invalid = { ...topic(2, 'Invalid', vector(0.6)), embeddingSourceHash: 'stale' };
    const corpus = buildCorpusFromRows(rows({ historical: [validHistorical, invalid], review: [expiredReview] }), { now });
    expect(corpus.counts).toEqual({ loaded: 3, admitted: 2, rejected: 1 }); expect(corpus.topics).toHaveLength(2); expect(eligibleTopics(corpus, now)).toHaveLength(1); expect(eligibleTopics(corpus, now + 1)).toHaveLength(1);
  });

  test('does not read the database during an in-memory check', async () => {
    const prisma = { historicalTopic: { findMany: jest.fn().mockResolvedValue([topic(1, 'Historical', vector(0.8))]) }, currentSessionTopic: { findMany: jest.fn().mockResolvedValue([]) }, underReviewTopic: { findMany: jest.fn().mockResolvedValue([]) } };
    const corpus = await loadCorpus(prisma); Object.values(prisma).forEach(model => model.findMany.mockClear());
    const result = inMemoryCheck(corpus, query); expect(result.matches).toHaveLength(1); Object.values(prisma).forEach(model => expect(model.findMany).not.toHaveBeenCalled());
  });

  test('matches database-backed top-five identity, order, score, class, and overall risk for multiple deterministic queries', () => {
    const now = Date.now(); const data = rows({ historical: [topic(1, 'Historical', vector(0.9)), topic(2, 'Historical two', vector(0.5))], current: [topic(1, 'Current', vector(0.8))], review: [topic(1, 'Review', vector(0.7), { reviewStartedAt: new Date(now) })] }); const corpus = buildCorpusFromRows(data, { now });
    const comparisons = compareCorpusParity(data, corpus, parityQuerySet(), now); expect(comparisons).toHaveLength(4); expect(comparisons.every(result => result.passed)).toBe(true);
    const baseline = databaseBackedCheck(data, query, { now }); const cached = inMemoryCheck(corpus, query, { now }); expect(compareChecks(baseline, cached)).toMatchObject({ passed: true, differences: [], identityOrderParity: true, classParity: true, overallRiskParity: true, maxAbsoluteScoreDifference: 0, tolerance: 1e-12 }); expect(cached.matches.map(match => [match.topic.collection, match.topic.id])).toEqual([['HISTORICAL', 1], ['CURRENT_SESSION', 1], ['UNDER_REVIEW', 1], ['HISTORICAL', 2]]);
  });

  test('keeps frozen threshold classifications and rejects score differences above tolerance', () => {
    const now = Date.now(); const data = rows({ historical: [topic(1, 'T1', vector(T1)), topic(2, 'T2', vector(T2))] }); const corpus = buildCorpusFromRows(data, { now }); const baseline = databaseBackedCheck(data, query, { now }); const cached = inMemoryCheck(corpus, query, { now });
    expect(compareChecks(baseline, cached).passed).toBe(true); expect(cached.matches.map(match => match.similarityClass)).toEqual(baseline.matches.map(match => match.similarityClass));
    const altered = { ...cached, matches: cached.matches.map((match, index) => index ? match : { ...match, score: match.score + 1e-9 }) }; expect(compareChecks(baseline, altered).passed).toBe(false);
  });

  test('preserves baseline parity immediately below, at, and above both frozen thresholds', () => {
    const epsilon = 1e-10; const scores = [T1 - epsilon, T1, T1 + epsilon, T2 - epsilon, T2, T2 + epsilon]; const expectedClasses = ['LOW', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH'];
    expect(scores.map(classify)).toEqual(expectedClasses);
    scores.forEach((score, index) => {
      const data = rows({ historical: [topic(index + 1, `Boundary ${index}`, vector(score))] }); const corpus = buildCorpusFromRows(data); const baseline = databaseBackedCheck(data, query); const cached = inMemoryCheck(corpus, query); const comparison = compareChecks(baseline, cached);
      expect(baseline.matches).toHaveLength(1); expect(cached.matches).toHaveLength(1); expect(Math.abs(baseline.matches[0].score - cached.matches[0].score)).toBeLessThanOrEqual(1e-12); expect(baseline.matches[0].similarityClass).toBe(expectedClasses[index]); expect(cached.matches[0].similarityClass).toBe(expectedClasses[index]); expect(baseline.overallRisk).toBe(expectedClasses[index]); expect(cached.overallRisk).toBe(expectedClasses[index]); expect(comparison.passed).toBe(true);
    });
  });

  test('refresh atomically admits new valid records, excludes stale records, and makes refresh failure explicit', async () => {
    const store = new CorpusStore(); const first = buildCorpusFromRows(rows({ historical: [topic(1, 'First', vector(0.8))] })); await store.refresh(async () => first); expect(store.get().topics).toHaveLength(1);
    const stale = { ...topic(1, 'First', vector(0.8)), embeddingSourceHash: 'stale' }; const second = buildCorpusFromRows(rows({ historical: [stale, topic(2, 'New', vector(0.7))] })); await store.refresh(async () => second); expect(store.get().topics.map(item => item.id)).toEqual([2]);
    await expect(store.refresh(async () => { throw new Error('simulated refresh failure'); })).rejects.toThrow('simulated refresh failure'); expect(store.status).toBe('stale_refresh_failed'); expect(store.get().topics.map(item => item.id)).toEqual([2]);
    const empty = new CorpusStore(); await expect(empty.refresh(async () => { throw new Error('initial load failed'); })).rejects.toThrow('initial load failed'); expect(empty.status).toBe('unavailable'); expect(() => empty.get()).toThrow('unavailable');
  });

  test('shares one read-only corpus snapshot across common-arrival requests and expires review topics without a rebuild', async () => {
    const now = Date.now(); const review = topic(1, 'Review', vector(0.9), { reviewStartedAt: new Date(now - 47 * 60 * 60 * 1000) }); const corpus = buildCorpusFromRows(rows({ current: [topic(1, 'Current', vector(0.8))], review: [review] }), { now });
    const references = []; const batch = await sameArrivalBatch(corpus, query, 10, { now, check: (receivedCorpus, receivedQuery, options) => { references.push(receivedCorpus); return inMemoryCheck(receivedCorpus, receivedQuery, options); } }); const results = batch.samples; expect(new Set(references)).toEqual(new Set([corpus])); expect(results).toHaveLength(10); expect(results.every(result => result.requestLatencyMs >= result.serviceProcessingMs)).toBe(true); expect(new Set(results.map(result => result.searchableRecords))).toEqual(new Set([2])); expect(results.every(result => result.matches.some(match => match.topic.collection === 'UNDER_REVIEW'))).toBe(true);
    expect(inMemoryCheck(corpus, query, { now: now + 2 * 60 * 60 * 1000 }).matches.some(match => match.topic.collection === 'UNDER_REVIEW')).toBe(false); expect(corpus.topics).toHaveLength(2);
  });

  test('enforces requested fixture scale integrity before benchmark work', () => {
    const corpus = buildCorpusFromRows(rows({ historical: [topic(1, 'One', vector(0.8))] })); expect(expectedRecords('1000')).toBe(1000); expect(expectedRecords('small', '7')).toBe(7); expect(() => expectedRecords('small')).toThrow('--expected-size'); expect(() => assertFixtureIntegrity(corpus, 1000)).toThrow('Fixture integrity failed'); expect(assertFixtureIntegrity(corpus, 1)).toMatchObject({ expectedRecords: 1, admittedRecords: 1, rejectedRecords: 0, searchableRecordsAtStart: 1 });
  });

  test('guards resolved connected identity without exposing a URL', async () => {
    const client = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ databaseName: 'topic_similarity_c4_perf', serverAddress: '127.0.0.1', serverPort: 5433 }]) }; await expect(assertConnectedC4bPerformanceDatabase(client, { PERF_DATABASE_URL: 'postgres://perf' })).resolves.toMatchObject({ databaseName: 'topic_similarity_c4_perf' });
    client.$queryRawUnsafe.mockResolvedValueOnce([{ databaseName: 'topic_similarity_v1_dev' }]); await expect(assertConnectedC4bPerformanceDatabase(client, { PERF_DATABASE_URL: 'postgres://perf' })).rejects.toThrow('development database');
    for (const databaseName of ['topic_similarity_c4_perf_backup', 'my_topic_similarity_c4_perf']) { client.$queryRawUnsafe.mockResolvedValueOnce([{ databaseName }]); await expect(assertConnectedC4bPerformanceDatabase(client, { PERF_DATABASE_URL: 'postgres://perf' })).rejects.toThrow('not the dedicated'); }
    client.$queryRawUnsafe.mockResolvedValueOnce([{ databaseName: 'unrelated_database' }]); await expect(assertConnectedC4bPerformanceDatabase(client, { PERF_DATABASE_URL: 'postgres://perf' })).rejects.toThrow('not the dedicated');
  });
});
