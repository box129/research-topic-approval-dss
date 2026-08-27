const {
  createSubmissionService,
  countWords,
  serializeSubmission,
  validateDecisionReason,
  MAX_DECISION_REASON_LENGTH
} = require('./submission.service');
const { documentMetadata, VoyageProviderError, validStoredEmbedding } = require('./voyageEmbedding.service');
const { buildSubmissionTopicShape } = require('./topicCorpusLifecycle.service');

function createPrismaMock(overrides = {}) {
  const prismaMock = {
    academicSession: {
      findFirst: jest.fn(),
      ...overrides.academicSession
    },
    submission: {
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      ...overrides.submission
    },
    underReviewTopic: {
      create: jest.fn().mockResolvedValue({ id: 501 }),
      findUnique: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.underReviewTopic
    },
    currentSessionTopic: {
      upsert: jest.fn().mockResolvedValue({ id: 601 }),
      ...overrides.currentSessionTopic
    },
    auditLog: {
      create: jest.fn(),
      ...overrides.auditLog
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      ...overrides.user
    },
    notification: {
      create: jest.fn(),
      ...overrides.notification
    }
  };

  prismaMock.$transaction = jest.fn(async (callback) => callback(prismaMock));

  return prismaMock;
}

const TEST_VECTOR = Array(1024).fill(0).map((_, index) => (index === 0 ? 1 : 0));

function createCorpusLifecycleMock(overrides = {}) {
  return {
    buildSubmissionTopicShape,
    prepareDocumentEmbedding: jest.fn((topicShape) => Promise.resolve(documentMetadata(topicShape, TEST_VECTOR))),
    refreshResidentCorpusSafely: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

function buildValidUnderReviewRow(submissionId, shape) {
  return {
    id: 501,
    ...shape,
    sessionYear: '2025/2026',
    supervisorName: '',
    sourceType: 'submission',
    reviewStartedAt: new Date('2026-05-19T10:00:00Z'),
    submissionId,
    ...documentMetadata(shape, TEST_VECTOR)
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
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

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
        // No context was supplied, so the semantic fields are persisted as
        // genuinely absent and the representation stays title-only.
        population: null,
        location: null,
        studyFocus: null,
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

  test('student submission atomically persists an embedded under-review corpus record', async () => {
    const createdAt = new Date('2026-05-19T10:00:00Z');
    const prisma = createPrismaMock({
      academicSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 3, name: '2025/2026' })
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
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    await service.createSubmission({ user: studentUser, input: validInput });

    expect(corpusLifecycle.prepareDocumentEmbedding).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.underReviewTopic.create).toHaveBeenCalledTimes(1);

    const underReviewData = prisma.underReviewTopic.create.mock.calls[0][0].data;
    expect(underReviewData).toMatchObject({
      title: validInput.title,
      category: validInput.category,
      sessionYear: '2025/2026',
      supervisorName: '',
      sourceType: 'submission',
      reviewStartedAt: createdAt,
      submissionId: 11,
      embedding: TEST_VECTOR,
      embeddingProvider: 'voyage',
      embeddingModel: 'voyage-4-large',
      embeddingDimension: 1024
    });
    expect(underReviewData.embeddingSourceHash).toEqual(expect.any(String));
    expect(corpusLifecycle.refreshResidentCorpusSafely).toHaveBeenCalled();
  });

  test('submission fails honestly and persists nothing when Voyage embedding is unavailable', async () => {
    const prisma = createPrismaMock({
      academicSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 3, name: '2025/2026' })
      }
    });
    const corpusLifecycle = createCorpusLifecycleMock({
      prepareDocumentEmbedding: jest.fn().mockRejectedValue(new VoyageProviderError('Voyage embedding request failed (503).', 503))
    });
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    await expect(service.createSubmission({
      user: studentUser,
      input: validInput
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'SEMANTIC_SYNC_UNAVAILABLE'
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.submission.create).not.toHaveBeenCalled();
    expect(prisma.underReviewTopic.create).not.toHaveBeenCalled();
  });

  test('student submission notifies real reviewer roles through event hook', async () => {
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
    const notificationEvents = {
      notifyReviewersOfSubmissionCreatedSafely: jest.fn().mockResolvedValue({
        created: 2,
        recipientCount: 2
      })
    };
    const service = createSubmissionService({ prismaClient: prisma, notificationEvents, corpusLifecycle: createCorpusLifecycleMock() });

    const result = await service.createSubmission({
      user: studentUser,
      input: validInput
    });

    expect(result.id).toBe(11);
    expect(notificationEvents.notifyReviewersOfSubmissionCreatedSafely).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: 11,
        studentId: studentUser.id,
        status: 'PENDING_REVIEW'
      }),
      actorUser: studentUser
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
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle: createCorpusLifecycleMock() });

    await service.createSubmission({
      user: studentUser,
      input: { title: validInput.title }
    });

    expect(prisma.submission.create.mock.calls[0][0].data.sessionId).toBeNull();
    expect(prisma.underReviewTopic.create.mock.calls[0][0].data.sessionYear).toBe('');
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
    const decidedAt = new Date('2026-05-22T13:30:00Z');
    const prisma = createPrismaMock({
      submission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 31,
            studentId: studentUser.id,
            sessionId: 3,
            session: { id: 3, name: '2025/2026' },
            title: validInput.title,
            category: validInput.category,
            keywords: validInput.keywords,
            status: 'REJECTED',
            decisionReason: 'Topic is too similar to approved work.',
            decidedById: lecturerUser.id,
            decidedBy: {
              name: 'Lecturer Demo'
            },
            decidedAt,
            similarityCheckSnapshots: [
              {
                id: 99,
                overallRisk: 'HIGH'
              }
            ],
            submittedAt: decidedAt,
            createdAt: decidedAt,
            updatedAt: decidedAt
          }
        ])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.listStudentSubmissions({ user: studentUser });

    expect(prisma.submission.findMany).toHaveBeenCalledWith({
      where: {
        studentId: studentUser.id
      },
      orderBy: {
        submittedAt: 'desc'
      },
      include: {
        session: true,
        revisionOf: true,
        revision: true
      }
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 31,
        student_id: studentUser.id,
        status: 'rejected',
        decision_reason: 'Topic is too similar to approved work.',
        decided_at: '2026-05-22T13:30:00.000Z'
      })
    ]);
    expect(result[0]).not.toHaveProperty('decided_by_id');
    expect(result[0]).not.toHaveProperty('decided_by_name');
    expect(result[0]).not.toHaveProperty('similarityCheckSnapshots');
    expect(result[0]).not.toHaveProperty('similarity_snapshots');
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
        revisionOf: true,
        student: {
          select: {
            name: true,
            matricNumber: true,
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

  test('lecturer decision history lists only decisions made by the authenticated lecturer', async () => {
    const submittedAt = new Date('2026-05-19T10:00:00Z');
    const decidedAt = new Date('2026-05-22T10:00:00Z');
    const prisma = createPrismaMock({
      submission: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 41,
            title: validInput.title,
            category: validInput.category,
            status: 'APPROVED',
            decisionReason: null,
            decidedById: lecturerUser.id,
            decidedAt,
            submittedAt,
            student: {
              name: 'Student Demo',
              email: 'student.demo@uniosun.edu.ng'
            },
            similarityCheckSnapshots: [
              { id: 91 }
            ]
          }
        ])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.listLecturerDecisionHistory({
      user: lecturerUser,
      query: {
        page: '1',
        limit: '10',
        sort: 'decidedAt',
        direction: 'desc'
      }
    });

    expect(prisma.submission.findMany).toHaveBeenCalledWith({
      where: {
        decidedById: lecturerUser.id,
        decidedAt: {
          not: null
        },
        status: {
          in: ['APPROVED', 'REJECTED', 'AWAITING_REVISION']
        }
      },
      orderBy: {
        decidedAt: 'desc'
      },
      skip: 0,
      take: 10,
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
    });
    expect(prisma.submission.count).toHaveBeenCalledWith({
      where: prisma.submission.findMany.mock.calls[0][0].where
    });
    expect(result.data.items).toEqual([
      {
        id: 41,
        title: validInput.title,
        studentName: 'Student Demo',
        studentEmail: 'student.demo@uniosun.edu.ng',
        category: validInput.category,
        status: 'APPROVED',
        submittedAt: '2026-05-19T10:00:00.000Z',
        decidedAt: '2026-05-22T10:00:00.000Z',
        decisionFeedback: null,
        similaritySnapshotId: 91
      }
    ]);
    expect(result.meta.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(result.data.items[0]).not.toHaveProperty('passwordHash');
    expect(result.data.items[0]).not.toHaveProperty('resetTokenHash');
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test('lecturer decision history applies filters, search, sort, and pagination', async () => {
    const prisma = createPrismaMock({
      submission: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.listLecturerDecisionHistory({
      user: lecturerUser,
      query: {
        status: 'rejected',
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-31T23:59:59.000Z',
        category: 'Public Health',
        search: 'malaria',
        page: '2',
        limit: '5',
        sort: 'submittedAt',
        direction: 'asc'
      }
    });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        decidedById: lecturerUser.id,
        decidedAt: {
          not: null,
          gte: expect.any(Date),
          lte: expect.any(Date)
        },
        status: 'REJECTED',
        category: {
          equals: 'Public Health',
          mode: 'insensitive'
        },
        OR: expect.any(Array)
      }),
      orderBy: {
        submittedAt: 'asc'
      },
      skip: 5,
      take: 5
    }));
    expect(result).toMatchObject({
      data: {
        items: []
      },
      meta: {
        pagination: {
          page: 2,
          limit: 5,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true
        },
        filters: {
          status: 'rejected',
          dateFrom: '2026-05-01T00:00:00.000Z',
          dateTo: '2026-05-31T23:59:59.000Z',
          category: 'Public Health',
          search: 'malaria',
          sort: 'submittedAt',
          direction: 'asc'
        },
        dataCoverage: 'Read-only lecturer decision history from existing submissions.'
      }
    });
  });

  test('lecturer decision history returns an honest empty list', async () => {
    const prisma = createPrismaMock({
      submission: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.listLecturerDecisionHistory({
      user: lecturerUser,
      query: {}
    });

    expect(result.data.items).toEqual([]);
    expect(result.meta.pagination).toMatchObject({
      total: 0,
      totalPages: 0
    });
  });

  test('lecturer decision history rejects unsupported filters', async () => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.listLecturerDecisionHistory({
      user: lecturerUser,
      query: {
        status: 'pending_review'
      }
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_DECISION_STATUS_FILTER',
      field: 'status'
    });

    await expect(service.listLecturerDecisionHistory({
      user: lecturerUser,
      query: {
        sort: 'studentEmail'
      }
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_DECISION_SORT',
      field: 'sort'
    });
  });

  test('lecturer can fetch submission detail by id', async () => {
    const submittedAt = new Date('2026-05-19T10:00:00Z');
    const prisma = createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue({
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
          status: 'APPROVED',
          decisionReason: null,
          decidedById: null,
          decidedBy: null,
          decidedAt: null,
          submittedAt,
          createdAt: submittedAt,
          updatedAt: submittedAt
        })
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const result = await service.getLecturerSubmission({
      user: lecturerUser,
      submissionId: 21
    });

    expect(prisma.submission.findUnique).toHaveBeenCalledWith({
      where: { id: 21 },
      include: {
        session: true,
        decidedBy: {
          select: {
            name: true
          }
        },
        revisionOf: true,
        revision: true,
        student: {
          select: {
            name: true,
            matricNumber: true,
            email: true
          }
        }
      }
    });
    expect(result).toMatchObject({
      id: 21,
      status: 'approved',
      session_name: '2025/2026',
      student_name: 'Student Demo',
      student_email: 'student.demo@uniosun.edu.ng',
      decision_reason: null,
      decided_by_id: null,
      decided_by_name: null,
      decided_at: null
    });
  });

  test('lecturer detail fetch rejects invalid id', async () => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.getLecturerSubmission({
      user: lecturerUser,
      submissionId: 'abc'
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_SUBMISSION_ID',
      field: 'id'
    });
  });

  test('lecturer detail fetch returns 404 for nonexistent submission', async () => {
    const prisma = createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    await expect(service.getLecturerSubmission({
      user: lecturerUser,
      submissionId: 999
    })).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBMISSION_NOT_FOUND'
    });
  });

  test.each([
    'student',
    'admin'
  ])('%s cannot fetch lecturer submission detail', async (role) => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.getLecturerSubmission({
      user: { id: 8, role },
      submissionId: 21
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  });

  test.each([
    ['approved', 'APPROVED', undefined, null],
    ['rejected', 'REJECTED', '  Topic is too similar to approved work.  ', 'Topic is too similar to approved work.'],
    ['awaiting_revision', 'AWAITING_REVISION', '  Narrow the population and state the study design.  ', 'Narrow the population and state the study design.']
  ])('lecturer can update pending submission to %s', async (clientStatus, prismaStatus, reason, expectedReason) => {
    const updatedAt = new Date('2026-05-19T12:00:00Z');
    const decidedAt = new Date('2026-05-19T12:05:00Z');
    const reviewShape = buildSubmissionTopicShape(validInput);
    const prisma = createPrismaMock({
      underReviewTopic: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(buildValidUnderReviewRow(21, reviewShape)),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      submission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 21,
          status: 'PENDING_REVIEW',
          studentId: studentUser.id,
          title: validInput.title,
          category: validInput.category,
          keywords: validInput.keywords,
          session: { id: 3, name: '2025/2026' }
        }),
        update: jest.fn().mockResolvedValue({
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
          status: prismaStatus,
          decisionReason: expectedReason,
          decidedById: lecturerUser.id,
          decidedBy: {
            name: 'Lecturer Demo'
          },
          decidedAt,
          submittedAt: updatedAt,
          createdAt: updatedAt,
          updatedAt
        })
      }
    });
    const notificationEvents = {
      notifyStudentOfSubmissionDecisionSafely: jest.fn().mockResolvedValue({ created: 1 })
    };
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({ prismaClient: prisma, notificationEvents, corpusLifecycle });

    const result = await service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: clientStatus,
      reason
    });

    expect(prisma.submission.findUnique).toHaveBeenCalledWith({
      where: { id: 21 },
      include: {
        session: true
      }
    });
    expect(prisma.underReviewTopic.deleteMany).toHaveBeenCalledWith({
      where: { submissionId: 21 }
    });
    if (prismaStatus === 'APPROVED') {
      expect(prisma.currentSessionTopic.upsert).toHaveBeenCalledTimes(1);
    } else {
      expect(prisma.currentSessionTopic.upsert).not.toHaveBeenCalled();
    }
    expect(prisma.submission.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        status: prismaStatus,
        decisionReason: expectedReason,
        decidedById: lecturerUser.id,
        decidedAt: expect.any(Date)
      },
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
    expect(result).toMatchObject({
      id: 21,
      status: clientStatus,
      decision_reason: expectedReason,
      decided_by_id: lecturerUser.id,
      decided_by_name: 'Lecturer Demo',
      decided_at: '2026-05-19T12:05:00.000Z',
      student_name: 'Student Demo',
      student_email: 'student.demo@uniosun.edu.ng'
    });
    expect(notificationEvents.notifyStudentOfSubmissionDecisionSafely).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: 21,
        studentId: studentUser.id,
        status: prismaStatus,
        decidedById: lecturerUser.id
      })
    });
  });

  function createDecisionPrismaMock({ underReviewRow }) {
    const decidedAt = new Date('2026-05-19T12:05:00Z');

    return createPrismaMock({
      underReviewTopic: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(underReviewRow),
        deleteMany: jest.fn().mockResolvedValue({ count: underReviewRow ? 1 : 0 })
      },
      submission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 21,
          status: 'PENDING_REVIEW',
          studentId: studentUser.id,
          title: validInput.title,
          category: validInput.category,
          keywords: validInput.keywords,
          session: { id: 3, name: '2025/2026' }
        }),
        update: jest.fn().mockResolvedValue({
          id: 21,
          studentId: studentUser.id,
          sessionId: 3,
          session: { id: 3, name: '2025/2026' },
          student: { name: 'Student Demo', email: 'student.demo@uniosun.edu.ng' },
          title: validInput.title,
          category: validInput.category,
          keywords: validInput.keywords,
          status: 'APPROVED',
          decisionReason: null,
          decidedById: lecturerUser.id,
          decidedBy: { name: 'Lecturer Demo' },
          decidedAt,
          submittedAt: decidedAt,
          createdAt: decidedAt,
          updatedAt: decidedAt
        })
      }
    });
  }

  test('approval reuses the valid stored under-review embedding without a new Voyage call', async () => {
    const reviewShape = buildSubmissionTopicShape(validInput);
    const underReviewRow = buildValidUnderReviewRow(21, reviewShape);
    const prisma = createDecisionPrismaMock({ underReviewRow });
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({
      prismaClient: prisma,
      notificationEvents: { notifyStudentOfSubmissionDecisionSafely: jest.fn().mockResolvedValue({ created: 1 }) },
      corpusLifecycle
    });

    await service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'approved'
    });

    expect(corpusLifecycle.prepareDocumentEmbedding).not.toHaveBeenCalled();
    const upsertArgs = prisma.currentSessionTopic.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ submissionId: 21 });
    expect(upsertArgs.create).toMatchObject({
      title: validInput.title,
      submissionId: 21,
      sourceType: 'submission',
      embedding: TEST_VECTOR,
      embeddingSourceHash: underReviewRow.embeddingSourceHash
    });
    expect(prisma.underReviewTopic.deleteMany).toHaveBeenCalledWith({ where: { submissionId: 21 } });
    expect(corpusLifecycle.refreshResidentCorpusSafely).toHaveBeenCalled();
  });

  test('approval regenerates the embedding when the stored under-review vector is stale', async () => {
    const reviewShape = buildSubmissionTopicShape(validInput);
    const staleRow = {
      ...buildValidUnderReviewRow(21, reviewShape),
      embeddingSourceHash: 'stale-source-hash'
    };
    const prisma = createDecisionPrismaMock({ underReviewRow: staleRow });
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({
      prismaClient: prisma,
      notificationEvents: { notifyStudentOfSubmissionDecisionSafely: jest.fn().mockResolvedValue({ created: 1 }) },
      corpusLifecycle
    });

    await service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'approved'
    });

    expect(corpusLifecycle.prepareDocumentEmbedding).toHaveBeenCalledTimes(1);
    const upsertArgs = prisma.currentSessionTopic.upsert.mock.calls[0][0];
    expect(upsertArgs.create.embeddingSourceHash).not.toBe('stale-source-hash');
    expect(upsertArgs.create.embedding).toEqual(TEST_VECTOR);
  });

  test('approval of a legacy submission without an under-review row generates a fresh embedding', async () => {
    const prisma = createDecisionPrismaMock({ underReviewRow: null });
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({
      prismaClient: prisma,
      notificationEvents: { notifyStudentOfSubmissionDecisionSafely: jest.fn().mockResolvedValue({ created: 1 }) },
      corpusLifecycle
    });

    await service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'approved'
    });

    expect(corpusLifecycle.prepareDocumentEmbedding).toHaveBeenCalledTimes(1);
    const upsertArgs = prisma.currentSessionTopic.upsert.mock.calls[0][0];
    expect(upsertArgs.create).toMatchObject({
      title: validInput.title,
      sessionYear: '2025/2026',
      embedding: TEST_VECTOR
    });
  });

  test('approval fails honestly when Voyage is unavailable and persists no decision', async () => {
    const prisma = createDecisionPrismaMock({ underReviewRow: null });
    const corpusLifecycle = createCorpusLifecycleMock({
      prepareDocumentEmbedding: jest.fn().mockRejectedValue(new VoyageProviderError('Voyage embedding request failed (503).', 503))
    });
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'approved'
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'SEMANTIC_SYNC_UNAVAILABLE'
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.submission.update).not.toHaveBeenCalled();
    expect(prisma.currentSessionTopic.upsert).not.toHaveBeenCalled();
    expect(prisma.underReviewTopic.deleteMany).not.toHaveBeenCalled();
  });

  test('a repeated decision request cannot create duplicate corpus records', async () => {
    const prisma = createDecisionPrismaMock({ underReviewRow: null });
    prisma.submission.findUnique.mockResolvedValue({
      id: 21,
      status: 'APPROVED',
      studentId: studentUser.id,
      title: validInput.title,
      category: validInput.category,
      keywords: validInput.keywords,
      session: { id: 3, name: '2025/2026' }
    });
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'approved'
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'SUBMISSION_NOT_PENDING'
    });

    expect(prisma.currentSessionTopic.upsert).not.toHaveBeenCalled();
    expect(prisma.underReviewTopic.deleteMany).not.toHaveBeenCalled();
    expect(corpusLifecycle.prepareDocumentEmbedding).not.toHaveBeenCalled();
  });

  test('rejects rejected status without a decision reason', async () => {
    const prisma = createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 21,
          status: 'PENDING_REVIEW'
        }),
        update: jest.fn()
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'rejected',
      reason: '   '
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'DECISION_REASON_REQUIRED',
      field: 'reason'
    });
    expect(prisma.submission.update).not.toHaveBeenCalled();
  });

  test('does not expose decision fields unless requested', () => {
    const date = new Date('2026-05-19T10:00:00Z');

    const submission = serializeSubmission({
      id: 22,
      studentId: studentUser.id,
      sessionId: null,
      session: null,
      title: validInput.title,
      category: null,
      keywords: null,
      status: 'REJECTED',
      decisionReason: 'Too similar.',
      decidedById: lecturerUser.id,
      decidedBy: {
        name: 'Lecturer Demo'
      },
      decidedAt: date,
      submittedAt: date,
      createdAt: date,
      updatedAt: date
    });

    expect(submission).not.toHaveProperty('decision_reason');
    expect(submission).not.toHaveProperty('decided_by_id');
    expect(submission).not.toHaveProperty('decided_at');
  });

  test('can expose student-safe decision feedback without lecturer identity', () => {
    const date = new Date('2026-05-19T10:00:00Z');

    const submission = serializeSubmission({
      id: 23,
      studentId: studentUser.id,
      sessionId: null,
      session: null,
      title: validInput.title,
      category: null,
      keywords: null,
      status: 'AWAITING_REVISION',
      decisionReason: 'Please narrow the study population.',
      decidedById: lecturerUser.id,
      decidedBy: {
        name: 'Lecturer Demo'
      },
      decidedAt: date,
      submittedAt: date,
      createdAt: date,
      updatedAt: date
    }, { includeDecision: true });

    expect(submission).toMatchObject({
      decision_reason: 'Please narrow the study population.',
      decided_at: '2026-05-19T10:00:00.000Z'
    });
    expect(submission).not.toHaveProperty('decided_by_id');
    expect(submission).not.toHaveProperty('decided_by_name');
  });

  test('rejects invalid lecturer status updates', async () => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'pending_review'
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_SUBMISSION_STATUS',
      field: 'status'
    });
  });

  test('returns 404 for nonexistent lecturer status update target', async () => {
    const prisma = createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 999,
      status: 'approved'
    })).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBMISSION_NOT_FOUND'
    });
  });

  test('does not update non-pending submissions again', async () => {
    const prisma = createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 21,
          status: 'APPROVED'
        }),
        update: jest.fn()
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'rejected'
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'SUBMISSION_NOT_PENDING',
      field: 'status'
    });
    expect(prisma.submission.update).not.toHaveBeenCalled();
  });

  test.each([
    'student',
    'admin'
  ])('%s cannot update lecturer submission status', async (role) => {
    const service = createSubmissionService({ prismaClient: createPrismaMock() });

    await expect(service.updateLecturerSubmissionStatus({
      user: { id: 8, role },
      submissionId: 21,
      status: 'approved'
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

describe('submission revision lineage', () => {
  const revisionInput = {
    title: 'Revised knowledge of malaria prevention among undergraduate students',
    category: 'Public Health',
    keywords: 'malaria, prevention, revised'
  };

  function awaitingRevisionOriginal(overrides = {}) {
    return {
      id: 21,
      studentId: studentUser.id,
      status: 'AWAITING_REVISION',
      title: validInput.title,
      category: validInput.category,
      keywords: validInput.keywords,
      decisionReason: 'Narrow the population and state the study design.',
      decidedAt: new Date('2026-05-19T12:05:00Z'),
      submittedAt: new Date('2026-05-19T10:00:00Z'),
      revision: null,
      ...overrides
    };
  }

  function revisionPrismaMock(original, createOverride) {
    return createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue(original),
        create: createOverride || jest.fn(async ({ data }) => ({
          id: 22,
          ...data,
          session: { id: 3, name: '2025/2026' },
          revisionOf: original,
          submittedAt: new Date('2026-05-20T09:00:00Z'),
          createdAt: new Date('2026-05-20T09:00:00Z'),
          updatedAt: new Date('2026-05-20T09:00:00Z')
        })),
        update: jest.fn()
      }
    });
  }

  test('eligible student can resubmit a revision that references the original', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal());
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    const result = await service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    });

    expect(prisma.submission.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: studentUser.id,
        title: revisionInput.title,
        status: 'PENDING_REVIEW',
        revisionOfId: 21
      })
    }));
    expect(result).toMatchObject({
      id: 22,
      status: 'pending_review',
      is_revision: true,
      revision_of_id: 21
    });
    expect(result.revision_of).toMatchObject({
      id: 21,
      title: validInput.title,
      status: 'awaiting_revision',
      decision_reason: 'Narrow the population and state the study design.'
    });
  });

  test('the original submission is never overwritten by a revision', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal());
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    });

    expect(prisma.submission.update).not.toHaveBeenCalled();
  });

  test('a revision receives its own valid stored embedding and under-review corpus entry', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal());
    const corpusLifecycle = createCorpusLifecycleMock();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    await service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    });

    expect(corpusLifecycle.prepareDocumentEmbedding).toHaveBeenCalledTimes(1);
    expect(corpusLifecycle.prepareDocumentEmbedding).toHaveBeenCalledWith(
      buildSubmissionTopicShape(revisionInput)
    );

    const underReviewRow = prisma.underReviewTopic.create.mock.calls[0][0].data;
    expect(underReviewRow.submissionId).toBe(22);
    expect(underReviewRow.title).toBe(revisionInput.title);
    expect(validStoredEmbedding(underReviewRow)).toBe(true);
  });

  test('a student cannot revise a submission belonging to another student', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal({ studentId: 999 }));
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    // Reported as missing rather than forbidden: a student has no legitimate way
    // to learn that another submission exists, so 403 would leak that fact.
    await expect(service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    })).rejects.toMatchObject({ statusCode: 404, code: 'SUBMISSION_NOT_FOUND' });

    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  test.each([
    ['PENDING_REVIEW'],
    ['APPROVED'],
    ['REJECTED']
  ])('a %s submission cannot be revised', async (status) => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal({ status }));
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await expect(service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'SUBMISSION_NOT_AWAITING_REVISION'
    });

    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  // A revision is itself PENDING_REVIEW, so the rule above is also what makes a
  // lineage cycle unrepresentable: nothing that already sits in the chain can be
  // pointed back at, and revisionOfId is only ever written at creation.
  test('a submission that already has a revision cannot be revised again', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal({
      revision: { id: 22, title: revisionInput.title, status: 'PENDING_REVIEW' }
    }));
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await expect(service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBMISSION_ALREADY_REVISED'
    });

    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  test('a racing duplicate resubmission loses at the unique index instead of creating a second revision', async () => {
    // Both requests can pass the read-time check, so the database constraint is
    // what actually prevents two competing revisions of one original.
    const uniqueViolation = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['revision_of_id'] }
    });
    const prisma = revisionPrismaMock(
      awaitingRevisionOriginal(),
      jest.fn().mockRejectedValue(uniqueViolation)
    );
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await expect(service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUBMISSION_ALREADY_REVISED'
    });
  });

  test('a revision that cannot be embedded fails honestly and writes nothing', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal());
    const corpusLifecycle = createCorpusLifecycleMock({
      prepareDocumentEmbedding: jest.fn().mockRejectedValue(new VoyageProviderError('provider down'))
    });
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle });

    await expect(service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: revisionInput
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'SEMANTIC_SYNC_UNAVAILABLE'
    });

    expect(prisma.submission.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('a revision is validated with the same title rules as a first submission', async () => {
    const prisma = revisionPrismaMock(awaitingRevisionOriginal());
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await expect(service.createRevisionSubmission({
      user: studentUser,
      submissionId: 21,
      input: { ...revisionInput, title: 'Too short title' }
    })).rejects.toMatchObject({ statusCode: 400, code: 'TITLE_TOO_SHORT' });
  });
});

describe('revision feedback is mandatory', () => {
  function pendingPrismaMock() {
    return createPrismaMock({
      submission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 21,
          status: 'PENDING_REVIEW',
          studentId: studentUser.id,
          title: validInput.title,
          category: validInput.category,
          keywords: validInput.keywords,
          session: { id: 3, name: '2025/2026' }
        }),
        update: jest.fn()
      }
    });
  }

  test.each([
    [undefined],
    [''],
    ['   ']
  ])('requesting a revision without feedback is rejected (%p)', async (reason) => {
    const prisma = pendingPrismaMock();
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'awaiting_revision',
      reason
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'DECISION_REASON_REQUIRED'
    });

    expect(prisma.submission.update).not.toHaveBeenCalled();
  });

  test('token revision feedback is rejected as too short', async () => {
    const prisma = pendingPrismaMock();
    const service = createSubmissionService({
      prismaClient: prisma,
      corpusLifecycle: createCorpusLifecycleMock()
    });

    await expect(service.updateLecturerSubmissionStatus({
      user: lecturerUser,
      submissionId: 21,
      status: 'awaiting_revision',
      reason: 'no'
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'DECISION_REASON_TOO_SHORT'
    });

    expect(prisma.submission.update).not.toHaveBeenCalled();
  });

  test('approval still needs no rationale', () => {
    expect(validateDecisionReason({ status: 'APPROVED', reason: undefined })).toBeNull();
  });

  test('over-long rationale is rejected rather than silently stored', () => {
    expect(() => validateDecisionReason({
      status: 'REJECTED',
      reason: 'x'.repeat(MAX_DECISION_REASON_LENGTH + 1)
    })).toThrow(/cannot exceed/);
  });
});

describe('review queue student identity', () => {
  function queueMock(student) {
    return createPrismaMock({
      submission: {
        findMany: jest.fn().mockResolvedValue([{
          id: 21,
          studentId: studentUser.id,
          sessionId: 3,
          session: { id: 3, name: '2025/2026' },
          title: validInput.title,
          category: validInput.category,
          keywords: validInput.keywords,
          status: 'PENDING_REVIEW',
          student,
          revisionOf: null,
          submittedAt: new Date('2026-05-19T10:00:00Z'),
          createdAt: new Date('2026-05-19T10:00:00Z'),
          updatedAt: new Date('2026-05-19T10:00:00Z')
        }])
      }
    });
  }

  test('a student with no email is still identified by matric number', async () => {
    const prisma = queueMock({ name: 'Student Demo', matricNumber: 'PHS/22/0042', email: null });
    const service = createSubmissionService({ prismaClient: prisma });

    const [row] = await service.listLecturerPendingSubmissions({ user: lecturerUser });

    expect(row.student_matric_number).toBe('PHS/22/0042');
    expect(row.student_name).toBe('Student Demo');
    expect(row.student_email).toBeNull();
  });

  test('an email, when present, is carried as secondary detail alongside matric', async () => {
    const prisma = queueMock({
      name: 'Student Demo',
      matricNumber: 'PHS/22/0043',
      email: 'personal.address@example.com'
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const [row] = await service.listLecturerPendingSubmissions({ user: lecturerUser });

    expect(row.student_matric_number).toBe('PHS/22/0043');
    expect(row.student_email).toBe('personal.address@example.com');
  });

  test('a revision arriving in the queue carries the feedback that produced it', async () => {
    const prisma = createPrismaMock({
      submission: {
        findMany: jest.fn().mockResolvedValue([{
          id: 22,
          studentId: studentUser.id,
          sessionId: 3,
          session: { id: 3, name: '2025/2026' },
          title: 'Revised topic title with enough words to pass validation',
          status: 'PENDING_REVIEW',
          revisionOfId: 21,
          student: { name: 'Student Demo', matricNumber: 'PHS/22/0042', email: null },
          revisionOf: {
            id: 21,
            title: validInput.title,
            status: 'AWAITING_REVISION',
            decisionReason: 'Narrow the population and state the study design.',
            decidedAt: new Date('2026-05-19T12:05:00Z'),
            submittedAt: new Date('2026-05-19T10:00:00Z')
          },
          submittedAt: new Date('2026-05-20T09:00:00Z'),
          createdAt: new Date('2026-05-20T09:00:00Z'),
          updatedAt: new Date('2026-05-20T09:00:00Z')
        }])
      }
    });
    const service = createSubmissionService({ prismaClient: prisma });

    const [row] = await service.listLecturerPendingSubmissions({ user: lecturerUser });

    expect(row.is_revision).toBe(true);
    expect(row.revision_of).toMatchObject({
      id: 21,
      title: validInput.title,
      decision_reason: 'Narrow the population and state the study design.'
    });
  });
});
