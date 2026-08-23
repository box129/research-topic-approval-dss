const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(req = {}) {
  const origin = req.get?.('origin') || req.headers?.origin;
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }

  const referer = req.get?.('referer') || req.headers?.referer;
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function createCsrfOriginGuard({ allowedOrigins = [], cookieName, requireOrigin = false } = {}) {
  const allowed = new Set(allowedOrigins.filter(Boolean));

  return (req, res, next) => {
    if (SAFE_METHODS.has(String(req.method || 'GET').toUpperCase())) {
      return next();
    }

    // Cookie-authenticated mutations are the CSRF-sensitive surface. Public
    // recovery/invitation flows use one-time tokens and do not carry a session
    // cookie, so this does not change their narrow authorization model.
    if (!cookieName || !req.cookies?.[cookieName]) {
      return next();
    }

    const origin = requestOrigin(req);
    if (!origin && !requireOrigin) {
      return next();
    }

    if (!origin || !allowed.has(origin)) {
      return res.status(403).json({
        status: 'error',
        message: 'Request origin is not allowed.',
        details: {
          error_code: 'CSRF_ORIGIN_REJECTED'
        }
      });
    }

    return next();
  };
}

module.exports = {
  SAFE_METHODS,
  createCsrfOriginGuard,
  requestOrigin
};
