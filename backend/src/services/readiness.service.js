const prisma = require('../config/database');

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

function checkVoyageConfiguration() { return process.env.VOYAGE_API_KEY ? { status:'configured', message:'Voyage credential is configured; reachability is not probed by readiness.' } : { status:'unavailable', message:'VOYAGE_API_KEY is not configured.' }; }

// Email is an operational capability, not a liveness requirement: readiness
// reports EMAIL READY vs EMAIL CAPABILITY DISABLED truthfully without
// failing the whole service when delivery is deliberately not configured.
function checkEmailCapability() {
  const { describeEmailCapability } = require('./email.service');
  return describeEmailCapability();
}

async function getReadiness() {
  const database = await checkDatabase(); const voyage = checkVoyageConfiguration(); const email = checkEmailCapability();

  let status = 'ready';
  let httpStatus = 200;

  if (database.status !== 'available') {
    status = 'not_ready';
    httpStatus = 503;
  } else if (voyage.status !== 'configured') {
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
        semanticProvider: voyage.status,
        emailDelivery: email.status
      },
      details: {
        api: {
          status: 'available',
          message: 'API process responded.'
        },
        database,
        semanticProvider: { provider:'voyage', model:'voyage-4-large', mode:'semantic-only', ...voyage },
        emailDelivery: email
      },
      meta: {
        generatedAt: new Date().toISOString(),
        readinessPolicy: 'Database and Voyage credential configuration are required. Email delivery is reported informationally: "configured" means EMAIL READY; "disabled" means EMAIL CAPABILITY DISABLED (invitations and password-recovery email cannot be delivered). No provider request is made by readiness.'
      }
    }
  };
}

module.exports = {
  getReadiness,
  checkDatabase,
  checkVoyageConfiguration,
  checkEmailCapability,
  DATABASE_READINESS_TIMEOUT_MS
};
