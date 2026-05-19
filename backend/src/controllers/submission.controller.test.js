const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/submission.service', () => ({
  createSubmission: jest.fn(),
  listStudentSubmissions: jest.fn()
}));

const authService = require('../services/auth.service');
const submissionService = require('../services/submission.service');
const app = require('../server');

const studentUser = {
  id: 7,
  name: 'Student Demo',
  email: 'student.demo@uniosun.edu.ng',
  role: 'student',
  status: 'active'
};

describe('Submission API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('authenticated student can create own submission', async () => {
    authService.authenticateToken.mockResolvedValue(studentUser);
    submissionService.createSubmission.mockResolvedValue({
      id: 1,
      student_id: studentUser.id,
      title: 'Knowledge of malaria prevention among undergraduate public health students',
      category: 'Public Health',
      keywords: 'malaria, prevention',
      status: 'pending_review',
      submitted_at: '2026-05-19T10:00:00.000Z'
    });

    const response = await request(app)
      .post('/api/v1/submissions')
      .set('Cookie', ['rtadss_session=signed-student-token'])
      .send({
        title: 'Knowledge of malaria prevention among undergraduate public health students',
        category: 'Public Health',
        keywords: 'malaria, prevention'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        submission: {
          id: 1,
          student_id: studentUser.id,
          status: 'pending_review'
        }
      }
    });
    expect(submissionService.createSubmission).toHaveBeenCalledWith({
      user: studentUser,
      input: expect.objectContaining({
        title: 'Knowledge of malaria prevention among undergraduate public health students'
      })
    });
  });

  test('unauthenticated create request is rejected', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .post('/api/v1/submissions')
      .send({
        title: 'Knowledge of malaria prevention among undergraduate public health students'
      })
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(submissionService.createSubmission).not.toHaveBeenCalled();
  });

  test.each([
    'lecturer',
    'admin'
  ])('%s cannot create student submission', async (role) => {
    authService.authenticateToken.mockResolvedValue({
      id: 2,
      role,
      status: 'active'
    });

    const response = await request(app)
      .post('/api/v1/submissions')
      .set('Cookie', [`rtadss_session=signed-${role}-token`])
      .send({
        title: 'Knowledge of malaria prevention among undergraduate public health students'
      })
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(submissionService.createSubmission).not.toHaveBeenCalled();
  });

  test('title validation errors are returned with field details', async () => {
    authService.authenticateToken.mockResolvedValue(studentUser);
    submissionService.createSubmission.mockRejectedValue({
      statusCode: 400,
      code: 'TITLE_TOO_SHORT',
      field: 'title',
      message: 'Title must be at least 7 words.'
    });

    const response = await request(app)
      .post('/api/v1/submissions')
      .set('Cookie', ['rtadss_session=signed-student-token'])
      .send({ title: 'Too short' })
      .expect(400);

    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Title must be at least 7 words.',
      details: {
        error_code: 'TITLE_TOO_SHORT',
        field: 'title'
      }
    });
  });

  test('student list only returns own submissions from service', async () => {
    authService.authenticateToken.mockResolvedValue(studentUser);
    submissionService.listStudentSubmissions.mockResolvedValue([
      {
        id: 1,
        student_id: studentUser.id,
        title: 'Knowledge of malaria prevention among undergraduate public health students',
        status: 'pending_review'
      }
    ]);

    const response = await request(app)
      .get('/api/v1/submissions')
      .set('Cookie', ['rtadss_session=signed-student-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        submissions: [
          {
            id: 1,
            student_id: studentUser.id,
            status: 'pending_review'
          }
        ]
      }
    });
    expect(submissionService.listStudentSubmissions).toHaveBeenCalledWith({
      user: studentUser
    });
  });
});
