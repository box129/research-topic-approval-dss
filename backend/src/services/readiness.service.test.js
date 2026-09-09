jest.mock('../config/database', () => ({ $queryRaw: jest.fn() }));
const prisma = require('../config/database');
const readinessService = require('./readiness.service');
const { residentCorpus } = require('./residentCorpus.service');

const HEALTHY_CORPUS_STATS = {
  built: true,
  topics: 9,
  searchable: 8,
  builtAt: '2026-08-23T12:00:00.000Z',
  sourceTopicCount: 9,
  searchableTopicCount: 8,
  skippedInvalidEmbeddingCount: 0,
  lastRefreshError: null
};

function spyCorpusStats(stats) {
  return jest.spyOn(residentCorpus, 'stats').mockReturnValue(stats);
}

describe('Voyage readiness service', () => {
  const originalKey = process.env.VOYAGE_API_KEY;
  beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });
  afterEach(() => { process.env.VOYAGE_API_KEY = originalKey; jest.useRealTimers(); });
  test('reports configured-but-unverified Voyage honestly before a probe completes', async () => {
    process.env.VOYAGE_API_KEY = 'test'; prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    const result = await readinessService.getReadiness();
    expect(result.httpStatus).toBe(503); expect(result.body).toMatchObject({ status:'degraded', checks:{api:'available',database:'available',semanticProvider:'configured_not_yet_verified'}, details:{semanticProvider:{provider:'voyage',model:'voyage-4-large',mode:'semantic-only'}} });
  });
  test('reports degraded when Voyage is not configured, without lexical fallback', async () => {
    delete process.env.VOYAGE_API_KEY; prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    const result = await readinessService.getReadiness();
    expect(result.httpStatus).toBe(503); expect(result.body.details.semanticProvider.message).toMatch(/VOYAGE_API_KEY/);
  });
  test('reports not ready when database is unavailable', async () => {
    process.env.VOYAGE_API_KEY = 'test'; prisma.$queryRaw.mockRejectedValue(new Error('connection failed'));
    const result = await readinessService.getReadiness(); expect(result.httpStatus).toBe(503); expect(result.body.checks.database).toBe('unavailable');
  });

  describe('routine provider cache refresh must not withdraw a healthy instance', () => {
    const voyageProviderStatus = require('./voyageProviderStatus.service');

    afterEach(() => { jest.restoreAllMocks(); });

    test('stays ready with HTTP 200 while a bounded provider refresh is in flight', async () => {
      process.env.VOYAGE_API_KEY = 'test';
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      spyCorpusStats(HEALTHY_CORPUS_STATS);
      jest.spyOn(voyageProviderStatus, 'getStatus').mockReturnValue({
        status: 'available',
        message: 'Voyage provider verification is being refreshed; serving the recent successful verification within the bounded grace window.',
        lastCheckedAt: '2026-08-23T12:00:00.000Z',
        lastSuccessfulAt: '2026-08-23T12:00:00.000Z',
        lastFailedAt: null,
        lastFailureCode: null,
        cached: true,
        revalidating: true
      });

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(200);
      expect(result.body.status).toBe('ready');
      expect(result.body.checks.semanticProvider).toBe('available');
      expect(result.body.checks.residentCorpus).toBe('available');
      expect(result.body.details.semanticProvider.revalidating).toBe(true);
    });

    test('a provider left unverified beyond cache and grace is still reported degraded', async () => {
      process.env.VOYAGE_API_KEY = 'test';
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      jest.spyOn(voyageProviderStatus, 'getStatus').mockReturnValue({
        status: 'stale',
        message: 'Voyage provider verification is older than the allowed cache and grace window and has not been re-verified.',
        lastCheckedAt: '2026-08-23T12:00:00.000Z',
        lastSuccessfulAt: '2026-08-23T12:00:00.000Z',
        lastFailedAt: null,
        lastFailureCode: null,
        cached: false,
        revalidating: false
      });

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(503);
      expect(result.body.status).toBe('degraded');
      expect(result.body.checks.semanticProvider).toBe('stale');
    });

    test('a genuine provider outage is still reported degraded', async () => {
      process.env.VOYAGE_API_KEY = 'test';
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      jest.spyOn(voyageProviderStatus, 'getStatus').mockReturnValue({
        status: 'unavailable',
        message: 'Voyage semantic provider verification failed.',
        lastCheckedAt: '2026-08-23T12:05:00.000Z',
        lastSuccessfulAt: '2026-08-23T12:00:00.000Z',
        lastFailedAt: '2026-08-23T12:05:00.000Z',
        lastFailureCode: 'VOYAGE_PROVIDER_ERROR',
        cached: true,
        revalidating: false
      });

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(503);
      expect(result.body.status).toBe('degraded');
      expect(result.body.checks.semanticProvider).toBe('unavailable');
    });
  });

  describe('resident corpus readiness', () => {
    const voyageProviderStatus = require('./voyageProviderStatus.service');

    const availableVoyage = () => jest.spyOn(voyageProviderStatus, 'getStatus').mockReturnValue({
      status: 'available',
      message: 'Voyage provider verified.',
      lastCheckedAt: '2026-08-23T12:00:00.000Z',
      lastSuccessfulAt: '2026-08-23T12:00:00.000Z',
      lastFailedAt: null,
      lastFailureCode: null,
      cached: true,
      revalidating: false
    });

    beforeEach(() => {
      process.env.VOYAGE_API_KEY = 'test';
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      availableVoyage();
    });

    afterEach(() => { jest.restoreAllMocks(); });

    test('CASE A: a corpus that has never built makes the service not ready', async () => {
      spyCorpusStats({
        built: false,
        topics: null,
        searchable: null,
        builtAt: null,
        sourceTopicCount: null,
        searchableTopicCount: null,
        skippedInvalidEmbeddingCount: null,
        lastRefreshError: 'database unavailable'
      });

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(503);
      expect(result.body.status).toBe('not_ready');
      expect(result.body.checks.residentCorpus).toBe('unavailable');
      expect(result.body.details.residentCorpus.message).toMatch(/no active resident corpus snapshot/i);
      // Safe detail only: the raw refresh error text never reaches the public payload.
      expect(JSON.stringify(result.body)).not.toContain('database unavailable');
    });

    test('CASE B: a preserved snapshot after a failed refresh keeps the service ready with a safe degraded detail', async () => {
      spyCorpusStats({
        ...HEALTHY_CORPUS_STATS,
        lastRefreshError: 'connect ECONNREFUSED 127.0.0.1:5432'
      });

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(200);
      expect(result.body.status).toBe('ready');
      expect(result.body.checks.residentCorpus).toBe('degraded');
      expect(result.body.details.residentCorpus).toMatchObject({
        refreshFailed: true,
        searchableTopicCount: 8
      });
      expect(JSON.stringify(result.body)).not.toContain('ECONNREFUSED');
    });

    test('CASE C: a partial corpus stays ready in this PR with the skipped count visible', async () => {
      spyCorpusStats({
        ...HEALTHY_CORPUS_STATS,
        topics: 6,
        searchable: 6,
        searchableTopicCount: 6,
        skippedInvalidEmbeddingCount: 3
      });

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(200);
      expect(result.body.status).toBe('ready');
      expect(result.body.checks.residentCorpus).toBe('available');
      expect(result.body.details.residentCorpus).toMatchObject({
        sourceTopicCount: 9,
        searchableTopicCount: 6,
        skippedInvalidEmbeddingCount: 3,
        refreshFailed: false
      });
    });

    test('CASE D: a healthy active corpus reports normal readiness with counts and no sensitive content', async () => {
      spyCorpusStats(HEALTHY_CORPUS_STATS);

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(200);
      expect(result.body.status).toBe('ready');
      expect(result.body.details.residentCorpus).toEqual({
        status: 'available',
        message: 'An active resident corpus snapshot is serving similarity checks.',
        refreshFailed: false,
        builtAt: '2026-08-23T12:00:00.000Z',
        sourceTopicCount: 9,
        searchableTopicCount: 8,
        skippedInvalidEmbeddingCount: 0
      });
    });

    test('database and Voyage gates still take precedence over the corpus gate', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection failed'));
      spyCorpusStats(HEALTHY_CORPUS_STATS);

      const result = await readinessService.getReadiness();

      expect(result.httpStatus).toBe(503);
      expect(result.body.status).toBe('not_ready');
      expect(result.body.checks.database).toBe('unavailable');
    });
  });
});
