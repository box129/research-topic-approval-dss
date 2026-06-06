const adminSettingsService = require('../services/adminSettings.service');

async function listSettings(req, res, next) {
  try {
    const result = await adminSettingsService.listSettings();

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
  listSettings
};
