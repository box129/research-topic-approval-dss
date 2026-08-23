jest.mock('../config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  http: jest.fn()
}));

const logger = require('../config/logger');
const { errorHandler, categorizeError, ERROR_CATEGORIES, AppError } = require('./errorHandler.middleware');

function runHandler(err, { production = false, requestId = 'req-test-0001', user } = {}) {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = production ? 'production' : 'test';
  const req = { path: '/api/v1/example', method: 'POST', ip: '127.0.0.1', requestId, user };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  try {
    errorHandler(err, req, res, jest.fn());
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
  return res;
}

describe('categorizeError', () => {
  test('maps provider, database, email, import, and corpus failures to their operational categories', () => {
    const voyage = Object.assign(new Error('Voyage embedding request failed (503).'), { name: 'VoyageProviderError' });
    expect(categorizeError(voyage)).toBe(ERROR_CATEGORIES.VOYAGE_PROVIDER);
    expect(categorizeError({ code: 'SEMANTIC_PROVIDER_UNAVAILABLE' })).toBe(ERROR_CATEGORIES.VOYAGE_PROVIDER);

    expect(categorizeError({ name: 'PrismaClientKnownRequestError', code: 'P2002' })).toBe(ERROR_CATEGORIES.DATABASE);
    expect(categorizeError({ message: 'Database connection failed' })).toBe(ERROR_CATEGORIES.DATABASE);

    expect(categorizeError({ name: 'EmailServiceError', code: 'EMAIL_DELIVERY_FAILED' })).toBe(ERROR_CATEGORIES.SMTP_PROVIDER);
    expect(categorizeError({ code: 'SMTP_AUTH_FAILED' })).toBe(ERROR_CATEGORIES.SMTP_PROVIDER);

    expect(categorizeError({ name: 'UserBulkImportError', code: 'MALFORMED_WORKBOOK' })).toBe(ERROR_CATEGORIES.IMPORT);
    expect(categorizeError({ code: 'TOPIC_IMPORT_FAILED' })).toBe(ERROR_CATEGORIES.IMPORT);

    expect(categorizeError({ message: 'Resident corpus is unavailable.' })).toBe(ERROR_CATEGORIES.CORPUS);
  });

  test('maps auth, authorization, rate-limit, validation, and unknown failures', () => {
    expect(categorizeError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED' })).toBe(ERROR_CATEGORIES.AUTHENTICATION);
    expect(categorizeError({ statusCode: 403, code: 'FORBIDDEN' })).toBe(ERROR_CATEGORIES.AUTHORIZATION);
    expect(categorizeError({ statusCode: 429 })).toBe(ERROR_CATEGORIES.RATE_LIMIT);
    expect(categorizeError({ statusCode: 400, code: 'USER_PROVISION_EMAIL_INVALID' })).toBe(ERROR_CATEGORIES.VALIDATION);
    expect(categorizeError(new Error('boom'))).toBe(ERROR_CATEGORIES.INTERNAL);
  });
});

describe('errorHandler operational logging and production hygiene', () => {
  beforeEach(() => jest.clearAllMocks());

  test('log entries carry category, request ID, and user ID for correlation', () => {
    const err = Object.assign(new Error('Voyage embedding request failed (503).'), {
      name: 'VoyageProviderError',
      statusCode: 503,
      code: 'SEMANTIC_PROVIDER_UNAVAILABLE'
    });
    runHandler(err, { requestId: 'edge-abc-123', user: { id: 7 } });

    const [, entry] = logger.error.mock.calls[0];
    expect(entry).toMatchObject({
      category: ERROR_CATEGORIES.VOYAGE_PROVIDER,
      requestId: 'edge-abc-123',
      userId: 7,
      path: '/api/v1/example'
    });
  });

  test('production 500 responses hide stack traces, internal messages, and provider details', () => {
    const err = new Error('ECONNREFUSED internal-db.private:5432 at Object.connect (/app/src/secret/path.js:10)');
    const res = runHandler(err, { production: true });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      status: 'error',
      message: 'An unexpected error occurred',
      details: { error_code: 'INTERNAL_ERROR' }
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('secret/path');
    expect(serialized).not.toContain('stack');
  });

  test('operational errors keep their established client contract', () => {
    const err = new AppError('Route /nope not found', 404, 'NOT_FOUND');
    const res = runHandler(err, { production: true });
    expect(res.statusCode).toBe(404);
    expect(res.body.details.error_code).toBe('NOT_FOUND');
  });
});
