const prisma = require('../config/database');
const { createNotificationEventService } = require('./notificationEvent.service');
const defaultCorpusLifecycle = require('./topicCorpusLifecycle.service');
const { validStoredEmbedding, VoyageProviderError } = require('./voyageEmbedding.service');

const MIN_TITLE_WORDS = 7;
const MAX_TITLE_WORDS = 24;
const LECTURER_STATUS_UPDATES = {
  approved: 'APPROVED',
  rejected: 'REJECTED',
  awaiting_revision: 'AWAITING_REVISION'
};
const LECTURER_DECISION_STATUSES = {
  approved: 'APPROVED',
  rejected: 'REJECTED',
  awaiting_revision: 'AWAITING_REVISION'
};
const LECTURER_DECISION_SORT_FIELDS = new Set(['decidedAt', 'submittedAt', 'title', 'status', 'category']);
const DEFAULT_DECISION_PAGE = 1;
const DEFAULT_DECISION_LIMIT = 25;
const MAX_DECISION_LIMIT = 100;

class SubmissionServiceError extends Error {
  constructor(message, statusCode, code, field) {
    super(message);
    this.name = 'SubmissionServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
  }
}

function countWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return normalizeOptionalText(value.filter(Boolean).map(item => String(item).trim()).filter(Boolean).join(', '));
  }

  return normalizeOptionalText(value);
}

function normalizeDecisionReason(value) {
  return normalizeOptionalText(value);
}

function serializeSubmission(submission, {
  includeStudent = Boolean(submission?.student),
  includeDecision = false,
  includeDecisionActor = false
} = {}) {
  if (!submission) {
    return null;
  }

  return {
    id: submission.id,
    student_id: submission.studentId,
    session_id: submission.sessionId,
    session_name: submission.session?.name || null,
    title: submission.title,
    category: submission.category,
    keywords: submission.keywords,
    status: String(submission.status || '').toLowerCase(),
    ...(includeDecision ? {
      decision_reason: submission.decisionReason || null,
      decided_at: submission.decidedAt?.toISOString?.() || submission.decidedAt || null
    } : {}),
    ...(includeDecision && includeDecisionActor ? {
      decided_by_id: submission.decidedById || null,
      decided_by_name: submission.decidedBy?.name || null
    } : {}),
    ...(includeStudent ? {
      student_name: submission.student?.name || null,
      student_email: submission.student?.email || null
    } : {}),
    submitted_at: submission.submittedAt?.toISOString?.() || submission.submittedAt,
    created_at: submission.createdAt?.toISOString?.() || submission.createdAt,
    updated_at: submission.updatedAt?.toISOString?.() || submission.updatedAt
  };
}

function assertStudentUser(user) {
  if (!user) {
    throw new SubmissionServiceError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED');
  }

  if (user.role !== 'student') {
    throw new SubmissionServiceError('Only students can access submissions.', 403, 'FORBIDDEN');
  }
}

function assertLecturerUser(user) {
  if (!user) {
    throw new SubmissionServiceError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED');
  }

  if (user.role !== 'lecturer') {
    throw new SubmissionServiceError('Only lecturers can access the review queue.', 403, 'FORBIDDEN');
  }
}

function validateSubmissionInput({ title }) {
  const normalizedTitle = normalizeOptionalText(title);

  if (!normalizedTitle) {
    throw new SubmissionServiceError('Title is required.', 400, 'TITLE_REQUIRED', 'title');
  }

  const wordCount = countWords(normalizedTitle);
  if (wordCount < MIN_TITLE_WORDS) {
    throw new SubmissionServiceError(
      `Title must be at least ${MIN_TITLE_WORDS} words.`,
      400,
      'TITLE_TOO_SHORT',
      'title'
    );
  }

  if (wordCount > MAX_TITLE_WORDS) {
    throw new SubmissionServiceError(
      `Title must be no more than ${MAX_TITLE_WORDS} words.`,
      400,
      'TITLE_TOO_LONG',
      'title'
    );
  }

  return normalizedTitle;
}

function parseSubmissionId(value) {
  const submissionId = Number(value);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    throw new SubmissionServiceError('Submission id is invalid.', 400, 'INVALID_SUBMISSION_ID', 'id');
  }

  return submissionId;
}

function parsePositiveInteger(value, fallback, { max } = {}) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return max ? Math.min(parsedValue, max) : parsedValue;
}

function parseDecisionDate(value, field) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new SubmissionServiceError(`${field} is invalid.`, 400, 'INVALID_DECISION_FILTER', field);
  }

  return parsedDate;
}

function parseDecisionStatusFilter(value) {
  const normalizedStatus = String(value || '').trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === 'all') {
    return null;
  }

  const prismaStatus = LECTURER_DECISION_STATUSES[normalizedStatus];

  if (!prismaStatus) {
    throw new SubmissionServiceError('Decision status filter is invalid.', 400, 'INVALID_DECISION_STATUS_FILTER', 'status');
  }

  return {
    clientStatus: normalizedStatus,
    prismaStatus
  };
}

function normalizeSortDirection(value) {
  return String(value || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeDecisionSortField(value) {
  const sortField = String(value || '').trim() || 'decidedAt';

  if (!LECTURER_DECISION_SORT_FIELDS.has(sortField)) {
    throw new SubmissionServiceError('Decision sort field is invalid.', 400, 'INVALID_DECISION_SORT', 'sort');
  }

  return sortField;
}

function parseLecturerStatusUpdate(value) {
  const normalizedStatus = String(value || '').trim().toLowerCase();
  const prismaStatus = LECTURER_STATUS_UPDATES[normalizedStatus];

  if (!prismaStatus) {
    throw new SubmissionServiceError('Submission status is invalid.', 400, 'INVALID_SUBMISSION_STATUS', 'status');
  }

  return prismaStatus;
}

function validateDecisionReason({ status, reason }) {
  const normalizedReason = normalizeDecisionReason(reason);

  if (status === 'REJECTED' && !normalizedReason) {
    throw new SubmissionServiceError(
      'Decision rationale is required when rejecting a submission.',
      400,
      'DECISION_REASON_REQUIRED',
      'reason'
    );
  }

  return normalizedReason;
}

function buildDecisionHistoryQuery({ user, query = {} }) {
  assertLecturerUser(user);

  const page = parsePositiveInteger(query.page, DEFAULT_DECISION_PAGE);
  const limit = parsePositiveInteger(query.limit, DEFAULT_DECISION_LIMIT, { max: MAX_DECISION_LIMIT });
  const statusFilter = parseDecisionStatusFilter(query.status);
  const dateFrom = parseDecisionDate(query.dateFrom, 'dateFrom');
  const dateTo = parseDecisionDate(query.dateTo, 'dateTo');
  const category = normalizeOptionalText(query.category);
  const search = normalizeOptionalText(query.search);
  const sort = normalizeDecisionSortField(query.sort);
  const direction = normalizeSortDirection(query.direction);

  const where = {
    decidedById: user.id,
    decidedAt: {
      not: null
    },
    status: {
      in: Object.values(LECTURER_DECISION_STATUSES)
    }
  };

  if (statusFilter) {
    where.status = statusFilter.prismaStatus;
  }

  if (dateFrom || dateTo) {
    where.decidedAt = {
      not: null,
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {})
    };
  }

  if (category) {
    where.category = {
      equals: category,
      mode: 'insensitive'
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      {
        student: {
          name: { contains: search, mode: 'insensitive' }
        }
      },
      {
        student: {
          email: { contains: search, mode: 'insensitive' }
        }
      }
    ];
  }

  return {
    filters: {
      ...(statusFilter ? { status: statusFilter.clientStatus } : {}),
      ...(dateFrom ? { dateFrom: dateFrom.toISOString() } : {}),
      ...(dateTo ? { dateTo: dateTo.toISOString() } : {}),
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      sort,
      direction
    },
    limit,
    orderBy: { [sort]: direction },
    page,
    skip: (page - 1) * limit,
    where
  };
}

function serializeLecturerDecision(submission) {
  return {
    id: submission.id,
    title: submission.title,
    studentName: submission.student?.name || null,
    studentEmail: submission.student?.email || null,
    category: submission.category || null,
    status: String(submission.status || ''),
    submittedAt: submission.submittedAt?.toISOString?.() || submission.submittedAt || null,
    decidedAt: submission.decidedAt?.toISOString?.() || submission.decidedAt || null,
    decisionFeedback: submission.decisionReason || null,
    similaritySnapshotId: submission.similarityCheckSnapshots?.[0]?.id || null
  };
}

function createSubmissionService({
  prismaClient = prisma,
  notificationEvents = createNotificationEventService({ prismaClient }),
  corpusLifecycle = defaultCorpusLifecycle
} = {}) {
  const getCurrentSession = async () => {
    const session = await prismaClient.academicSession.findFirst({
      where: { isCurrent: true },
      select: { id: true, name: true }
    });

    return session || null;
  };

  const prepareDocumentEmbeddingOrFail = async (topicShape, failureMessage) => {
    try {
      return await corpusLifecycle.prepareDocumentEmbedding(topicShape);
    } catch (error) {
      if (error instanceof VoyageProviderError) {
        throw new SubmissionServiceError(failureMessage, 503, 'SEMANTIC_SYNC_UNAVAILABLE');
      }

      throw error;
    }
  };

  const createSubmission = async ({ user, input }) => {
    assertStudentUser(user);
    const title = validateSubmissionInput(input || {});
    const category = normalizeOptionalText(input?.category);
    const keywords = normalizeKeywords(input?.keywords);
    const session = await getCurrentSession();
    const sessionId = session?.id || null;

    // A pending submission is an under-review topic other checks must see, so the
    // Voyage document embedding is prepared before any row is written (never
    // inside the transaction) and the submission plus its under-review corpus
    // record are committed atomically. If Voyage is unavailable the submission
    // fails honestly instead of entering review invisible to similarity checks.
    const topicShape = corpusLifecycle.buildSubmissionTopicShape({ title, category, keywords });
    const embeddingData = await prepareDocumentEmbeddingOrFail(
      topicShape,
      'Your topic could not be submitted because semantic analysis is currently unavailable. Please try again shortly.'
    );

    const submission = await prismaClient.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          studentId: user.id,
          sessionId,
          title,
          category,
          keywords,
          status: 'PENDING_REVIEW'
        },
        include: {
          session: true
        }
      });

      await tx.underReviewTopic.create({
        data: {
          ...topicShape,
          keywords: topicShape.keywords || '',
          sessionYear: session?.name || '',
          supervisorName: '',
          sourceType: 'submission',
          reviewStartedAt: created.submittedAt,
          submissionId: created.id,
          ...embeddingData
        }
      });

      return created;
    });

    await corpusLifecycle.refreshResidentCorpusSafely('submission creation');

    await notificationEvents.notifyReviewersOfSubmissionCreatedSafely({
      submission,
      actorUser: user
    });

    return serializeSubmission(submission);
  };

  const listStudentSubmissions = async ({ user }) => {
    assertStudentUser(user);

    const submissions = await prismaClient.submission.findMany({
      where: {
        studentId: user.id
      },
      orderBy: {
        submittedAt: 'desc'
      },
      include: {
        session: true
      }
    });

    return submissions.map((submission) => serializeSubmission(submission, {
      includeStudent: true,
      includeDecision: true
    }));
  };

  const listLecturerPendingSubmissions = async ({ user }) => {
    assertLecturerUser(user);

    const submissions = await prismaClient.submission.findMany({
      where: {
        status: 'PENDING_REVIEW'
      },
      orderBy: {
        submittedAt: 'asc'
      },
      include: {
        session: true,
        student: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return submissions.map(serializeSubmission);
  };

  const getLecturerSubmission = async ({ user, submissionId }) => {
    assertLecturerUser(user);
    const id = parseSubmissionId(submissionId);

    const submission = await prismaClient.submission.findUnique({
      where: { id },
      include: {
        session: true,
        decidedBy: {
          select: {
            name: true
          }
        },
        student: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!submission) {
      throw new SubmissionServiceError('Submission was not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    return serializeSubmission(submission, {
      includeDecision: true,
      includeDecisionActor: true
    });
  };

  // Semantic fields an approved topic carries into the current-session corpus.
  const CORPUS_CONTENT_FIELDS = ['title', 'keywords', 'category', 'population', 'location', 'studyFocus', 'sessionYear', 'supervisorName'];
  const EMBEDDING_METADATA_FIELDS = ['embedding', 'embeddingProvider', 'embeddingModel', 'embeddingDimension', 'embeddingRepresentation', 'embeddingSourceHash', 'embeddedAt'];

  const pickFields = (source, fields) => Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));

  // Builds the current-session corpus record for an approved submission. The
  // stored under-review embedding is reused when it is still valid for the same
  // semantic content; otherwise (legacy submissions, stale hash) a fresh Voyage
  // document embedding is generated before the decision transaction opens.
  const buildApprovedCorpusData = async ({ submission, underReviewRow }) => {
    if (underReviewRow && validStoredEmbedding(underReviewRow)) {
      return {
        ...pickFields(underReviewRow, CORPUS_CONTENT_FIELDS),
        ...pickFields(underReviewRow, EMBEDDING_METADATA_FIELDS)
      };
    }

    const topicShape = corpusLifecycle.buildSubmissionTopicShape(submission);
    const embeddingData = await prepareDocumentEmbeddingOrFail(
      topicShape,
      'The approval could not be completed because semantic analysis is currently unavailable. Please try again shortly.'
    );

    return {
      ...topicShape,
      keywords: topicShape.keywords || '',
      sessionYear: underReviewRow?.sessionYear || submission.session?.name || '',
      supervisorName: underReviewRow?.supervisorName || '',
      ...embeddingData
    };
  };

  const updateLecturerSubmissionStatus = async ({ user, submissionId, status, reason }) => {
    assertLecturerUser(user);
    const id = parseSubmissionId(submissionId);
    const nextStatus = parseLecturerStatusUpdate(status);

    const existingSubmission = await prismaClient.submission.findUnique({
      where: { id },
      include: {
        session: true
      }
    });

    if (!existingSubmission) {
      throw new SubmissionServiceError('Submission was not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (existingSubmission.status !== 'PENDING_REVIEW') {
      throw new SubmissionServiceError(
        'Only pending review submissions can be updated.',
        400,
        'SUBMISSION_NOT_PENDING',
        'status'
      );
    }

    const decisionReason = validateDecisionReason({
      status: nextStatus,
      reason
    });

    const decisionData = {
      status: nextStatus,
      decisionReason,
      decidedById: user.id,
      decidedAt: new Date()
    };
    const decisionInclude = {
      session: true,
      decidedBy: {
        select: {
          name: true
        }
      },
      student: {
        select: {
          name: true,
          email: true
        }
      }
    };

    // The submission decision and its corpus transition commit atomically:
    // APPROVED promotes the topic into the current-session repository (keyed by
    // submissionId, so retries cannot create duplicates) and removes the
    // under-review copy so the proposal never contributes twice; REJECTED and
    // AWAITING_REVISION only remove the under-review copy — a revised topic
    // re-enters the corpus through a new submission.
    let approvedCorpusData = null;

    if (nextStatus === 'APPROVED') {
      const underReviewRow = await prismaClient.underReviewTopic.findUnique({
        where: { submissionId: id }
      });

      approvedCorpusData = await buildApprovedCorpusData({
        submission: existingSubmission,
        underReviewRow
      });
    }

    const updatedSubmission = await prismaClient.$transaction(async (tx) => {
      const updated = await tx.submission.update({
        where: { id },
        data: decisionData,
        include: decisionInclude
      });

      if (nextStatus === 'APPROVED') {
        await tx.currentSessionTopic.upsert({
          where: { submissionId: id },
          create: {
            ...approvedCorpusData,
            approvedDate: decisionData.decidedAt,
            studentId: String(updated.studentId),
            sourceType: 'submission',
            submissionId: id
          },
          update: {
            ...approvedCorpusData,
            approvedDate: decisionData.decidedAt,
            studentId: String(updated.studentId)
          }
        });
      }

      await tx.underReviewTopic.deleteMany({
        where: { submissionId: id }
      });

      return updated;
    });

    await corpusLifecycle.refreshResidentCorpusSafely('lecturer decision');

    await notificationEvents.notifyStudentOfSubmissionDecisionSafely({
      submission: updatedSubmission
    });

    return serializeSubmission(updatedSubmission, {
      includeDecision: true,
      includeDecisionActor: true
    });
  };

  const listLecturerDecisionHistory = async ({ user, query }) => {
    const decisionQuery = buildDecisionHistoryQuery({ user, query });

    const [items, total] = await Promise.all([
      prismaClient.submission.findMany({
        where: decisionQuery.where,
        orderBy: decisionQuery.orderBy,
        skip: decisionQuery.skip,
        take: decisionQuery.limit,
        include: {
          student: {
            select: {
              name: true,
              email: true
            }
          },
          similarityCheckSnapshots: {
            orderBy: {
              createdAt: 'desc'
            },
            select: {
              id: true
            },
            take: 1
          }
        }
      }),
      prismaClient.submission.count({
        where: decisionQuery.where
      })
    ]);

    const totalPages = total > 0 ? Math.ceil(total / decisionQuery.limit) : 0;

    return {
      data: {
        items: items.map(serializeLecturerDecision)
      },
      meta: {
        pagination: {
          page: decisionQuery.page,
          limit: decisionQuery.limit,
          total,
          totalPages,
          hasNextPage: decisionQuery.page < totalPages,
          hasPreviousPage: decisionQuery.page > 1
        },
        filters: decisionQuery.filters,
        generatedAt: new Date().toISOString(),
        dataCoverage: 'Read-only lecturer decision history from existing submissions.'
      }
    };
  };

  return {
    createSubmission,
    listStudentSubmissions,
    listLecturerPendingSubmissions,
    getLecturerSubmission,
    updateLecturerSubmissionStatus,
    listLecturerDecisionHistory
  };
}

module.exports = {
  ...createSubmissionService(),
  createSubmissionService,
  countWords,
  MAX_TITLE_WORDS,
  MIN_TITLE_WORDS,
  serializeSubmission,
  assertLecturerUser,
  LECTURER_STATUS_UPDATES,
  LECTURER_DECISION_STATUSES,
  validateDecisionReason,
  SubmissionServiceError
};
