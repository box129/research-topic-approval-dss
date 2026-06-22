jest.mock('../services/topicImportFile.service', () => ({
  normalizeTopicImportFile: jest.fn()
}));

jest.mock('../services/topicImportPersistence.service', () => ({
  persistNormalizedTopicImport: jest.fn()
}));

jest.mock('../services/auditLog.service', () => ({
  AUDIT_EVENT_TYPES: {
    TOPIC_IMPORT_PREVIEWED: 'TOPIC_IMPORT_PREVIEWED',
    TOPIC_IMPORT_COMMITTED: 'TOPIC_IMPORT_COMMITTED'
  },
  buildAuditContextFromRequest: jest.fn(() => ({
    actorId: 1,
    actorRole: 'admin',
    actorEmail: 'admin.demo@uniosun.edu.ng'
  })),
  createAuditLogSafely: jest.fn()
}));

jest.mock('../services/notificationEvent.service', () => ({
  notifyAdminImportPreviewedSafely: jest.fn(),
  notifyAdminImportCommittedSafely: jest.fn()
}));

jest.mock('fs/promises', () => ({
  unlink: jest.fn()
}));

const {
  previewTopicImport,
  commitTopicImport
} = require('./topicImport.controller');
const topicImportFileService = require('../services/topicImportFile.service');
const topicImportPersistenceService = require('../services/topicImportPersistence.service');
const auditLogService = require('../services/auditLog.service');
const notificationEventService = require('../services/notificationEvent.service');
const fs = require('fs/promises');

function createResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  return res;
}

function createSuccessImportResult() {
  return {
    metadata: {
      sheet_name: 'Topics',
      total_parsed_rows: 1,
      warnings: []
    },
    records: [
      {
        title: 'Imported Topic',
        lifecycle_bucket: 'historical',
        raw_record: { session_year: '2024/2025' },
        warnings: []
      }
    ],
    report: {
      total_rows: 1,
      accepted_rows: 1,
      skipped_rows: 0,
      missing_title_rows: 0,
      incomplete_context_rows: 0,
      duplicate_title_rows: 0
    }
  };
}

describe('Topic Import Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.unlink.mockResolvedValue(undefined);
    topicImportFileService.normalizeTopicImportFile.mockResolvedValue(createSuccessImportResult());
    topicImportPersistenceService.persistNormalizedTopicImport.mockResolvedValue({
      attempted_records: 1,
      inserted_records: 1,
      failed_records: 0,
      skipped_records: 0,
      inserted_by_bucket: {
        historical: 1,
        current_session: 0,
        under_review: 0
      },
      warnings: [],
      errors: []
    });
    notificationEventService.notifyAdminImportPreviewedSafely.mockResolvedValue({ created: 1 });
    notificationEventService.notifyAdminImportCommittedSafely.mockResolvedValue({ created: 1 });
  });

  test('should return preview response without persisting records', async () => {
    const req = {
      file: { path: 'tmp/upload.xlsx', originalname: 'topics.xlsx' },
      body: { sheetName: 'Topics' }
    };
    const res = createResponse();
    const next = jest.fn();

    await previewTopicImport(req, res, next);

    expect(topicImportFileService.normalizeTopicImportFile).toHaveBeenCalledWith(
      'tmp/upload.xlsx',
      { sheetName: 'Topics' }
    );
    expect(topicImportPersistenceService.persistNormalizedTopicImport).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: {
        mode: 'preview',
        metadata: createSuccessImportResult().metadata,
        records: createSuccessImportResult().records,
        import_report: createSuccessImportResult().report
      }
    });
    expect(auditLogService.createAuditLogSafely).toHaveBeenCalledWith({
      eventType: 'TOPIC_IMPORT_PREVIEWED',
      actorId: 1,
      actorRole: 'admin',
      actorEmail: 'admin.demo@uniosun.edu.ng',
      targetType: 'TopicImport',
      targetId: null,
      metadata: {
        mode: 'preview',
        filename: 'topics.xlsx',
        requestedSheetName: 'Topics',
        parsedSheetName: 'Topics',
        totalParsedRows: 1,
        report: {
          totalRows: 1,
          acceptedRows: 1,
          skippedRows: 0,
          missingTitleRows: 0,
          incompleteContextRows: 0,
          duplicateTitleRows: 0
        }
      }
    });
    expect(notificationEventService.notifyAdminImportPreviewedSafely).toHaveBeenCalledWith({
      actorUser: undefined,
      fileName: 'topics.xlsx',
      report: createSuccessImportResult().report,
      importBatchId: null
    });
    expect(fs.unlink).toHaveBeenCalledWith('tmp/upload.xlsx');
    expect(next).not.toHaveBeenCalled();
  });

  test('should return commit response and persist records with source metadata', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1777777777777);
    const req = {
      file: { path: 'tmp/upload.xlsx', originalname: 'topics.xlsx' },
      body: {
        sourceType: 'xlsx',
        sourceFilename: 'custom-name.xlsx'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await commitTopicImport(req, res, next);

    expect(topicImportPersistenceService.persistNormalizedTopicImport).toHaveBeenCalledWith(
      createSuccessImportResult().records,
      {
        sourceType: 'xlsx',
        sourceFilename: 'custom-name.xlsx',
        importBatchId: 'import-1777777777777'
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: {
        mode: 'commit',
        metadata: createSuccessImportResult().metadata,
        import_report: createSuccessImportResult().report,
        persistence_report: expect.objectContaining({
          attempted_records: 1,
          inserted_records: 1
        })
      }
    });
    expect(auditLogService.createAuditLogSafely).toHaveBeenCalledWith({
      eventType: 'TOPIC_IMPORT_COMMITTED',
      actorId: 1,
      actorRole: 'admin',
      actorEmail: 'admin.demo@uniosun.edu.ng',
      targetType: 'TopicImport',
      targetId: 'import-1777777777777',
      metadata: {
        mode: 'commit',
        filename: 'topics.xlsx',
        sourceFilename: 'custom-name.xlsx',
        sourceType: 'xlsx',
        importBatchId: 'import-1777777777777',
        requestedSheetName: null,
        parsedSheetName: 'Topics',
        totalParsedRows: 1,
        importReport: {
          totalRows: 1,
          acceptedRows: 1,
          skippedRows: 0,
          missingTitleRows: 0,
          incompleteContextRows: 0,
          duplicateTitleRows: 0
        },
        persistenceReport: {
          attemptedRecords: 1,
          insertedRecords: 1,
          failedRecords: 0,
          skippedRecords: 0,
          insertedByBucket: {
            historical: 1,
            current_session: 0,
            under_review: 0
          }
        }
      }
    });
    expect(notificationEventService.notifyAdminImportCommittedSafely).toHaveBeenCalledWith({
      actorUser: undefined,
      fileName: 'topics.xlsx',
      report: createSuccessImportResult().report,
      persistenceReport: expect.objectContaining({
        inserted_records: 1
      }),
      importBatchId: 'import-1777777777777'
    });
    expect(fs.unlink).toHaveBeenCalledWith('tmp/upload.xlsx');
    expect(next).not.toHaveBeenCalled();
    Date.now.mockRestore();
  });

  test('should return missing-file error response', async () => {
    const req = { body: {} };
    const res = createResponse();
    const next = jest.fn();

    await previewTopicImport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Import file is required.',
      details: {
        error_code: 'MISSING_FILE',
        field: 'file'
      }
    });
    expect(topicImportFileService.normalizeTopicImportFile).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  test('should return unsupported-file error response', async () => {
    const req = {
      file: { path: 'tmp/upload.csv', originalname: 'topics.csv' },
      body: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await previewTopicImport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Only .xlsx import files are supported.',
      details: {
        error_code: 'UNSUPPORTED_FILE_TYPE',
        field: 'file'
      }
    });
    expect(fs.unlink).toHaveBeenCalledWith('tmp/upload.csv');
    expect(next).not.toHaveBeenCalled();
  });

  test('should map worksheet-not-found errors to a 400 response', async () => {
    topicImportFileService.normalizeTopicImportFile.mockRejectedValue(new Error('worksheet not found'));
    const req = {
      file: { path: 'tmp/upload.xlsx', originalname: 'topics.xlsx' },
      body: { sheetName: 'Missing' }
    };
    const res = createResponse();
    const next = jest.fn();

    await previewTopicImport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Worksheet not found.',
      details: {
        error_code: 'WORKSHEET_NOT_FOUND',
        field: 'sheetName'
      }
    });
    expect(fs.unlink).toHaveBeenCalledWith('tmp/upload.xlsx');
    expect(next).not.toHaveBeenCalled();
  });

  test('should clean up uploaded files after failed import processing', async () => {
    const error = new Error('import failed');
    topicImportFileService.normalizeTopicImportFile.mockRejectedValue(error);
    const req = {
      file: { path: 'tmp/upload.xlsx', originalname: 'topics.xlsx' },
      body: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await previewTopicImport(req, res, next);

    expect(fs.unlink).toHaveBeenCalledWith('tmp/upload.xlsx');
    expect(next).toHaveBeenCalledWith(error);
  });
});
