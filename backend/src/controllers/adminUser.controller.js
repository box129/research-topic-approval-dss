const adminUserService = require('../services/adminUser.service');
const userProvisioningService = require('../services/userProvisioning.service');
const { setNoStoreHeaders } = require('../utils/httpCache');

const SERVICE_ERROR_NAMES = new Set(['AdminUserServiceError', 'UserProvisioningError']);

function sendServiceError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    error: {
      code: error.code || 'ADMIN_USER_ERROR',
      message: error.message,
      ...(error.field ? { field: error.field } : {})
    }
  });
}

async function listUsers(req, res, next) {
  try {
    const result = await adminUserService.listUsers(req.query);

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    if (error.name === 'AdminUserServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await adminUserService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User record not found.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        item: user
      },
      meta: {
        dataCoverage: 'Read-only user detail from existing User records.'
      }
    });
  } catch (error) {
    if (error.name === 'AdminUserServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const user = await adminUserService.updateUserStatus({
      id: req.params.id,
      status: req.body?.status,
      actor: req.user,
      req
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User record not found.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        item: user
      },
      meta: {
        auditEventType: 'USER_STATUS_CHANGED'
      }
    });
  } catch (error) {
    if (error.name === 'AdminUserServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const result = await userProvisioningService.provisionUser({
      input: req.body || {},
      actor: req.user,
      req
    });

    setNoStoreHeaders(res);
    return res.status(201).json({
      success: true,
      data: {
        item: result.user,
        // One-time operational information: shown only in this response,
        // never stored or logged in plaintext anywhere.
        temporaryPassword: result.temporaryPassword
      },
      meta: {
        auditEventType: 'USER_PROVISIONED',
        credentialNotice: 'This temporary password is shown once and cannot be retrieved again. Transfer it securely; the user must change it at first login.'
      }
    });
  } catch (error) {
    if (SERVICE_ERROR_NAMES.has(error.name)) {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function resetUserCredential(req, res, next) {
  try {
    const result = await userProvisioningService.resetUserCredential({
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
        temporaryPassword: result.temporaryPassword
      },
      meta: {
        auditEventType: 'USER_CREDENTIAL_RESET',
        credentialNotice: 'This temporary password is shown once and cannot be retrieved again. The previous password and all existing sessions are now invalid.'
      }
    });
  } catch (error) {
    if (SERVICE_ERROR_NAMES.has(error.name)) {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function correctUserIdentity(req, res, next) {
  try {
    const result = await userProvisioningService.correctUserIdentity({
      id: req.params.id,
      input: req.body || {},
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

    return res.status(200).json({
      success: true,
      data: {
        item: result.user,
        changedFields: result.changedFields,
        sessionsInvalidated: result.sessionsInvalidated
      },
      meta: {
        auditEventType: 'USER_IDENTITY_CORRECTED',
        ...(result.sessionsInvalidated
          ? { notice: 'The login email changed, so all existing sessions for this account were invalidated. The password is unchanged.' }
          : {})
      }
    });
  } catch (error) {
    if (SERVICE_ERROR_NAMES.has(error.name)) {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  resetUserCredential,
  updateUserStatus,
  correctUserIdentity
};
