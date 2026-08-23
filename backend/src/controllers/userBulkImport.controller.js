const {
  classifyUserImportRows,
  commitUserImport,
  parseUserImportWorkbook,
  buildCredentialManifestWorkbookBuffer,
  buildUserImportTemplateWorkbookBuffer,
  UserBulkImportError,
  BulkImportStateChangedError,
  XLSX_MIME_TYPE
} = require('../services/userBulkImport.service');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('../services/auditLog.service');
const { cleanupUploadedFile, validateUploadedFile } = require('./topicImport.controller');
const { setNoStoreHeaders } = require('../utils/httpCache');

const CREDENTIAL_NOTICE = 'The credential manifest is shown once and cannot be retrieved again. Download it now, transfer it securely, and delete it after distribution. Every listed user must change their temporary password at first login.';

function sendBulkImportError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    error: {
      code: error.code || 'USER_BULK_IMPORT_ERROR',
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
      ...(error instanceof BulkImportStateChangedError ? { contested: error.contested } : {})
    }
  });
}

function sendFileValidationError(res, fileError) {
  return res.status(400).json({
    success: false,
    error: {
      code: fileError.details?.error_code || 'INVALID_FILE',
      message: fileError.message,
      field: fileError.details?.field
    }
  });
}

async function loadClassification(req) {
  const parsed = await parseUserImportWorkbook(req.file.path);
  const classification = await classifyUserImportRows(parsed.rows);
  return { parsed, classification };
}

function buildSummaryAuditMetadata({ req, parsed, classification }) {
  return {
    filename: req.file?.originalname || null,
    totalParsedRows: parsed.metadata.total_parsed_rows,
    ignoredColumns: parsed.metadata.ignored_columns,
    summary: classification.summary
  };
}

async function previewBulkUserImport(req, res, next) {
  try {
    const fileError = validateUploadedFile(req.file);
    if (fileError) {
      return sendFileValidationError(res, fileError);
    }

    const { parsed, classification } = await loadClassification(req);

    await createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.BULK_USER_IMPORT_PREVIEWED,
      ...buildAuditContextFromRequest(req),
      targetType: 'UserBulkImport',
      targetId: null,
      metadata: {
        mode: 'preview',
        ...buildSummaryAuditMetadata({ req, parsed, classification })
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        mode: 'preview',
        metadata: parsed.metadata,
        summary: classification.summary,
        rows: classification.rows
      },
      meta: {
        auditEventType: AUDIT_EVENT_TYPES.BULK_USER_IMPORT_PREVIEWED,
        note: 'Preview only: no accounts were created. Commit re-validates every row against the live directory.'
      }
    });
  } catch (error) {
    if (error instanceof UserBulkImportError) {
      return sendBulkImportError(res, error);
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

async function commitBulkUserImport(req, res, next) {
  try {
    const fileError = validateUploadedFile(req.file);
    if (fileError) {
      return sendFileValidationError(res, fileError);
    }

    // The uploaded workbook is parsed and classified again from scratch:
    // commit never trusts client-side preview state.
    const { classification } = await loadClassification(req);

    const result = await commitUserImport({
      classification,
      actor: req.user,
      req,
      sourceFilename: req.file?.originalname || null
    });

    setNoStoreHeaders(res);

    const responseData = {
      mode: 'commit',
      import_batch_id: result.importBatchId,
      summary: result.summary,
      rows: result.rows,
      created_users: result.createdUsers,
      timing: result.timing
    };

    if (result.credentialRows.length > 0) {
      const manifestBuffer = await buildCredentialManifestWorkbookBuffer(result.credentialRows);
      responseData.credential_manifest = {
        filename: `user-onboarding-credentials-${result.importBatchId}.xlsx`,
        mime_type: XLSX_MIME_TYPE,
        rows: result.credentialRows.length,
        content_base64: Buffer.from(manifestBuffer).toString('base64')
      };
    }

    return res.status(200).json({
      success: true,
      data: responseData,
      meta: {
        auditEventType: AUDIT_EVENT_TYPES.BULK_USER_IMPORT_COMMITTED,
        ...(result.credentialRows.length > 0 ? { credentialNotice: CREDENTIAL_NOTICE } : {})
      }
    });
  } catch (error) {
    if (error instanceof UserBulkImportError) {
      return sendBulkImportError(res, error);
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

async function downloadUserImportTemplate(req, res, next) {
  try {
    const buffer = await buildUserImportTemplateWorkbookBuffer();
    res.set('Content-Type', XLSX_MIME_TYPE);
    res.set('Content-Disposition', 'attachment; filename="user-onboarding-template.xlsx"');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  previewBulkUserImport,
  commitBulkUserImport,
  downloadUserImportTemplate
};
