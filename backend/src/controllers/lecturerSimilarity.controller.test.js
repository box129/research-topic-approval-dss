const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/submission.service', () => ({
  getLecturerSubmission: jest.fn(),
  updateLecturerSubmissionStatus: jest.fn()
}));

jest.mock('../services/similaritySnapshot.service', () => ({
  createSnapshotFromSimilarityResponse: jest.fn(),
  listSnapshotsForSubmission: jest.fn()
}));

jest.mock('./similarity.controller', () => ({
  checkSimilarity: jest.fn()
}));

jest.mock('../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const authService = require('../services/auth.service');
const submissionService = require('../services/submission.service');
const similaritySnapshotService = require('../services/similaritySnapshot.service');
const similarityController = require('./similarity.controller');
const app = require('../server');

const lecturerUser = {
  id: 8,
  name: 'Lecturer Demo',
  email: 'lecturer.demo@uniosun.edu.ng',
  role: 'lecturer',
  status: 'active'
};

function mockSimilaritySuccess() {
  similarityController.checkSimilarity.mockImplementation((req, res) => res.status(200).json({
    status: 'success',
    data: {
      input_topic: req.body.topic,
      overall_risk: 'LOW',
      max_similarity: 0,
      tier1_historical: [],
      tier2_current: [],
      tier3_under_review: [],
      recommendation: 'Topic appears unique. Proceed with approval.'
    }
  }));
}

describe('Lecturer similarity wrapper route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    similaritySnapshotService.createSnapshotFromSimilarityResponse.mockResolvedValue({ id: 20 });
    similaritySnapshotService.listSnapshotsForSubmission.mockResolvedValue([]);
    mockSimilaritySuccess();
  });

  test('lecturer can run similarity check for a valid submission id', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 4,
      title: 'Factors influencing malaria prevention practices among undergraduate students in Osogbo',
      keywords: 'malaria, prevention, undergraduate students, Osogbo',
      status: 'pending_review'
    });

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/4/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        input_topic: 'Factors influencing malaria prevention practices among undergraduate students in Osogbo',
        overall_risk: 'LOW',
        max_similarity: 0
      }
    });
    expect(submissionService.getLecturerSubmission).toHaveBeenCalledWith({
      user: lecturerUser,
      submissionId: '4'
    });
    expect(similarityController.checkSimilarity).toHaveBeenCalledTimes(1);
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).toHaveBeenCalledWith({
      submissionId: 4,
      checkedById: lecturerUser.id,
      similarityResponse: response.body
    });
  });

  test('wrapper uses submission title and keywords for the similarity request', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 5,
      title: 'Assessment of antenatal care utilization among pregnant women in Osogbo',
      keywords: 'antenatal care, pregnant women, Osogbo',
      status: 'pending_review'
    });

    await request(app)
      .post('/api/v1/lecturer/submissions/5/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    const delegatedRequest = similarityController.checkSimilarity.mock.calls[0][0];
    expect(delegatedRequest.body).toStrictEqual({
      topic: 'Assessment of antenatal care utilization among pregnant women in Osogbo',
      keywords: 'antenatal care, pregnant women, Osogbo'
    });
  });

  test('wrapper forwards the stored structured context so the lecturer query matches the student pre-check representation', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 7,
      title: 'Knowledge of malaria prevention among mothers in Osogbo',
      keywords: 'malaria, prevention',
      population: 'Mothers of children under five',
      location: 'Osogbo',
      study_focus: 'Malaria prevention knowledge',
      status: 'pending_review'
    });

    await request(app)
      .post('/api/v1/lecturer/submissions/7/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    const delegatedRequest = similarityController.checkSimilarity.mock.calls[0][0];
    // These are exactly the fields similarity.controller hands to embedQuery, so
    // a title-only body here would embed a different representation from the
    // one the thresholds were calibrated on.
    expect(delegatedRequest.body).toStrictEqual({
      topic: 'Knowledge of malaria prevention among mothers in Osogbo',
      population: 'Mothers of children under five',
      location: 'Osogbo',
      studyFocus: 'Malaria prevention knowledge',
      keywords: 'malaria, prevention'
    });
  });

  test('wrapper sends an empty keyword string when submission keywords are null', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 6,
      title: 'Knowledge of hand hygiene practices among health workers in Osogbo',
      keywords: null,
      status: 'pending_review'
    });

    await request(app)
      .post('/api/v1/lecturer/submissions/6/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    const delegatedRequest = similarityController.checkSimilarity.mock.calls[0][0];
    expect(delegatedRequest.body).toStrictEqual({
      topic: 'Knowledge of hand hygiene practices among health workers in Osogbo',
      keywords: ''
    });
  });

  test('unauthenticated request is rejected', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/4/similarity-check')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(submissionService.getLecturerSubmission).not.toHaveBeenCalled();
    expect(similarityController.checkSimilarity).not.toHaveBeenCalled();
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).not.toHaveBeenCalled();
  });

  test.each([
    'student',
    'admin'
  ])('%s request is rejected', async (role) => {
    authService.authenticateToken.mockResolvedValue({
      id: 2,
      role,
      status: 'active'
    });

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/4/similarity-check')
      .set('Cookie', [`rtadss_session=signed-${role}-token`])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(submissionService.getLecturerSubmission).not.toHaveBeenCalled();
    expect(similarityController.checkSimilarity).not.toHaveBeenCalled();
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).not.toHaveBeenCalled();
  });

  test.each([
    ['INVALID_SUBMISSION_ID', 400],
    ['SUBMISSION_NOT_FOUND', 404]
  ])('returns service error %s', async (errorCode, statusCode) => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockRejectedValue({
      statusCode,
      code: errorCode,
      field: errorCode === 'INVALID_SUBMISSION_ID' ? 'id' : undefined,
      message: 'Submission similarity check failed.'
    });

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/abc/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(statusCode);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: errorCode
      }
    });
    expect(similarityController.checkSimilarity).not.toHaveBeenCalled();
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).not.toHaveBeenCalled();
  });

  test('does not expose an unexpected lecturer similarity service error', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockRejectedValue(new Error('database connection string or provider secret'));

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/4/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(500);

    expect(response.body).toEqual({
      status: 'error',
      message: 'Lecturer similarity service is temporarily unavailable.',
      details: { error_code: 'LECTURER_SIMILARITY_UNAVAILABLE' }
    });
    expect(JSON.stringify(response.body)).not.toMatch(/connection string|provider secret/i);
  });

  test('wrapper does not mutate submission status', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 7,
      title: 'Factors affecting immunization uptake among mothers in Osogbo',
      keywords: 'immunization, mothers, Osogbo',
      status: 'pending_review'
    });

    await request(app)
      .post('/api/v1/lecturer/submissions/7/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(submissionService.updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });

  test('wrapper creates snapshot after partial_success similarity check', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 8,
      title: 'Awareness of malaria prevention practices among university students',
      keywords: 'malaria, prevention',
      status: 'pending_review'
    });
    similarityController.checkSimilarity.mockImplementation((req, res) => res.status(200).json({
      status: 'partial_success',
      message: 'SBERT semantic analysis unavailable. Showing lexical similarity only (Jaccard, TF-IDF).',
      data: {
        input_topic: req.body.topic,
        overall_risk: 'LOW',
        max_similarity: 0,
        tier1_historical: [],
        tier2_current: [],
        tier3_under_review: []
      }
    }));

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/8/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body.status).toBe('partial_success');
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).toHaveBeenCalledWith({
      submissionId: 8,
      checkedById: lecturerUser.id,
      similarityResponse: response.body
    });
  });

  test('wrapper does not create snapshot for similarity error response', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Malformed similarity topic',
      keywords: '',
      status: 'pending_review'
    });
    similarityController.checkSimilarity.mockImplementation((req, res) => res.status(400).json({
      status: 'error',
      message: 'Topic is required.',
      details: {
        error_code: 'MISSING_FIELD'
      }
    }));

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/9/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(400);

    expect(response.body.status).toBe('error');
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).toHaveBeenCalledWith({
      submissionId: 9,
      checkedById: lecturerUser.id,
      similarityResponse: response.body
    });
  });

  test('snapshot storage failure still returns similarity response', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 10,
      title: 'Factors affecting malaria prevention among students in Osogbo',
      keywords: 'malaria, prevention',
      status: 'pending_review'
    });
    similaritySnapshotService.createSnapshotFromSimilarityResponse.mockRejectedValue(new Error('Snapshot insert failed'));

    const response = await request(app)
      .post('/api/v1/lecturer/submissions/10/similarity-check')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        overall_risk: 'LOW'
      }
    });
  });

  test('lecturer can list similarity snapshots for a valid submission id', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 11,
      title: 'Assessment of malaria prevention practices among undergraduate students',
      keywords: 'malaria, prevention',
      status: 'pending_review'
    });
    similaritySnapshotService.listSnapshotsForSubmission.mockResolvedValue([
      {
        id: 30,
        checked_by: {
          id: lecturerUser.id,
          name: lecturerUser.name,
          email: lecturerUser.email
        },
        response_status: 'success',
        overall_risk: 'HIGH',
        max_similarity: 81.4,
        recommendation: 'High similarity detected.',
        result_summary: {
          tierCounts: {
            historical: 5,
            currentSession: 1,
            underReview: 2
          }
        },
        created_at: '2026-05-22T12:00:00.000Z'
      }
    ]);

    const response = await request(app)
      .get('/api/v1/lecturer/submissions/11/similarity-snapshots')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      data: {
        submission_id: 11,
        snapshots: [
          {
            id: 30,
            checked_by: {
              id: lecturerUser.id,
              name: lecturerUser.name,
              email: lecturerUser.email
            },
            response_status: 'success',
            overall_risk: 'HIGH',
            max_similarity: 81.4,
            recommendation: 'High similarity detected.',
            result_summary: {
              tierCounts: {
                historical: 5,
                currentSession: 1,
                underReview: 2
              }
            },
            created_at: '2026-05-22T12:00:00.000Z'
          }
        ]
      }
    });
    expect(submissionService.getLecturerSubmission).toHaveBeenCalledWith({
      user: lecturerUser,
      submissionId: '11'
    });
    expect(similaritySnapshotService.listSnapshotsForSubmission).toHaveBeenCalledWith({
      submissionId: 11
    });
    expect(similaritySnapshotService.createSnapshotFromSimilarityResponse).not.toHaveBeenCalled();
    expect(submissionService.updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });

  test('lecturer snapshot history returns an empty list when no snapshots exist', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockResolvedValue({
      id: 12,
      title: 'Assessment of malaria prevention practices among undergraduate students',
      keywords: null,
      status: 'pending_review'
    });
    similaritySnapshotService.listSnapshotsForSubmission.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/lecturer/submissions/12/similarity-snapshots')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body).toEqual({
      status: 'success',
      data: {
        submission_id: 12,
        snapshots: []
      }
    });
  });

  test('unauthenticated snapshot history request is rejected', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/lecturer/submissions/11/similarity-snapshots')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(submissionService.getLecturerSubmission).not.toHaveBeenCalled();
    expect(similaritySnapshotService.listSnapshotsForSubmission).not.toHaveBeenCalled();
  });

  test.each([
    'student',
    'admin'
  ])('%s snapshot history request is rejected', async (role) => {
    authService.authenticateToken.mockResolvedValue({
      id: 2,
      role,
      status: 'active'
    });

    const response = await request(app)
      .get('/api/v1/lecturer/submissions/11/similarity-snapshots')
      .set('Cookie', [`rtadss_session=signed-${role}-token`])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(submissionService.getLecturerSubmission).not.toHaveBeenCalled();
    expect(similaritySnapshotService.listSnapshotsForSubmission).not.toHaveBeenCalled();
  });

  test.each([
    ['INVALID_SUBMISSION_ID', 400],
    ['SUBMISSION_NOT_FOUND', 404]
  ])('snapshot history returns service error %s', async (errorCode, statusCode) => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.getLecturerSubmission.mockRejectedValue({
      statusCode,
      code: errorCode,
      field: errorCode === 'INVALID_SUBMISSION_ID' ? 'id' : undefined,
      message: 'Submission snapshot history failed.'
    });

    const response = await request(app)
      .get('/api/v1/lecturer/submissions/abc/similarity-snapshots')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(statusCode);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: errorCode
      }
    });
    expect(similaritySnapshotService.listSnapshotsForSubmission).not.toHaveBeenCalled();
  });
});
