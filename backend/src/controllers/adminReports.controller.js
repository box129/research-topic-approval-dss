const adminReportsService = require('../services/adminReports.service');
const adminReportExportService = require('../services/adminReportExport.service');

function buildErrorResponse(code, message, field) {
  const error = {
    code,
    message
  };

  if (field) {
    error.field = field;
  }

  return {
    success: false,
    error
  };
}

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

async function exportReport(req, res, next) {
  try {
    const result = await adminReportExportService.exportReport({
      type: req.params.type,
      query: req.query,
      req
    });

    res.set('Content-Type', result.contentType);
    res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.set('X-Report-Export-Type', result.type);
    res.set('X-Report-Export-Row-Count', String(result.rowCount));
    return res.status(200).send(result.body);
  } catch (error) {
    if (error instanceof adminReportExportService.AdminReportExportServiceError) {
      return res.status(error.statusCode).json(
        buildErrorResponse(error.code, error.message, error.field)
      );
    }

    return next(error);
  }
}

module.exports = {
  getReportsSummary,
  exportReport,
  buildErrorResponse
};
