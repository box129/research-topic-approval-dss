const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const config = require('./config/env');
const logger = require('./config/logger');
// Lazy-load the similarity controller to avoid Prisma initialization blocking
let similarityController;
let topicImportController;
let authController;
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');
const { requireAuth } = require('./middleware/auth.middleware');

const app = express();
const IMPORT_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const importUploadDir = path.join(__dirname, '..', 'tmp', 'imports');

const importUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(importUploadDir, { recursive: true });
    cb(null, importUploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, safeName);
  }
});

const importUpload = multer({
  storage: importUploadStorage,
  limits: {
    fileSize: IMPORT_UPLOAD_LIMIT_BYTES
  }
});

const importUploadMiddleware = (req, res, next) => {
  importUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        status: 'error',
        message: 'Import file is too large.',
        details: {
          error_code: 'FILE_TOO_LARGE',
          field: 'file'
        }
      });
    }

    if (error) {
      return next(error);
    }

    return next();
  });
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  handler: (req, res) => {
    res.set('Retry-After', '300');
    res.status(429).json({
      status: 'error',
      message: 'Rate limit exceeded. Please try again in 5 minutes.',
      details: {
        retry_after: 300,
        limit: '100 requests per hour'
      }
    });
  }
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    environment: config.env,
    apiVersion: config.apiVersion
  });
});

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    environment: config.env,
    apiVersion: config.apiVersion
  });
});

// API Routes
const similarityRouteHandler = (req, res, next) => {
  if (!similarityController) {
    similarityController = require('./controllers/similarity.controller');
  }
  similarityController.checkSimilarity(req, res, next);
};

app.post('/api/similarity/check', similarityRouteHandler);

// Architecture alias — matches API spec
app.post('/api/v1/check-similarity', similarityRouteHandler);

const getTopicImportController = () => {
  if (!topicImportController) {
    topicImportController = require('./controllers/topicImport.controller');
  }
  return topicImportController;
};

const getAuthController = () => {
  if (!authController) {
    authController = require('./controllers/auth.controller');
  }
  return authController;
};

app.post('/api/v1/auth/login', (req, res, next) => {
  getAuthController().login(req, res, next);
});

app.post('/api/v1/auth/logout', (req, res, next) => {
  getAuthController().logout(req, res, next);
});

app.get('/api/v1/auth/me', requireAuth, (req, res, next) => {
  getAuthController().me(req, res, next);
});

app.post('/api/v1/auth/forgot-password', (req, res, next) => {
  getAuthController().forgotPassword(req, res, next);
});

app.post('/api/v1/auth/reset-password', (req, res, next) => {
  getAuthController().resetPassword(req, res, next);
});

const previewImportRouteHandler = (req, res, next) => {
  getTopicImportController().previewTopicImport(req, res, next);
};

const commitImportRouteHandler = (req, res, next) => {
  getTopicImportController().commitTopicImport(req, res, next);
};

app.post('/api/import/topics/preview', importUploadMiddleware, previewImportRouteHandler);
app.post('/api/import/topics/commit', importUploadMiddleware, commitImportRouteHandler);
app.post('/api/v1/import/topics/preview', importUploadMiddleware, previewImportRouteHandler);
app.post('/api/v1/import/topics/commit', importUploadMiddleware, commitImportRouteHandler);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Only start server if not in test mode
if (config.env !== 'test') {
  const server = app.listen(config.port, '0.0.0.0');
  
  server.on('listening', () => {
    console.log(`Server is running on port ${config.port}`);
    console.log(`Environment: ${config.env}`);
    console.log(`API Version: ${config.apiVersion}`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
}

module.exports = app;
