const prisma = require('../config/database');
const logger = require('../config/logger');
const voyageProviderStatus = require('./voyageProviderStatus.service');

const DATABASE_READINESS_TIMEOUT_MS = 2000;

// Database availability transitions are operational events: log once when
// connectivity is lost and once when it recovers, not on every readiness poll.
let lastDatabaseStatus = null;

function noteDatabaseStatus(status) {
  if (lastDatabaseStatus !== null && lastDatabaseStatus !== status) {
    if (status === 'available') {
      logger.info('Database connectivity recovered', { from: lastDatabaseStatus, to: status });
    } else {
      logger.error('Database connectivity lost', { from: lastDatabaseStatus, to: status });
    }
  }
  lastDatabaseStatus = status;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function checkDatabase() {
  try {
    await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      DATABASE_READINESS_TIMEOUT_MS,
      'Database readiness check timed out.'
    );
    noteDatabaseStatus('available');
    return {
      status: 'available',
      message: 'Database connectivity check succeeded.'
    };
  } catch (error) {
    noteDatabaseStatus('unavailable');
    return {
      status: 'unavailable',
      message: 'Database connectivity check failed.'
    };
  }
}

function checkVoyageConfiguration() {
  return voyageProviderStatus.getStatus();
}

// Email is an operational capability, not a liveness requirement: readiness
// reports EMAIL READY vs EMAIL CAPABILITY DISABLED truthfully without
// failing the whole service when delivery is deliberately not configured.
function checkEmailCapability() {
  const { describeEmailCapability } = require('./email.service');
  return describeEmailCapability();
}

// The resident corpus is the DSS's core comparison substrate: without an
// active snapshot no similarity check can run, so a corpus that has NEVER
// successfully built means the service is not ready. Once an active snapshot
// exists it is deliberately preserved across later refresh failures, so a
// refresh error is reported as a safe degraded detail without withdrawing the
// service. Partial coverage (rows skipped for invalid embeddings) is exposed
// as counts only; whether partial coverage should ever fail readiness is a
// separately-open product decision, deliberately not taken here. The payload
// carries counts, timestamps, and booleans — never raw error text or topic
// content. Lazy require keeps module initialization order simple for tests.
function checkResidentCorpus() {
  const { residentCorpus } = require('./residentCorpus.service');
  const stats = residentCorpus.stats();

  if (!stats.built) {
    return {
      status: 'unavailable',
      message: 'No active resident corpus snapshot exists yet, so similarity checks cannot run.',
      refreshFailed: Boolean(stats.lastRefreshError)
    };
  }

  const refreshFailed = Boolean(stats.lastRefreshError);
  return {
    status: refreshFailed ? 'degraded' : 'available',
    message: refreshFailed
      ? 'A later refresh failed; the previous valid snapshot remains active and continues to serve checks.'
      : 'An active resident corpus snapshot is serving similarity checks.',
    refreshFailed,
    builtAt: stats.builtAt,
    sourceTopicCount: stats.sourceTopicCount,
    searchableTopicCount: stats.searchableTopicCount,
    skippedInvalidEmbeddingCount: stats.skippedInvalidEmbeddingCount
  };
}

async function getReadiness() {
  const database = await checkDatabase(); const voyage = checkVoyageConfiguration(); const email = checkEmailCapability();
  const residentCorpus = checkResidentCorpus();

  let status = 'ready';
  let httpStatus = 200;

  if (database.status !== 'available') {
    status = 'not_ready';
    httpStatus = 503;
  } else if (voyage.status !== 'available') {
    status = 'degraded';
    httpStatus = 503;
  } else if (residentCorpus.status === 'unavailable') {
    // Core corpus has never built: similarity checks cannot run at all, so the
    // service is not ready. A degraded corpus (preserved snapshot after a
    // failed refresh) intentionally does NOT withdraw readiness.
    status = 'not_ready';
    httpStatus = 503;
  }

  return {
    httpStatus,
    body: {
      status,
      checks: {
        api: 'available',
        database: database.status,
        semanticProvider: voyage.status,
        residentCorpus: residentCorpus.status,
        emailDelivery: email.status
      },
      details: {
        api: {
          status: 'available',
          message: 'API process responded.'
        },
        database,
        semanticProvider: {
          provider: voyageProviderStatus.provider,
          model: voyageProviderStatus.model,
          mode: 'semantic-only',
          ...voyage
        },
        residentCorpus,
        emailDelivery: email
      },
      meta: {
        generatedAt: new Date().toISOString(),
        readinessPolicy: 'Database availability, a recently verified Voyage provider, and an active resident corpus snapshot are required for full readiness. Voyage verification uses one de-duplicated bounded minimal query probe per cache window. When that cache expires, a provider whose last verification SUCCEEDED keeps reporting available while its replacement probe runs (revalidating), so routine refresh never withdraws a healthy instance from traffic; that grace is bounded by cache + grace and a provider that has never verified can never use it. A failed probe, or a successful verification older than cache + grace, is reported as degraded. A resident corpus that has never built reports not_ready; once built, the previous valid snapshot is preserved across refresh failures and readiness reports a degraded corpus detail instead of withdrawing the service; skipped-invalid-embedding counts are informational. Email delivery is informational: "configured" means EMAIL READY; "disabled" means EMAIL CAPABILITY DISABLED.'
      }
    }
  };
}

module.exports = {
  getReadiness,
  checkDatabase,
  checkVoyageConfiguration,
  checkEmailCapability,
  checkResidentCorpus,
  DATABASE_READINESS_TIMEOUT_MS
};
