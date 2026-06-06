const adminUserService = require('../services/adminUser.service');

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

module.exports = {
  listUsers,
  getUserById,
  updateUserStatus
};
