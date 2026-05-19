const prisma = require('../config/database');

const MIN_TITLE_WORDS = 7;
const MAX_TITLE_WORDS = 24;

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

function serializeSubmission(submission) {
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

function createSubmissionService({ prismaClient = prisma } = {}) {
  const getCurrentSessionId = async () => {
    const session = await prismaClient.academicSession.findFirst({
      where: { isCurrent: true },
      select: { id: true }
    });

    return session?.id || null;
  };

  const createSubmission = async ({ user, input }) => {
    assertStudentUser(user);
    const title = validateSubmissionInput(input || {});
    const category = normalizeOptionalText(input?.category);
    const keywords = normalizeKeywords(input?.keywords);
    const sessionId = await getCurrentSessionId();

    const submission = await prismaClient.submission.create({
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

    return submissions.map(serializeSubmission);
  };

  return {
    createSubmission,
    listStudentSubmissions
  };
}

module.exports = {
  ...createSubmissionService(),
  createSubmissionService,
  countWords,
  MAX_TITLE_WORDS,
  MIN_TITLE_WORDS,
  serializeSubmission,
  SubmissionServiceError
};
