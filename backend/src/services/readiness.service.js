const prisma = require('../config/database');
const sbertService = require('./sbert.service');

const DATABASE_READINESS_TIMEOUT_MS = 2000;

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
    return {
      status: 'available',
      message: 'Database connectivity check succeeded.'
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message: 'Database connectivity check failed.'
    };
  }
}

async function checkSbert() {
  const isHealthy = await sbertService.checkHealth();

  if (isHealthy) {
    return {
      status: 'available',
      message: 'SBERT health check succeeded.'
    };
  }

  return {
    status: 'unavailable',
    message: 'SBERT health check failed; similarity requests may use degraded lexical fallback.'
  };
}

async function getReadiness() {
  const [database, sbert] = await Promise.all([
    checkDatabase(),
    checkSbert()
  ]);

  let status = 'ready';
  let httpStatus = 200;

  if (database.status !== 'available') {
    status = 'not_ready';
    httpStatus = 503;
  } else if (sbert.status !== 'available') {
    status = 'degraded';
    httpStatus = 503;
  }

  return {
    httpStatus,
    body: {
      status,
      checks: {
        api: 'available',
        database: database.status,
        sbert: sbert.status
      },
      details: {
        api: {
          status: 'available',
          message: 'API process responded.'
        },
        database,
        sbert
      },
      meta: {
        generatedAt: new Date().toISOString(),
        readinessPolicy: 'Database and SBERT must both be available for full readiness. SBERT failure is reported as degraded, not full semantic readiness.'
      }
    }
  };
}

module.exports = {
  getReadiness,
  checkDatabase,
  checkSbert,
  DATABASE_READINESS_TIMEOUT_MS
};
