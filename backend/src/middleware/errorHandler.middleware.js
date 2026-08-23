/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the Express application.
 * Handles different types of errors and returns consistent error responses.
 */

const logger = require('../config/logger');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = null;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    code: errorCode,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid request format.',
      details: {
        error_code: 'INVALID_FORMAT'
      }
    });
  }

  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      status: 'error',
      message: 'Request body is too large.',
      details: {
        error_code: 'PAYLOAD_TOO_LARGE'
      }
    });
  }

  if (err.message === 'Database connection failed') {
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed. Please try again later.',
      details: {
        error_code: 'DB_CONNECTION_ERROR'
      }
    });
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.details || err.errors;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = 'Access denied';
  } else if (err.name === 'NotFoundError' || statusCode === 404 || errorCode === 'NOT_FOUND') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = err.message || 'Resource not found';
    return res.status(statusCode).json({
      status: 'error',
      message,
      details: {
        error_code: errorCode
      }
    });
  } else if (err.name === 'RateLimitError' || err.statusCode === 429) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = 'Too many requests, please try again later';
  } else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
    // Don't expose database details in production
    if (process.env.NODE_ENV !== 'production') {
      details = { code: err.code, meta: err.meta };
    }
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    errorCode = 'DATABASE_VALIDATION_ERROR';
    message = 'Invalid database query';
  }

  // Sanitize error message in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
    details = null;
  }

  if (statusCode === 500) {
    return res.status(500).json({
      status: 'error',
      message,
      details: {
        error_code: 'INTERNAL_ERROR'
      }
    });
  }

  // Build error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  };

  // Add details if available and not in production for 500 errors
  if (details && !(process.env.NODE_ENV === 'production' && statusCode === 500)) {
    errorResponse.error.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError
};
