const config = require('../config/env');
const userInvitationService = require('../services/userInvitation.service');
const authService = require('../services/auth.service');
const { setNoStoreHeaders } = require('../utils/httpCache');

// Admin-surface error shape (matches adminUser endpoints).
function sendAdminError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    error: {
      code: error.code || 'USER_INVITATION_ERROR',
      message: error.message,
      ...(error.field ? { field: error.field } : {})
    }
  });
}

// Public-auth-surface error shape (matches /auth endpoints).
function sendPublicError(res, error) {
  return res.status(error.statusCode || 400).json({
    status: 'error',
    message: error.message,
    details: {
      error_code: error.code || 'INVITATION_ERROR'
    }
  });
}

async function inviteUser(req, res, next) {
  try {
    const result = await userInvitationService.issueInvitation({
      id: req.params.id,
      actor: req.user,
      req
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User record not found.'
        }
      });
    }

    setNoStoreHeaders(res);
    return res.status(200).json({
      success: true,
      data: {
        item: result.user,
        delivery: result.delivery
      },
      meta: {
        deliveryNotice: result.delivery.status === 'sent'
          ? 'The invitation email was accepted for delivery. The previous invitation link (if any) is now invalid.'
          : 'The invitation email could NOT be delivered. The account is unchanged; retry later or use the manual temporary-credential fallback.'
      }
    });
  } catch (error) {
    if (error.name === 'UserInvitationError') {
      return sendAdminError(res, error);
    }
    return next(error);
  }
}

async function sendBulkInvitations(req, res, next) {
  try {
    const result = await userInvitationService.sendBulkInvitations({
      userIds: req.body?.userIds,
      actor: req.user,
      req
    });

    setNoStoreHeaders(res);
    return res.status(200).json({
      success: true,
      data: result,
      meta: {
        deliveryNotice: 'Invitations were sent synchronously with bounded concurrency. Each row shows its own truthful outcome; failed rows can be resent individually.'
      }
    });
  } catch (error) {
    if (error.name === 'UserInvitationError') {
      return sendAdminError(res, error);
    }
    return next(error);
  }
}

async function validateInvitation(req, res, next) {
  try {
    const result = await userInvitationService.validateInvitationToken({
      token: req.body?.token
    });

    setNoStoreHeaders(res);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    if (error.name === 'UserInvitationError') {
      setNoStoreHeaders(res);
      return sendPublicError(res, error);
    }
    return next(error);
  }
}

async function acceptInvitation(req, res, next) {
  try {
    const result = await userInvitationService.acceptInvitation({
      token: req.body?.token,
      password: req.body?.password,
      req
    });

    // Sign the user in exactly like login/change-password do.
    res.cookie(config.auth.cookieName, result.token, authService.getCookieOptions());

    setNoStoreHeaders(res);
    return res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        user: result.user
      }
    });
  } catch (error) {
    if (error.name === 'UserInvitationError') {
      setNoStoreHeaders(res);
      return sendPublicError(res, error);
    }
    return next(error);
  }
}

module.exports = {
  inviteUser,
  sendBulkInvitations,
  validateInvitation,
  acceptInvitation
};
