const prisma = require('../config/database');

const DATA_COVERAGE = 'Read-only report aggregates from existing tables.';
const SOURCE_TABLES = [
  'User',
  'Submission',
  'HistoricalTopic',
  'CurrentSessionTopic',
  'UnderReviewTopic',
  'SimilarityCheckSnapshot',
  'AuditLog'
];

function toCount(value) {
  return Number.isFinite(value) ? value : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + toCount(value), 0);
}

function normalizeRisk(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(normalized)) {
    return normalized;
  }
  return 'unknown';
}

function normalizeResponseStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'success') {
    return 'success';
  }
  if (normalized === 'partial_success') {
    return 'partialSuccess';
  }
  if (normalized === 'error') {
    return 'error';
  }
  return 'other';
}

function normalizeActorRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['admin', 'lecturer', 'student'].includes(normalized)) {
    return normalized;
  }
  return 'unknown';
}

function countGroup(group) {
  if (typeof group?._count?._all === 'number') {
    return group._count._all;
  }

  if (typeof group?._count === 'number') {
    return group._count;
  }

  return 0;
}

function mapGroupedCounts(groups, normalizer, initial) {
  return groups.reduce((counts, group) => {
    const key = normalizer(group.overallRisk || group.responseStatus || group.actorRole);
    return {
      ...counts,
      [key]: (counts[key] || 0) + countGroup(group)
    };
  }, { ...initial });
}

function mapEventTypes(groups) {
  return groups
    .map((group) => ({
      eventType: group.eventType || 'UNKNOWN_EVENT',
      count: countGroup(group)
    }))
    .sort((left, right) => right.count - left.count || left.eventType.localeCompare(right.eventType))
    .slice(0, 8);
}

function createAdminReportsService({ prismaClient = prisma } = {}) {
  const getReportsSummary = async () => {
    const [
      userTotal,
      studentUsers,
      lecturerUsers,
      adminUsers,
      activeUsers,
      suspendedUsers,
      submissionTotal,
      pendingReviewSubmissions,
      awaitingRevisionSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      historicalTopics,
      currentSessionTopics,
      underReviewTopics,
      snapshotTotal,
      riskGroups,
      responseStatusGroups,
      auditLogTotal,
      auditEventGroups,
      auditActorRoleGroups
    ] = await Promise.all([
      prismaClient.user.count(),
      prismaClient.user.count({ where: { role: 'STUDENT' } }),
      prismaClient.user.count({ where: { role: 'LECTURER' } }),
      prismaClient.user.count({ where: { role: 'ADMIN' } }),
      prismaClient.user.count({ where: { status: 'ACTIVE' } }),
      prismaClient.user.count({ where: { status: 'SUSPENDED' } }),
      prismaClient.submission.count(),
      prismaClient.submission.count({ where: { status: 'PENDING_REVIEW' } }),
      prismaClient.submission.count({ where: { status: 'AWAITING_REVISION' } }),
      prismaClient.submission.count({ where: { status: 'APPROVED' } }),
      prismaClient.submission.count({ where: { status: 'REJECTED' } }),
      prismaClient.historicalTopic.count(),
      prismaClient.currentSessionTopic.count(),
      prismaClient.underReviewTopic.count(),
      prismaClient.similarityCheckSnapshot.count(),
      prismaClient.similarityCheckSnapshot.groupBy({
        by: ['overallRisk'],
        _count: { _all: true }
      }),
      prismaClient.similarityCheckSnapshot.groupBy({
        by: ['responseStatus'],
        _count: { _all: true }
      }),
      prismaClient.auditLog.count(),
      prismaClient.auditLog.groupBy({
        by: ['eventType'],
        _count: { _all: true }
      }),
      prismaClient.auditLog.groupBy({
        by: ['actorRole'],
        _count: { _all: true }
      })
    ]);

    const riskCounts = mapGroupedCounts(riskGroups, normalizeRisk, {
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    });
    const responseStatusCounts = mapGroupedCounts(responseStatusGroups, normalizeResponseStatus, {
      success: 0,
      partialSuccess: 0,
      error: 0,
      other: 0
    });
    const auditActorRoleCounts = mapGroupedCounts(auditActorRoleGroups, normalizeActorRole, {
      admin: 0,
      lecturer: 0,
      student: 0,
      unknown: 0
    });

    return {
      data: {
        users: {
          total: userTotal,
          byRole: {
            students: studentUsers,
            lecturers: lecturerUsers,
            admins: adminUsers
          },
          byStatus: {
            active: activeUsers,
            suspended: suspendedUsers
          }
        },
        submissions: {
          total: submissionTotal,
          byStatus: {
            pendingReview: pendingReviewSubmissions,
            awaitingRevision: awaitingRevisionSubmissions,
            approved: approvedSubmissions,
            rejected: rejectedSubmissions
          },
          decisionCoverage: {
            decided: sum([awaitingRevisionSubmissions, approvedSubmissions, rejectedSubmissions]),
            pending: pendingReviewSubmissions
          }
        },
        topics: {
          total: sum([historicalTopics, currentSessionTopics, underReviewTopics]),
          byLifecycle: {
            historical: historicalTopics,
            currentSession: currentSessionTopics,
            underReview: underReviewTopics
          }
        },
        similarityChecks: {
          snapshots: snapshotTotal,
          byRisk: riskCounts,
          byResponseStatus: responseStatusCounts,
          notes: ['Similarity report counts use stored lecturer snapshots only.']
        },
        auditLogs: {
          total: auditLogTotal,
          byActorRole: auditActorRoleCounts,
          topEventTypes: mapEventTypes(auditEventGroups)
        },
        exports: {
          status: 'csv_available',
          message: 'CSV exports are available for safe admin report categories. PDF exports remain deferred.'
        },
        warnings: []
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataCoverage: DATA_COVERAGE,
        sourceTables: SOURCE_TABLES,
        exportStatus: 'csv_available_pdf_deferred'
      }
    };
  };

  return {
    getReportsSummary
  };
}

module.exports = {
  ...createAdminReportsService(),
  createAdminReportsService,
  DATA_COVERAGE,
  SOURCE_TABLES
};
