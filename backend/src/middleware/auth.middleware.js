const authService = require('../services/auth.service');
const config = require('../config/env');

function sendAuthError(res, error) {
  return res.status(error.statusCode || 401).json({
    status: 'error',
    message: error.message || 'Authentication required.',
    details: {
      error_code: error.code || 'AUTHENTICATION_REQUIRED'
    }
  });
}

async function authenticateRequest(req) {
  const token = req.cookies?.[config.auth.cookieName];
  req.user = await authService.authenticateToken(token);
}

// Standard guard: authenticated, active, and not pending a forced password
// change. Accounts holding a temporary credential must establish a private
// password before any normal application access.
async function requireAuth(req, res, next) {
  try {
    await authenticateRequest(req);
  } catch (error) {
    return sendAuthError(res, error);
  }

  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      status: 'error',
      message: 'Password change required before continuing.',
      details: {
        error_code: 'PASSWORD_CHANGE_REQUIRED'
      }
    });
  }

  return next();
}

// Narrow guard for the password-establishment surface only (/auth/me and
// /auth/change-password): identity is verified but the forced-change state
// does not block the request, so the user can complete the change.
async function requireAuthAllowingPasswordChange(req, res, next) {
  try {
    await authenticateRequest(req);
    return next();
  } catch (error) {
    return sendAuthError(res, error);
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
        details: {
          error_code: 'AUTHENTICATION_REQUIRED'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied.',
        details: {
          error_code: 'FORBIDDEN'
        }
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireAuthAllowingPasswordChange,
  requireRole
};
