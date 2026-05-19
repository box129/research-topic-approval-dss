const {
  createSubmissionService,
  countWords,
  serializeSubmission
} = require('./submission.service');

function createPrismaMock(overrides = {}) {
  return {
    academicSession: {
      findFirst: jest.fn(),
      ...overrides.academicSession
    },
    submission: {
      create: jest.fn(),
      findMany: jest.fn(),
      ...overrides.submission
    }
  };
}

const studentUser = {
  id: 7,
  role: 'student'
};

const lecturerUser = {
  id: 9,
  role: 'lecturer'
};

const validInput = {
  title: 'Knowledge of malaria prevention among undergraduate public health students',
  category: 'Public Health',
  keywords: 'malaria, prevention'
};

describe('submission.service', () => {
  test('counts words in normalized topic titles', () => {
    expect(countWords('  one two   three  ')).toBe(3);
  });

  test('authenticated student can create own pending submission', async () => {
    const createdAt = new Date('2026-05-19T10:00:00Z');
    const prisma = createPrismaMock({
      academicSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 3 })
      },
      submission: {
        create: jest.fn().mockResolvedValue({
          id: 11,
          studentId: studentUser.id,
          sessionId: 3,
          session: { id: 3, name: '2025/2026' },
          title: validInput.title,
          category: validInput.category,
          keywords: validInput.keywords,
          status: 'PENDING_REVIEW',
          submittedAt: createdAt,
          createdAt,
          updatedAt: createdAt
        })
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.createSubmission({
      user: studentUser,
      input: validInput
    });

    expect(prisma.submission.create).toHaveBeenCalledWith({
      data: {
        studentId: studentUser.id,
        sessionId: 3,
        title: validInput.title,
        category: validInput.category,
        keywords: validInput.keywords,
        status: 'PENDING_REVIEW'
      },
      include: {
        session: true
      }
    });
    expect(result).toMatchObject({
      id: 11,
      student_id: studentUser.id,
      session_id: 3,
      session_name: '2025/2026',
      status: 'pending_review'
    });
  });

  test('creates submission without session when no current session exists', async () => {
    const prisma = createPrismaMock({
      academicSession: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      submission: {
        create: jest.fn().mockResolvedValue({
          id: 12,
          studentId: studentUser.id,
          sessionId: null,
          session: null,
          title: validInput.title,
          category: null,
          keywords: null,
          status: 'PENDING_REVIEW',
          submittedAt: new Date('2026-05-19T10:00:00Z'),
          createdAt: new Date('2026-05-19T10:00:00Z'),
          updatedAt: new Date('2026-05-19T10:00:00Z')
        })
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    await service.createSubmission({
      user: studentUser,
      input: { title: validInput.title }
    });

    expect(prisma.submission.create.mock.calls[0][0].data.sessionId).toBeNull();
  });

  test.each([
    'lecturer',
    'admin'
  ])('%s cannot create student submission', async (role) => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.createSubmission({
      user: { id: 8, role },
      input: validInput
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  });

  test('requires title', async () => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.createSubmission({
      user: studentUser,
      input: { title: '   ' }
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'TITLE_REQUIRED',
      field: 'title'
    });
  });

  test('rejects titles below 7 words', async () => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.createSubmission({
      user: studentUser,
      input: { title: 'Too short topic title' }
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'TITLE_TOO_SHORT'
    });
  });

  test('rejects titles above 24 words', async () => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.createSubmission({
      user: studentUser,
      input: {
        title: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive'
      }
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'TITLE_TOO_LONG'
    });
  });

  test('student list only queries authenticated student submissions', async () => {
    const prisma = createPrismaMock({
      submission: {
        findMany: jest.fn().mockResolvedValue([])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    await service.listStudentSubmissions({ user: studentUser });

    expect(prisma.submission.findMany).toHaveBeenCalledWith({
      where: {
        studentId: studentUser.id
      },
      orderBy: {
        submittedAt: 'desc'
      },
      include: {
        session: true
      }
    });
  });

  test('lecturer can list pending review submissions with student details', async () => {
    const submittedAt = new Date('2026-05-19T10:00:00Z');
    const prisma = createPrismaMock({
      submission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            studentId: studentUser.id,
            sessionId: 3,
            session: { id: 3, name: '2025/2026' },
            student: {
              name: 'Student Demo',
              email: 'student.demo@uniosun.edu.ng'
            },
            title: validInput.title,
            category: validInput.category,
            keywords: validInput.keywords,
            status: 'PENDING_REVIEW',
            submittedAt,
            createdAt: submittedAt,
            updatedAt: submittedAt
          }
        ])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.listLecturerPendingSubmissions({ user: lecturerUser });

    expect(prisma.submission.findMany).toHaveBeenCalledWith({
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
    expect(result).toEqual([
      expect.objectContaining({
        id: 21,
        status: 'pending_review',
        student_name: 'Student Demo',
        student_email: 'student.demo@uniosun.edu.ng'
      })
    ]);
  });

  test.each([
    'student',
    'admin'
  ])('%s cannot list lecturer pending submissions', async (role) => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.listLecturerPendingSubmissions({
      user: { id: 8, role }
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  });

  test('serializes submission dates and status for API responses', () => {
    const date = new Date('2026-05-19T10:00:00Z');

    expect(serializeSubmission({
      id: 1,
      studentId: 2,
      sessionId: null,
      session: null,
      title: validInput.title,
      category: null,
      keywords: null,
      status: 'PENDING_REVIEW',
      student: {
        name: 'Student Demo',
        email: 'student.demo@uniosun.edu.ng'
      },
      submittedAt: date,
      createdAt: date,
      updatedAt: date
    })).toMatchObject({
      status: 'pending_review',
      student_name: 'Student Demo',
      student_email: 'student.demo@uniosun.edu.ng',
      submitted_at: '2026-05-19T10:00:00.000Z'
    });
  });
});
