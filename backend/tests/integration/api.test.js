/**
 * Integration coverage for the C2 Voyage semantic-only similarity endpoint.
 * The provider is mocked; fixtures contain already-persisted document vectors.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../../src/config/env');

jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/voyageEmbedding.service', () => {
  const actual = jest.requireActual('../../src/services/voyageEmbedding.service');
  return { ...actual, embedQuery: jest.fn(), embedDocument: jest.fn() };
});

const app = require('../../src/server');
const prisma = new PrismaClient();
const voyage = require('../../src/services/voyageEmbedding.service');
const { VoyageProviderError, documentMetadata } = voyage;

const QUERY_VECTOR = Array.from({ length: 1024 }, () => 1);
const DOCUMENT_VECTOR = Array.from({ length: 1024 }, () => 1);

describe('POST /api/similarity/check - Voyage semantic-only integration', () => {
  const created = { historical: [], current: [], review: [], userId: null };
  let sessionToken;

  const seed = async (model, bucket, data) => {
    const persisted = await prisma[model].create({ data: { ...data, ...documentMetadata(data, DOCUMENT_VECTOR) } });
    created[bucket].push(persisted.id);
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'C2 Integration Student',
        email: `c2-integration-${process.pid}-${Date.now()}@example.test`,
        passwordHash: 'not-used-by-token-authentication',
        role: 'STUDENT',
        status: 'ACTIVE',
        mustChangePassword: false,
        credentialVersion: 1
      }
    });
    created.userId = user.id;
    sessionToken = jwt.sign(
      { sub: String(user.id), role: 'student', cv: user.credentialVersion },
      config.auth.jwtSecret,
      { expiresIn: '1h' }
    );

    await seed('historicalTopic', 'historical', {
      title: 'Machine Learning Applications in Healthcare Diagnosis', keywords: 'legacy, keywords',
      sessionYear: 'C2-integration', supervisorName: 'C2 fixture', category: 'Computer Science',
      population: 'adult patients', location: 'Lagos', studyFocus: 'diagnostic support'
    });
    await seed('currentSessionTopic', 'current', {
      title: 'Natural Language Processing for Sentiment Analysis', keywords: 'legacy, keywords',
      sessionYear: 'C2-integration', supervisorName: 'C2 fixture', category: 'Computer Science',
      population: 'university students', location: 'Ibadan', studyFocus: 'sentiment classification'
    });
    await seed('underReviewTopic', 'review', {
      title: 'Blockchain Technology in Supply Chain Management', keywords: 'legacy, keywords',
      sessionYear: 'C2-integration', supervisorName: 'C2 fixture', category: 'Information Systems',
      population: 'logistics firms', location: 'Abuja', studyFocus: 'traceability',
      reviewStartedAt: new Date(), reviewingLecturer: 'C2 fixture'
    });
  });

  beforeEach(() => {
    voyage.embedQuery.mockReset().mockResolvedValue(QUERY_VECTOR);
    voyage.embedDocument.mockReset();
  });

  afterAll(async () => {
    await prisma.underReviewTopic.deleteMany({ where: { id: { in: created.review } } });
    await prisma.currentSessionTopic.deleteMany({ where: { id: { in: created.current } } });
    await prisma.historicalTopic.deleteMany({ where: { id: { in: created.historical } } });
    if (created.userId) {
      await prisma.user.delete({ where: { id: created.userId } });
    }
    await prisma.$disconnect();
  });

  const authenticatedRequest = () => request(app)
    .post('/api/similarity/check')
    .set('Cookie', `${config.auth.cookieName}=${sessionToken}`);

  const successfulRequest = (topic, extra = {}) => authenticatedRequest()
    .send({ topic, ...extra }).expect('Content-Type', /json/).expect(200);

  test('returns the semantic-only success envelope with persisted matches from all searchable models', async () => {
    const response = await successfulRequest('Machine Learning Applications in Healthcare Diagnosis');
    expect(response.body).toMatchObject({ status: 'success', semanticAvailable: true, semanticProvider: 'voyage', semanticModel: 'voyage-4-large' });
    expect(response.body.data).toMatchObject({ input_topic: 'Machine Learning Applications in Healthcare Diagnosis' });
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(response.body.data.overall_risk);
    expect(response.body.data.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'HISTORICAL', id: created.historical[0] }),
      expect.objectContaining({ collection: 'CURRENT_SESSION', id: created.current[0] }),
      expect.objectContaining({ collection: 'UNDER_REVIEW', id: created.review[0] })
    ]));
  });

  test('uses exactly one query embedding and no document embedding call for valid stored fixtures', async () => {
    await successfulRequest('Deep Learning for Medical Image Analysis');
    expect(voyage.embedQuery).toHaveBeenCalledTimes(1);
    expect(voyage.embedQuery).toHaveBeenCalledWith(expect.objectContaining({ title: 'Deep Learning for Medical Image Analysis' }));
    expect(voyage.embedDocument).not.toHaveBeenCalled();
  });

  test('accepts legacy keywords without including them in the semantic query representation', async () => {
    await successfulRequest('Artificial Intelligence in Autonomous Navigation', { keywords: 'computer vision, sensor fusion' });
    expect(voyage.embedQuery).toHaveBeenCalledWith({ title: 'Artificial Intelligence in Autonomous Navigation', population: undefined, location: undefined, studyFocus: undefined });
  });

  test.each([
    'Machine Learning Applications',
    'This is a very long topic title that exceeds the old maximum word count and remains accepted by the C2 semantic endpoint',
    'AI/ML & Deep-Learning (2024) - Research Applications',
    'Machine Learning 2024 with Python 3.9 and TensorFlow 2.0'
  ])('accepts allowed topic wording: %s', async (topic) => {
    const response = await successfulRequest(topic);
    expect(response.body.data.input_topic).toBe(topic);
  });

  test('returns explicit semantic_unavailable for a missing Voyage configuration', async () => {
    voyage.embedQuery.mockRejectedValueOnce(new VoyageProviderError('Voyage semantic analysis is not configured.'));
    const response = await authenticatedRequest().send({ topic: 'Configuration failure fixture' }).expect(503);
    expect(response.body).toEqual(expect.objectContaining({ status: 'semantic_unavailable', semanticAvailable: false, semanticProvider: 'voyage', semanticModel: 'voyage-4-large', message: 'Semantic analysis is currently unavailable.' }));
    expect(response.body).not.toHaveProperty('results');
    expect(response.body).not.toHaveProperty('algorithmStatus');
  });

  test.each([[429, 'rate limited'], [504, 'provider timeout'], [502, 'malformed provider response']])(
    'returns semantic_unavailable for controlled Voyage provider failure %i', async (status, message) => {
      voyage.embedQuery.mockRejectedValueOnce(new VoyageProviderError(message, status));
      const response = await authenticatedRequest().send({ topic: 'Provider failure fixture' }).expect(503);
      expect(response.body).toMatchObject({ status: 'semantic_unavailable', semanticAvailable: false, semanticProvider: 'voyage', semanticModel: 'voyage-4-large' });
      expect(response.body).not.toHaveProperty('error');
    }
  );

  test('returns raw semantic scores and never exposes obsolete component or combined scores', async () => {
    const response = await successfulRequest('Cybersecurity Threats and Defense Mechanisms');
    const seeded = new Set([`HISTORICAL:${created.historical[0]}`, `CURRENT_SESSION:${created.current[0]}`, `UNDER_REVIEW:${created.review[0]}`]);
    for (const result of response.body.data.matches) {
      if (seeded.has(`${result.collection}:${result.id}`)) expect(result.semantic_score).toBeCloseTo(1, 12);
      expect(result).not.toHaveProperty('combined');
      expect(result).not.toHaveProperty('scores');
      expect(result).not.toHaveProperty('jaccard');
      expect(result).not.toHaveProperty('tfidf');
      expect(result).not.toHaveProperty('sbert');
    }
  });

  test('returns current semantic result fields without legacy tier-specific fields', async () => {
    const response = await successfulRequest('Software Engineering Best Practices for Agile Development');
    expect(response.body.data.matches[0]).toEqual(expect.objectContaining({ id: expect.any(Number), title: expect.any(String), category: expect.anything(), semantic_score: expect.any(Number), similarity_class: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/) }));
    expect(response.body.data).not.toHaveProperty('tier1_historical');
    expect(response.body.data).not.toHaveProperty('tier2_current');
    expect(response.body.data).not.toHaveProperty('tier3_under_review');
  });

  test('uses only a generous mocked local runtime guard, not a production performance claim', async () => {
    const startedAt = Date.now();
    await successfulRequest('Internet of Things Security and Privacy Challenges');
    expect(Date.now() - startedAt).toBeLessThan(5000);
  });

  test.each([
    [{}, 'missing topic field'],
    [{ topic: '' }, 'empty topic'],
    [{ topic: '   ' }, 'whitespace topic'],
    [{ topic: null }, 'null topic']
  ])('returns 400 for %s', async (body) => {
    const response = await authenticatedRequest().send(body).expect(400);
    expect(response.body).toMatchObject({ status: 'error', details: { field: 'topic', error_code: 'MISSING_FIELD' } });
  });

  test('returns the generic error envelope for malformed JSON', async () => {
    const response = await authenticatedRequest().set('Content-Type', 'application/json').send('{"topic": invalid json}').expect(400);
    expect(response.body).toMatchObject({ status: 'error', message: 'Invalid request format.', details: { error_code: 'INVALID_FORMAT' } });
  });

  test('accepts application/json content type', async () => {
    const response = await authenticatedRequest().set('Content-Type', 'application/json').send({ topic: 'Data Mining Techniques for Business Intelligence Applications' }).expect(200);
    expect(response.body.semanticAvailable).toBe(true);
  });

  test('rejects a non-JSON similarity request without processing it', async () => {
    const response = await authenticatedRequest().set('Content-Type', 'text/plain').send('topic=test').expect(400);
    expect(response.body).toMatchObject({ status: 'error', details: { field: 'topic', error_code: 'MISSING_FIELD' } });
    expect(voyage.embedQuery).not.toHaveBeenCalled();
  });
});

describe('Health Check Endpoint', () => {
  test('returns 200 for health check', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toHaveProperty('status', 'OK');
  });
});

describe('404 Handler', () => {
  test.each(['/api/non-existent-route', '/api/similarity/check'])('returns the generic not-found envelope for %s', async (path) => {
    const response = await request(app).get(path).expect(404);
    expect(response.body).toMatchObject({ status: 'error', details: { error_code: 'NOT_FOUND' } });
  });
});
