const adminTopicRepositoryService = require('../services/adminTopicRepository.service');

function sendServiceError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    error: {
      code: error.code || 'ADMIN_TOPIC_REPOSITORY_ERROR',
      message: error.message,
      ...(error.field ? { field: error.field } : {})
    }
  });
}

async function listTopics(req, res, next) {
  try {
    const result = await adminTopicRepositoryService.listTopics(req.query);

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    if (error.name === 'AdminTopicRepositoryServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function getTopicByLifecycleAndId(req, res, next) {
  try {
    const topic = await adminTopicRepositoryService.getTopicByLifecycleAndId(
      req.params.lifecycle,
      req.params.id
    );

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADMIN_TOPIC_NOT_FOUND',
          message: 'Topic record not found for the requested lifecycle and id.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        item: topic
      },
      meta: {
        dataCoverage: 'Read-only topic detail from existing lifecycle tables.'
      }
    });
  } catch (error) {
    if (error.name === 'AdminTopicRepositoryServiceError') {
      return sendServiceError(res, error);
    }

    return next(error);
  }
}

async function getTopicsSummary(req, res, next) {
  try {
    const result = await adminTopicRepositoryService.getTopicsSummary();

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTopics,
  getTopicByLifecycleAndId,
  getTopicsSummary
};
