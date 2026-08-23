const prisma = require('../config/database');
const logger = require('../config/logger');

const DATA_COVERAGE = 'Read-only counts from existing tables.';

function createWarning(section, code, message) {
  return {
    section,
    code,
    message
  };
}

function sumValues(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function createUnavailableUsers() {
  return {
    total: null,
    students: null,
    lecturers: null,
    admins: null,
    active: null,
    suspended: null,
    status: 'unavailable'
  };
}

function createUnavailableSubmissions() {
  return {
    total: null,
    pendingReview: null,
    awaitingRevision: null,
    approved: null,
    rejected: null,
    status: 'unavailable'
  };
}

function createUnavailableTopics() {
  return {
    total: null,
    historical: null,
    currentSession: null,
    underReview: null,
    status: 'unavailable'
  };
}

function createUnavailableSimilarityChecks() {
  return {
    snapshots: null,
    highRisk: null,
    mediumRisk: null,
    lowRisk: null,
    status: 'unavailable',
    notes: ['Stored lecturer similarity snapshot counts are unavailable.']
  };
}

function createAdminDashboardService({ prismaClient = prisma, log = logger } = {}) {
  const countUsers = async () => {
    const [
      total,
      students,
      lecturers,
      admins,
      active,
      suspended
    ] = await Promise.all([
      prismaClient.user.count(),
      prismaClient.user.count({ where: { role: 'STUDENT' } }),
      prismaClient.user.count({ where: { role: 'LECTURER' } }),
      prismaClient.user.count({ where: { role: 'ADMIN' } }),
      prismaClient.user.count({ where: { status: 'ACTIVE' } }),
      prismaClient.user.count({ where: { status: 'SUSPENDED' } })
    ]);

    return {
      total,
      students,
      lecturers,
      admins,
      active,
      suspended,
      status: 'available'
    };
  };

  const countSubmissions = async () => {
    const [
      total,
      pendingReview,
      awaitingRevision,
      approved,
      rejected
    ] = await Promise.all([
      prismaClient.submission.count(),
      prismaClient.submission.count({ where: { status: 'PENDING_REVIEW' } }),
      prismaClient.submission.count({ where: { status: 'AWAITING_REVISION' } }),
      prismaClient.submission.count({ where: { status: 'APPROVED' } }),
      prismaClient.submission.count({ where: { status: 'REJECTED' } })
    ]);

    return {
      total,
      pendingReview,
      awaitingRevision,
      approved,
      rejected,
      status: 'available'
    };
  };

  const countTopics = async () => {
    const [
      historical,
      currentSession,
      underReview
    ] = await Promise.all([
      prismaClient.historicalTopic.count(),
      prismaClient.currentSessionTopic.count(),
      prismaClient.underReviewTopic.count()
    ]);

    return {
      total: sumValues([historical, currentSession, underReview]),
      historical,
      currentSession,
      underReview,
      status: 'available'
    };
  };

  const countSimilarityChecks = async () => {
    const [
      snapshots,
      highRisk,
      mediumRisk,
      lowRisk
    ] = await Promise.all([
      prismaClient.similarityCheckSnapshot.count(),
      prismaClient.similarityCheckSnapshot.count({ where: { overallRisk: { in: ['HIGH', 'high'] } } }),
      prismaClient.similarityCheckSnapshot.count({ where: { overallRisk: { in: ['MEDIUM', 'medium'] } } }),
      prismaClient.similarityCheckSnapshot.count({ where: { overallRisk: { in: ['LOW', 'low'] } } })
    ]);

    return {
      snapshots,
      highRisk,
      mediumRisk,
      lowRisk,
      status: 'available',
      notes: ['Risk distribution includes stored lecturer similarity snapshots only.']
    };
  };

  const runSection = async ({ name, code, unavailable, task, warnings }) => {
    try {
      return await task();
    } catch (error) {
      log.warn('Admin dashboard summary section unavailable', {
        section: name,
        error: error.message
      });
      warnings.push(createWarning(
        name,
        code,
        `${name} counts are unavailable from the database.`
      ));
      return unavailable();
    }
  };

  const getDashboardSummary = async () => {
    const warnings = [];

    const [users, submissions, topics, similarityChecks] = await Promise.all([
      runSection({
        name: 'users',
        code: 'ADMIN_DASHBOARD_USERS_UNAVAILABLE',
        unavailable: createUnavailableUsers,
        task: countUsers,
        warnings
      }),
      runSection({
        name: 'submissions',
        code: 'ADMIN_DASHBOARD_SUBMISSIONS_UNAVAILABLE',
        unavailable: createUnavailableSubmissions,
        task: countSubmissions,
        warnings
      }),
      runSection({
        name: 'topics',
        code: 'ADMIN_DASHBOARD_TOPICS_UNAVAILABLE',
        unavailable: createUnavailableTopics,
        task: countTopics,
        warnings
      }),
      runSection({
        name: 'similarityChecks',
        code: 'ADMIN_DASHBOARD_SIMILARITY_UNAVAILABLE',
        unavailable: createUnavailableSimilarityChecks,
        task: countSimilarityChecks,
        warnings
      })
    ]);

    const databaseStatus = warnings.length > 0 ? 'unavailable' : 'available';
    const generatedAt = new Date().toISOString();

    return {
      data: {
        users,
        submissions,
        topics,
        similarityChecks,
        serviceHealth: {
          api: {
            status: 'available',
            message: 'API process responded to the admin dashboard summary request.'
          },
          database: {
            status: databaseStatus,
            message: databaseStatus === 'available'
              ? 'Database counts were read from existing tables.'
              : 'One or more database-backed dashboard sections could not be read.'
          },
          semanticProvider: {
            status: 'unknown',
            provider: 'voyage',
            model: 'voyage-4-large',
            message: 'Voyage semantic provider (voyage-4-large) health is not checked by this dashboard endpoint yet.'
          }
        },
        warnings
      },
      meta: {
        generatedAt,
        dataCoverage: DATA_COVERAGE
      }
    };
  };

  return {
    getDashboardSummary
  };
}

module.exports = {
  ...createAdminDashboardService(),
  createAdminDashboardService,
  DATA_COVERAGE
};
