const adminDashboardService = require('../services/adminDashboard.service');

async function getDashboardSummary(req, res, next) {
  try {
    const result = await adminDashboardService.getDashboardSummary();

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardSummary
};
