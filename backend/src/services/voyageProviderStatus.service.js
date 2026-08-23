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
    cached: Boolean(state.cached)
  };
}

function createVoyageProviderStatusService({
  embedQueryImpl = embedQuery,
  env = process.env,
  cacheMs = config.voyage.readinessProbeCacheMs,
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

  const isFresh = () => {
    if (!state.lastCheckedAt) {
      return false;
    }
    return now().getTime() - new Date(state.lastCheckedAt).getTime() < cacheMs;
  };

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
      if (autoProbe) {
        void probe();
      }
      return serializeState({
        ...state,
        status: PROVIDER_STATUS.STALE,
        message: 'Voyage provider status is stale while a bounded refresh is running.',
        cached: false
      });
    }

    return serializeState({
      ...state,
      cached: true
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
