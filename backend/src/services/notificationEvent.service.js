const prisma = require('../config/database');
const logger = require('../config/logger');
const { createNotificationService } = require('./notification.service');

const NOTIFICATION_EVENT_TYPES = {
  SUBMISSION_CREATED: 'SUBMISSION_CREATED',
  SUBMISSION_DECISION: 'SUBMISSION_DECISION',
  TOPIC_IMPORT_PREVIEWED: 'TOPIC_IMPORT_PREVIEWED',
  TOPIC_IMPORT_COMMITTED: 'TOPIC_IMPORT_COMMITTED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED'
};

function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function toClientSubmissionStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function getSubmissionTitle(submission) {
  return String(submission?.title || 'A submitted topic').trim();
}

function buildDecisionText(status) {
  const normalizedStatus = toClientSubmissionStatus(status);
  if (normalizedStatus === 'approved') {
    return {
      title: 'Topic approved',
      message: 'Your topic submission was approved.'
    };
  }

  if (normalizedStatus === 'rejected') {
    return {
      title: 'Topic rejected',
      message: 'Your topic submission was rejected. Review the lecturer feedback in your submissions page.'
    };
  }

  if (normalizedStatus === 'awaiting_revision') {
    return {
      title: 'Topic revision requested',
      message: 'Your topic submission needs revision. Review the lecturer feedback in your submissions page.'
    };
  }

  return {
    title: 'Topic decision updated',
    message: 'Your topic submission decision was updated.'
  };
}

function pickImportReportCounts(report = {}) {
  return {
    totalRows: report.total_rows ?? report.totalRows ?? null,
    acceptedRows: report.accepted_rows ?? report.acceptedRows ?? null,
    skippedRows: report.skipped_rows ?? report.skippedRows ?? null,
    insertedRecords: report.inserted_records ?? report.insertedRecords ?? null,
    failedRecords: report.failed_records ?? report.failedRecords ?? null
  };
}

function createNotificationEventService({
  prismaClient = prisma,
  notificationService = createNotificationService({ prismaClient }),
  serviceLogger = logger
} = {}) {
  const createNotificationSafely = async (payload) => {
    try {
      const item = await notificationService.createNotification(payload);
      return { created: 1, failed: 0, item };
    } catch (error) {
      serviceLogger.warn('Notification event creation failed', {
        type: payload?.type,
        userId: payload?.userId,
        errorName: error?.name,
        errorCode: error?.code
      });

      return { created: 0, failed: 1, error };
    }
  };

  const notifyReviewersOfSubmissionCreatedSafely = async ({ submission, actorUser } = {}) => {
    try {
      if (!submission?.id) {
        return { created: 0, skipped: true, reason: 'missing_submission' };
      }

      const reviewers = await prismaClient.user.findMany({
        where: {
          role: {
            in: ['LECTURER', 'ADMIN']
          },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          role: true
        }
      });

      if (!reviewers.length) {
        return { created: 0, skipped: true, reason: 'no_active_reviewers' };
      }

      const results = await Promise.all(reviewers.map((recipient) => {
        const role = normalizeRole(recipient.role);
        return createNotificationSafely({
          userId: recipient.id,
          type: NOTIFICATION_EVENT_TYPES.SUBMISSION_CREATED,
          title: 'New topic pending review',
          message: `A student submitted a topic for review: ${getSubmissionTitle(submission)}.`,
          linkPath: role === 'ADMIN' ? '/admin/dashboard' : '/lecturer/pending-reviews',
          metadata: {
            submissionId: submission.id,
            studentId: submission.studentId || actorUser?.id || null,
            category: submission.category || null,
            sessionId: submission.sessionId || null,
            reviewerRole: role.toLowerCase()
          }
        });
      }));

      return {
        created: results.reduce((sum, result) => sum + result.created, 0),
        failed: results.reduce((sum, result) => sum + result.failed, 0),
        recipientCount: reviewers.length
      };
    } catch (error) {
      serviceLogger.warn('Submission-created notification event failed', {
        submissionId: submission?.id,
        errorName: error?.name,
        errorCode: error?.code
      });

      return { created: 0, failed: 1, error };
    }
  };

  const notifyStudentOfSubmissionDecisionSafely = async ({ submission } = {}) => {
    if (!submission?.studentId || !submission?.id) {
      return { created: 0, skipped: true, reason: 'missing_submission_owner' };
    }

    const decisionText = buildDecisionText(submission.status);
    return createNotificationSafely({
      userId: submission.studentId,
      type: NOTIFICATION_EVENT_TYPES.SUBMISSION_DECISION,
      title: decisionText.title,
      message: decisionText.message,
      linkPath: '/student/my-submissions',
      metadata: {
        submissionId: submission.id,
        status: toClientSubmissionStatus(submission.status),
        decidedById: submission.decidedById || null,
        decidedAt: submission.decidedAt?.toISOString?.() || submission.decidedAt || null
      }
    });
  };

  const notifyAdminImportPreviewedSafely = async ({ actorUser, fileName, report, importBatchId } = {}) => {
    if (!actorUser?.id || normalizeRole(actorUser.role) !== 'ADMIN') {
      return { created: 0, skipped: true, reason: 'missing_admin_actor' };
    }

    return createNotificationSafely({
      userId: actorUser.id,
      type: NOTIFICATION_EVENT_TYPES.TOPIC_IMPORT_PREVIEWED,
      title: 'Topic import preview completed',
      message: 'Your topic import preview completed. Review the returned import report before committing.',
      linkPath: '/admin/topic-repository',
      metadata: {
        mode: 'preview',
        fileName: fileName || null,
        importBatchId: importBatchId || null,
        report: pickImportReportCounts(report)
      }
    });
  };

  const notifyAdminImportCommittedSafely = async ({ actorUser, fileName, report, persistenceReport, importBatchId } = {}) => {
    if (!actorUser?.id || normalizeRole(actorUser.role) !== 'ADMIN') {
      return { created: 0, skipped: true, reason: 'missing_admin_actor' };
    }

    const counts = pickImportReportCounts(persistenceReport);
    return createNotificationSafely({
      userId: actorUser.id,
      type: NOTIFICATION_EVENT_TYPES.TOPIC_IMPORT_COMMITTED,
      title: 'Topic import committed',
      message: 'Your topic import commit completed. Review the persistence report for inserted, skipped, or failed records.',
      linkPath: '/admin/topic-repository',
      metadata: {
        mode: 'commit',
        fileName: fileName || null,
        importBatchId: importBatchId || null,
        importReport: pickImportReportCounts(report),
        persistenceReport: counts
      }
    });
  };

  const notifyPasswordResetRequestedSafely = async ({ user } = {}) => {
    if (!user?.id || normalizeStatus(user.status) !== 'ACTIVE') {
      return { created: 0, skipped: true, reason: 'missing_active_user' };
    }

    return createNotificationSafely({
      userId: user.id,
      type: NOTIFICATION_EVENT_TYPES.PASSWORD_RESET_REQUESTED,
      title: 'Password reset requested',
      message: 'A password reset link was requested for your account.',
      linkPath: null,
      metadata: {
        userId: user.id,
        emailDelivery: 'requested'
      }
    });
  };

  return {
    notifyAdminImportCommittedSafely,
    notifyAdminImportPreviewedSafely,
    notifyPasswordResetRequestedSafely,
    notifyReviewersOfSubmissionCreatedSafely,
    notifyStudentOfSubmissionDecisionSafely
  };
}

module.exports = {
  ...createNotificationEventService(),
  NOTIFICATION_EVENT_TYPES,
  buildDecisionText,
  createNotificationEventService,
  pickImportReportCounts
};
