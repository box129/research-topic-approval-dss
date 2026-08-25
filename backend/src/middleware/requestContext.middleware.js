const crypto = require('crypto');
const logger = require('../config/logger');

// Correlation contract: every request gets a collision-resistant request ID,
// echoed in the X-Request-Id response header and attached to operational
// logs, so one failing user action can be traced to one backend event chain.
//
// An upstream ID (from the reverse proxy) is accepted only when it matches a
// strict opaque-token shape; anything else is replaced rather than trusted.
// Accepted IDs are treated purely as opaque log data, never interpreted.
const REQUEST_ID_HEADER = 'x-request-id';
const UPSTREAM_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

function generateRequestId() {
  return crypto.randomUUID();
}

function resolveRequestId(upstreamValue) {
  const candidate = String(upstreamValue || '').trim();
  if (candidate && UPSTREAM_REQUEST_ID_PATTERN.test(candidate)) {
    return { requestId: candidate, source: 'upstream' };
  }
  return { requestId: generateRequestId(), source: 'generated' };
}

function createRequestContextMiddleware({ log = logger, now = () => Date.now() } = {}) {
  // Completion logging must never interfere with a response, so transport
  // problems (or partially mocked loggers) are swallowed and the http level
  // falls back to info when a logger does not implement it.
  const emit = (level, message, entry) => {
    try {
      const fn = typeof log?.[level] === 'function'
        ? log[level]
        : (typeof log?.info === 'function' ? log.info : null);
      fn?.call(log, message, entry);
    } catch {
      // Logging failures are intentionally ignored.
    }
  };

  return function requestContext(req, res, next) {
    const { requestId } = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    const startedAt = now();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    let logged = false;
    const buildEntry = () => ({
      requestId,
      method: req.method,
      path: req.originalUrl ? String(req.originalUrl).split('?')[0] : req.path,
      statusCode: res.statusCode,
      durationMs: now() - startedAt,
      // Populated by the auth middleware for authenticated requests; safe
      // identity context only, never credentials.
      userId: req.user?.id ?? null,
      ip: req.ip || null
    });

    res.on('finish', () => {
      if (logged) {
        return;
      }
      logged = true;
      const entry = buildEntry();

      // Server-side failures are always visible; routine traffic logs at the
      // opt-in http level so default operation is not spammed.
      if (res.statusCode >= 500) {
        emit('error', 'Request failed', entry);
      } else {
        emit('http', 'Request completed', entry);
      }
    });

    // A long administrative operation can outlive its client: an edge or proxy
    // that gives up first destroys the socket, so 'finish' never fires and the
    // request would otherwise leave no HTTP record at all — even though the
    // backend keeps working and may still commit. Emit exactly one line for
    // that case so the true duration and the abandonment are both visible.
    res.on('close', () => {
      if (logged) {
        return;
      }
      logged = true;
      emit('warn', 'Request abandoned by client before the response was sent', {
        ...buildEntry(),
        clientAborted: true
      });
    });

    next();
  };
}

module.exports = {
  createRequestContextMiddleware,
  resolveRequestId,
  generateRequestId,
  REQUEST_ID_HEADER,
  UPSTREAM_REQUEST_ID_PATTERN
};
