const submissionService = require('../services/submission.service');
const similaritySnapshotService = require('../services/similaritySnapshot.service');
const similarityController = require('./similarity.controller');
const logger = require('../config/logger');

function sendLecturerSimilarityError(res, error) {
  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;
  return res.status(statusCode).json({
    status: 'error',
    message: isServerError ? 'Lecturer similarity service is temporarily unavailable.' : (error.message || 'Lecturer similarity request failed.'),
    details: {
      error_code: isServerError ? 'LECTURER_SIMILARITY_UNAVAILABLE' : (error.code || 'LECTURER_SIMILARITY_ERROR'),
      ...(!isServerError && error.field ? { field: error.field } : {})
    }
  });
}

async function checkLecturerSubmissionSimilarity(req, res, next) {
  try {
    const submission = await submissionService.getLecturerSubmission({
      user: req.user,
      submissionId: req.params.id
    });

    const snapshotResponse = Object.create(res);
    snapshotResponse.status = (statusCode) => {
      res.status(statusCode);
      return snapshotResponse;
    };
    snapshotResponse.json = async (similarityResponse) => {
      try {
        await similaritySnapshotService.createSnapshotFromSimilarityResponse({
          submissionId: submission.id,
          checkedById: req.user.id,
          similarityResponse
        });
      } catch (error) {
        logger.warn('Failed to store lecturer similarity snapshot', {
          submissionId: submission.id,
          checkedById: req.user.id,
          error: error.message
        });
      }

      return res.json(similarityResponse);
    };

    // The lecturer's check is a query embedding of the stored submission, and
    // it must use the same structured-context-v1 text the student's own
    // pre-check used: title plus whatever context the student supplied. Passing
    // the title alone would compare a different representation from the one the
    // thresholds were calibrated on.
    return similarityController.checkSimilarity({
      ...req,
      body: {
        topic: submission.title,
        ...(submission.population ? { population: submission.population } : {}),
        ...(submission.location ? { location: submission.location } : {}),
        ...(submission.study_focus ? { studyFocus: submission.study_focus } : {}),
        keywords: submission.keywords || ''
      }
    }, snapshotResponse, next);
  } catch (error) {
    return sendLecturerSimilarityError(res, error);
  }
}

async function listLecturerSubmissionSimilaritySnapshots(req, res) {
  try {
    const submission = await submissionService.getLecturerSubmission({
      user: req.user,
      submissionId: req.params.id
    });

    const snapshots = await similaritySnapshotService.listSnapshotsForSubmission({
      submissionId: submission.id
    });

    return res.status(200).json({
      status: 'success',
      data: {
        submission_id: submission.id,
        snapshots
      }
    });
  } catch (error) {
    return sendLecturerSimilarityError(res, error);
  }
}

module.exports = {
  checkLecturerSubmissionSimilarity,
  listLecturerSubmissionSimilaritySnapshots
};
