const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/submission.service', () => ({
  getLecturerSubmission: jest.fn(),
  updateLecturerSubmissionStatus: jest.fn()
}));

jest.mock('./similarity.controller', () => ({
  checkSimilarity: jest.fn()
}));

const authService = require('../services/auth.service');
const submissionService = require('../services/submission.service');
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
    expect(delegatedRequest.body).toEqual({
      topic: 'Assessment of antenatal care utilization among pregnant women in Osogbo',
      keywords: 'antenatal care, pregnant women, Osogbo'
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
    expect(delegatedRequest.body).toEqual({
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
});
