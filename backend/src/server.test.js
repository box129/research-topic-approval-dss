const request = require('supertest');
const app = require('./server');
const config = require('./config/env');

describe('Server Integration Tests', () => {
  describe('Health Check Endpoint', () => {
    test('GET /health should return 200 and correct response', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('message', 'Server is running');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('apiVersion');
    });
  });

  describe('Security Headers (Helmet)', () => {
    test('should include security headers in response', async () => {
      const response = await request(app).get('/health');

      // Helmet sets various security headers
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-download-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });
  });

  describe('CORS Configuration', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should handle OPTIONS preflight request', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBeLessThan(300);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toMatch(/content-type/i);
    });

    test('does not grant a hostile browser origin CORS access', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://attacker.example');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limit headers', async () => {
      const response = await request(app).get('/health');

      // Rate limit headers
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });

    test('should enforce rate limits', async () => {
      // Make multiple requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/health'));
      }

      const responses = await Promise.all(requests);
      
      // All should succeed initially
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check that rate limit remaining decreases
      const remaining = responses.map(r => 
        parseInt(r.headers['x-ratelimit-remaining'])
      );
      
      expect(remaining[0]).toBeGreaterThan(remaining[remaining.length - 1]);
    }, 10000);
  });

  describe('JSON Parsing', () => {
    test('should parse JSON request body', async () => {
      // This will be useful when we add POST endpoints
      const response = await request(app)
        .post('/health')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Even though /health doesn't accept POST, it should parse the body
      expect(response.status).toBe(404); // Method not allowed or not found
    });
  });

  describe('Import API Routes', () => {
    test('should protect v1 preview import alias route', async () => {
      const response = await request(app)
        .post('/api/v1/import/topics/preview')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.details).toHaveProperty('error_code', 'AUTHENTICATION_REQUIRED');
    });

    test('should protect v1 commit import alias route', async () => {
      const response = await request(app)
        .post('/api/v1/import/topics/commit')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.details).toHaveProperty('error_code', 'AUTHENTICATION_REQUIRED');
    });

    test('should reject unauthenticated import uploads before file handling', async () => {
      const response = await request(app)
        .post('/api/import/topics/preview')
        .attach('file', Buffer.from('xlsx-placeholder'), {
          filename: 'topics.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.details).toHaveProperty('error_code', 'AUTHENTICATION_REQUIRED');
    });
  });

  describe('Submission API Routes', () => {
    test('should reject unauthenticated submission list requests', async () => {
      const response = await request(app)
        .get('/api/v1/submissions')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });

    test('should reject unauthenticated lecturer pending queue requests', async () => {
      const response = await request(app)
        .get('/api/v1/lecturer/submissions')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });

    test('should reject unauthenticated lecturer detail requests', async () => {
      const response = await request(app)
        .get('/api/v1/lecturer/submissions/1')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });

    test('should reject unauthenticated lecturer status update requests', async () => {
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
    });

    test('should reject unauthenticated lecturer similarity wrapper requests', async () => {
      const response = await request(app)
        .post('/api/v1/lecturer/submissions/1/similarity-check')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });

    test('should reject unauthenticated lecturer similarity snapshot history requests', async () => {
      const response = await request(app)
        .get('/api/v1/lecturer/submissions/1/similarity-snapshots')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });

    test('should deny anonymous callers on the legacy similarity route', async () => {
      const response = await request(app)
        .post('/api/similarity/check')
        .send({})
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });

    test('should deny anonymous callers on the v1 similarity route', async () => {
      const response = await request(app)
        .post('/api/v1/check-similarity')
        .send({})
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'error',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toBeDefined();
    });

    test('should expose intended FYP_Selected shared error envelope for 404 routes', async () => {
      // Reconciliation spec based on authoritative FYP_Selected common error-envelope docs.
      // Exact 404 message and error_code still need verification.
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('error_code');
    });
  });

  describe('URL Encoded Parsing', () => {
    test('should parse URL encoded data', async () => {
      const response = await request(app)
        .post('/health')
        .send('key=value&another=data')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Should handle URL encoded data
      expect(response.status).toBeDefined();
    });
  });
});

describe('Server Error Handling', () => {
  test('should handle malformed JSON gracefully', async () => {
    const response = await request(app)
      .post('/health')
      .send('{"invalid": json}')
      .set('Content-Type', 'application/json');

    // Should return 400 for bad JSON
    expect([400, 404]).toContain(response.status);
  });

  test('should expose intended FYP_Selected shared error envelope for generic internal errors', async () => {
    // Reconciliation spec based on authoritative FYP_Selected internal-error docs.
    // Exact human-readable message still needs verification.
    const express = require('express');
    const { errorHandler } = require('./middleware/errorHandler.middleware');
    const testApp = express();

    testApp.get('/force-internal-error', (req, res, next) => {
      next(new Error('Unexpected test failure'));
    });
    testApp.use(errorHandler);

    const response = await request(testApp)
      .get('/force-internal-error')
      .expect(500);

    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('details');
    expect(response.body.details).toHaveProperty('error_code', 'INTERNAL_ERROR');
  });
});

describe('Server Configuration', () => {
  test('should export app for testing', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });
});

describe('Broad Rate Limit Contract', () => {
  test('uses a high, truthful departmental ceiling rather than a stale fixed message', async () => {
    const response = await request(app).get('/health').expect(200);

    // The checked-in local environment may deliberately override the broad
    // ceiling. The response must accurately advertise the configured value;
    // sensitive routes have their own lower, identity-aware limits.
    expect(Number(response.headers['x-ratelimit-limit'])).toBe(config.rateLimit.max);
    expect(response.headers).toHaveProperty('ratelimit');
  });
});
