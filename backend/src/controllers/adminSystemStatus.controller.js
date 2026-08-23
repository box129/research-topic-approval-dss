const config = require('../config/env');
const packageInfo = require('../../package.json');
const { checkDatabase } = require('../services/readiness.service');
const voyageProviderStatus = require('../services/voyageProviderStatus.service');
const { describeEmailCapability } = require('../services/email.service');
const { residentCorpus } = require('../services/residentCorpus.service');

// Admin-only operational snapshot. Everything here is derived state that is
// safe to show an administrator: component statuses, counts, and timestamps.
// It must never include secrets, environment values, connection strings,
// filesystem paths, or stack traces.
async function getSystemStatus(req, res, next) {
  try {
    const database = await checkDatabase();

    return res.status(200).json({
      success: true,
      data: {
        application: {
          name: 'Research Topic Approval DSS backend',
          version: packageInfo.version,
          buildId: process.env.BUILD_ID || null,
          apiVersion: config.apiVersion,
          environment: config.env,
          nodeVersion: process.version,
          uptimeSeconds: Math.round(process.uptime())
        },
        database,
        semanticProvider: {
          provider: voyageProviderStatus.provider,
          model: voyageProviderStatus.model,
          ...voyageProviderStatus.getStatus()
        },
        emailDelivery: describeEmailCapability(),
        // Corpus stats reflect the current in-memory snapshot without forcing
        // a database refresh; "built: false" before first semantic use is the
        // truthful state, not an error.
        residentCorpus: residentCorpus.stats()
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataCoverage: 'Derived operational state only; no secrets, connection details, or raw provider errors are included.'
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSystemStatus
};
