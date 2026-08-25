const {
  createVoyageProviderStatusService,
  PROVIDER_STATUS
} = require('./voyageProviderStatus.service');
const { VoyageProviderError } = require('./voyageEmbedding.service');

const VECTOR = Array(1024).fill(0);

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
    const embedQueryImpl = jest.fn().mockResolvedValue(VECTOR);
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false,
      cacheMs: 60_000,
      staleGraceMs: 30_000,
      now: () => clock
    });

    await service.probe();
    expect(service.getStatus()).toMatchObject({
      status: PROVIDER_STATUS.AVAILABLE,
      cached: true,
      revalidating: false,
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

  describe('bounded stale-while-revalidate at the cache boundary', () => {
    // Builds a service whose first probe succeeds and whose next probe never
    // settles, so the refresh is observably "in flight".
    const buildWithHangingRefresh = (overrides = {}) => {
      const clockRef = { value: new Date('2026-08-23T12:00:00.000Z') };
      const embedQueryImpl = jest.fn()
        .mockResolvedValueOnce(VECTOR)
        .mockImplementation(() => new Promise(() => {}));
      const service = createVoyageProviderStatusService({
        env: { VOYAGE_API_KEY: 'test-key' },
        embedQueryImpl,
        autoProbe: true,
        cacheMs: 10_000,
        staleGraceMs: 5_000,
        now: () => clockRef.value,
        log: { info: jest.fn(), warn: jest.fn() },
        ...overrides
      });
      return { service, embedQueryImpl, clockRef };
    };

    test('a known-good provider stays available while the replacement probe is in flight', async () => {
      const { service, embedQueryImpl, clockRef } = buildWithHangingRefresh();
      await service.probe();
      expect(embedQueryImpl).toHaveBeenCalledTimes(1);

      // Cache has expired; the refresh has been started but has not settled.
      clockRef.value = new Date('2026-08-23T12:00:12.000Z');
      const status = service.getStatus();

      expect(status.status).toBe(PROVIDER_STATUS.AVAILABLE);
      expect(status.revalidating).toBe(true);
      expect(status.lastSuccessfulAt).toBe('2026-08-23T12:00:00.000Z');
      expect(embedQueryImpl).toHaveBeenCalledTimes(2);
    });

    test('cache expiry alone never yields a non-available status for a healthy provider', async () => {
      const { service, clockRef } = buildWithHangingRefresh();
      await service.probe();

      // Sample repeatedly across the whole cache+grace window.
      for (let offsetMs = 10_001; offsetMs < 15_000; offsetMs += 500) {
        clockRef.value = new Date(new Date('2026-08-23T12:00:00.000Z').getTime() + offsetMs);
        expect(service.getStatus().status).toBe(PROVIDER_STATUS.AVAILABLE);
      }
    });

    test('many concurrent expired-cache reads trigger exactly one paid provider probe', async () => {
      const { service, embedQueryImpl, clockRef } = buildWithHangingRefresh();
      await service.probe();
      expect(embedQueryImpl).toHaveBeenCalledTimes(1);

      clockRef.value = new Date('2026-08-23T12:00:12.000Z');
      const statuses = Array.from({ length: 25 }, () => service.getStatus());

      expect(embedQueryImpl).toHaveBeenCalledTimes(2);
      expect(statuses.every((s) => s.status === PROVIDER_STATUS.AVAILABLE)).toBe(true);
      expect(statuses.every((s) => s.revalidating === true)).toBe(true);
    });

    test('grace is bounded: beyond cache + grace an unrefreshed provider is not available', async () => {
      const { service, clockRef } = buildWithHangingRefresh();
      await service.probe();

      clockRef.value = new Date('2026-08-23T12:00:14.999Z');
      expect(service.getStatus().status).toBe(PROVIDER_STATUS.AVAILABLE);

      // cacheMs (10s) + staleGraceMs (5s) has now elapsed since the last success.
      clockRef.value = new Date('2026-08-23T12:00:15.001Z');
      const expired = service.getStatus();
      expect(expired.status).toBe(PROVIDER_STATUS.STALE);
      expect(expired.cached).toBe(false);
      expect(expired.message).toMatch(/older than the allowed cache and grace window/i);
    });

    test('a provider that has never verified cannot borrow the grace window', () => {
      const embedQueryImpl = jest.fn().mockImplementation(() => new Promise(() => {}));
      const service = createVoyageProviderStatusService({
        env: { VOYAGE_API_KEY: 'test-key' },
        embedQueryImpl,
        autoProbe: true,
        cacheMs: 10_000,
        staleGraceMs: 5_000
      });

      const status = service.getStatus();
      expect(status.status).toBe(PROVIDER_STATUS.CONFIGURED_NOT_YET_VERIFIED);
      expect(status.status).not.toBe(PROVIDER_STATUS.AVAILABLE);
      expect(status.lastSuccessfulAt).toBeNull();
    });
  });

  test('a successful refresh extends the verified state and clears revalidating', async () => {
    let clock = new Date('2026-08-23T12:00:00.000Z');
    const embedQueryImpl = jest.fn().mockResolvedValue(VECTOR);
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false,
      cacheMs: 10_000,
      staleGraceMs: 5_000,
      now: () => clock
    });

    await service.probe();
    clock = new Date('2026-08-23T12:00:12.000Z');
    await service.probe();

    const status = service.getStatus();
    expect(status).toMatchObject({
      status: PROVIDER_STATUS.AVAILABLE,
      cached: true,
      revalidating: false,
      lastSuccessfulAt: '2026-08-23T12:00:12.000Z'
    });
    expect(embedQueryImpl).toHaveBeenCalledTimes(2);
  });

  test('a failed refresh ends the grace immediately and reports unavailable', async () => {
    let clock = new Date('2026-08-23T12:00:00.000Z');
    const embedQueryImpl = jest.fn()
      .mockResolvedValueOnce(VECTOR)
      .mockRejectedValue(new VoyageProviderError('provider detail', 429, 'VOYAGE_PROVIDER_ERROR'));
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false,
      cacheMs: 10_000,
      staleGraceMs: 60_000,
      now: () => clock,
      log: { info: jest.fn(), warn: jest.fn() }
    });

    await service.probe();
    clock = new Date('2026-08-23T12:00:12.000Z');
    // Still inside the grace window, so a healthy provider would stay available.
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.AVAILABLE);

    await service.probe();
    const failed = service.getStatus();
    expect(failed.status).toBe(PROVIDER_STATUS.UNAVAILABLE);
    expect(failed.lastFailureCode).toBe('VOYAGE_PROVIDER_ERROR');
    expect(failed.message).not.toContain('provider detail');

    // A failure must not be masked by the still-recent successful verification.
    clock = new Date('2026-08-23T12:00:13.000Z');
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.UNAVAILABLE);
  });

  test('provider recovery after a sustained outage restores available', async () => {
    let clock = new Date('2026-08-23T12:00:00.000Z');
    const embedQueryImpl = jest.fn()
      .mockResolvedValueOnce(VECTOR)
      .mockRejectedValueOnce(new VoyageProviderError('down', undefined, 'VOYAGE_PROVIDER_ERROR'))
      .mockRejectedValueOnce(new VoyageProviderError('down', undefined, 'VOYAGE_PROVIDER_ERROR'))
      .mockResolvedValue(VECTOR);
    const service = createVoyageProviderStatusService({
      env: { VOYAGE_API_KEY: 'test-key' },
      embedQueryImpl,
      autoProbe: false,
      cacheMs: 1_000,
      staleGraceMs: 1_000,
      now: () => clock,
      log: { info: jest.fn(), warn: jest.fn() }
    });

    await service.probe();
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.AVAILABLE);

    clock = new Date('2026-08-23T12:00:05.000Z');
    await service.probe();
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.UNAVAILABLE);

    clock = new Date('2026-08-23T12:00:10.000Z');
    await service.probe();
    expect(service.getStatus().status).toBe(PROVIDER_STATUS.UNAVAILABLE);

    clock = new Date('2026-08-23T12:00:15.000Z');
    await service.probe();
    expect(service.getStatus()).toMatchObject({
      status: PROVIDER_STATUS.AVAILABLE,
      lastSuccessfulAt: '2026-08-23T12:00:15.000Z',
      revalidating: false
    });
  });
});
