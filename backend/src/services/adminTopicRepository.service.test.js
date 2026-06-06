const {
  AdminTopicRepositoryServiceError,
  createAdminTopicRepositoryService
} = require('./adminTopicRepository.service');

const historicalTopic = {
  id: 1,
  title: 'Malaria prevention in rural communities',
  keywords: 'malaria, prevention',
  sessionYear: '2023/2024',
  supervisorName: 'Dr. Adeyemi',
  category: 'Public Health',
  population: 'Children under five',
  location: 'Osun',
  studyFocus: 'Prevention',
  rawRecord: { title: 'Malaria prevention in rural communities' },
  importWarnings: [],
  sourceType: 'spreadsheet',
  sourceFilename: 'historical.xlsx',
  importBatchId: 'batch-1',
  embedding: [0.1, 0.2],
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z')
};

const currentSessionTopic = {
  id: 2,
  title: 'Vaccination education uptake',
  keywords: 'vaccination',
  sessionYear: '2025/2026',
  supervisorName: 'Dr. Musa',
  category: 'Health Education',
  population: 'Caregivers',
  location: 'Osogbo',
  studyFocus: 'Education',
  rawRecord: { title: 'Vaccination education uptake' },
  importWarnings: [{ code: 'MISSING_CONTEXT_FIELD', field: 'location' }],
  sourceType: 'spreadsheet',
  sourceFilename: 'current.xlsx',
  importBatchId: 'batch-2',
  embedding: null,
  approvedDate: new Date('2026-02-01T10:00:00.000Z'),
  studentId: 'STU-001',
  createdAt: new Date('2026-02-01T10:00:00.000Z'),
  updatedAt: new Date('2026-02-02T10:00:00.000Z')
};

const underReviewTopic = {
  id: 3,
  title: 'Hand hygiene compliance in hospitals',
  keywords: 'hygiene, compliance',
  sessionYear: '',
  supervisorName: '',
  category: '',
  population: '',
  location: '',
  studyFocus: '',
  rawRecord: { title: 'Hand hygiene compliance in hospitals' },
  importWarnings: [{ code: 'MISSING_CONTEXT_FIELD' }],
  sourceType: 'manual',
  sourceFilename: null,
  importBatchId: null,
  embedding: [],
  reviewStartedAt: new Date('2026-03-01T10:00:00.000Z'),
  reviewingLecturer: 'Dr. Okoro',
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-02T10:00:00.000Z')
};

function createPrismaMock({
  historical = [historicalTopic],
  currentSession = [currentSessionTopic],
  underReview = [underReviewTopic]
} = {}) {
  return {
    historicalTopic: {
      findMany: jest.fn().mockResolvedValue(historical),
      findUnique: jest.fn(({ where }) => Promise.resolve(historical.find((topic) => topic.id === where.id) || null))
    },
    currentSessionTopic: {
      findMany: jest.fn().mockResolvedValue(currentSession),
      findUnique: jest.fn(({ where }) => Promise.resolve(currentSession.find((topic) => topic.id === where.id) || null))
    },
    underReviewTopic: {
      findMany: jest.fn().mockResolvedValue(underReview),
      findUnique: jest.fn(({ where }) => Promise.resolve(underReview.find((topic) => topic.id === where.id) || null))
    }
  };
}

describe('adminTopicRepository.service', () => {
  test('lists topics across lifecycle tables without exposing embeddings', async () => {
    const prisma = createPrismaMock();
    const service = createAdminTopicRepositoryService({ prismaClient: prisma });

    const result = await service.listTopics({ page: '1', limit: '10' });

    expect(result.data.items).toHaveLength(3);
    expect(result.data.items[0]).toMatchObject({
      id: 3,
      lifecycle: 'under-review',
      title: 'Hand hygiene compliance in hospitals',
      dataQuality: {
        hasEmbedding: false,
        hasContextFields: false,
        hasImportWarnings: true,
        importWarningCount: 1
      }
    });
    expect(result.data.items[0]).not.toHaveProperty('embedding');
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(result.meta.dataCoverage).toBe('Read-only topic data from existing lifecycle tables.');
  });

  test('applies lifecycle, search, filter, sort, and pagination metadata', async () => {
    const prisma = createPrismaMock();
    const service = createAdminTopicRepositoryService({ prismaClient: prisma });

    const result = await service.listTopics({
      lifecycle: 'current_session',
      search: 'vaccination',
      category: 'Health',
      sessionYear: '2025',
      supervisorName: 'Musa',
      sourceType: 'spreadsheet',
      importBatchId: 'batch-2',
      page: '1',
      limit: '1',
      sort: 'title',
      direction: 'asc'
    });

    expect(prisma.currentSessionTopic.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.any(Array)
      }),
      orderBy: {
        title: 'asc'
      }
    });
    expect(prisma.historicalTopic.findMany).not.toHaveBeenCalled();
    expect(result.data.items).toHaveLength(1);
    expect(result.meta.filters).toEqual({
      lifecycle: 'current-session',
      search: 'vaccination',
      category: 'Health',
      sessionYear: '2025',
      supervisorName: 'Musa',
      sourceType: 'spreadsheet',
      importBatchId: 'batch-2',
      sort: 'title',
      direction: 'asc'
    });
  });

  test('rejects invalid lifecycle and pagination inputs', async () => {
    const service = createAdminTopicRepositoryService({ prismaClient: createPrismaMock() });

    await expect(service.listTopics({ lifecycle: 'archived' })).rejects.toMatchObject({
      name: 'AdminTopicRepositoryServiceError',
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_LIFECYCLE',
      field: 'lifecycle'
    });

    await expect(service.listTopics({ page: '0' })).rejects.toBeInstanceOf(AdminTopicRepositoryServiceError);
    await expect(service.listTopics({ limit: '101' })).rejects.toMatchObject({
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_PAGINATION',
      field: 'limit'
    });
    await expect(service.listTopics({ sort: 'riskScore' })).rejects.toMatchObject({
      code: 'ADMIN_TOPIC_REPOSITORY_INVALID_SORT',
      field: 'sort'
    });
  });

  test('reads topic detail by lifecycle and id without exposing embeddings', async () => {
    const service = createAdminTopicRepositoryService({ prismaClient: createPrismaMock() });

    const topic = await service.getTopicByLifecycleAndId('historical', '1');

    expect(topic).toMatchObject({
      id: 1,
      lifecycle: 'historical',
      title: 'Malaria prevention in rural communities',
      population: 'Children under five',
      location: 'Osun',
      studyFocus: 'Prevention',
      lifecycleDetails: {
        approvedDate: null,
        studentId: null,
        reviewStartedAt: null,
        reviewingLecturer: null
      }
    });
    expect(topic).not.toHaveProperty('embedding');
  });

  test('returns null for a missing topic detail record', async () => {
    const service = createAdminTopicRepositoryService({ prismaClient: createPrismaMock() });

    await expect(service.getTopicByLifecycleAndId('historical', '999')).resolves.toBeNull();
  });

  test('summarizes lifecycle totals and data quality from real topic rows', async () => {
    const service = createAdminTopicRepositoryService({ prismaClient: createPrismaMock() });

    const result = await service.getTopicsSummary();

    expect(result.data.totals).toEqual({
      all: 3,
      historical: 1,
      currentSession: 1,
      underReview: 1
    });
    expect(result.data.byCategory).toEqual(expect.arrayContaining([
      { category: 'Public Health', count: 1 },
      { category: 'Health Education', count: 1 },
      { category: null, count: 1 }
    ]));
    expect(result.data.dataQuality).toEqual({
      missingCategory: 1,
      missingSessionYear: 1,
      missingSupervisorName: 1,
      missingContextFields: 1,
      withEmbeddings: 1,
      withoutEmbeddings: 2,
      withImportWarnings: 2
    });
    expect(result.meta.dataCoverage).toBe('Read-only aggregate counts from existing topic tables.');
  });

  test('returns safe empty list and summary when topic tables are empty', async () => {
    const service = createAdminTopicRepositoryService({
      prismaClient: createPrismaMock({
        historical: [],
        currentSession: [],
        underReview: []
      })
    });

    const list = await service.listTopics();
    const summary = await service.getTopicsSummary();

    expect(list.data.items).toEqual([]);
    expect(list.meta.pagination.total).toBe(0);
    expect(summary.data.totals.all).toBe(0);
    expect(summary.data.byCategory).toEqual([]);
    expect(summary.data.bySessionYear).toEqual([]);
  });
});
