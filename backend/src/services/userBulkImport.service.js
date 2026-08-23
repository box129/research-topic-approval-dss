const crypto = require('crypto');
const ExcelJS = require('exceljs');
const prisma = require('../config/database');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');
const {
  UserProvisioningError,
  generateTemporaryPassword,
  normalizeName,
  normalizeCanonicalEmail,
  normalizeProvisionRole,
  normalizeMatricNumber
} = require('./userProvisioning.service');
const { hashPasswordsBounded } = require('./credentialHashing.service');
const { serializeUser } = require('./adminUser.service');
const { parseWorksheetRows } = require('./topicImportFile.service');

// Bulk onboarding reuses the Phase-2 individual-provisioning contract in full:
// the same name/email/role/matric normalizers, the same temporary-credential
// generator, bcrypt-only storage, mustChangePassword, and the same audit
// vocabulary. This module only adds the spreadsheet lifecycle around it:
// parse -> classify (preview) -> commit.

const USER_IMPORT_ROW_STATUS = Object.freeze({
  VALID_NEW: 'valid_new',
  ALREADY_EXISTS: 'already_exists',
  DUPLICATE_IN_FILE: 'duplicate_in_file',
  CONFLICT: 'conflict',
  INVALID: 'invalid'
});

// Comfortably above the ~650-user departmental cohort while still bounding
// upload parsing and hashing work per request.
const MAX_IMPORT_DATA_ROWS = 2000;

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Canonical logical fields with the spreadsheet header spellings accepted for
// each. Header matching is case/spacing/underscore-insensitive; anything not
// listed here is reported back to the administrator as an ignored column.
const HEADER_FIELD_ALIASES = Object.freeze({
  name: ['name', 'full name', 'student name', 'staff name', 'fullname'],
  email: ['email', 'email address', 'university email', 'e mail'],
  role: ['role', 'account role', 'user role', 'account type'],
  matricNumber: ['matric number', 'matric', 'matric no', 'matricnumber', 'matriculation number']
});

const REQUIRED_FIELDS = ['name', 'email', 'role'];

const TEMPLATE_HEADERS = ['name', 'email', 'role', 'matric_number'];

class UserBulkImportError extends Error {
  constructor(message, { code = 'USER_BULK_IMPORT_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'UserBulkImportError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

// Raised when commit-time revalidation (or the database's own uniqueness
// constraints) find that directory state changed after preview. The whole
// batch is refused so the administrator never gets a silently different
// cohort than the one they approved.
class BulkImportStateChangedError extends UserBulkImportError {
  constructor(contested = []) {
    super(
      'The user directory changed while this import was being committed. No accounts were created. Re-run the preview and commit again.',
      { code: 'BULK_IMPORT_STATE_CHANGED', statusCode: 409 }
    );
    this.name = 'BulkImportStateChangedError';
    this.contested = contested;
  }
}

function normalizeHeaderKey(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function buildHeaderMapping(headers) {
  const aliasToField = new Map();
  for (const [field, aliases] of Object.entries(HEADER_FIELD_ALIASES)) {
    for (const alias of aliases) {
      aliasToField.set(alias, field);
    }
  }

  const fieldToHeader = {};
  const ignoredColumns = [];

  for (const header of headers) {
    if (!header) {
      continue;
    }
    const field = aliasToField.get(normalizeHeaderKey(header));
    if (!field) {
      ignoredColumns.push(header);
      continue;
    }
    if (fieldToHeader[field] && fieldToHeader[field] !== header) {
      throw new UserBulkImportError(
        `Columns "${fieldToHeader[field]}" and "${header}" both map to the ${field} field. Remove one of them.`,
        { code: 'IMPORT_TEMPLATE_AMBIGUOUS', field: 'file' }
      );
    }
    fieldToHeader[field] = header;
  }

  const missing = REQUIRED_FIELDS.filter((field) => !fieldToHeader[field]);
  if (missing.length > 0) {
    throw new UserBulkImportError(
      `The spreadsheet is missing required column(s): ${missing.join(', ')}. Expected columns: name, email, role and optionally matric_number. Download the template for the supported layout.`,
      { code: 'IMPORT_TEMPLATE_UNRECOGNIZED', field: 'file' }
    );
  }

  return { fieldToHeader, ignoredColumns };
}

function rawCell(row, header) {
  if (!header || !Object.prototype.hasOwnProperty.call(row, header)) {
    return '';
  }
  return String(row[header] ?? '').trim();
}

/**
 * Reads a departmental user workbook from disk into raw rows keyed by the
 * canonical logical fields. Throws UserBulkImportError for malformed,
 * empty, oversized, or unrecognizable workbooks.
 */
async function parseUserImportWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    throw new UserBulkImportError('The file could not be read as an .xlsx workbook.', {
      code: 'MALFORMED_WORKBOOK',
      field: 'file'
    });
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new UserBulkImportError('The workbook contains no worksheet with user rows.', {
      code: 'EMPTY_IMPORT',
      field: 'file'
    });
  }

  const { headers, rows, rowNumbers } = parseWorksheetRows(worksheet);
  if (!headers.some(Boolean) || rows.length === 0) {
    throw new UserBulkImportError('The workbook contains no user rows to import.', {
      code: 'EMPTY_IMPORT',
      field: 'file'
    });
  }

  if (rows.length > MAX_IMPORT_DATA_ROWS) {
    throw new UserBulkImportError(
      `The workbook has ${rows.length} data rows; the maximum supported per import is ${MAX_IMPORT_DATA_ROWS}. Split the file and import in parts.`,
      { code: 'IMPORT_TOO_MANY_ROWS', field: 'file' }
    );
  }

  const { fieldToHeader, ignoredColumns } = buildHeaderMapping(headers);

  const parsedRows = rows.map((row, index) => ({
    rowNumber: rowNumbers[index],
    values: {
      name: rawCell(row, fieldToHeader.name),
      email: rawCell(row, fieldToHeader.email),
      role: rawCell(row, fieldToHeader.role),
      matricNumber: rawCell(row, fieldToHeader.matricNumber)
    }
  }));

  return {
    rows: parsedRows,
    metadata: {
      sheet_name: worksheet.name,
      total_parsed_rows: parsedRows.length,
      ignored_columns: ignoredColumns,
      warnings: ignoredColumns.length
        ? [`Unrecognized column(s) ignored: ${ignoredColumns.join(', ')}`]
        : []
    }
  };
}

function normalizeRowIdentity(values) {
  const name = normalizeName(values.name);
  const email = normalizeCanonicalEmail(values.email);
  const role = normalizeProvisionRole(values.role);
  const matricNumber = normalizeMatricNumber(values.matricNumber);

  if (matricNumber && role !== 'STUDENT') {
    throw new UserProvisioningError('Matric numbers only apply to student accounts.', {
      code: 'USER_PROVISION_MATRIC_ROLE_MISMATCH',
      field: 'matricNumber'
    });
  }

  return { name, email, role, matricNumber };
}

function sameNormalizedName(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function buildSummary(rows) {
  const summary = {
    total_rows: rows.length,
    valid_new: 0,
    already_exists: 0,
    duplicate_in_file: 0,
    conflict: 0,
    invalid: 0,
    warnings: 0
  };

  for (const row of rows) {
    switch (row.status) {
      case USER_IMPORT_ROW_STATUS.VALID_NEW:
        summary.valid_new += 1;
        break;
      case USER_IMPORT_ROW_STATUS.ALREADY_EXISTS:
        summary.already_exists += 1;
        break;
      case USER_IMPORT_ROW_STATUS.DUPLICATE_IN_FILE:
        summary.duplicate_in_file += 1;
        break;
      case USER_IMPORT_ROW_STATUS.CONFLICT:
        summary.conflict += 1;
        break;
      default:
        summary.invalid += 1;
        break;
    }
    if (row.warnings.length > 0) {
      summary.warnings += 1;
    }
  }

  return summary;
}

function toClientRole(role) {
  return String(role || '').toLowerCase();
}

function generateImportBatchId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `user-import-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

function createUserBulkImportService({
  prismaClient = prisma,
  audit = { createAuditLogSafely },
  hashPasswords = hashPasswordsBounded,
  generatePassword = generateTemporaryPassword
} = {}) {
  /**
   * Classifies every parsed spreadsheet row against the current database
   * state without mutating anything. This is the single source of truth for
   * both preview and commit; commit re-runs it so stale preview results can
   * never bypass server-side validation.
   */
  const classifyUserImportRows = async (parsedRows) => {
    const rows = parsedRows.map((parsedRow) => ({
      row_number: parsedRow.rowNumber,
      input: { ...parsedRow.values },
      identity: null,
      status: null,
      messages: [],
      warnings: []
    }));

    // Step 1: field validation through the exact Phase-2 normalizers.
    for (const row of rows) {
      try {
        row.identity = normalizeRowIdentity(row.input);
      } catch (error) {
        if (error instanceof UserProvisioningError) {
          row.status = USER_IMPORT_ROW_STATUS.INVALID;
          row.messages.push(error.message);
        } else {
          throw error;
        }
      }
    }

    const validRows = rows.filter((row) => row.identity);

    // Step 2: duplicates and contradictions inside the file itself.
    const byEmail = new Map();
    for (const row of validRows) {
      const group = byEmail.get(row.identity.email) || [];
      group.push(row);
      byEmail.set(row.identity.email, group);
    }

    for (const group of byEmail.values()) {
      if (group.length < 2) {
        continue;
      }
      const [first, ...rest] = group;
      const contradictory = rest.some((row) => (
        row.identity.role !== first.identity.role
        || (row.identity.matricNumber || null) !== (first.identity.matricNumber || null)
        || !sameNormalizedName(row.identity.name, first.identity.name)
      ));

      if (contradictory) {
        const rowNumbers = group.map((row) => row.row_number).join(', ');
        for (const row of group) {
          row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
          row.messages.push(`Email ${row.identity.email} appears in rows ${rowNumbers} with different identity details. Fix the spreadsheet; nothing was decided automatically.`);
        }
      } else {
        for (const row of rest) {
          row.status = USER_IMPORT_ROW_STATUS.DUPLICATE_IN_FILE;
          row.messages.push(`Duplicate of row ${first.row_number} (same account). Only the first occurrence is considered.`);
        }
      }
    }

    const byMatric = new Map();
    for (const row of validRows) {
      if (!row.identity.matricNumber || row.status) {
        continue;
      }
      const group = byMatric.get(row.identity.matricNumber) || [];
      group.push(row);
      byMatric.set(row.identity.matricNumber, group);
    }

    for (const [matricNumber, group] of byMatric.entries()) {
      const distinctEmails = new Set(group.map((row) => row.identity.email));
      if (distinctEmails.size < 2) {
        continue;
      }
      const rowNumbers = group.map((row) => row.row_number).join(', ');
      for (const row of group) {
        row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
        row.messages.push(`Matric number ${matricNumber} is assigned to different accounts in rows ${rowNumbers}.`);
      }
    }

    // Step 3: authoritative database comparison, batched to avoid per-row
    // queries at the ~650-user departmental scale.
    const undecided = validRows.filter((row) => !row.status);
    const emails = [...new Set(undecided.map((row) => row.identity.email))];
    const matrics = [...new Set(undecided.map((row) => row.identity.matricNumber).filter(Boolean))];

    const [existingByEmailRows, existingByMatricRows] = await Promise.all([
      emails.length
        ? prismaClient.user.findMany({ where: { email: { in: emails } } })
        : Promise.resolve([]),
      matrics.length
        ? prismaClient.user.findMany({ where: { matricNumber: { in: matrics } } })
        : Promise.resolve([])
    ]);

    const existingByEmail = new Map(existingByEmailRows.map((user) => [user.email, user]));
    const existingByMatric = new Map(existingByMatricRows.map((user) => [user.matricNumber, user]));

    for (const row of undecided) {
      const { name, email, role, matricNumber } = row.identity;
      const emailOwner = existingByEmail.get(email) || null;
      const matricOwner = matricNumber ? existingByMatric.get(matricNumber) || null : null;

      if (emailOwner) {
        if (emailOwner.role !== role) {
          row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
          row.messages.push(`Email ${email} already belongs to an existing ${toClientRole(emailOwner.role)} account, but this row says ${toClientRole(role)}.`);
          continue;
        }
        if (matricOwner && matricOwner.id !== emailOwner.id) {
          row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
          row.messages.push(`Email ${email} belongs to one existing account but matric number ${matricNumber} belongs to a different account (${matricOwner.email}).`);
          continue;
        }
        if (matricNumber && emailOwner.matricNumber && emailOwner.matricNumber !== matricNumber) {
          row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
          row.messages.push(`Existing account ${email} has matric number ${emailOwner.matricNumber}, but this row says ${matricNumber}. Use identity correction if the stored value is wrong.`);
          continue;
        }
        if (matricNumber && !emailOwner.matricNumber) {
          row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
          row.messages.push(`Existing account ${email} has no matric number on record. Imports never modify existing accounts; add it through identity correction instead.`);
          continue;
        }

        row.status = USER_IMPORT_ROW_STATUS.ALREADY_EXISTS;
        row.messages.push('An account with this identity already exists. It is skipped; no new credential is generated.');
        if (!sameNormalizedName(emailOwner.name, name)) {
          row.warnings.push(`Name differs from the existing record ("${emailOwner.name}"). The existing name is kept.`);
        }
        if (emailOwner.status === 'SUSPENDED') {
          row.warnings.push('The existing account is currently suspended.');
        }
        continue;
      }

      if (matricOwner) {
        row.status = USER_IMPORT_ROW_STATUS.CONFLICT;
        row.messages.push(`Matric number ${matricNumber} already belongs to existing account ${matricOwner.email}.`);
        continue;
      }

      row.status = USER_IMPORT_ROW_STATUS.VALID_NEW;
    }

    const clientRows = rows.map((row) => ({
      row_number: row.row_number,
      status: row.status,
      name: row.identity ? row.identity.name : row.input.name || null,
      email: row.identity ? row.identity.email : row.input.email || null,
      role: row.identity ? toClientRole(row.identity.role) : row.input.role || null,
      matric_number: row.identity ? row.identity.matricNumber : row.input.matricNumber || null,
      messages: row.messages,
      warnings: row.warnings
    }));

    return {
      rows: clientRows,
      internalRows: rows,
      summary: buildSummary(rows)
    };
  };

  /**
   * Creates every VALID_NEW account from a fresh classification as one
   * protected batch. Credentials are generated and bcrypt-hashed BEFORE the
   * database transaction opens (CPU work must not extend the transaction),
   * then the transaction revalidates directory state and inserts the cohort
   * atomically. Any contested identity aborts the whole batch.
   */
  const commitUserImport = async ({ classification, actor, req, sourceFilename = null } = {}) => {
    const importBatchId = generateImportBatchId();
    const summary = classification.summary;
    const toCreate = classification.internalRows.filter(
      (row) => row.status === USER_IMPORT_ROW_STATUS.VALID_NEW
    );

    const writeBatchAudit = async (extraMetadata) => {
      await audit.createAuditLogSafely({
        eventType: AUDIT_EVENT_TYPES.BULK_USER_IMPORT_COMMITTED,
        ...buildAuditContextFromRequest(req),
        targetType: 'UserBulkImport',
        targetId: importBatchId,
        metadata: {
          importBatchId,
          sourceFilename,
          totalRows: summary.total_rows,
          createdCount: 0,
          alreadyExistingCount: summary.already_exists,
          duplicateInFileCount: summary.duplicate_in_file,
          conflictCount: summary.conflict,
          invalidCount: summary.invalid,
          committedByAdminId: actor?.id ?? null,
          ...extraMetadata
        }
      });
    };

    if (toCreate.length === 0) {
      await writeBatchAudit({ outcome: 'no-new-accounts' });
      return {
        importBatchId,
        summary,
        rows: classification.rows,
        createdUsers: [],
        credentialRows: [],
        timing: { hash_ms: 0, transaction_ms: 0 }
      };
    }

    // Credential material is prepared entirely outside the transaction.
    const credentials = toCreate.map(() => generatePassword());
    const hashStartedAt = Date.now();
    const passwordHashes = await hashPasswords(credentials);
    const hashDurationMs = Date.now() - hashStartedAt;

    const emails = toCreate.map((row) => row.identity.email);
    const matrics = toCreate.map((row) => row.identity.matricNumber).filter(Boolean);

    const transactionStartedAt = Date.now();
    let createdRecords;
    try {
      createdRecords = await prismaClient.$transaction(async (tx) => {
        // Commit-time revalidation: preview state is advisory only. Anything
        // that now exists (created by another administrator in the preview ->
        // commit window) contests the batch.
        const [emailClashes, matricClashes] = await Promise.all([
          tx.user.findMany({ where: { email: { in: emails } } }),
          matrics.length
            ? tx.user.findMany({ where: { matricNumber: { in: matrics } } })
            : Promise.resolve([])
        ]);

        if (emailClashes.length > 0 || matricClashes.length > 0) {
          throw new BulkImportStateChangedError([
            ...emailClashes.map((user) => ({ email: user.email, reason: 'email now belongs to an existing account' })),
            ...matricClashes.map((user) => ({ matricNumber: user.matricNumber, reason: 'matric number now belongs to an existing account' }))
          ]);
        }

        await tx.user.createMany({
          data: toCreate.map((row, index) => ({
            name: row.identity.name,
            email: row.identity.email,
            role: row.identity.role,
            status: 'ACTIVE',
            passwordHash: passwordHashes[index],
            matricNumber: row.identity.matricNumber,
            mustChangePassword: true
          }))
        });

        return tx.user.findMany({ where: { email: { in: emails } } });
      }, { timeout: 60000, maxWait: 10000 });
    } catch (error) {
      if (error instanceof BulkImportStateChangedError) {
        throw error;
      }
      if (error?.code === 'P2002') {
        // The database uniqueness constraints are the final race arbiter; a
        // clash between revalidation and insert still aborts the whole batch.
        throw new BulkImportStateChangedError([]);
      }
      throw error;
    }
    const transactionDurationMs = Date.now() - transactionStartedAt;

    const createdByEmail = new Map(createdRecords.map((user) => [user.email, user]));
    const createdUsers = [];
    const credentialRows = [];
    for (const [index, row] of toCreate.entries()) {
      const created = createdByEmail.get(row.identity.email);
      row.createdUserId = created.id;
      createdUsers.push(serializeUser(created));
      // Plaintext temporary credentials exist only in this in-memory response
      // structure; they are never persisted, logged, or audited.
      credentialRows.push({
        name: created.name,
        email: created.email,
        role: toClientRole(created.role),
        matricNumber: created.matricNumber || null,
        temporaryPassword: credentials[index]
      });
    }

    const createdStudentCount = createdUsers.filter((user) => user.role === 'student').length;
    await writeBatchAudit({
      outcome: 'committed',
      createdCount: createdUsers.length,
      createdStudentCount,
      createdLecturerCount: createdUsers.length - createdStudentCount,
      hashDurationMs,
      transactionDurationMs
    });

    for (const row of toCreate) {
      await audit.createAuditLogSafely({
        eventType: AUDIT_EVENT_TYPES.USER_PROVISIONED,
        ...buildAuditContextFromRequest(req),
        targetType: 'User',
        targetId: String(row.createdUserId),
        metadata: {
          targetUserId: row.createdUserId,
          targetUserRole: row.identity.role,
          targetUserEmail: row.identity.email,
          matricNumberProvided: Boolean(row.identity.matricNumber),
          provisionedByAdminId: actor?.id ?? null,
          source: 'bulk-import',
          importBatchId
        }
      });
    }

    return {
      importBatchId,
      summary,
      rows: classification.rows,
      createdUsers,
      credentialRows,
      timing: { hash_ms: hashDurationMs, transaction_ms: transactionDurationMs }
    };
  };

  return {
    classifyUserImportRows,
    commitUserImport
  };
}

function setLiteralCell(row, columnIndex, value) {
  // Values are always written as primitive strings. ExcelJS only creates
  // formula cells from explicit { formula } objects, so a payload such as
  // "=HYPERLINK(...)" stays an inert text cell in the generated workbook.
  row.getCell(columnIndex).value = String(value ?? '');
}

/**
 * Builds the one-time credential manifest workbook for newly created
 * accounts. The caller streams/encodes the buffer directly into the commit
 * response; nothing is written to disk or database.
 */
async function buildCredentialManifestWorkbookBuffer(credentialRows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Credentials');
  sheet.columns = [
    { width: 32 }, { width: 38 }, { width: 12 }, { width: 18 }, { width: 24 }
  ];

  const header = sheet.getRow(1);
  ['Name', 'Email', 'Role', 'Matric Number', 'Temporary Password'].forEach((title, index) => {
    setLiteralCell(header, index + 1, title);
    header.getCell(index + 1).font = { bold: true };
  });

  credentialRows.forEach((entry, index) => {
    const row = sheet.getRow(index + 2);
    setLiteralCell(row, 1, entry.name);
    setLiteralCell(row, 2, entry.email);
    setLiteralCell(row, 3, entry.role);
    setLiteralCell(row, 4, entry.matricNumber || '');
    setLiteralCell(row, 5, entry.temporaryPassword);
  });

  const readme = workbook.addWorksheet('READ ME');
  readme.columns = [{ width: 110 }];
  [
    'ONE-TIME CREDENTIAL MANIFEST — HANDLE AS CONFIDENTIAL',
    '',
    'This file is the only copy of these temporary passwords. The system stores only bcrypt hashes and cannot show them again.',
    'Transfer each credential to its owner through a secure channel. Do not email or post this file in shared folders.',
    'Every listed user must sign in and change the temporary password before any other access is allowed.',
    'If a credential is lost, an administrator can issue a new one with the per-user "Reset credential" action.',
    'Delete this file securely once distribution is complete.'
  ].forEach((line, index) => {
    setLiteralCell(readme.getRow(index + 1), 1, line);
  });

  return workbook.xlsx.writeBuffer();
}

/**
 * Builds the downloadable import template with the supported columns and an
 * instructions sheet. Contains no user data.
 */
async function buildUserImportTemplateWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Users');
  sheet.columns = [
    { width: 32 }, { width: 38 }, { width: 14 }, { width: 18 }
  ];

  const header = sheet.getRow(1);
  TEMPLATE_HEADERS.forEach((title, index) => {
    setLiteralCell(header, index + 1, title);
    header.getCell(index + 1).font = { bold: true };
  });

  // Guide data entry for the role column without restricting the parser.
  for (let rowIndex = 2; rowIndex <= 700; rowIndex += 1) {
    sheet.getCell(rowIndex, 3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"student,lecturer"']
    };
  }

  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [{ width: 110 }];
  [
    'Departmental bulk user onboarding template',
    '',
    'Fill one row per account on the "Users" sheet. Supported columns:',
    'name — required. The person\'s full name.',
    'email — required. The institutional email address; it is stored lower-cased and must be unique.',
    'role — required. Either "student" or "lecturer". Administrator accounts can never be created by import.',
    'matric_number — optional, students only. Stored upper-cased without spaces; must be unique when provided.',
    '',
    'Upload the completed file under Admin → User Management → Bulk import users.',
    'The preview shows exactly what will happen to every row before anything is created.',
    'Existing accounts are never modified by an import; conflicting rows are reported instead.'
  ].forEach((line, index) => {
    setLiteralCell(instructions.getRow(index + 1), 1, line);
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  ...createUserBulkImportService(),
  createUserBulkImportService,
  parseUserImportWorkbook,
  buildCredentialManifestWorkbookBuffer,
  buildUserImportTemplateWorkbookBuffer,
  UserBulkImportError,
  BulkImportStateChangedError,
  USER_IMPORT_ROW_STATUS,
  MAX_IMPORT_DATA_ROWS,
  XLSX_MIME_TYPE,
  TEMPLATE_HEADERS
};
