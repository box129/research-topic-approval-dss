jest.mock('../config/database', () => ({}));
const { persistNormalizedTopicImport } = require('./topicImportPersistence.service');

function createMockPrismaClient() {
  return {
    historicalTopic: {
      create: jest.fn().mockResolvedValue({ id: 1 })
    },
    currentSessionTopic: {
      create: jest.fn().mockResolvedValue({ id: 2 })
    },
    underReviewTopic: {
      create: jest.fn().mockResolvedValue({ id: 3 })
    }
  };
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

describe('Topic Import Persistence Service', () => {
  test('should throw when records is not an array', async () => {
    await expect(persistNormalizedTopicImport({ title: 'Not Array' }))
      .rejects
      .toThrow('records must be an array');
  });

  test('should insert historical records into historicalTopic', async () => {
    const prismaClient = createMockPrismaClient();

    const report = await persistNormalizedTopicImport([createRecord()], { prismaClient });

    expect(prismaClient.historicalTopic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Imported Public Health Topic'
      })
    });
    expect(prismaClient.historicalTopic.create.mock.calls[0][0].data).not.toHaveProperty('lifecycle_bucket');
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

    const report = await persistNormalizedTopicImport([record], { prismaClient });
    const data = prismaClient.currentSessionTopic.create.mock.calls[0][0].data;

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

    const report = await persistNormalizedTopicImport([record], { prismaClient });
    const data = prismaClient.underReviewTopic.create.mock.calls[0][0].data;

    expect(data.reviewingLecturer).toBe('Dr. Reviewer');
    expect(data.reviewStartedAt).toBe(reviewStartedAt);
    expect(report.inserted_by_bucket.under_review).toBe(1);
  });

  test('should map normalized field names to Prisma field names', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord();

    await persistNormalizedTopicImport([record], { prismaClient });
    const data = prismaClient.historicalTopic.create.mock.calls[0][0].data;

    expect(data.studyFocus).toBe('Topic approval workflow');
    expect(data.rawRecord).toEqual(record.raw_record);
    expect(data.importWarnings).toEqual(['missing location']);
  });

  test('should apply source metadata from options', async () => {
    const prismaClient = createMockPrismaClient();

    await persistNormalizedTopicImport([createRecord()], {
      prismaClient,
      sourceType: 'xlsx',
      sourceFilename: 'department-topics.xlsx',
      importBatchId: 'batch-001'
    });

    const data = prismaClient.historicalTopic.create.mock.calls[0][0].data;
    expect(data.sourceType).toBe('xlsx');
    expect(data.sourceFilename).toBe('department-topics.xlsx');
    expect(data.importBatchId).toBe('batch-001');
  });

  test('should serialize keyword arrays to comma-separated text', async () => {
    const prismaClient = createMockPrismaClient();

    await persistNormalizedTopicImport([createRecord()], { prismaClient });

    expect(prismaClient.historicalTopic.create.mock.calls[0][0].data.keywords).toBe('health, students');
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

    await persistNormalizedTopicImport([record], { prismaClient });
    const data = prismaClient.historicalTopic.create.mock.calls[0][0].data;

    expect(data.sessionYear).toBe('2023/2024');
    expect(data.supervisorName).toBe('Dr. Okafor');
    expect(data.category).toBe('Education');
  });

  test('should default missing required Prisma fields and report warnings', async () => {
    const prismaClient = createMockPrismaClient();
    const record = createRecord({ raw_record: {} });

    const report = await persistNormalizedTopicImport([record], { prismaClient });
    const data = prismaClient.historicalTopic.create.mock.calls[0][0].data;

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
    ], { prismaClient });

    expect(prismaClient.currentSessionTopic.create.mock.calls[0][0].data.studentId).toBe('STU999');
    expect(prismaClient.currentSessionTopic.create.mock.calls[0][0].data.approvedDate).toBe(approvedDate);
    expect(prismaClient.underReviewTopic.create.mock.calls[0][0].data.reviewingLecturer).toBe('Dr. Reviewer');
    expect(prismaClient.underReviewTopic.create.mock.calls[0][0].data.reviewStartedAt).toBeInstanceOf(Date);
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

    const report = await persistNormalizedTopicImport([record], { prismaClient });
    const data = prismaClient.currentSessionTopic.create.mock.calls[0][0].data;

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

    const report = await persistNormalizedTopicImport([
      createRecord({ lifecycle_bucket: 'archived' })
    ], { prismaClient });

    expect(report.skipped_records).toBe(1);
    expect(report.errors).toEqual([
      {
        title: 'Imported Public Health Topic',
        lifecycle_bucket: 'archived',
        message: 'Unsupported lifecycle bucket'
      }
    ]);
    expect(prismaClient.historicalTopic.create).not.toHaveBeenCalled();
  });

  test('should continue after insert failure and report failed records', async () => {
    const prismaClient = createMockPrismaClient();
    prismaClient.historicalTopic.create
      .mockRejectedValueOnce(new Error('database insert failed'))
      .mockResolvedValueOnce({ id: 2 });

    const report = await persistNormalizedTopicImport([
      createRecord({ title: 'Failing Topic' }),
      createRecord({ title: 'Successful Topic' })
    ], { prismaClient });

    expect(report.failed_records).toBe(1);
    expect(report.inserted_records).toBe(1);
    expect(report.errors).toEqual([
      {
        title: 'Failing Topic',
        lifecycle_bucket: 'historical',
        message: 'database insert failed'
      }
    ]);
  });

  test('should count inserted records by bucket', async () => {
    const prismaClient = createMockPrismaClient();

    const report = await persistNormalizedTopicImport([
      createRecord({ lifecycle_bucket: 'historical' }),
      createRecord({ lifecycle_bucket: 'current_session' }),
      createRecord({ lifecycle_bucket: 'under_review' })
    ], { prismaClient });

    expect(report).toEqual(expect.objectContaining({
      attempted_records: 3,
      inserted_records: 3,
      failed_records: 0,
      skipped_records: 0,
      inserted_by_bucket: {
        historical: 1,
        current_session: 1,
        under_review: 1
      }
    }));
  });
});
