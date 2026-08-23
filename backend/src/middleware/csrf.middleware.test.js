const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { createCsrfOriginGuard, requestOrigin } = require('./csrf.middleware');

function createApp({ requireOrigin = true } = {}) {
  const app = express();
  app.use(cookieParser());
  app.use(createCsrfOriginGuard({
    allowedOrigins: ['https://app.example.edu'],
    cookieName: 'rtadss_session',
    requireOrigin
  }));
  app.post('/mutation', (req, res) => res.status(200).json({ status: 'success' }));
  return app;
}

describe('cookie-authenticated CSRF origin guard', () => {
  test('allows the configured browser origin for a session mutation', async () => {
    await request(createApp())
      .post('/mutation')
      .set('Origin', 'https://app.example.edu')
      .set('Cookie', 'rtadss_session=signed-token')
      .expect(200);
  });

  test('rejects a hostile origin before the mutation handler', async () => {
    const response = await request(createApp())
      .post('/mutation')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'rtadss_session=signed-token')
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: { error_code: 'CSRF_ORIGIN_REJECTED' }
    });
  });

  test('requires Origin or Referer for production-style cookie mutations', async () => {
    await request(createApp({ requireOrigin: true }))
      .post('/mutation')
      .set('Cookie', 'rtadss_session=signed-token')
      .expect(403);
  });

  test('does not change public token flow authorization when no session cookie exists', async () => {
    await request(createApp())
      .post('/mutation')
      .set('Origin', 'https://attacker.example')
      .expect(200);
  });

  test('normalizes origin and referer values without trusting malformed headers', () => {
    expect(requestOrigin({ headers: { origin: 'https://app.example.edu/path' } })).toBe('https://app.example.edu');
    expect(requestOrigin({ headers: { referer: 'https://app.example.edu/path' } })).toBe('https://app.example.edu');
    expect(requestOrigin({ headers: { origin: 'not a URL' } })).toBeNull();
  });
});
