const submissionService = require('../services/submission.service');
const similarityController = require('./similarity.controller');

function sendLecturerSimilarityError(res, error) {
  return res.status(error.statusCode || 500).json({
    status: 'error',
    message: error.message || 'Lecturer similarity request failed.',
    details: {
      error_code: error.code || 'LECTURER_SIMILARITY_ERROR',
      ...(error.field ? { field: error.field } : {})
    }
  });
}

async function checkLecturerSubmissionSimilarity(req, res, next) {
  try {
    const submission = await submissionService.getLecturerSubmission({
      user: req.user,
      submissionId: req.params.id
    });

    return similarityController.checkSimilarity({
      ...req,
      body: {
        topic: submission.title,
        keywords: submission.keywords || ''
      }
    }, res, next);
  } catch (error) {
    return sendLecturerSimilarityError(res, error);
  }
}

module.exports = {
  checkLecturerSubmissionSimilarity
};
