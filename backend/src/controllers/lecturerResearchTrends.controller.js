const lecturerResearchTrendsService = require('../services/lecturerResearchTrends.service');

async function getResearchTrends(req, res, next) {
  try {
    const result = await lecturerResearchTrendsService.getResearchTrends();

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
  getResearchTrends
};
