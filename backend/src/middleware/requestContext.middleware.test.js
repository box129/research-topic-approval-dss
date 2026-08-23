const {
  createRequestContextMiddleware,
  resolveRequestId,
  REQUEST_ID_HEADER
} = require('./requestContext.middleware');

function createMockResponse() {
  const listeners = {};
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    on(event, handler) { listeners[event] = handler; },
    emitFinish() { listeners.finish?.(); }
  };
}

function runMiddleware({ headers = {}, user, statusCode = 200, log }) {
  const middleware = createRequestContextMiddleware({
    log,
    now: (() => {
      let tick = 1000;
      return () => { tick += 25; return tick; };
    })()
  });
  const req = { headers, method: 'POST', originalUrl: '/api/v1/auth/login?next=1', path: '/api/v1/auth/login', ip: '127.0.0.1', user };
  const res = createMockResponse();
  res.statusCode = statusCode;
  const next = jest.fn();
  middleware(req, res, next);
  return { req, res, next };
}

describe('request context middleware', () => {
  const silentLog = () => ({ http: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() });

  test('generates a collision-resistant request ID and echoes it in the response header', () => {
    const log = silentLog();
    const { req, res, next } = runMiddleware({ log });

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['X-Request-Id']).toBe(req.requestId);
    expect(next).toHaveBeenCalled();

    const second = runMiddleware({ log });
    expect(second.req.requestId).not.toBe(req.requestId);
  });

  test('accepts a safely shaped upstream request ID and replaces malformed ones', () => {
    expect(resolveRequestId('edge-7f3a9c2e-0001')).toEqual({ requestId: 'edge-7f3a9c2e-0001', source: 'upstream' });

    for (const malformed of ['short', 'x'.repeat(65), 'bad id with spaces', '<script>alert(1)</script>', 'token\r\nInjected: header', '', undefined]) {
      const resolved = resolveRequestId(malformed);
      expect(resolved.source).toBe('generated');
      expect(resolved.requestId).toMatch(/^[0-9a-f-]{36}$/);
    }

    const log = silentLog();
    const { req } = runMiddleware({ headers: { [REQUEST_ID_HEADER]: '<script>' }, log });
    expect(req.requestId).not.toContain('<');
  });

  test('writes one completion log entry with correlation fields and no credential material', () => {
    const log = silentLog();
    const { req, res } = runMiddleware({
      log,
      user: { id: 42, role: 'student' },
      headers: { authorization: 'Bearer super-secret-jwt', cookie: 'rtadss_session=secret-cookie' }
    });
    res.emitFinish();

    expect(log.http).toHaveBeenCalledTimes(1);
    const [message, entry] = log.http.mock.calls[0];
    expect(message).toBe('Request completed');
    expect(entry).toMatchObject({
      requestId: req.requestId,
      method: 'POST',
      path: '/api/v1/auth/login',
      statusCode: 200,
      userId: 42,
      ip: '127.0.0.1'
    });
    expect(entry.durationMs).toBeGreaterThan(0);
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('super-secret-jwt');
    expect(serialized).not.toContain('secret-cookie');
    expect(serialized).not.toContain('next=1');
  });

  test('server-side failures log at error level', () => {
    const log = silentLog();
    const { res } = runMiddleware({ log, statusCode: 503 });
    res.emitFinish();

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.http).not.toHaveBeenCalled();
    expect(log.error.mock.calls[0][1].statusCode).toBe(503);
  });
});
