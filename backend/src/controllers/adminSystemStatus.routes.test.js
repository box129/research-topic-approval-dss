const request = require('supertest');

jest.mock('../services/auth.service', () => {
  const actual = jest.requireActual('../services/auth.service');
  return {
    ...actual,
    authenticateToken: jest.fn()
  };
});

jest.mock('../services/readiness.service', () => {
  const actual = jest.requireActual('../services/readiness.service');
  return {
    ...actual,
    checkDatabase: jest.fn()
  };
});

jest.mock('../services/voyageProviderStatus.service', () => ({
  provider: 'voyage',
  model: 'voyage-4-large',
  getStatus: jest.fn()
}));

const authService = require('../services/auth.service');
const readinessService = require('../services/readiness.service');
const voyageProviderStatus = require('../services/voyageProviderStatus.service');
const { residentCorpus } = require('../services/residentCorpus.service');
const app = require('../server');

const adminUser = { id: 1, name: 'Admin', email: 'admin@uniosun.edu.ng', role: 'admin', status: 'active' };

describe('admin system-status diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readinessService.checkDatabase.mockResolvedValue({ status: 'available', message: 'Database connectivity check succeeded.' });
    voyageProviderStatus.getStatus.mockReturnValue({
      status: 'available',
      message: 'Voyage semantic provider verification succeeded.',
      lastCheckedAt: '2026-08-23T10:00:00.000Z',
      lastSuccessfulAt: '2026-08-23T10:00:00.000Z',
      lastFailedAt: null,
      lastFailureCode: null,
      cached: true
    });
  });

  test('unauthenticated callers are denied', async () => {
    authService.authenticateToken.mockRejectedValue({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' });
    const response = await request(app).get('/api/v1/admin/system-status').expect(401);
    expect(response.body.details.error_code).toBe('AUTHENTICATION_REQUIRED');
  });

  test.each(['student', 'lecturer'])('%s callers are denied', async (role) => {
    authService.authenticateToken.mockResolvedValue({ ...adminUser, id: 5, role });
    const response = await request(app)
      .get('/api/v1/admin/system-status')
      .set('Cookie', ['rtadss_session=token'])
      .expect(403);
    expect(response.body.details.error_code).toBe('FORBIDDEN');
  });

  test('admin receives component states, corpus stats, and build identity without secrets', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);

    const response = await request(app)
      .get('/api/v1/admin/system-status')
      .set('Cookie', ['rtadss_session=token'])
      .expect(200);

    expect(response.body.data.application).toMatchObject({
      version: expect.any(String),
      apiVersion: expect.any(String),
      uptimeSeconds: expect.any(Number),
      nodeVersion: expect.stringMatching(/^v\d+/)
    });
    expect(response.body.data.database.status).toBe('available');
    expect(response.body.data.semanticProvider).toMatchObject({ provider: 'voyage', model: 'voyage-4-large', status: 'available' });
    expect(response.body.data.emailDelivery.status).toBeDefined();
    // Corpus stats mirror the live in-memory snapshot truthfully.
    expect(response.body.data.residentCorpus).toEqual(residentCorpus.stats());
    expect(response.body.data.residentCorpus).toHaveProperty('built');
    expect(response.body.data.residentCorpus).toHaveProperty('lastRefreshError');

    // No secrets, connection details, environment dumps, paths, or stacks.
    const serialized = JSON.stringify(response.body);
    for (const forbidden of ['postgresql://', 'VOYAGE_API_KEY', 'SMTP_PASSWORD', 'JWT_SECRET', 'passwordHash', 'stack', 'C:\\\\', '/app/src']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
