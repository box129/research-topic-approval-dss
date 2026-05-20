const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/submission.service', () => ({
  createSubmission: jest.fn(),
  listLecturerPendingSubmissions: jest.fn(),
  listStudentSubmissions: jest.fn(),
  updateLecturerSubmissionStatus: jest.fn()
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

const lecturerUser = {
  id: 8,
  name: 'Lecturer Demo',
  email: 'lecturer.demo@uniosun.edu.ng',
  role: 'lecturer',
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

  test('lecturer can list pending review submissions', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.listLecturerPendingSubmissions.mockResolvedValue([
      {
        id: 1,
        student_name: 'Student Demo',
        student_email: 'student.demo@uniosun.edu.ng',
        title: 'Knowledge of malaria prevention among undergraduate public health students',
        status: 'pending_review'
      }
    ]);

    const response = await request(app)
      .get('/api/v1/lecturer/submissions')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        submissions: [
          {
            id: 1,
            student_name: 'Student Demo',
            student_email: 'student.demo@uniosun.edu.ng',
            status: 'pending_review'
          }
        ]
      }
    });
    expect(submissionService.listLecturerPendingSubmissions).toHaveBeenCalledWith({
      user: lecturerUser
    });
  });

  test('unauthenticated lecturer queue request is rejected', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/lecturer/submissions')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(submissionService.listLecturerPendingSubmissions).not.toHaveBeenCalled();
  });

  test.each([
    'student',
    'admin'
  ])('%s cannot access lecturer pending queue', async (role) => {
    authService.authenticateToken.mockResolvedValue({
      id: 2,
      role,
      status: 'active'
    });

    const response = await request(app)
      .get('/api/v1/lecturer/submissions')
      .set('Cookie', [`rtadss_session=signed-${role}-token`])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(submissionService.listLecturerPendingSubmissions).not.toHaveBeenCalled();
  });

  test('lecturer can approve a pending submission', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.updateLecturerSubmissionStatus.mockResolvedValue({
      id: 1,
      student_name: 'Student Demo',
      student_email: 'student.demo@uniosun.edu.ng',
      title: 'Knowledge of malaria prevention among undergraduate public health students',
      status: 'approved'
    });

    const response = await request(app)
      .patch('/api/v1/lecturer/submissions/1/status')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .send({ status: 'approved' })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        submission: {
          id: 1,
          status: 'approved',
          student_name: 'Student Demo'
        }
      }
    });
    expect(submissionService.updateLecturerSubmissionStatus).toHaveBeenCalledWith({
      user: lecturerUser,
      submissionId: '1',
      status: 'approved'
    });
  });

  test.each([
    'rejected',
    'awaiting_revision'
  ])('lecturer can update a pending submission to %s', async (status) => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.updateLecturerSubmissionStatus.mockResolvedValue({
      id: 1,
      status
    });

    const response = await request(app)
      .patch('/api/v1/lecturer/submissions/1/status')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .send({ status })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        submission: {
          id: 1,
          status
        }
      }
    });
  });

  test('unauthenticated lecturer status update is rejected', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .patch('/api/v1/lecturer/submissions/1/status')
      .send({ status: 'approved' })
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(submissionService.updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });

  test.each([
    'student',
    'admin'
  ])('%s cannot update lecturer submission status', async (role) => {
    authService.authenticateToken.mockResolvedValue({
      id: 2,
      role,
      status: 'active'
    });

    const response = await request(app)
      .patch('/api/v1/lecturer/submissions/1/status')
      .set('Cookie', [`rtadss_session=signed-${role}-token`])
      .send({ status: 'approved' })
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(submissionService.updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });

  test.each([
    ['INVALID_SUBMISSION_STATUS', 400],
    ['SUBMISSION_NOT_FOUND', 404],
    ['SUBMISSION_NOT_PENDING', 400]
  ])('lecturer status update returns service error %s', async (errorCode, statusCode) => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    submissionService.updateLecturerSubmissionStatus.mockRejectedValue({
      statusCode,
      code: errorCode,
      field: errorCode === 'SUBMISSION_NOT_FOUND' ? undefined : 'status',
      message: 'Submission update failed.'
    });

    const response = await request(app)
      .patch('/api/v1/lecturer/submissions/1/status')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .send({ status: 'approved' })
      .expect(statusCode);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: errorCode
      }
    });
  });
});
