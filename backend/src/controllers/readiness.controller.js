const readinessService = require('../services/readiness.service');

async function getReadiness(req, res, next) {
  try {
    const result = await readinessService.getReadiness();
    return res.status(result.httpStatus).json(result.body);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getReadiness
};
