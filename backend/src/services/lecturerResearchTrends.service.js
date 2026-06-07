const prisma = require('../config/database');

const DATA_COVERAGE = 'Read-only lecturer research trend aggregates from existing topic, submission, and similarity snapshot tables.';
const SOURCE_TABLES = [
  'HistoricalTopic',
  'CurrentSessionTopic',
  'UnderReviewTopic',
  'Submission',
  'SimilarityCheckSnapshot'
];

function toCount(value) {
  return Number.isFinite(value) ? value : 0;
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

function normalizeLabel(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
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

function sum(values) {
  return values.reduce((total, value) => total + toCount(value), 0);
}

function sortEntries(entries, labelKey) {
  return entries.sort((left, right) => (
    right.count - left.count || left[labelKey].localeCompare(right[labelKey])
  ));
}

function combineGroupedCounts(groupSets, fieldName, outputKey, fallback) {
  const counts = new Map();

  groupSets.flat().forEach((group) => {
    const label = normalizeLabel(group[fieldName], fallback);
    counts.set(label, (counts.get(label) || 0) + countGroup(group));
  });

  return sortEntries(
    Array.from(counts.entries()).map(([label, count]) => ({
      [outputKey]: label,
      count
    })),
    outputKey
  );
}

function mapGroupedCounts(groups, fieldName, normalizer, initial) {
  return groups.reduce((counts, group) => {
    const key = normalizer(group[fieldName]);
    return {
      ...counts,
      [key]: (counts[key] || 0) + countGroup(group)
    };
  }, { ...initial });
}

function createLecturerResearchTrendsService({ prismaClient = prisma } = {}) {
  const getResearchTrends = async () => {
    const [
      historicalTopicTotal,
      currentSessionTopicTotal,
      underReviewTopicTotal,
      historicalCategoryGroups,
      currentSessionCategoryGroups,
      underReviewCategoryGroups,
      historicalSessionGroups,
      currentSessionSessionGroups,
      underReviewSessionGroups,
      submissionTotal,
      pendingReviewSubmissions,
      awaitingRevisionSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      submissionCategoryGroups,
      snapshotTotal,
      snapshotRiskGroups,
      snapshotResponseStatusGroups
    ] = await Promise.all([
      prismaClient.historicalTopic.count(),
      prismaClient.currentSessionTopic.count(),
      prismaClient.underReviewTopic.count(),
      prismaClient.historicalTopic.groupBy({ by: ['category'], _count: { _all: true } }),
      prismaClient.currentSessionTopic.groupBy({ by: ['category'], _count: { _all: true } }),
      prismaClient.underReviewTopic.groupBy({ by: ['category'], _count: { _all: true } }),
      prismaClient.historicalTopic.groupBy({ by: ['sessionYear'], _count: { _all: true } }),
      prismaClient.currentSessionTopic.groupBy({ by: ['sessionYear'], _count: { _all: true } }),
      prismaClient.underReviewTopic.groupBy({ by: ['sessionYear'], _count: { _all: true } }),
      prismaClient.submission.count(),
      prismaClient.submission.count({ where: { status: 'PENDING_REVIEW' } }),
      prismaClient.submission.count({ where: { status: 'AWAITING_REVISION' } }),
      prismaClient.submission.count({ where: { status: 'APPROVED' } }),
      prismaClient.submission.count({ where: { status: 'REJECTED' } }),
      prismaClient.submission.groupBy({ by: ['category'], _count: { _all: true } }),
      prismaClient.similarityCheckSnapshot.count(),
      prismaClient.similarityCheckSnapshot.groupBy({ by: ['overallRisk'], _count: { _all: true } }),
      prismaClient.similarityCheckSnapshot.groupBy({ by: ['responseStatus'], _count: { _all: true } })
    ]);

    const topicTotal = sum([historicalTopicTotal, currentSessionTopicTotal, underReviewTopicTotal]);
    const decidedSubmissions = sum([awaitingRevisionSubmissions, approvedSubmissions, rejectedSubmissions]);

    return {
      data: {
        topics: {
          total: topicTotal,
          byLifecycle: {
            historical: historicalTopicTotal,
            currentSession: currentSessionTopicTotal,
            underReview: underReviewTopicTotal
          },
          byCategory: combineGroupedCounts(
            [historicalCategoryGroups, currentSessionCategoryGroups, underReviewCategoryGroups],
            'category',
            'category',
            'Uncategorised'
          ),
          bySessionYear: combineGroupedCounts(
            [historicalSessionGroups, currentSessionSessionGroups, underReviewSessionGroups],
            'sessionYear',
            'sessionYear',
            'Unknown session'
          )
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
            decided: decidedSubmissions,
            pending: pendingReviewSubmissions
          },
          byCategory: combineGroupedCounts(
            [submissionCategoryGroups],
            'category',
            'category',
            'Uncategorised'
          )
        },
        similarityChecks: {
          snapshots: snapshotTotal,
          byRisk: mapGroupedCounts(snapshotRiskGroups, 'overallRisk', normalizeRisk, {
            high: 0,
            medium: 0,
            low: 0,
            unknown: 0
          }),
          byResponseStatus: mapGroupedCounts(snapshotResponseStatusGroups, 'responseStatus', normalizeResponseStatus, {
            success: 0,
            partialSuccess: 0,
            error: 0,
            other: 0
          }),
          notes: ['Similarity trend counts use stored lecturer snapshots only; no threshold or scoring behavior is changed.']
        },
        keywordTrends: {
          status: 'deferred',
          message: 'Keyword trend extraction and clustering are not generated by this endpoint. No fake keywords or recommendations are returned.'
        },
        recommendations: {
          status: 'deferred',
          message: 'Research recommendations are deferred. This endpoint returns aggregate counts only.'
        },
        warnings: []
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataCoverage: DATA_COVERAGE,
        sourceTables: SOURCE_TABLES,
        analyticsStatus: 'read_only_aggregates'
      }
    };
  };

  return {
    getResearchTrends
  };
}

module.exports = {
  ...createLecturerResearchTrendsService(),
  createLecturerResearchTrendsService,
  DATA_COVERAGE,
  SOURCE_TABLES
};
