const superviseeAssignmentService = require('../services/superviseeAssignment.service');

function sendServiceError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    error: {
      code: error.code || 'SUPERVISEE_ASSIGNMENT_ERROR',
      message: error.message,
      ...(error.field ? { field: error.field } : {})
    }
  });
}

async function listAdminAssignments(req, res, next) {
  try {
    const result = await superviseeAssignmentService.listAssignments(req.query || {});

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    if (error.name === 'SuperviseeAssignmentServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function createAdminAssignment(req, res, next) {
  try {
    const item = await superviseeAssignmentService.createAssignment({
      actor: req.user,
      input: req.body || {},
      req
    });

    return res.status(201).json({
      success: true,
      data: { item },
      meta: {
        auditEventType: 'SUPERVISEE_ASSIGNED'
      }
    });
  } catch (error) {
    if (error.name === 'SuperviseeAssignmentServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function updateAdminAssignment(req, res, next) {
  try {
    const item = await superviseeAssignmentService.updateAssignment({
      id: req.params.id,
      actor: req.user,
      input: req.body || {},
      req
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUPERVISEE_ASSIGNMENT_NOT_FOUND',
          message: 'Supervisee assignment was not found.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: { item },
      meta: {
        auditEventType: item.isActive
          ? 'SUPERVISEE_ASSIGNMENT_UPDATED'
          : 'SUPERVISEE_ASSIGNMENT_ENDED'
      }
    });
  } catch (error) {
    if (error.name === 'SuperviseeAssignmentServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function endAdminAssignment(req, res, next) {
  try {
    const item = await superviseeAssignmentService.endAssignment({
      id: req.params.id,
      actor: req.user,
      req
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUPERVISEE_ASSIGNMENT_NOT_FOUND',
          message: 'Supervisee assignment was not found.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: { item },
      meta: {
        auditEventType: 'SUPERVISEE_ASSIGNMENT_ENDED'
      }
    });
  } catch (error) {
    if (error.name === 'SuperviseeAssignmentServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function listLecturerSupervisees(req, res, next) {
  try {
    const result = await superviseeAssignmentService.listLecturerSupervisees({
      user: req.user
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    if (error.name === 'SuperviseeAssignmentServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

module.exports = {
  createAdminAssignment,
  endAdminAssignment,
  listAdminAssignments,
  listLecturerSupervisees,
  updateAdminAssignment
};
