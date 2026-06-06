const adminReportsService = require('../services/adminReports.service');

async function getReportsSummary(req, res, next) {
  try {
    const result = await adminReportsService.getReportsSummary();

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
  getReportsSummary
};
