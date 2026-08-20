const fs = require('fs/promises');
const path = require('path');
const { normalizeTopicImportFile } = require('../services/topicImportFile.service');
const {
  persistNormalizedTopicImport,
  TopicImportEmbeddingUnavailableError
} = require('../services/topicImportPersistence.service');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('../services/auditLog.service');
const notificationEventService = require('../services/notificationEvent.service');

const XLSX_EXTENSION = '.xlsx';

function buildImportErrorResponse(message, errorCode, field) {
  return {
    status: 'error',
    message,
    details: {
      error_code: errorCode,
      field
    }
  };
}

function validateUploadedFile(file) {
  if (!file) {
    return buildImportErrorResponse('Import file is required.', 'MISSING_FILE', 'file');
  }

  const extension = path.extname(file.originalname || '').toLowerCase();
  if (extension !== XLSX_EXTENSION) {
    return buildImportErrorResponse('Only .xlsx import files are supported.', 'UNSUPPORTED_FILE_TYPE', 'file');
  }

  return null;
}

function buildImportOptions(req) {
  return {
    sheetName: req.body?.sheetName || undefined
  };
}

function buildPersistenceOptions(req) {
  return {
    sourceType: req.body?.sourceType || 'xlsx',
    sourceFilename: req.body?.sourceFilename || req.file?.originalname || null,
    importBatchId: req.body?.importBatchId || `import-${Date.now()}`
  };
}

function buildPreviewAuditMetadata({ req, result }) {
  return {
    mode: 'preview',
    filename: req.file?.originalname || null,
    requestedSheetName: req.body?.sheetName || null,
    parsedSheetName: result.metadata?.sheet_name || null,
    totalParsedRows: result.metadata?.total_parsed_rows ?? null,
    report: {
      totalRows: result.report?.total_rows ?? null,
      acceptedRows: result.report?.accepted_rows ?? null,
      skippedRows: result.report?.skipped_rows ?? null,
      missingTitleRows: result.report?.missing_title_rows ?? null,
      incompleteContextRows: result.report?.incomplete_context_rows ?? null,
      duplicateTitleRows: result.report?.duplicate_title_rows ?? null
    }
  };
}

function buildCommitAuditMetadata({ req, importResult, persistenceOptions, persistenceReport }) {
  return {
    mode: 'commit',
    filename: req.file?.originalname || null,
    sourceFilename: persistenceOptions.sourceFilename,
    sourceType: persistenceOptions.sourceType,
    importBatchId: persistenceOptions.importBatchId,
    requestedSheetName: req.body?.sheetName || null,
    parsedSheetName: importResult.metadata?.sheet_name || null,
    totalParsedRows: importResult.metadata?.total_parsed_rows ?? null,
    importReport: {
      totalRows: importResult.report?.total_rows ?? null,
      acceptedRows: importResult.report?.accepted_rows ?? null,
      skippedRows: importResult.report?.skipped_rows ?? null,
      missingTitleRows: importResult.report?.missing_title_rows ?? null,
      incompleteContextRows: importResult.report?.incomplete_context_rows ?? null,
      duplicateTitleRows: importResult.report?.duplicate_title_rows ?? null
    },
    persistenceReport: {
      attemptedRecords: persistenceReport?.attempted_records ?? null,
      insertedRecords: persistenceReport?.inserted_records ?? null,
      failedRecords: persistenceReport?.failed_records ?? null,
      skippedRecords: persistenceReport?.skipped_records ?? null,
      duplicateRecords: persistenceReport?.duplicate_records ?? null,
      searchableRecords: persistenceReport?.searchable_records ?? null,
      embeddingGenerated: persistenceReport?.embedding_generated ?? null,
      corpusRefreshed: persistenceReport?.corpus_refreshed ?? null,
      insertedByBucket: persistenceReport?.inserted_by_bucket || null
    }
  };
}

async function recordImportAuditEvent(req, { eventType, targetId = null, metadata }) {
  await createAuditLogSafely({
    eventType,
    ...buildAuditContextFromRequest(req),
    targetType: 'TopicImport',
    targetId,
    metadata
  });
}

async function cleanupUploadedFile(file) {
  if (!file?.path) {
    return;
  }

  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function sendWorksheetNotFoundResponse(res) {
  return res.status(400).json(
    buildImportErrorResponse('Worksheet not found.', 'WORKSHEET_NOT_FOUND', 'sheetName')
  );
}

async function previewTopicImport(req, res, next) {
  try {
    const fileError = validateUploadedFile(req.file);
    if (fileError) {
      return res.status(400).json(fileError);
    }

    const result = await normalizeTopicImportFile(req.file.path, buildImportOptions(req));
    await recordImportAuditEvent(req, {
      eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_PREVIEWED,
      targetId: req.body?.importBatchId || null,
      metadata: buildPreviewAuditMetadata({ req, result })
    });
    await notificationEventService.notifyAdminImportPreviewedSafely({
      actorUser: req.user,
      fileName: req.file?.originalname || null,
      report: result.report,
      importBatchId: req.body?.importBatchId || null
    });

    return res.status(200).json({
      status: 'success',
      data: {
        mode: 'preview',
        metadata: result.metadata,
        records: result.records,
        import_report: result.report
      }
    });
  } catch (error) {
    if (error.message === 'worksheet not found') {
      return sendWorksheetNotFoundResponse(res);
    }

    return next(error);
  } finally {
    try {
      await cleanupUploadedFile(req.file);
    } catch (error) {
      next(error);
    }
  }
}

async function commitTopicImport(req, res, next) {
  try {
    const fileError = validateUploadedFile(req.file);
    if (fileError) {
      return res.status(400).json(fileError);
    }

    const importResult = await normalizeTopicImportFile(req.file.path, buildImportOptions(req));
    const persistenceOptions = buildPersistenceOptions(req);
    const persistenceReport = await persistNormalizedTopicImport(
      importResult.records,
      persistenceOptions
    );
    await recordImportAuditEvent(req, {
      eventType: AUDIT_EVENT_TYPES.TOPIC_IMPORT_COMMITTED,
      targetId: persistenceOptions.importBatchId,
      metadata: buildCommitAuditMetadata({
        req,
        importResult,
        persistenceOptions,
        persistenceReport
      })
    });
    await notificationEventService.notifyAdminImportCommittedSafely({
      actorUser: req.user,
      fileName: req.file?.originalname || null,
      report: importResult.report,
      persistenceReport,
      importBatchId: persistenceOptions.importBatchId
    });

    return res.status(200).json({
      status: 'success',
      data: {
        mode: 'commit',
        metadata: importResult.metadata,
        import_report: importResult.report,
        persistence_report: persistenceReport
      }
    });
  } catch (error) {
    if (error.message === 'worksheet not found') {
      return sendWorksheetNotFoundResponse(res);
    }

    if (error instanceof TopicImportEmbeddingUnavailableError) {
      return res.status(503).json({
        status: 'error',
        message: 'Topic import was not committed because semantic embeddings could not be generated. No records were persisted.',
        details: {
          error_code: 'SEMANTIC_PROVIDER_UNAVAILABLE',
          field: 'file',
          reason: error.message,
          attempted_records: error.attemptedRecords,
          embedded_before_failure: error.embeddedBeforeFailure
        }
      });
    }

    return next(error);
  } finally {
    try {
      await cleanupUploadedFile(req.file);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = {
  previewTopicImport,
  commitTopicImport,
  cleanupUploadedFile,
  buildImportErrorResponse,
  buildPreviewAuditMetadata,
  buildCommitAuditMetadata
};
