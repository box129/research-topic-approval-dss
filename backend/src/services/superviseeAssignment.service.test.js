const {
  SuperviseeAssignmentServiceError,
  createSuperviseeAssignmentService
} = require('./superviseeAssignment.service');

function createPrismaMock(overrides = {}) {
  return {
    user: {
      findUnique: jest.fn(),
      ...overrides.user
    },
    lecturerSuperviseeAssignment: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      ...overrides.lecturerSuperviseeAssignment
    },
    auditLog: {
      create: jest.fn(),
      ...overrides.auditLog
    }
  };
}

const adminUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@example.edu',
  role: 'admin'
};

const lecturerRecord = {
  id: 2,
  name: 'Lecturer One',
  email: 'lecturer.one@example.edu',
  role: 'LECTURER',
  status: 'ACTIVE'
};

const otherLecturerRecord = {
  id: 5,
  name: 'Lecturer Two',
  email: 'lecturer.two@example.edu',
  role: 'LECTURER',
  status: 'ACTIVE'
};

const studentRecord = {
  id: 3,
  name: 'Student One',
  email: 'student.one@example.edu',
  role: 'STUDENT',
  status: 'ACTIVE'
};

const assignmentDate = new Date('2026-06-22T09:00:00.000Z');

function makeAssignment(overrides = {}) {
  return {
    id: 10,
    lecturerId: lecturerRecord.id,
    lecturer: lecturerRecord,
    studentId: studentRecord.id,
    student: studentRecord,
    assignedById: adminUser.id,
    assignedBy: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: 'ADMIN',
      status: 'ACTIVE'
    },
    isActive: true,
    assignedAt: assignmentDate,
    endedAt: null,
    notes: 'Assigned after department review.',
    createdAt: assignmentDate,
    updatedAt: assignmentDate,
    ...overrides
  };
}

describe('superviseeAssignment.service', () => {
  test('create assignment succeeds with real active lecturer, student, and admin actor', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(lecturerRecord)
          .mockResolvedValueOnce(studentRecord)
      },
      lecturerSuperviseeAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(makeAssignment())
      }
    });
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue({}) };
    const service = createSuperviseeAssignmentService({ prismaClient: prisma, audit });

    const result = await service.createAssignment({
      actor: adminUser,
      input: {
        lecturerId: lecturerRecord.id,
        studentId: studentRecord.id,
        notes: ' Assigned after department review. '
      },
      req: { user: adminUser }
    });

    expect(prisma.lecturerSuperviseeAssignment.create).toHaveBeenCalledWith({
      data: {
        lecturerId: lecturerRecord.id,
        studentId: studentRecord.id,
        assignedById: adminUser.id,
        notes: 'Assigned after department review.'
      },
      include: expect.any(Object)
    });
    expect(audit.createAuditLogSafely).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'SUPERVISEE_ASSIGNED',
      targetType: 'LecturerSuperviseeAssignment',
      targetId: '10'
    }));
    expect(result).toMatchObject({
      id: 10,
      status: 'active',
      lecturer: {
        id: lecturerRecord.id,
        role: 'lecturer'
      },
      student: {
        id: studentRecord.id,
        role: 'student'
      }
    });
    expect(result.student).not.toHaveProperty('passwordHash');
    expect(result.student).not.toHaveProperty('resetTokenHash');
  });

  test('rejects non-lecturer lecturerId', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ ...studentRecord, id: 4 })
          .mockResolvedValueOnce(studentRecord)
      }
    });
    const service = createSuperviseeAssignmentService({ prismaClient: prisma });

    await expect(service.createAssignment({
      actor: adminUser,
      input: {
        lecturerId: 4,
        studentId: studentRecord.id
      }
    })).rejects.toMatchObject({
      code: 'SUPERVISEE_ASSIGNMENT_LECTURER_ROLE_REQUIRED',
      field: 'lecturerId'
    });
  });

  test('rejects non-student studentId', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(lecturerRecord)
          .mockResolvedValueOnce(otherLecturerRecord)
      }
    });
    const service = createSuperviseeAssignmentService({ prismaClient: prisma });

    await expect(service.createAssignment({
      actor: adminUser,
      input: {
        lecturerId: lecturerRecord.id,
        studentId: otherLecturerRecord.id
      }
    })).rejects.toMatchObject({
      code: 'SUPERVISEE_ASSIGNMENT_STUDENT_ROLE_REQUIRED',
      field: 'studentId'
    });
  });

  test('rejects duplicate active assignment', async () => {
    const prisma = createPrismaMock({
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(lecturerRecord)
          .mockResolvedValueOnce(studentRecord)
      },
      lecturerSuperviseeAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 9 })
      }
    });
    const service = createSuperviseeAssignmentService({ prismaClient: prisma });

    await expect(service.createAssignment({
      actor: adminUser,
      input: {
        lecturerId: lecturerRecord.id,
        studentId: studentRecord.id
      }
    })).rejects.toMatchObject({
      code: 'SUPERVISEE_ASSIGNMENT_DUPLICATE_ACTIVE',
      statusCode: 409
    });
  });

  test('lecturer can list only own assigned supervisees with latest real submission summary', async () => {
    const latestSubmission = {
      id: 71,
      title: 'Knowledge of malaria prevention among undergraduate public health students',
      category: 'Public Health',
      status: 'PENDING_REVIEW',
      submittedAt: new Date('2026-06-22T08:00:00.000Z'),
      decidedAt: null
    };
    const prisma = createPrismaMock({
      lecturerSuperviseeAssignment: {
        findMany: jest.fn().mockResolvedValue([
          makeAssignment({
            student: {
              ...studentRecord,
              studentSubmissions: [latestSubmission]
            }
          })
        ])
      }
    });
    const service = createSuperviseeAssignmentService({ prismaClient: prisma });

    const result = await service.listLecturerSupervisees({
      user: { id: lecturerRecord.id, role: 'lecturer' }
    });

    expect(prisma.lecturerSuperviseeAssignment.findMany).toHaveBeenCalledWith({
      where: {
        lecturerId: lecturerRecord.id,
        isActive: true
      },
      include: expect.any(Object),
      orderBy: { assignedAt: 'desc' }
    });
    expect(result.data.items).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({
          id: studentRecord.id,
          email: studentRecord.email
        }),
        latestSubmission: {
          id: 71,
          title: latestSubmission.title,
          category: 'Public Health',
          status: 'pending_review',
          submittedAt: '2026-06-22T08:00:00.000Z',
          decidedAt: null
        }
      })
    ]);
    expect(result.data.items[0].student).not.toHaveProperty('passwordHash');
  });

  test('lecturer cannot see another lecturer supervisees because query is scoped to actor id', async () => {
    const prisma = createPrismaMock({
      lecturerSuperviseeAssignment: {
        findMany: jest.fn().mockResolvedValue([])
      }
    });
    const service = createSuperviseeAssignmentService({ prismaClient: prisma });

    await service.listLecturerSupervisees({
      user: { id: otherLecturerRecord.id, role: 'lecturer' }
    });

    expect(prisma.lecturerSuperviseeAssignment.findMany.mock.calls[0][0].where).toEqual({
      lecturerId: otherLecturerRecord.id,
      isActive: true
    });
  });

  test('deactivation ends assignment instead of deleting it', async () => {
    const prisma = createPrismaMock({
      lecturerSuperviseeAssignment: {
        findUnique: jest.fn().mockResolvedValue(makeAssignment()),
        update: jest.fn().mockResolvedValue(makeAssignment({
          isActive: false,
          endedAt: new Date('2026-06-22T11:00:00.000Z')
        }))
      }
    });
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue({}) };
    const service = createSuperviseeAssignmentService({ prismaClient: prisma, audit });

    const result = await service.endAssignment({
      id: 10,
      actor: adminUser,
      req: { user: adminUser }
    });

    expect(prisma.lecturerSuperviseeAssignment.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        isActive: false,
        endedAt: expect.any(Date)
      },
      include: expect.any(Object)
    });
    expect(result).toMatchObject({
      id: 10,
      isActive: false,
      status: 'ended',
      endedAt: '2026-06-22T11:00:00.000Z'
    });
    expect(audit.createAuditLogSafely).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'SUPERVISEE_ASSIGNMENT_ENDED'
    }));
  });

  test('non-lecturer cannot list lecturer supervisees', async () => {
    const service = createSuperviseeAssignmentService({ prismaClient: createPrismaMock() });

    await expect(service.listLecturerSupervisees({
      user: { id: 1, role: 'admin' }
    })).rejects.toBeInstanceOf(SuperviseeAssignmentServiceError);
  });
});
