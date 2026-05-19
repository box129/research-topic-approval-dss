const authService = require('../services/auth.service');
const config = require('../config/env');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[config.auth.cookieName];
    req.user = await authService.authenticateToken(token);
    return next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      status: 'error',
      message: error.message || 'Authentication required.',
      details: {
        error_code: error.code || 'AUTHENTICATION_REQUIRED'
      }
    });
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
  requireRole
};
