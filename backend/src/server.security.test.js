const request = require('supertest');

jest.mock('./services/auth.service', () => ({
  authenticateToken: jest.fn(),
  getClearCookieOptions: jest.fn(() => ({ httpOnly: true, sameSite: 'lax', secure: false })),
  getCookieOptions: jest.fn(() => ({ httpOnly: true, sameSite: 'lax', secure: false, maxAge: 86400000 })),
  login: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  recordLogout: jest.fn()
}));

jest.mock('./controllers/similarity.controller', () => ({
  checkSimilarity: jest.fn((req, res) => res.status(200).json({
    status: 'success',
    semanticAvailable: true,
    data: { input_topic: req.body.topic, matches: [] }
  }))
}));

jest.mock('./controllers/submission.controller', () => ({
  createSubmission: jest.fn((req, res) => res.status(201).json({
    status: 'success',
    data: { id: 1, title: req.body?.title }
  }))
}));

jest.mock('./controllers/topicImport.controller', () => ({
  previewTopicImport: jest.fn((req, res) => res.status(200).json({ status: 'success', data: { mode: 'preview' } })),
  commitTopicImport: jest.fn((req, res) => res.status(200).json({ status: 'success', data: { mode: 'commit' } }))
}));

const authService = require('./services/auth.service');
const similarityController = require('./controllers/similarity.controller');
const submissionController = require('./controllers/submission.controller');
const topicImportController = require('./controllers/topicImport.controller');
const config = require('./config/env');
const app = require('./server');

function authenticatedUser({
  id = 1,
  role = 'student',
  status = 'active',
  mustChangePassword = false
} = {}) {
  return {
    id,
    name: 'Test User',
    email: `user${id}@example.test`,
    role,
    status,
    mustChangePassword
  };
}

describe('Internet-facing similarity route protections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.authenticateToken.mockReset();
  });

  test.each(['/api/similarity/check', '/api/v1/check-similarity'])('denies anonymous callers on %s', async (path) => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app).post(path).send({ topic: 'A proposed topic' }).expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: { error_code: 'AUTHENTICATION_REQUIRED' }
    });
    expect(similarityController.checkSimilarity).not.toHaveBeenCalled();
  });

  test.each(['/api/similarity/check', '/api/v1/check-similarity'])('allows an authenticated student on %s', async (path) => {
    authService.authenticateToken.mockResolvedValue(authenticatedUser({ id: 501, role: 'student' }));

    const response = await request(app)
      .post(path)
      .set('Cookie', 'rtadss_session=student-session')
      .send({ topic: 'A proposed topic' })
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(similarityController.checkSimilarity).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: 501, role: 'student' }) }),
      expect.anything(),
      expect.anything()
    );
  });

  test('allows an authenticated lecturer but rejects unrelated roles', async () => {
    authService.authenticateToken.mockResolvedValueOnce(authenticatedUser({ id: 502, role: 'lecturer' }));
    await request(app)
      .post('/api/v1/check-similarity')
      .set('Cookie', 'rtadss_session=lecturer-session')
      .send({ topic: 'A proposed topic' })
      .expect(200);

    authService.authenticateToken.mockResolvedValueOnce(authenticatedUser({ id: 503, role: 'admin' }));
    const response = await request(app)
      .post('/api/v1/check-similarity')
      .set('Cookie', 'rtadss_session=admin-session')
      .send({ topic: 'A proposed topic' })
      .expect(403);

    expect(response.body.details.error_code).toBe('FORBIDDEN');
  });

  test('does not let suspended or forced-password-change accounts bypass the route guard', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'INVALID_SESSION',
      message: 'Authentication required.'
    });
    await request(app)
      .post('/api/similarity/check')
      .set('Cookie', 'rtadss_session=suspended-session')
      .send({ topic: 'A proposed topic' })
      .expect(401);

    authService.authenticateToken.mockResolvedValueOnce(authenticatedUser({
      id: 504,
      role: 'student',
      mustChangePassword: true
    }));
    const response = await request(app)
      .post('/api/similarity/check')
      .set('Cookie', 'rtadss_session=temporary-session')
      .send({ topic: 'A proposed topic' })
      .expect(403);

    expect(response.body.details.error_code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  test('uses the paid semantic-operation limiter for student submission creation', async () => {
    authService.authenticateToken.mockResolvedValue(authenticatedUser({ id: 650, role: 'student' }));

    const response = await request(app)
      .post('/api/v1/submissions')
      .set('Cookie', 'rtadss_session=submission-session')
      .send({ title: 'A student submission title' })
      .expect(201);

    expect(submissionController.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: 650, role: 'student' }) }),
      expect.anything(),
      expect.anything()
    );
    expect(Number(response.headers['x-ratelimit-limit'])).toBe(config.rateLimit.similarityMax);
  });

  test('bounds oversized multipart fields before the import controller is invoked', async () => {
    authService.authenticateToken.mockResolvedValue(authenticatedUser({ id: 651, role: 'admin' }));

    const response = await request(app)
      .post('/api/import/topics/preview')
      .set('Cookie', 'rtadss_session=admin-import-session')
      .field('sheetName', 'x'.repeat(config.requestLimits.importUploadFieldSizeBytes + 1))
      .attach('file', Buffer.from('xlsx-placeholder'), 'topics.xlsx')
      .expect(413);

    expect(response.body).toEqual({
      status: 'error',
      message: 'Import form field is too large.',
      details: { error_code: 'MULTIPART_FIELD_TOO_LARGE' }
    });
  });

  test('bounds the number of multipart fields before the import controller is invoked', async () => {
    authService.authenticateToken.mockResolvedValue(authenticatedUser({ id: 652, role: 'admin' }));

    const upload = request(app)
      .post('/api/import/topics/preview')
      .set('Cookie', 'rtadss_session=admin-import-session');
    for (let index = 0; index <= config.requestLimits.importUploadMaxFields; index += 1) {
      upload.field(`field${index}`, 'value');
    }

    const response = await upload.expect(413);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Import request exceeds the allowed multipart limits.',
      details: { error_code: 'MULTIPART_LIMIT_EXCEEDED' }
    });
  });

  test.each([
    '/api/import/topics/commit',
    '/api/v1/import/topics/commit',
    '/api/v1/admin/import/topics/commit'
  ])('uses the dedicated paid-provider limiter on import commit alias %s', async (path) => {
    authService.authenticateToken.mockResolvedValue(authenticatedUser({ id: 653, role: 'admin' }));

    const response = await request(app)
      .post(path)
      .set('Cookie', 'rtadss_session=admin-import-commit-session')
      .expect(200);

    expect(response.body.data.mode).toBe('commit');
    expect(Number(response.headers['x-ratelimit-limit'])).toBe(config.rateLimit.adminTopicImportMax);
  });

  test('does not apply the paid-provider limiter to topic-import previews', async () => {
    authService.authenticateToken.mockResolvedValue(authenticatedUser({ id: 654, role: 'admin' }));

    const response = await request(app)
      .post('/api/v1/import/topics/preview')
      .set('Cookie', 'rtadss_session=admin-import-preview-session')
      .expect(200);

    expect(response.body.data.mode).toBe('preview');
    expect(Number(response.headers['x-ratelimit-limit'])).toBe(config.rateLimit.max);
    expect(topicImportController.previewTopicImport).toHaveBeenCalledTimes(1);
    expect(topicImportController.commitTopicImport).not.toHaveBeenCalled();
  });
});
