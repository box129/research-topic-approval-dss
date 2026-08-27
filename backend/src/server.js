const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const config = require('./config/env');
const logger = require('./config/logger');
const prisma = require('./config/database');
const { createRateLimiters } = require('./middleware/rateLimit.middleware');
const { createCsrfOriginGuard } = require('./middleware/csrf.middleware');
const { createRequestContextMiddleware } = require('./middleware/requestContext.middleware');
const { createServerLifecycle } = require('./runtime/serverLifecycle');
const packageInfo = require('../package.json');
// Lazy-load the similarity controller to avoid Prisma initialization blocking
let similarityController;
let topicImportController;
let authController;
let submissionController;
let lecturerSimilarityController;
let adminAuditLogController;
let adminDashboardController;
let adminTopicRepositoryController;
let adminUserController;
let userBulkImportController;
let userInvitationController;
let adminSettingsController;
let adminSystemStatusController;
let adminReportsController;
let lecturerResearchTrendsController;
let notificationController;
let readinessController;
let superviseeAssignmentController;
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');
const {
  optionallyAuthenticateRequest,
  requireAuth,
  requireAuthAllowingPasswordChange,
  requireRole
} = require('./middleware/auth.middleware');

const app = express();
const IMPORT_UPLOAD_LIMIT_BYTES = config.requestLimits.importUploadBytes;
const IMPORT_UPLOAD_MAX_FIELDS = config.requestLimits.importUploadMaxFields;
const IMPORT_UPLOAD_MAX_PARTS = config.requestLimits.importUploadMaxParts;
const IMPORT_UPLOAD_FIELD_SIZE_BYTES = config.requestLimits.importUploadFieldSizeBytes;
const importUploadDir = path.join(__dirname, '..', 'tmp', 'imports');
const limiters = createRateLimiters(config.rateLimit);

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
    fileSize: IMPORT_UPLOAD_LIMIT_BYTES,
    files: 1,
    fields: IMPORT_UPLOAD_MAX_FIELDS,
    parts: IMPORT_UPLOAD_MAX_PARTS,
    fieldSize: IMPORT_UPLOAD_FIELD_SIZE_BYTES
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

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FIELD_VALUE') {
      return res.status(413).json({
        status: 'error',
        message: 'Import form field is too large.',
        details: {
          error_code: 'MULTIPART_FIELD_TOO_LARGE'
        }
      });
    }

    if (error instanceof multer.MulterError && [
      'LIMIT_FILE_COUNT',
      'LIMIT_FIELD_COUNT',
      'LIMIT_PART_COUNT',
      'LIMIT_FIELD_KEY'
    ].includes(error.code)) {
      return res.status(413).json({
        status: 'error',
        message: 'Import request exceeds the allowed multipart limits.',
        details: {
          error_code: 'MULTIPART_LIMIT_EXCEEDED'
        }
      });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        status: 'error',
        message: 'Import upload is invalid.',
        details: {
          error_code: 'INVALID_IMPORT_UPLOAD'
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
// A false default avoids trusting arbitrary X-Forwarded-For values from direct
// clients. Future hosting must set TRUST_PROXY to its precise known topology.
app.set('trust proxy', config.trustProxy);
// Correlation runs first so every response — including CORS/limiter/guard
// rejections — carries an X-Request-Id and produces one completion log line.
app.use(createRequestContextMiddleware());
app.use(helmet({
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Omit CORS permission rather than reflecting a hostile origin. The
    // cookie-authenticated mutation surface is rejected by the origin guard.
    return callback(null, false);
  },
  credentials: config.cors.credentials
}));
app.use(cookieParser());
app.use(optionallyAuthenticateRequest);

// Broad low-cost protection runs before body parsing. Valid sessions are
// keyed by user ID so a shared departmental NAT does not collapse ordinary
// authenticated traffic into one bucket; public traffic remains IP-keyed.
app.use(limiters.global);
app.use(createCsrfOriginGuard({
  allowedOrigins: config.csrf.allowedOrigins,
  cookieName: config.auth.cookieName,
  requireOrigin: config.csrf.requireOrigin
}));
app.use(express.json({ limit: config.requestLimits.jsonBodyBytes }));
app.use(express.urlencoded({ extended: true, limit: config.requestLimits.jsonBodyBytes }));

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

const directSimilarityMiddleware = [
  requireAuth,
  requireRole('student', 'lecturer'),
  limiters.similarity
];

app.post('/api/similarity/check', directSimilarityMiddleware, similarityRouteHandler);

// Architecture alias — matches API spec
app.post('/api/v1/check-similarity', directSimilarityMiddleware, similarityRouteHandler);

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

const getSubmissionController = () => {
  if (!submissionController) {
    submissionController = require('./controllers/submission.controller');
  }
  return submissionController;
};

const getLecturerSimilarityController = () => {
  if (!lecturerSimilarityController) {
    lecturerSimilarityController = require('./controllers/lecturerSimilarity.controller');
  }
  return lecturerSimilarityController;
};

const getAdminAuditLogController = () => {
  if (!adminAuditLogController) {
    adminAuditLogController = require('./controllers/adminAuditLog.controller');
  }
  return adminAuditLogController;
};

const getAdminDashboardController = () => {
  if (!adminDashboardController) {
    adminDashboardController = require('./controllers/adminDashboard.controller');
  }
  return adminDashboardController;
};

const getAdminTopicRepositoryController = () => {
  if (!adminTopicRepositoryController) {
    adminTopicRepositoryController = require('./controllers/adminTopicRepository.controller');
  }
  return adminTopicRepositoryController;
};

const getAdminUserController = () => {
  if (!adminUserController) {
    adminUserController = require('./controllers/adminUser.controller');
  }
  return adminUserController;
};

const getUserBulkImportController = () => {
  if (!userBulkImportController) {
    userBulkImportController = require('./controllers/userBulkImport.controller');
  }
  return userBulkImportController;
};

const getUserInvitationController = () => {
  if (!userInvitationController) {
    userInvitationController = require('./controllers/userInvitation.controller');
  }
  return userInvitationController;
};

const getAdminSettingsController = () => {
  if (!adminSettingsController) {
    adminSettingsController = require('./controllers/adminSettings.controller');
  }
  return adminSettingsController;
};

const getAdminReportsController = () => {
  if (!adminReportsController) {
    adminReportsController = require('./controllers/adminReports.controller');
  }
  return adminReportsController;
};

const getAdminSystemStatusController = () => {
  if (!adminSystemStatusController) {
    adminSystemStatusController = require('./controllers/adminSystemStatus.controller');
  }
  return adminSystemStatusController;
};

const getLecturerResearchTrendsController = () => {
  if (!lecturerResearchTrendsController) {
    lecturerResearchTrendsController = require('./controllers/lecturerResearchTrends.controller');
  }
  return lecturerResearchTrendsController;
};

const getNotificationController = () => {
  if (!notificationController) {
    notificationController = require('./controllers/notification.controller');
  }
  return notificationController;
};

const getSuperviseeAssignmentController = () => {
  if (!superviseeAssignmentController) {
    superviseeAssignmentController = require('./controllers/superviseeAssignment.controller');
  }
  return superviseeAssignmentController;
};

const getReadinessController = () => {
  if (!readinessController) {
    readinessController = require('./controllers/readiness.controller');
  }
  return readinessController;
};

app.get('/api/v1/readiness', (req, res, next) => {
  getReadinessController().getReadiness(req, res, next);
});

app.post('/api/v1/auth/login', limiters.loginIp, limiters.loginIdentifier, (req, res, next) => {
  getAuthController().login(req, res, next);
});

app.post('/api/v1/auth/logout', (req, res, next) => {
  getAuthController().logout(req, res, next);
});

// /auth/me and /auth/change-password intentionally stay reachable while a
// forced password change is pending; every other authenticated route is
// blocked until the user establishes a private password.
app.get('/api/v1/auth/me', requireAuthAllowingPasswordChange, (req, res, next) => {
  getAuthController().me(req, res, next);
});

app.post('/api/v1/auth/change-password', requireAuthAllowingPasswordChange, (req, res, next) => {
  getAuthController().changePassword(req, res, next);
});

app.post('/api/v1/auth/forgot-password', limiters.forgotPassword, (req, res, next) => {
  getAuthController().forgotPassword(req, res, next);
});

app.post('/api/v1/auth/reset-password', limiters.resetPassword, (req, res, next) => {
  getAuthController().resetPassword(req, res, next);
});

// Invitation acceptance is public in the narrow sense that no session is
// required: the one-time emailed token is the sole authorization, and it can
// only establish the password of an already-provisioned account. This is not
// public registration — no account can be created here.
app.post('/api/v1/auth/invitation/validate', limiters.invitationValidation, (req, res, next) => {
  getUserInvitationController().validateInvitation(req, res, next);
});

app.post('/api/v1/auth/invitation/accept', limiters.invitationAcceptance, (req, res, next) => {
  getUserInvitationController().acceptInvitation(req, res, next);
});

app.get('/api/v1/notifications', requireAuth, (req, res, next) => {
  getNotificationController().listNotifications(req, res, next);
});

app.patch('/api/v1/notifications/read-all', requireAuth, (req, res, next) => {
  getNotificationController().markAllNotificationsRead(req, res, next);
});

app.patch('/api/v1/notifications/:id/read', requireAuth, (req, res, next) => {
  getNotificationController().markNotificationRead(req, res, next);
});

app.get('/api/v1/submissions', requireAuth, requireRole('student'), (req, res, next) => {
  getSubmissionController().listSubmissions(req, res, next);
});

app.post('/api/v1/submissions', requireAuth, requireRole('student'), limiters.similarity, (req, res, next) => {
  getSubmissionController().createSubmission(req, res, next);
});

// Resubmitting a revision costs a Voyage document embedding exactly like a first
// submission, so it carries the same limiter.
app.post('/api/v1/submissions/:id/revision', requireAuth, requireRole('student'), limiters.similarity, (req, res, next) => {
  getSubmissionController().createRevisionSubmission(req, res, next);
});

app.get('/api/v1/lecturer/submissions', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getSubmissionController().listLecturerPendingSubmissions(req, res, next);
});

app.get('/api/v1/lecturer/decisions', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getSubmissionController().listLecturerDecisionHistory(req, res, next);
});

app.get('/api/v1/lecturer/research-trends', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getLecturerResearchTrendsController().getResearchTrends(req, res, next);
});

app.get('/api/v1/lecturer/supervisees', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getSuperviseeAssignmentController().listLecturerSupervisees(req, res, next);
});

app.get('/api/v1/lecturer/submissions/:id', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getSubmissionController().getLecturerSubmission(req, res, next);
});

app.post('/api/v1/lecturer/submissions/:id/similarity-check', requireAuth, requireRole('lecturer'), limiters.similarity, (req, res, next) => {
  getLecturerSimilarityController().checkLecturerSubmissionSimilarity(req, res, next);
});

app.get('/api/v1/lecturer/submissions/:id/similarity-snapshots', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getLecturerSimilarityController().listLecturerSubmissionSimilaritySnapshots(req, res, next);
});

app.patch('/api/v1/lecturer/submissions/:id/status', requireAuth, requireRole('lecturer'), (req, res, next) => {
  getSubmissionController().updateLecturerSubmissionStatus(req, res, next);
});

app.get('/api/v1/admin/dashboard/summary', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminDashboardController().getDashboardSummary(req, res, next);
});

app.get('/api/v1/admin/users', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminUserController().listUsers(req, res, next);
});

app.post('/api/v1/admin/users', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminUserController().createUser(req, res, next);
});

// Bulk departmental onboarding: preview classifies the uploaded workbook
// without creating anything; commit re-validates the same workbook against
// live directory state and creates only still-valid new accounts.
app.post('/api/v1/admin/users/import/preview', requireAuth, requireRole('admin'), importUploadMiddleware, (req, res, next) => {
  getUserBulkImportController().previewBulkUserImport(req, res, next);
});

app.post('/api/v1/admin/users/import/commit', requireAuth, requireRole('admin'), importUploadMiddleware, (req, res, next) => {
  getUserBulkImportController().commitBulkUserImport(req, res, next);
});

app.get('/api/v1/admin/users/import/template', requireAuth, requireRole('admin'), (req, res, next) => {
  getUserBulkImportController().downloadUserImportTemplate(req, res, next);
});

app.patch('/api/v1/admin/users/:id/identity', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminUserController().correctUserIdentity(req, res, next);
});

// Email invitations for provisioned accounts: individual (send/resend) and
// bounded-concurrency bulk. Registered before the :id routes for clarity.
app.post('/api/v1/admin/users/invitations/bulk', requireAuth, requireRole('admin'), limiters.adminBulkInvitation, (req, res, next) => {
  getUserInvitationController().sendBulkInvitations(req, res, next);
});

app.post('/api/v1/admin/users/:id/invite', requireAuth, requireRole('admin'), limiters.adminAccountAction, (req, res, next) => {
  getUserInvitationController().inviteUser(req, res, next);
});

app.post('/api/v1/admin/users/:id/credential-reset', requireAuth, requireRole('admin'), limiters.adminAccountAction, (req, res, next) => {
  getAdminUserController().resetUserCredential(req, res, next);
});

app.patch('/api/v1/admin/users/:id/status', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminUserController().updateUserStatus(req, res, next);
});

app.get('/api/v1/admin/users/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminUserController().getUserById(req, res, next);
});

app.get('/api/v1/admin/supervisee-assignments', requireAuth, requireRole('admin'), (req, res, next) => {
  getSuperviseeAssignmentController().listAdminAssignments(req, res, next);
});

app.post('/api/v1/admin/supervisee-assignments', requireAuth, requireRole('admin'), (req, res, next) => {
  getSuperviseeAssignmentController().createAdminAssignment(req, res, next);
});

app.patch('/api/v1/admin/supervisee-assignments/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  getSuperviseeAssignmentController().updateAdminAssignment(req, res, next);
});

app.delete('/api/v1/admin/supervisee-assignments/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  getSuperviseeAssignmentController().endAdminAssignment(req, res, next);
});

app.get('/api/v1/admin/settings', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminSettingsController().listSettings(req, res, next);
});

// Admin-only operational diagnostics: component states, corpus stats, and
// build identity. This is not a public debug endpoint.
app.get('/api/v1/admin/system-status', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminSystemStatusController().getSystemStatus(req, res, next);
});

app.get('/api/v1/admin/reports/summary', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminReportsController().getReportsSummary(req, res, next);
});

app.get('/api/v1/admin/reports/export/:type', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminReportsController().exportReport(req, res, next);
});

app.get('/api/v1/admin/topics/summary', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminTopicRepositoryController().getTopicsSummary(req, res, next);
});

app.get('/api/v1/admin/topics', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminTopicRepositoryController().listTopics(req, res, next);
});

app.get('/api/v1/admin/topics/:lifecycle/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminTopicRepositoryController().getTopicByLifecycleAndId(req, res, next);
});

app.get('/api/v1/admin/audit-logs', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminAuditLogController().listAuditLogs(req, res, next);
});

app.post('/api/v1/admin/audit-logs/purge-preview', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminAuditLogController().previewAuditLogPurge(req, res, next);
});

app.post('/api/v1/admin/audit-logs/purge', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminAuditLogController().purgeAuditLogs(req, res, next);
});

app.get('/api/v1/admin/audit-logs/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  getAdminAuditLogController().getAuditLogById(req, res, next);
});

const previewImportRouteHandler = (req, res, next) => {
  getTopicImportController().previewTopicImport(req, res, next);
};

const commitImportRouteHandler = (req, res, next) => {
  getTopicImportController().commitTopicImport(req, res, next);
};

const adminImportMiddleware = [requireAuth, requireRole('admin'), importUploadMiddleware];
// Commit (unlike preview) creates one paid Voyage document embedding for each
// accepted record, so rate-limit it by the authenticated administrator before
// receiving the multipart body. Preview remains deliberately unthrottled by
// this narrow provider-cost limiter because it does not invoke Voyage.
const adminImportCommitMiddleware = [requireAuth, requireRole('admin'), limiters.adminTopicImport, importUploadMiddleware];

app.post('/api/import/topics/preview', adminImportMiddleware, previewImportRouteHandler);
app.post('/api/import/topics/commit', adminImportCommitMiddleware, commitImportRouteHandler);
app.post('/api/v1/import/topics/preview', adminImportMiddleware, previewImportRouteHandler);
app.post('/api/v1/import/topics/commit', adminImportCommitMiddleware, commitImportRouteHandler);
app.post('/api/v1/admin/import/topics/preview', adminImportMiddleware, previewImportRouteHandler);
app.post('/api/v1/admin/import/topics/commit', adminImportCommitMiddleware, commitImportRouteHandler);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

function startServer({
  application = app,
  runtimeConfig = config,
  prismaClient = prisma,
  log = logger,
  processRef = process,
  exit = (code) => process.exit(code),
  host = '0.0.0.0'
} = {}) {
  const server = application.listen(runtimeConfig.port, host);
  const lifecycle = createServerLifecycle({
    server,
    prisma: prismaClient,
    log,
    gracePeriodMs: runtimeConfig.shutdownGracePeriodMs,
    exit
  });
  const removeSignalHandlers = lifecycle.installSignalHandlers(processRef);
  // Fatal-failure policy: uncaughtException/unhandledRejection log one
  // redacted fatal event and terminate through a bounded shutdown.
  const removeFatalHandlers = lifecycle.installFatalHandlers(processRef);
  let listening = false;

  server.on('listening', () => {
    listening = true;
    log.info('Server is listening.', {
      port: runtimeConfig.port,
      environment: runtimeConfig.env,
      apiVersion: runtimeConfig.apiVersion,
      version: packageInfo.version,
      buildId: process.env.BUILD_ID || null,
      nodeVersion: process.version
    });
  });

  server.on('error', (error) => {
    log.error('HTTP server error.', {
      error: error?.message,
      listening
    });

    if (!listening) {
      removeSignalHandlers();
      removeFatalHandlers();
      exit(1);
    }
  });

  return {
    server,
    shutdown: lifecycle.shutdown,
    removeSignalHandlers,
    removeFatalHandlers
  };
}

// Export the Express application for Supertest and other in-process callers.
// The production entrypoint starts only when this module is executed directly,
// so importing the app cannot accidentally bind a port.
module.exports = app;
module.exports.startServer = startServer;

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    logger.error('Server startup failed.', { error: error?.message });
    process.exit(1);
  }
}
