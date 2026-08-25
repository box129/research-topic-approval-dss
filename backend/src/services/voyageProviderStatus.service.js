const config = require('../config/env');
const logger = require('../config/logger');
const { embedQuery, MODEL, VoyageProviderError } = require('./voyageEmbedding.service');

const PROVIDER_STATUS = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  CONFIGURED_NOT_YET_VERIFIED: 'configured_not_yet_verified',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  STALE: 'stale'
});

function serializeState(state) {
  return {
    status: state.status,
    message: state.message,
    lastCheckedAt: state.lastCheckedAt,
    lastSuccessfulAt: state.lastSuccessfulAt,
    lastFailedAt: state.lastFailedAt,
    lastFailureCode: state.lastFailureCode,
    cached: Boolean(state.cached),
    // True when this answer comes from a recent successful verification while a
    // replacement probe is still running.
    revalidating: Boolean(state.revalidating)
  };
}

function createVoyageProviderStatusService({
  embedQueryImpl = embedQuery,
  env = process.env,
  cacheMs = config.voyage.readinessProbeCacheMs,
  staleGraceMs = config.voyage.readinessStaleGraceMs,
  now = () => new Date(),
  log = logger,
  autoProbe = String(env.NODE_ENV || '').trim().toLowerCase() !== 'test'
} = {}) {
  let state = {
    status: PROVIDER_STATUS.CONFIGURED_NOT_YET_VERIFIED,
    message: 'Voyage credential is configured but has not yet been verified.',
    lastCheckedAt: null,
    lastSuccessfulAt: null,
    lastFailedAt: null,
    lastFailureCode: null,
    cached: false
  };
  let inFlightProbe = null;

  const isConfigured = () => Boolean(String(env.VOYAGE_API_KEY || '').trim());

  const notConfiguredState = () => ({
    status: PROVIDER_STATUS.NOT_CONFIGURED,
    message: 'VOYAGE_API_KEY is not configured.',
    lastCheckedAt: null,
    lastSuccessfulAt: null,
    lastFailedAt: null,
    lastFailureCode: null,
    cached: false
  });

  const ageMs = (timestamp) => (
    timestamp ? now().getTime() - new Date(timestamp).getTime() : Number.POSITIVE_INFINITY
  );

  const isFresh = () => ageMs(state.lastCheckedAt) < cacheMs;

  // Bounded stale-while-revalidate. Routine cache expiry must not withdraw a
  // healthy instance from traffic just because its replacement probe has not
  // finished yet, but last-known-good is never open-ended:
  //   - the previous verification must have SUCCEEDED (a failed probe already
  //     moved the provider to unavailable, and that must stand);
  //   - a provider that has never verified can never borrow this grace;
  //   - the successful verification must still be inside cacheMs + staleGraceMs.
  const canServeLastKnownGood = () => (
    state.status === PROVIDER_STATUS.AVAILABLE
    && Boolean(state.lastSuccessfulAt)
    && ageMs(state.lastSuccessfulAt) < cacheMs + staleGraceMs
  );

  const probe = async () => {
    if (!isConfigured()) {
      state = notConfiguredState();
      return serializeState(state);
    }

    if (inFlightProbe) {
      return inFlightProbe;
    }

    inFlightProbe = (async () => {
      const previousStatus = state.status;
      try {
        // A single short query embedding verifies the real configured
        // credential/provider/model contract without touching departmental
        // data. The result is cached, so readiness does not pay on every hit.
        await embedQueryImpl({ title: 'readiness' });
        const checkedAt = now().toISOString();
        state = {
          status: PROVIDER_STATUS.AVAILABLE,
          message: 'Voyage semantic provider verification succeeded.',
          lastCheckedAt: checkedAt,
          lastSuccessfulAt: checkedAt,
          lastFailedAt: state.lastFailedAt,
          lastFailureCode: null,
          cached: false
        };
      } catch (error) {
        const checkedAt = now().toISOString();
        const failureCode = error instanceof VoyageProviderError
          ? error.code || 'VOYAGE_PROVIDER_ERROR'
          : 'VOYAGE_PROVIDER_UNAVAILABLE';
        state = {
          status: PROVIDER_STATUS.UNAVAILABLE,
          message: 'Voyage semantic provider verification failed.',
          lastCheckedAt: checkedAt,
          lastSuccessfulAt: state.lastSuccessfulAt,
          lastFailedAt: checkedAt,
          lastFailureCode: failureCode,
          cached: false
        };
      } finally {
        inFlightProbe = null;
      }

      // State-change events only: a provider that stays down does not repeat
      // a log line on every cache-window refresh, and recovery is visible.
      if (state.status !== previousStatus) {
        if (state.status === PROVIDER_STATUS.AVAILABLE) {
          log.info('Voyage provider status changed', {
            from: previousStatus,
            to: state.status
          });
        } else {
          log.warn('Voyage provider status changed', {
            from: previousStatus,
            to: state.status,
            failureCode: state.lastFailureCode
          });
        }
      }

      return serializeState(state);
    })();

    return inFlightProbe;
  };

  const getStatus = () => {
    if (!isConfigured()) {
      state = notConfiguredState();
      return serializeState(state);
    }

    if (!state.lastCheckedAt) {
      if (autoProbe) {
        void probe();
      }
      return serializeState({
        ...state,
        status: PROVIDER_STATUS.CONFIGURED_NOT_YET_VERIFIED,
        message: 'Voyage credential is configured but has not yet been verified.',
        cached: false
      });
    }

    if (!isFresh()) {
      // Start the replacement probe first; `probe()` de-duplicates, so many
      // concurrent readiness calls at expiry still cost exactly one paid probe.
      if (autoProbe) {
        void probe();
      }

      if (canServeLastKnownGood()) {
        return serializeState({
          ...state,
          status: PROVIDER_STATUS.AVAILABLE,
          message: 'Voyage provider verification is being refreshed; serving the recent successful verification within the bounded grace window.',
          cached: true,
          revalidating: true
        });
      }

      return serializeState({
        ...state,
        status: PROVIDER_STATUS.STALE,
        message: 'Voyage provider verification is older than the allowed cache and grace window and has not been re-verified.',
        cached: false,
        revalidating: Boolean(inFlightProbe)
      });
    }

    return serializeState({
      ...state,
      cached: true,
      revalidating: false
    });
  };

  return {
    getStatus,
    probe,
    isConfigured,
    provider: 'voyage',
    model: MODEL
  };
}

module.exports = {
  ...createVoyageProviderStatusService(),
  createVoyageProviderStatusService,
  PROVIDER_STATUS,
  serializeState
};
