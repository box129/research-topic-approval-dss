jest.mock('../config/database', () => ({
  historicalTopic: { findMany: jest.fn(), createMany: jest.fn() },
  currentSessionTopic: { findMany: jest.fn(), createMany: jest.fn() },
  underReviewTopic: { findMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn()
}));
jest.mock('./residentCorpus.service', () => ({
  residentCorpus: { refresh: jest.fn() }
}));
jest.mock('../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const defaultPrisma = require('../config/database');
const { residentCorpus } = require('./residentCorpus.service');
const {
  persistNormalizedTopicImport,
  computeSourceFingerprint,
  TopicImportEmbeddingUnavailableError
} = require('./topicImportPersistence.service');
const { validStoredEmbedding, VoyageProviderError, MODEL, DIMENSION } = require('./voyageEmbedding.service');
const { REPRESENTATION_ID } = require('./topicSemanticRepresentation.service');

const TEST_VECTOR = Array.from({ length: 1024 }, (_, index) => (index === 0 ? 1 : 0));

function createModelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn(async ({ data }) => ({ count: data.length }))
  };
}

function createMockPrismaClient() {
  const client = {
    historicalTopic: createModelMock(),
    currentSessionTopic: createModelMock(),
    underReviewTopic: createModelMock()
  };

  client.$transaction = jest.fn(async (callback) => callback(client));

  return client;
}

function createEmbedImpl() {
  return jest.fn().mockResolvedValue(TEST_VECTOR);
}

function createRecord(overrides = {}) {
  return {
    title: 'Imported Public Health Topic',
    keywords: ['health', 'students'],
    population: 'Final year students',
    location: 'Osun State',
    study_focus: 'Topic approval workflow',
    lifecycle_bucket: 'historical',
    raw_record: {
      session_year: '2024/2025',
      supervisor_name: 'Dr. Adeyemi',
      category: 'Public Health'
    },
    warnings: ['missing location'],
    ...overrides
  };
}

function firstCreateManyData(modelMock, callIndex = 0) {
  return modelMock.createMany.mock.calls[callIndex][0].data;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(defaultPrisma.historicalTopic, createModelMock());
  Object.assign(defaultPrisma.currentSessionTopic, createModelMock());
  Object.assign(defaultPrisma.underReviewTopic, createModelMock());
  defaultPrisma.$transaction = jest.fn(async (callback) => callback(defaultPrisma));
  residentCorpus.refresh.mockResolvedValue({ topics: [] });
});

describe('Topic Import Persistence Service', () => {
  test('should throw when records is not an array', async () => {
    await expect(persistNormalizedTopicImport({ title: 'Not Array' }))
      .rejects
      .toThrow('records must be an array');
  });

  test('should insert historical records into historicalTopic', async () => {
    const prismaClient = createMockPrismaClient();

    const report = await persistNormalizedTopicImport([createRecord()], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });

    const data = firstCreateManyData(prismaClient.historicalTopic);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ title: 'Imported Public Health Topic' });
    expect(data[0]).not.toHaveProperty('lifecycle_bucket');
    expect(report.inserted_by_bucket.historical).toBe(1);
  });

  test('should insert current-session records into currentSessionTopic', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord({
      lifecycle_bucket: 'current_session',
      raw_record: {
        sessionYear: '2024/2025',
        supervisorName: 'Dr. Balogun',
        student_id: 'STU001',
        approved_date: '2025-01-02'
      }
    });

    const report = await persistNormalizedTopicImport([record], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });
    const data = firstCreateManyData(prismaClient.currentSessionTopic)[0];

    expect(data.studentId).toBe('STU001');
    expect(data.approvedDate).toBeInstanceOf(Date);
    expect(report.inserted_by_bucket.current_session).toBe(1);
  });

  test('should insert under-review records into underReviewTopic', async () => {
    const prismaClient = createMockPrismaClient();
    const reviewStartedAt = new Date('2025-01-03T10:00:00.000Z');
    const record = createRecord({
      lifecycle_bucket: 'under_review',
      raw_record: {
        'Session Year': '2024/2025',
        supervisor: 'Dr. Ibrahim',
        reviewing_lecturer: 'Dr. Reviewer',
        review_started_at: reviewStartedAt
      }
    });

    const report = await persistNormalizedTopicImport([record], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });
    const data = firstCreateManyData(prismaClient.underReviewTopic)[0];

    expect(data.reviewingLecturer).toBe('Dr. Reviewer');
    expect(data.reviewStartedAt).toBe(reviewStartedAt);
    expect(report.inserted_by_bucket.under_review).toBe(1);
  });

  test('should map normalized field names to Prisma field names', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord();

    await persistNormalizedTopicImport([record], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });
    const data = firstCreateManyData(prismaClient.historicalTopic)[0];

    expect(data.studyFocus).toBe('Topic approval workflow');
    expect(data.rawRecord).toEqual(record.raw_record);
    expect(data.importWarnings).toEqual(['missing location']);
  });

  test('should apply source metadata from options', async () => {
    const prismaClient = createMockPrismaClient();

    await persistNormalizedTopicImport([createRecord()], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl(),
      sourceType: 'xlsx',
      sourceFilename: 'department-topics.xlsx',
      importBatchId: 'batch-001'
    });

    const data = firstCreateManyData(prismaClient.historicalTopic)[0];
    expect(data.sourceType).toBe('xlsx');
    expect(data.sourceFilename).toBe('department-topics.xlsx');
    expect(data.importBatchId).toBe('batch-001');
  });

  test('should serialize keyword arrays to comma-separated text', async () => {
    const prismaClient = createMockPrismaClient();

    await persistNormalizedTopicImport([createRecord()], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });

    expect(firstCreateManyData(prismaClient.historicalTopic)[0].keywords).toBe('health, students');
  });

  test('should derive sessionYear, supervisorName, and category from raw_record aliases', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord({
      raw_record: {
        'Session Year': '2023/2024',
        'Supervisor Name': 'Dr. Okafor',
        Category: 'Education'
      }
    });

    await persistNormalizedTopicImport([record], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });
    const data = firstCreateManyData(prismaClient.historicalTopic)[0];

    expect(data.sessionYear).toBe('2023/2024');
    expect(data.supervisorName).toBe('Dr. Okafor');
    expect(data.category).toBe('Education');
  });

  test('should default missing required Prisma fields and report warnings', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord({ raw_record: {} });

    const report = await persistNormalizedTopicImport([record], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });
    const data = firstCreateManyData(prismaClient.historicalTopic)[0];

    expect(data.sessionYear).toBe('');
    expect(data.supervisorName).toBe('');
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'sessionYear',
        message: 'sessionYear missing from raw_record; defaulted to empty string'
      }),
      expect.objectContaining({
        field: 'supervisorName',
        message: 'supervisorName missing from raw_record; defaulted to empty string'
      })
    ]));
  });

  test('should use exact bucket-specific aliases', async () => {
    const prismaClient = createMockPrismaClient();
    const approvedDate = new Date('2025-02-01T00:00:00.000Z');
    const reviewStartedAt = '2025-02-02T00:00:00.000Z';

    await persistNormalizedTopicImport([
      createRecord({
        lifecycle_bucket: 'current_session',
        raw_record: {
          session_year: '2024/2025',
          supervisor_name: 'Dr. Current',
          'Student ID': 'STU999',
          'Approved Date': approvedDate
        }
      }),
      createRecord({
        lifecycle_bucket: 'under_review',
        raw_record: {
          session_year: '2024/2025',
          supervisor_name: 'Dr. Review',
          'Reviewing Lecturer': 'Dr. Reviewer',
          'Review Started At': reviewStartedAt
        }
      })
    ], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });

    expect(firstCreateManyData(prismaClient.currentSessionTopic)[0].studentId).toBe('STU999');
    expect(firstCreateManyData(prismaClient.currentSessionTopic)[0].approvedDate).toBe(approvedDate);
    expect(firstCreateManyData(prismaClient.underReviewTopic)[0].reviewingLecturer).toBe('Dr. Reviewer');
    expect(firstCreateManyData(prismaClient.underReviewTopic)[0].reviewStartedAt).toBeInstanceOf(Date);
  });

  test('should omit invalid date fields and report warnings', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord({
      lifecycle_bucket: 'current_session',
      raw_record: {
        session_year: '2024/2025',
        supervisor_name: 'Dr. Current',
        approvedDate: 'not a date'
      }
    });

    const report = await persistNormalizedTopicImport([record], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });
    const data = firstCreateManyData(prismaClient.currentSessionTopic)[0];

    expect(data).not.toHaveProperty('approvedDate');
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'approvedDate',
        message: 'approvedDate is not a valid date and was not persisted'
      })
    ]));
  });

  test('should skip unsupported lifecycle buckets', async () => {
    const prismaClient = createMockPrismaClient();
    const embedDocumentImpl = createEmbedImpl();

    const report = await persistNormalizedTopicImport([
      createRecord({ lifecycle_bucket: 'archived' })
    ], { prismaClient, embedDocumentImpl });

    expect(report.skipped_records).toBe(1);
    expect(report.errors).toEqual([
      {
        title: 'Imported Public Health Topic',
        lifecycle_bucket: 'archived',
        message: 'Unsupported lifecycle bucket'
      }
    ]);
    expect(embedDocumentImpl).not.toHaveBeenCalled();
    expect(prismaClient.historicalTopic.createMany).not.toHaveBeenCalled();
  });

  test('should count inserted records by bucket', async () => {
    const prismaClient = createMockPrismaClient();

    const report = await persistNormalizedTopicImport([
      createRecord({ lifecycle_bucket: 'historical' }),
      createRecord({ lifecycle_bucket: 'current_session' }),
      createRecord({ lifecycle_bucket: 'under_review' })
    ], {
      prismaClient,
      embedDocumentImpl: createEmbedImpl()
    });

    expect(report).toEqual(expect.objectContaining({
      attempted_records: 3,
      inserted_records: 3,
      failed_records: 0,
      skipped_records: 0,
      duplicate_records: 0,
      searchable_records: 3,
      embedding_generated: 3,
      inserted_by_bucket: {
        historical: 1,
        current_session: 1,
        under_review: 1
      }
    }));
  });

  describe('embedding lifecycle', () => {
    test('committed records carry a valid stored Voyage embedding with full metadata', async () => {
      const prismaClient = createMockPrismaClient();
      const embedDocumentImpl = createEmbedImpl();

      const report = await persistNormalizedTopicImport([createRecord()], {
        prismaClient,
        embedDocumentImpl
      });

      const data = firstCreateManyData(prismaClient.historicalTopic)[0];
      expect(embedDocumentImpl).toHaveBeenCalledTimes(1);
      expect(data.embedding).toEqual(TEST_VECTOR);
      expect(data.embeddingProvider).toBe('voyage');
      expect(data.embeddingModel).toBe(MODEL);
      expect(data.embeddingDimension).toBe(DIMENSION);
      expect(data.embeddingRepresentation).toBe(REPRESENTATION_ID);
      expect(data.embeddingSourceHash).toEqual(expect.any(String));
      expect(data.embeddedAt).toBeInstanceOf(Date);
      expect(validStoredEmbedding(data)).toBe(true);
      expect(report.embedding_generated).toBe(1);
      expect(report.searchable_records).toBe(report.inserted_records);
    });

    test('provider failure aborts the import before any database mutation', async () => {
      const prismaClient = createMockPrismaClient();
      const embedDocumentImpl = jest.fn()
        .mockRejectedValue(new VoyageProviderError('Voyage embedding request failed (401).', 401));

      await expect(persistNormalizedTopicImport([createRecord()], {
        prismaClient,
        embedDocumentImpl
      })).rejects.toThrow(TopicImportEmbeddingUnavailableError);

      expect(prismaClient.$transaction).not.toHaveBeenCalled();
      expect(prismaClient.historicalTopic.createMany).not.toHaveBeenCalled();
      expect(residentCorpus.refresh).not.toHaveBeenCalled();
    });

    test('provider failure error reports how far embedding progressed', async () => {
      const prismaClient = createMockPrismaClient();
      const embedDocumentImpl = jest.fn()
        .mockResolvedValueOnce(TEST_VECTOR)
        .mockRejectedValueOnce(new VoyageProviderError('Voyage embedding request failed (401).', 401));

      const records = [
        createRecord(),
        createRecord({ title: 'Second Imported Topic' })
      ];

      await expect(persistNormalizedTopicImport(records, {
        prismaClient,
        embedDocumentImpl
      })).rejects.toMatchObject({
        name: 'TopicImportEmbeddingUnavailableError',
        attemptedRecords: 2,
        embeddedBeforeFailure: 1
      });

      expect(prismaClient.$transaction).not.toHaveBeenCalled();
    });

    test('a malformed generated vector fails stored-embedding validation and aborts without fallback', async () => {
      const prismaClient = createMockPrismaClient();
      const embedDocumentImpl = jest.fn().mockResolvedValue([0.5, 0.5]);

      await expect(persistNormalizedTopicImport([createRecord()], {
        prismaClient,
        embedDocumentImpl
      })).rejects.toThrow(/failed stored-embedding validation/);

      expect(prismaClient.$transaction).not.toHaveBeenCalled();
      expect(prismaClient.historicalTopic.createMany).not.toHaveBeenCalled();
    });

    test('database failure inside the commit transaction propagates without a partial report', async () => {
      const prismaClient = createMockPrismaClient();
      prismaClient.historicalTopic.createMany.mockRejectedValue(new Error('database insert failed'));

      await expect(persistNormalizedTopicImport([
        createRecord(),
        createRecord({ title: 'Second Imported Topic' })
      ], {
        prismaClient,
        embedDocumentImpl: createEmbedImpl()
      })).rejects.toThrow('database insert failed');

      expect(prismaClient.$transaction).toHaveBeenCalledTimes(1);
      expect(residentCorpus.refresh).not.toHaveBeenCalled();
    });

    test('commits all buckets inside a single transaction with an explicit timeout', async () => {
      const prismaClient = createMockPrismaClient();

      await persistNormalizedTopicImport([
        createRecord({ lifecycle_bucket: 'historical' }),
        createRecord({ lifecycle_bucket: 'current_session' })
      ], {
        prismaClient,
        embedDocumentImpl: createEmbedImpl()
      });

      expect(prismaClient.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaClient.$transaction.mock.calls[0][1]).toEqual(
        expect.objectContaining({ timeout: expect.any(Number) })
      );
    });
  });

  describe('import idempotency', () => {
    test('replaying the same import skips already persisted records without re-embedding', async () => {
      const prismaClient = createMockPrismaClient();
      const record = createRecord();

      const firstReport = await persistNormalizedTopicImport([record], {
        prismaClient,
        embedDocumentImpl: createEmbedImpl()
      });
      expect(firstReport.inserted_records).toBe(1);

      const persistedFingerprint = firstCreateManyData(prismaClient.historicalTopic)[0].sourceFingerprint;
      expect(persistedFingerprint).toEqual(expect.any(String));

      const replayClient = createMockPrismaClient();
      replayClient.historicalTopic.findMany.mockResolvedValue([
        { sourceFingerprint: persistedFingerprint }
      ]);
      const replayEmbed = createEmbedImpl();

      const replayReport = await persistNormalizedTopicImport([record], {
        prismaClient: replayClient,
        embedDocumentImpl: replayEmbed,
        importBatchId: 'a-different-batch-id'
      });

      expect(replayReport.inserted_records).toBe(0);
      expect(replayReport.duplicate_records).toBe(1);
      expect(replayReport.duplicates).toEqual([
        expect.objectContaining({ reason: 'already_persisted' })
      ]);
      expect(replayEmbed).not.toHaveBeenCalled();
      expect(replayClient.historicalTopic.createMany).not.toHaveBeenCalled();
    });

    test('identical records inside one batch collapse to a single insert', async () => {
      const prismaClient = createMockPrismaClient();

      const report = await persistNormalizedTopicImport([
        createRecord(),
        createRecord()
      ], {
        prismaClient,
        embedDocumentImpl: createEmbedImpl()
      });

      expect(report.inserted_records).toBe(1);
      expect(report.duplicate_records).toBe(1);
      expect(report.duplicates).toEqual([
        expect.objectContaining({ reason: 'duplicate_in_batch' })
      ]);
    });

    test('legitimate distinct records with the same title coexist when their context differs', async () => {
      const prismaClient = createMockPrismaClient();

      const report = await persistNormalizedTopicImport([
        createRecord({
          raw_record: {
            session_year: '2023/2024',
            supervisor_name: 'Dr. Adeyemi',
            category: 'Public Health'
          }
        }),
        createRecord({
          raw_record: {
            session_year: '2024/2025',
            supervisor_name: 'Dr. Adeyemi',
            category: 'Public Health'
          }
        })
      ], {
        prismaClient,
        embedDocumentImpl: createEmbedImpl()
      });

      expect(report.inserted_records).toBe(2);
      expect(report.duplicate_records).toBe(0);

      const data = firstCreateManyData(prismaClient.historicalTopic);
      expect(data).toHaveLength(2);
      expect(data[0].sourceFingerprint).not.toBe(data[1].sourceFingerprint);
    });

    test('records skipped by the unique constraint at commit time are reported as duplicates', async () => {
      const prismaClient = createMockPrismaClient();
      prismaClient.historicalTopic.createMany.mockResolvedValue({ count: 1 });

      const report = await persistNormalizedTopicImport([
        createRecord(),
        createRecord({ title: 'Second Imported Topic' })
      ], {
        prismaClient,
        embedDocumentImpl: createEmbedImpl()
      });

      expect(report.inserted_records).toBe(1);
      expect(report.duplicate_records).toBe(1);
      expect(report.searchable_records).toBe(1);
      expect(report.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'sourceFingerprint' })
      ]));
    });
  });

  describe('source fingerprint identity', () => {
    const baseData = {
      title: 'Assessment of Malaria Prevention Awareness',
      sessionYear: '2023/2024',
      supervisorName: 'Dr. Adeyemi',
      category: 'Public Health',
      population: 'Final year students',
      location: 'Osun State',
      studyFocus: 'Awareness',
      keywords: 'malaria, prevention'
    };

    test('is deterministic and case-insensitive on title', () => {
      expect(computeSourceFingerprint('historical', baseData))
        .toBe(computeSourceFingerprint('historical', { ...baseData, title: baseData.title.toUpperCase() }));
    });

    test('differs across lifecycle buckets and across identity fields', () => {
      const fingerprint = computeSourceFingerprint('historical', baseData);

      expect(computeSourceFingerprint('current_session', baseData)).not.toBe(fingerprint);
      expect(computeSourceFingerprint('historical', { ...baseData, sessionYear: '2024/2025' })).not.toBe(fingerprint);
      expect(computeSourceFingerprint('historical', { ...baseData, supervisorName: 'Dr. Balogun' })).not.toBe(fingerprint);
    });
  });

  describe('resident corpus coherence', () => {
    test('refreshes the resident corpus after committing with the default client', async () => {
      const report = await persistNormalizedTopicImport([createRecord()], {
        embedDocumentImpl: createEmbedImpl()
      });

      expect(report.inserted_records).toBe(1);
      expect(residentCorpus.refresh).toHaveBeenCalledTimes(1);
      expect(report.corpus_refreshed).toBe(true);
    });

    test('reports an honest warning when the post-commit corpus refresh fails', async () => {
      residentCorpus.refresh.mockRejectedValue(new Error('database unavailable'));

      const report = await persistNormalizedTopicImport([createRecord()], {
        embedDocumentImpl: createEmbedImpl()
      });

      expect(report.inserted_records).toBe(1);
      expect(report.corpus_refreshed).toBe(false);
      expect(report.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'residentCorpus' })
      ]));
    });

    test('does not refresh the corpus when nothing was inserted', async () => {
      defaultPrisma.historicalTopic.findMany.mockResolvedValue([
        { sourceFingerprint: computeSourceFingerprintForRecord(createRecord()) }
      ]);

      const report = await persistNormalizedTopicImport([createRecord()], {
        embedDocumentImpl: createEmbedImpl()
      });

      expect(report.inserted_records).toBe(0);
      expect(report.duplicate_records).toBe(1);
      expect(residentCorpus.refresh).not.toHaveBeenCalled();
      expect(report.corpus_refreshed).toBeNull();
    });
  });
});

// Mirrors the normalization the service applies before fingerprinting so the
// replay test can predict the fingerprint of a normalized record.
function computeSourceFingerprintForRecord(record) {
  return computeSourceFingerprint(record.lifecycle_bucket, {
    title: record.title,
    sessionYear: record.raw_record.session_year || '',
    supervisorName: record.raw_record.supervisor_name || '',
    category: record.raw_record.category || null,
    population: record.population,
    location: record.location,
    studyFocus: record.study_focus,
    keywords: Array.isArray(record.keywords) ? record.keywords.join(', ') : record.keywords
  });
}
