const {
  createVoyageProviderStatusService,
  PROVIDER_STATUS
} = require('./voyageProviderStatus.service');
const { VoyageProviderError } = require('./voyageEmbedding.service');

describe('Voyage provider readiness status', () => {
  test('reports not configured without invoking the provider', () => {
    const embedQueryImpl = jest.fn();
    const service = createVoyageProviderStatusService({
      env: {},
      embedQueryImpl,
      autoProbe: false
    });

    expect(service.getStatus()).toMatchObject({
      status: PROVIDER_STATUS.NOT_CONFIGURED,
      message: expect.stringMatching(/not configured/i)
    });
    expect(embedQueryImpl).not.toHaveBeenCalled();
  });

  test('reports configured-but-unverified honestly before the first bounded probe', () => {
    const embedQueryImpl = jest.fn();
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false
    });

    expect(service.getStatus()).toMatchObject({
      status: PROVIDER_STATUS.CONFIGURED_NOT_YET_VERIFIED,
      lastCheckedAt: null
    });
    expect(embedQueryImpl).not.toHaveBeenCalled();
  });

  test('reports available after one successful low-cost probe and caches the result', async () => {
    let clock = new Date('2026-08-23T12:00:00.000Z');
    const embedQueryImpl = jest.fn().mockResolvedValue(Array(1024).fill(0));
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false,
      cacheMs: 60_000,
      now: () => clock
    });

    await service.probe();
    expect(service.getStatus()).toMatchObject({
      status: PROVIDER_STATUS.AVAILABLE,
      cached: true,
      lastSuccessfulAt: '2026-08-23T12:00:00.000Z'
    });
    expect(embedQueryImpl).toHaveBeenCalledTimes(1);

    clock = new Date('2026-08-23T12:00:30.000Z');
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.AVAILABLE);
    expect(embedQueryImpl).toHaveBeenCalledTimes(1);
  });

  test('reports unavailable after a failed probe without exposing the provider error', async () => {
    const providerFailure = new VoyageProviderError('internal provider detail', undefined, 'VOYAGE_TIMEOUT');
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl: jest.fn().mockRejectedValue(providerFailure),
      autoProbe: false,
      log: { warn: jest.fn() }
    });

    await service.probe();
    const status = service.getStatus();
    expect(status).toMatchObject({
      status: PROVIDER_STATUS.UNAVAILABLE,
      lastFailureCode: 'VOYAGE_TIMEOUT',
      cached: true
    });
    expect(status.message).not.toContain('internal provider detail');
  });

  test('marks a cached result stale and refreshes only after the cache window', async () => {
    let timestamp = new Date('2026-08-23T12:00:00.000Z');
    const embedQueryImpl = jest.fn().mockResolvedValue(Array(1024).fill(0));
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false,
      cacheMs: 1_000,
      now: () => timestamp
    });

    await service.probe();
    timestamp = new Date('2026-08-23T12:00:01.500Z');
    expect(service.getStatus()).toMatchObject({
      status: PROVIDER_STATUS.STALE,
      cached: false
    });
    expect(embedQueryImpl).toHaveBeenCalledTimes(1);

    await service.probe();
    expect(embedQueryImpl).toHaveBeenCalledTimes(2);
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.AVAILABLE);
  });
});
