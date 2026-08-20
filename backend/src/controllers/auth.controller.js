const authService = require('../services/auth.service');
const config = require('../config/env');

function sendAuthError(res, error) {
  return res.status(error.statusCode || 500).json({
    status: 'error',
    message: error.message || 'Authentication failed.',
    details: {
      error_code: error.code || 'AUTH_ERROR'
    }
  });
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body || {});

    res.cookie(config.auth.cookieName, result.token, authService.getCookieOptions());

    return res.status(200).json({
      status: 'success',
      data: {
        user: result.user
      }
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function logout(req, res) {
  res.clearCookie(config.auth.cookieName, authService.getClearCookieOptions());

  return res.status(200).json({
    status: 'success',
    message: 'Logged out.'
  });
}

async function me(req, res) {
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
}

async function forgotPassword(req, res) {
  try {
    const result = await authService.requestPasswordReset(req.body || {});

    return res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function resetPassword(req, res) {
  try {
    const result = await authService.resetPassword({ ...(req.body || {}), req });

    return res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

async function changePassword(req, res) {
  try {
    const result = await authService.changePassword({
      userId: req.user?.id,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
      req
    });

    // Re-issue the session cookie so this session carries the new credential
    // version; all other sessions for the account become invalid.
    res.cookie(config.auth.cookieName, result.token, authService.getCookieOptions());

    return res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        user: result.user
      }
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

module.exports = {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  resetPassword
};
