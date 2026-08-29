const prisma = require('../config/database');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  // Students are identified by matric number; null for lecturers and admins.
  matricNumber: true,
  role: true,
  status: true
};

class SuperviseeAssignmentServiceError extends Error {
  constructor(message, { code = 'SUPERVISEE_ASSIGNMENT_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'SuperviseeAssignmentServiceError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function toIso(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toClientEnum(value) {
  return String(value || '').toLowerCase();
}

function parsePositiveId(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new SuperviseeAssignmentServiceError(`${field} must be a positive integer.`, {
      code: 'SUPERVISEE_ASSIGNMENT_INVALID_ID',
      field
    });
  }

  return parsed;
}

function normalizeNotes(value) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeStatusFilter(value) {
  const normalized = String(value || 'active').trim().toLowerCase();
  if (normalized === 'all' || normalized === 'active' || normalized === 'ended') {
    return normalized;
  }

  throw new SuperviseeAssignmentServiceError('Assignment status filter is invalid.', {
    code: 'SUPERVISEE_ASSIGNMENT_INVALID_STATUS',
    field: 'status'
  });
}

function normalizeBoolean(value, field) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new SuperviseeAssignmentServiceError(`${field} must be a boolean.`, {
    code: 'SUPERVISEE_ASSIGNMENT_INVALID_BOOLEAN',
    field
  });
}

function normalizePositiveInteger(value, { defaultValue, field, max }) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new SuperviseeAssignmentServiceError(`${field} must be a positive integer.`, {
      code: 'SUPERVISEE_ASSIGNMENT_INVALID_PAGINATION',
      field
    });
  }

  if (max && parsed > max) {
    throw new SuperviseeAssignmentServiceError(`${field} cannot exceed ${max}.`, {
      code: 'SUPERVISEE_ASSIGNMENT_INVALID_PAGINATION',
      field
    });
  }

  return parsed;
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    matricNumber: user.matricNumber || null,
    role: toClientEnum(user.role),
    status: toClientEnum(user.status)
  };
}

function serializeLatestSubmission(submission) {
  if (!submission) {
    return null;
  }

  return {
    id: submission.id,
    title: submission.title,
    category: submission.category || null,
    status: toClientEnum(submission.status),
    submittedAt: toIso(submission.submittedAt),
    decidedAt: toIso(submission.decidedAt)
  };
}

function serializeAssignment(assignment) {
  if (!assignment) {
    return null;
  }

  return {
    id: assignment.id,
    lecturer: serializeUser(assignment.lecturer),
    student: serializeUser(assignment.student),
    assignedBy: serializeUser(assignment.assignedBy),
    isActive: Boolean(assignment.isActive),
    status: assignment.isActive ? 'active' : 'ended',
    assignedAt: toIso(assignment.assignedAt),
    endedAt: toIso(assignment.endedAt),
    notes: assignment.notes || null,
    latestSubmission: serializeLatestSubmission(assignment.student?.studentSubmissions?.[0]),
    createdAt: toIso(assignment.createdAt),
    updatedAt: toIso(assignment.updatedAt)
  };
}

function createPagination({ page, limit, total }) {
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0
  };
}

function buildAssignmentInclude({ includeLatestSubmission = false } = {}) {
  return {
    lecturer: { select: USER_SAFE_SELECT },
    student: {
      select: {
        ...USER_SAFE_SELECT,
        ...(includeLatestSubmission ? {
          studentSubmissions: {
            orderBy: { submittedAt: 'desc' },
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              submittedAt: true,
              decidedAt: true
            },
            take: 1
          }
        } : {})
      }
    },
    assignedBy: { select: USER_SAFE_SELECT }
  };
}

async function getUserById(prismaClient, id) {
  return prismaClient.user.findUnique({
    where: { id },
    select: USER_SAFE_SELECT
  });
}

function assertRole(user, role, field) {
  if (!user) {
    throw new SuperviseeAssignmentServiceError(`${field} user was not found.`, {
      code: 'SUPERVISEE_ASSIGNMENT_USER_NOT_FOUND',
      field,
      statusCode: 404
    });
  }

  if (user.role !== role) {
    throw new SuperviseeAssignmentServiceError(`${field} must reference a ${role.toLowerCase()} user.`, {
      code: role === 'LECTURER'
        ? 'SUPERVISEE_ASSIGNMENT_LECTURER_ROLE_REQUIRED'
        : 'SUPERVISEE_ASSIGNMENT_STUDENT_ROLE_REQUIRED',
      field
    });
  }

  if (user.status !== 'ACTIVE') {
    throw new SuperviseeAssignmentServiceError(`${field} must reference an active user.`, {
      code: 'SUPERVISEE_ASSIGNMENT_ACTIVE_USER_REQUIRED',
      field
    });
  }
}

function createSuperviseeAssignmentService({
  prismaClient = prisma,
  audit = { createAuditLogSafely }
} = {}) {
  const assertNoDuplicateActiveAssignment = async ({ lecturerId, studentId, excludeId }) => {
    const existing = await prismaClient.lecturerSuperviseeAssignment.findFirst({
      where: {
        lecturerId,
        studentId,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      select: { id: true }
    });

    if (existing) {
      throw new SuperviseeAssignmentServiceError('An active assignment already exists for this lecturer and student.', {
        code: 'SUPERVISEE_ASSIGNMENT_DUPLICATE_ACTIVE',
        field: 'studentId',
        statusCode: 409
      });
    }
  };

  const listAssignments = async (query = {}) => {
    const page = normalizePositiveInteger(query.page, {
      defaultValue: DEFAULT_PAGE,
      field: 'page'
    });
    const limit = normalizePositiveInteger(query.limit, {
      defaultValue: DEFAULT_LIMIT,
      field: 'limit',
      max: MAX_LIMIT
    });
    const status = normalizeStatusFilter(query.status);
    const lecturerId = query.lecturerId ? parsePositiveId(query.lecturerId, 'lecturerId') : null;
    const studentId = query.studentId ? parsePositiveId(query.studentId, 'studentId') : null;
    const where = {
      ...(status !== 'all' ? { isActive: status === 'active' } : {}),
      ...(lecturerId ? { lecturerId } : {}),
      ...(studentId ? { studentId } : {})
    };

    const [items, total] = await Promise.all([
      prismaClient.lecturerSuperviseeAssignment.findMany({
        where,
        include: buildAssignmentInclude(),
        orderBy: [
          { isActive: 'desc' },
          { assignedAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prismaClient.lecturerSuperviseeAssignment.count({ where })
    ]);

    return {
      data: { items: items.map(serializeAssignment) },
      meta: {
        pagination: createPagination({ page, limit, total }),
        filters: {
          status,
          lecturerId,
          studentId
        },
        generatedAt: new Date().toISOString(),
        dataCoverage: 'Real lecturer-supervisee assignments from LecturerSuperviseeAssignment records.'
      }
    };
  };

  const createAssignment = async ({ actor, input = {}, req }) => {
    const lecturerId = parsePositiveId(input.lecturerId, 'lecturerId');
    const studentId = parsePositiveId(input.studentId, 'studentId');
    const notes = normalizeNotes(input.notes);

    if (lecturerId === studentId) {
      throw new SuperviseeAssignmentServiceError('Lecturer and student must be different users.', {
        code: 'SUPERVISEE_ASSIGNMENT_SELF_ASSIGNMENT_FORBIDDEN',
        field: 'studentId'
      });
    }

    const [lecturer, student] = await Promise.all([
      getUserById(prismaClient, lecturerId),
      getUserById(prismaClient, studentId)
    ]);

    assertRole(lecturer, 'LECTURER', 'lecturerId');
    assertRole(student, 'STUDENT', 'studentId');
    await assertNoDuplicateActiveAssignment({ lecturerId, studentId });

    const assignment = await prismaClient.lecturerSuperviseeAssignment.create({
      data: {
        lecturerId,
        studentId,
        assignedById: actor?.id || null,
        notes
      },
      include: buildAssignmentInclude()
    });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.SUPERVISEE_ASSIGNED,
      ...buildAuditContextFromRequest(req),
      targetType: 'LecturerSuperviseeAssignment',
      targetId: String(assignment.id),
      metadata: {
        assignmentId: assignment.id,
        lecturerId,
        studentId,
        assignedById: actor?.id || null
      }
    });

    return serializeAssignment(assignment);
  };

  const updateAssignment = async ({ id: idValue, actor, input = {}, req }) => {
    const id = parsePositiveId(idValue, 'id');
    const existing = await prismaClient.lecturerSuperviseeAssignment.findUnique({
      where: { id },
      include: buildAssignmentInclude()
    });

    if (!existing) {
      return null;
    }

    const data = {};
    const notes = normalizeNotes(input.notes);
    if (notes !== undefined) {
      data.notes = notes;
    }

    if (input.isActive !== undefined) {
      const nextActive = normalizeBoolean(input.isActive, 'isActive');
      if (nextActive && !existing.isActive) {
        await assertNoDuplicateActiveAssignment({
          lecturerId: existing.lecturerId,
          studentId: existing.studentId,
          excludeId: id
        });
      }

      data.isActive = nextActive;
      data.endedAt = nextActive ? null : (existing.endedAt || new Date());
    }

    if (Object.keys(data).length === 0) {
      return serializeAssignment(existing);
    }

    const updated = await prismaClient.lecturerSuperviseeAssignment.update({
      where: { id },
      data,
      include: buildAssignmentInclude()
    });

    await audit.createAuditLogSafely({
      eventType: updated.isActive
        ? AUDIT_EVENT_TYPES.SUPERVISEE_ASSIGNMENT_UPDATED
        : AUDIT_EVENT_TYPES.SUPERVISEE_ASSIGNMENT_ENDED,
      ...buildAuditContextFromRequest(req),
      targetType: 'LecturerSuperviseeAssignment',
      targetId: String(id),
      metadata: {
        assignmentId: id,
        lecturerId: updated.lecturer?.id || existing.lecturerId,
        studentId: updated.student?.id || existing.studentId,
        actorId: actor?.id || null,
        isActive: updated.isActive
      }
    });

    return serializeAssignment(updated);
  };

  const endAssignment = async ({ id, actor, req }) => updateAssignment({
    id,
    actor,
    input: { isActive: false },
    req
  });

  const listLecturerSupervisees = async ({ user }) => {
    if (!user) {
      throw new SuperviseeAssignmentServiceError('Authentication required.', {
        code: 'AUTHENTICATION_REQUIRED',
        statusCode: 401
      });
    }

    if (user.role !== 'lecturer') {
      throw new SuperviseeAssignmentServiceError('Only lecturers can access assigned supervisees.', {
        code: 'FORBIDDEN',
        statusCode: 403
      });
    }

    const items = await prismaClient.lecturerSuperviseeAssignment.findMany({
      where: {
        lecturerId: user.id,
        isActive: true
      },
      include: buildAssignmentInclude({ includeLatestSubmission: true }),
      orderBy: { assignedAt: 'desc' }
    });

    return {
      data: {
        items: items.map(serializeAssignment)
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataCoverage: 'Active supervisee assignments for the authenticated lecturer.',
        assignmentSource: 'LecturerSuperviseeAssignment'
      }
    };
  };

  return {
    createAssignment,
    endAssignment,
    listAssignments,
    listLecturerSupervisees,
    updateAssignment
  };
}

module.exports = {
  ...createSuperviseeAssignmentService(),
  createSuperviseeAssignmentService,
  serializeAssignment,
  SuperviseeAssignmentServiceError
};
