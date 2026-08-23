const express = require('express');
const request = require('supertest');
const {
  authenticatedUserKey,
  createRateLimiter,
  ipKey,
  loginIdentifierKey
} = require('./rateLimit.middleware');

describe('security rate-limit middleware', () => {
  test('keys authenticated expensive operations by user rather than shared IP', async () => {
    const app = express();
    app.use((req, res, next) => {
      req.user = { id: Number(req.get('x-test-user')) };
      next();
    });
    app.get('/similarity', createRateLimiter({
      name: 'test-similarity',
      windowMs: 60_000,
      max: 1,
      keyGenerator: authenticatedUserKey
    }), (req, res) => res.status(200).json({ status: 'success' }));

    await request(app).get('/similarity').set('x-test-user', '1').expect(200);
    const limited = await request(app).get('/similarity').set('x-test-user', '1').expect(429);
    await request(app).get('/similarity').set('x-test-user', '2').expect(200);

    expect(limited.body).toMatchObject({
      status: 'error',
      message: 'Too many requests. Please try again later.',
      details: {
        error_code: 'RATE_LIMIT_EXCEEDED',
        limiter: 'test-similarity',
        limit: '1 request per 1 minute',
        window_seconds: 60
      }
    });
    expect(limited.body.details.retry_after).toBeGreaterThan(0);
    expect(limited.headers['retry-after']).toBe(String(limited.body.details.retry_after));
  });

  test('keys login attempts by both client IP and a privacy-preserving identifier digest', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', createRateLimiter({
      name: 'test-login-identifier',
      windowMs: 60_000,
      max: 1,
      keyGenerator: loginIdentifierKey
    }), (req, res) => res.status(200).json({ status: 'accepted' }));

    await request(app).post('/login').send({ email: 'student@example.test' }).expect(200);
    await request(app).post('/login').send({ email: 'student@example.test' }).expect(429);
    await request(app).post('/login').send({ email: 'other@example.test' }).expect(200);
  });

  test('groups IPv6 callers in the same /56 bucket while keeping a different subnet independent', async () => {
    const app = express();
    app.use((req, res, next) => {
      Object.defineProperty(req, 'ip', {
        configurable: true,
        value: req.get('x-test-ip')
      });
      next();
    });
    app.get('/ip-limited', createRateLimiter({
      name: 'test-ipv6',
      windowMs: 60_000,
      max: 1,
      keyGenerator: (req) => ipKey(req, { ipv6SubnetPrefix: 56 })
    }), (req, res) => res.status(200).json({ status: 'success' }));

    await request(app)
      .get('/ip-limited')
      .set('x-test-ip', '2001:db8:abcd:1200::1')
      .expect(200);
    await request(app)
      .get('/ip-limited')
      .set('x-test-ip', '2001:db8:abcd:12ff::beef')
      .expect(429);
    await request(app)
      .get('/ip-limited')
      .set('x-test-ip', '2001:db8:abcd:1300::1')
      .expect(200);
  });

  test('normalizes IPv4-mapped IPv6 addresses into the matching IPv4 bucket', () => {
    expect(ipKey({ ip: '::ffff:203.0.113.24' })).toBe(ipKey({ ip: '203.0.113.24' }));
  });
});
