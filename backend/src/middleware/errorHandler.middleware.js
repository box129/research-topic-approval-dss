/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the Express application.
 * Handles different types of errors and returns consistent error responses.
 */

const logger = require('../config/logger');

function normalizedNodeEnvironment() {
  return String(process.env.NODE_ENV || 'development').trim().toLowerCase();
}

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

// Internal operational taxonomy. Categories exist for logs/diagnosis only —
// user-facing response contracts from previous phases stay exactly as they
// are. An operator filtering production logs by category can immediately
// separate a Voyage outage from a database or SMTP problem.
const ERROR_CATEGORIES = Object.freeze({
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  VALIDATION: 'VALIDATION',
  RATE_LIMIT: 'RATE_LIMIT',
  DATABASE: 'DATABASE',
  VOYAGE_PROVIDER: 'VOYAGE_PROVIDER',
  SMTP_PROVIDER: 'SMTP_PROVIDER',
  IMPORT: 'IMPORT',
  CORPUS: 'CORPUS',
  INTERNAL: 'INTERNAL'
});

function categorizeError(err) {
  const name = String(err?.name || '');
  const code = String(err?.code || '');
  const statusCode = Number(err?.statusCode || err?.status || 0);
  const message = String(err?.message || '');

  if (name === 'VoyageProviderError' || /^SEMANTIC_PROVIDER/.test(code) || /^VOYAGE/.test(code)) {
    return ERROR_CATEGORIES.VOYAGE_PROVIDER;
  }
  if (name === 'EmailServiceError' || /^EMAIL_/.test(code) || /^SMTP/i.test(code)) {
    return ERROR_CATEGORIES.SMTP_PROVIDER;
  }
  if (name.startsWith('PrismaClient') || /^P\d{4}$/.test(code) || message === 'Database connection failed') {
    return ERROR_CATEGORIES.DATABASE;
  }
  if (
    name === 'UserBulkImportError'
    || name === 'BulkImportStateChangedError'
    || /IMPORT/.test(code)
    || /^(MALFORMED_WORKBOOK|EMPTY_IMPORT|WORKSHEET_NOT_FOUND)$/.test(code)
  ) {
    return ERROR_CATEGORIES.IMPORT;
  }
  if (/corpus/i.test(message) || /CORPUS/.test(code)) {
    return ERROR_CATEGORIES.CORPUS;
  }
  if (statusCode === 401 || /^(AUTHENTICATION_REQUIRED|INVALID_SESSION|INVALID_CREDENTIALS)$/.test(code)) {
    return ERROR_CATEGORIES.AUTHENTICATION;
  }
  if (statusCode === 403 || code === 'FORBIDDEN') {
    return ERROR_CATEGORIES.AUTHORIZATION;
  }
  if (statusCode === 429 || name === 'RateLimitError') {
    return ERROR_CATEGORIES.RATE_LIMIT;
  }
  if ((statusCode >= 400 && statusCode < 500) || name === 'ValidationError') {
    return ERROR_CATEGORIES.VALIDATION;
  }
  return ERROR_CATEGORIES.INTERNAL;
}

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  const environment = normalizedNodeEnvironment();
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  // Default error values
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = null;

  // Log error with the internal operational category and request correlation
  // ID. Stack traces stay in operator logs only; they never reach clients in
  // production responses.
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    code: errorCode,
    category: categorizeError(err),
    requestId: req.requestId || null,
    userId: req.user?.id ?? null,
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
    if (!isProduction) {
      details = { code: err.code, meta: err.meta };
    }
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    errorCode = 'DATABASE_VALIDATION_ERROR';
    message = 'Invalid database query';
  }

  // Sanitize error message in production
  if (isProduction && statusCode === 500) {
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
  if (details && !(isProduction && statusCode === 500)) {
    errorResponse.error.details = details;
  }

  // Add stack trace in development
  if (isDevelopment && err.stack) {
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
  AppError,
  categorizeError,
  ERROR_CATEGORIES
};
