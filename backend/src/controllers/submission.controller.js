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

async function createRevisionSubmission(req, res) {
  try {
    const submission = await submissionService.createRevisionSubmission({
      user: req.user,
      submissionId: req.params.id,
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

async function listLecturerDecisionHistory(req, res) {
  try {
    const result = await submissionService.listLecturerDecisionHistory({
      user: req.user,
      query: req.query || {}
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    return sendSubmissionError(res, error);
  }
}

async function getLecturerSubmission(req, res) {
  try {
    const submission = await submissionService.getLecturerSubmission({
      user: req.user,
      submissionId: req.params.id
    });

    return res.status(200).json({
      status: 'success',
      data: {
        submission
      }
    });
  } catch (error) {
    return sendSubmissionError(res, error);
  }
}

async function updateLecturerSubmissionStatus(req, res) {
  try {
    const submission = await submissionService.updateLecturerSubmissionStatus({
      user: req.user,
      submissionId: req.params.id,
      status: req.body?.status,
      reason: req.body?.reason
    });

    return res.status(200).json({
      status: 'success',
      data: {
        submission
      }
    });
  } catch (error) {
    return sendSubmissionError(res, error);
  }
}

module.exports = {
  createSubmission,
  createRevisionSubmission,
  listSubmissions,
  listLecturerPendingSubmissions,
  listLecturerDecisionHistory,
  getLecturerSubmission,
  updateLecturerSubmissionStatus
};
