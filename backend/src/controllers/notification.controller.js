const notificationService = require('../services/notification.service');

function sendServiceError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    error: {
      code: error.code || 'NOTIFICATION_ERROR',
      message: error.message,
      ...(error.field ? { field: error.field } : {})
    }
  });
}

async function listNotifications(req, res, next) {
  try {
    const result = await notificationService.listNotificationsForUser(req.user.id, req.query);

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    if (error.name === 'NotificationServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const item = await notificationService.markNotificationRead({
      id: req.params.id,
      userId: req.user.id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification record not found.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: { item },
      meta: {
        mutationStatus: 'read'
      }
    });
  } catch (error) {
    if (error.name === 'NotificationServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user.id);

    return res.status(200).json({
      success: true,
      data: result,
      meta: {
        mutationStatus: 'read_all'
      }
    });
  } catch (error) {
    if (error.name === 'NotificationServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
