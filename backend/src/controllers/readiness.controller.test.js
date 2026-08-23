const request = require('supertest');

jest.mock('../services/readiness.service', () => ({
  getReadiness: jest.fn()
}));

const readinessService = require('../services/readiness.service');
const app = require('../server');

describe('Readiness API route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns unauthenticated readiness status when dependencies are ready', async () => {
    readinessService.getReadiness.mockResolvedValue({
      httpStatus: 200,
      body: {
        status: 'ready',
        checks: {
          api: 'available',
          database: 'available',
          semanticProvider: 'available'
        },
        meta: {
          generatedAt: '2026-06-19T12:00:00.000Z'
        }
      }
    });

    const response = await request(app)
      .get('/api/v1/readiness')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ready',
      checks: {
        api: 'available',
        database: 'available',
        semanticProvider: 'available'
      },
      meta: {
        generatedAt: '2026-06-19T12:00:00.000Z'
      }
    });
    expect(readinessService.getReadiness).toHaveBeenCalledTimes(1);
  });

  test('returns degraded readiness as 503 without exposing secrets', async () => {
    readinessService.getReadiness.mockResolvedValue({
      httpStatus: 503,
      body: {
        status: 'degraded',
        checks: {
          api: 'available',
          database: 'available',
          semanticProvider: 'unavailable'
        },
        details: {
          semanticProvider: {
            status: 'unavailable',
            message: 'Voyage provider is unavailable; similarity requests fail closed.'
          }
        }
      }
    });

    const response = await request(app)
      .get('/api/v1/readiness')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: {
        api: 'available',
        database: 'available',
        semanticProvider: 'unavailable'
      }
    });
    expect(JSON.stringify(response.body)).not.toMatch(/DATABASE_URL|JWT_SECRET|password/i);
  });

  test('passes unexpected readiness failures to the shared error handler', async () => {
    readinessService.getReadiness.mockRejectedValue(new Error('unexpected readiness failure'));

    const response = await request(app)
      .get('/api/v1/readiness')
      .expect(500);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'INTERNAL_ERROR'
      }
    });
  });
});
