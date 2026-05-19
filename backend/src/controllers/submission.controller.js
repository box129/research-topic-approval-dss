const submissionService = require('../services/submission.service');

function sendSubmissionError(res, error) {
  return res.status(error.statusCode || 500).json({
    status: 'error',
    message: error.message || 'Submission request failed.',
    details: {
      error_code: error.code || 'SUBMISSION_ERROR',
      ...(error.field ? { field: error.field } : {})
    }
  });
}

async function createSubmission(req, res) {
  try {
    const submission = await submissionService.createSubmission({
      user: req.user,
      input: req.body || {}
    });

    return res.status(201).json({
      status: 'success',
      data: {
        submission
      }
    });
  } catch (error) {
    return sendSubmissionError(res, error);
  }
}

async function listSubmissions(req, res) {
  try {
    const submissions = await submissionService.listStudentSubmissions({
      user: req.user
    });

    return res.status(200).json({
      status: 'success',
      data: {
        submissions
      }
    });
  } catch (error) {
    return sendSubmissionError(res, error);
  }
}

async function listLecturerPendingSubmissions(req, res) {
  try {
    const submissions = await submissionService.listLecturerPendingSubmissions({
      user: req.user
    });

    return res.status(200).json({
      status: 'success',
      data: {
        submissions
      }
    });
  } catch (error) {
    return sendSubmissionError(res, error);
  }
}

module.exports = {
  createSubmission,
  listSubmissions,
  listLecturerPendingSubmissions
};
