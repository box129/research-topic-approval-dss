/**
 * Unit Tests for Error Handler Middleware
 * 
 * Tests the error handling middleware for various error types and scenarios.
 */

const { errorHandler, notFoundHandler, AppError } = require('../../src/middleware/errorHandler.middleware');
const logger = require('../../src/config/logger');

// Mock logger
jest.mock('../../src/config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Mock Express request object
    req = {
      path: '/api/test',
      method: 'POST',
      ip: '127.0.0.1',
      originalUrl: '/api/test'
    };

    // Mock Express response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock Express next function
    next = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Validation Errors (400)', () => {
    test('should handle validation errors with correct format', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = { field: 'email', message: 'Invalid email format' };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { field: 'email', message: 'Invalid email format' }
        }
      });
    });

    test('should log validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Error occurred:', expect.objectContaining({
        message: 'Validation failed',
        path: '/api/test',
        method: 'POST'
      }));
    });
  });

  describe('Not Found Errors (404)', () => {
    test('should handle not found errors with correct format', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Resource not found',
        details: {
          error_code: 'NOT_FOUND'
        }
      });
    });

    test('should use default message for not found errors without message', () => {
      const error = new Error();
      error.name = 'NotFoundError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Resource not found',
        details: {
          error_code: 'NOT_FOUND'
        }
      });
    });
  });

  describe('Rate Limit Errors (429)', () => {
    test('should handle rate limit errors with correct format', () => {
      const error = new Error('Too many requests');
      error.name = 'RateLimitError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        }
      });
    });

    test('should handle rate limit errors by status code', () => {
      const error = new Error('Rate limit exceeded');
      error.statusCode = 429;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        }
      });
    });
  });

  describe('Database Errors (500)', () => {
    test('should handle Prisma known request errors', () => {
      const error = new Error('Database error');
      error.name = 'PrismaClientKnownRequestError';
      error.code = 'P2002';
      error.meta = { target: ['email'] };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
          details: { code: 'P2002', meta: { target: ['email'] } }
        }
      });
    });

    test('should handle Prisma validation errors', () => {
      const error = new Error('Invalid query');
      error.name = 'PrismaClientValidationError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DATABASE_VALIDATION_ERROR',
          message: 'Invalid database query'
        }
      });
    });

    test('should not expose database details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database error');
      error.name = 'PrismaClientKnownRequestError';
      error.code = 'P2002';
      error.meta = { target: ['email'] };

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database operation failed'
        }
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Generic Errors (500)', () => {
    test('should handle generic errors with correct format', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Something went wrong',
        details: {
          error_code: 'INTERNAL_ERROR'
        }
      });
    });

    test('should use default message for errors without message', () => {
      const error = new Error();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'An unexpected error occurred',
        details: {
          error_code: 'INTERNAL_ERROR'
        }
      });
    });

    test('should handle errors with custom status code', () => {
      const error = new Error('Custom error');
      error.statusCode = 503;
      error.code = 'SERVICE_UNAVAILABLE';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Custom error'
        }
      });
    });
  });

  describe('Error Message Sanitization', () => {
    test('should sanitize error messages in production for 500 errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database connection failed');
      error.statusCode = 500;

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'An unexpected error occurred',
        details: {
          error_code: 'INTERNAL_ERROR'
        }
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('normalizes production environment casing before sanitizing 500 errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = ' Production ';

      const error = new Error('Internal database connection failed');
      error.statusCode = 500;

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'An unexpected error occurred',
        details: {
          error_code: 'INTERNAL_ERROR'
        }
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should not sanitize error messages in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Internal database connection failed');
      error.statusCode = 500;

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: 'Internal database connection failed',
        details: {
          error_code: 'INTERNAL_ERROR'
        }
      }));

      process.env.NODE_ENV = originalEnv;
    });

    test('should not include stack traces in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      errorHandler(error, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.stack).toBeUndefined();
      expect(jsonCall.details.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should include stack traces in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      errorHandler(error, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.stack).toBeUndefined();
      expect(jsonCall.details.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Logging', () => {
    test('should log all errors with Winston', () => {
      const error = new Error('Test error');
      error.statusCode = 400;
      error.code = 'TEST_ERROR';

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Error occurred:', {
        message: 'Test error',
        stack: error.stack,
        statusCode: 400,
        code: 'TEST_ERROR',
        path: '/api/test',
        method: 'POST',
        ip: '127.0.0.1'
      });
    });

    test('should log request context with errors', () => {
      const error = new Error('Context test');

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Error occurred:', expect.objectContaining({
        path: '/api/test',
        method: 'POST',
        ip: '127.0.0.1'
      }));
    });
  });

  describe('AppError Class', () => {
    test('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
    });

    test('should capture stack trace', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test error');
    });
  });

  describe('Not Found Handler', () => {
    test('should create 404 error for non-existent routes', () => {
      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Route /api/test not found',
        statusCode: 404,
        code: 'NOT_FOUND'
      }));
    });

    test('should include original URL in error message', () => {
      req.originalUrl = '/api/users/123';

      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Route /api/users/123 not found'
      }));
    });
  });

  describe('Authorization Errors', () => {
    test('should handle unauthorized errors (401)', () => {
      const error = new Error('Authentication required');
      error.name = 'UnauthorizedError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });

    test('should handle forbidden errors (403)', () => {
      const error = new Error('Access denied');
      error.name = 'ForbiddenError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    });
  });

  describe('Response Format Consistency', () => {
    test('should return status error for generic internal errors', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.status).toBe('error');
    });

    test('should include internal error_code for generic internal errors', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.details.error_code).toBe('INTERNAL_ERROR');
    });

    test('should include top-level message for generic internal errors', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.message).toBeDefined();
    });

    test('should not include undocumented extra detail keys for generic internal errors', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(Object.keys(jsonCall.details)).toEqual(['error_code']);
    });
  });
});
