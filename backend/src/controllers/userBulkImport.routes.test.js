const request = require('supertest');
const ExcelJS = require('exceljs');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/userBulkImport.service', () => {
  const actual = jest.requireActual('../services/userBulkImport.service');
  return {
    ...actual,
    parseUserImportWorkbook: jest.fn(),
    classifyUserImportRows: jest.fn(),
    commitUserImport: jest.fn()
  };
});

jest.mock('../services/auditLog.service', () => ({
  AUDIT_EVENT_TYPES: {
    BULK_USER_IMPORT_PREVIEWED: 'BULK_USER_IMPORT_PREVIEWED',
    BULK_USER_IMPORT_COMMITTED: 'BULK_USER_IMPORT_COMMITTED'
  },
  buildAuditContextFromRequest: jest.fn((req) => ({
    actorId: req.user?.id,
    actorRole: req.user?.role,
    actorEmail: req.user?.email
  })),
  createAuditLogSafely: jest.fn().mockResolvedValue(null)
}));

const authService = require('../services/auth.service');
const userBulkImportService = require('../services/userBulkImport.service');
const auditLogService = require('../services/auditLog.service');
const logger = require('../config/logger');
const app = require('../server');

const adminUser = {
  id: 1,
  name: 'Admin Demo',
  email: 'admin.demo@uniosun.edu.ng',
  role: 'admin',
  status: 'active'
};

const studentUser = { ...adminUser, id: 2, role: 'student', email: 'student.demo@uniosun.edu.ng' };
const lecturerUser = { ...adminUser, id: 3, role: 'lecturer', email: 'lecturer.demo@uniosun.edu.ng' };

const TEMP_PASSWORD = 'Zx8Kq2NvPw4RtY6u';

function xlsxAttachment(requestBuilder) {
  return requestBuilder.attach('file', Buffer.from('xlsx-placeholder'), {
    filename: 'cohort.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function stubParsedWorkbook() {
  return {
    rows: [{ rowNumber: 2, values: { name: 'Ada', email: 'ada@uniosun.edu.ng', role: 'student', matricNumber: 'CSC/21/0001' } }],
    metadata: { sheet_name: 'Users', total_parsed_rows: 1, ignored_columns: [], warnings: [] }
  };
}

function stubClassification() {
  return {
    rows: [{
      row_number: 2,
      status: 'valid_new',
      name: 'Ada',
      email: 'ada@uniosun.edu.ng',
      role: 'student',
      matric_number: 'CSC/21/0001',
      messages: [],
      warnings: []
    }],
    internalRows: [],
    summary: { total_rows: 1, valid_new: 1, already_exists: 0, duplicate_in_file: 0, conflict: 0, invalid: 0, warnings: 0 }
  };
}

function stubCommitResult() {
  return {
    importBatchId: 'user-import-20260822-abc123',
    summary: stubClassification().summary,
    rows: stubClassification().rows,
    createdUsers: [{
      id: 7,
      name: 'Ada',
      email: 'ada@uniosun.edu.ng',
      role: 'student',
      status: 'active',
      matricNumber: 'CSC/21/0001',
      mustChangePassword: true
    }],
    credentialRows: [{
      name: 'Ada',
      email: 'ada@uniosun.edu.ng',
      role: 'student',
      matricNumber: 'CSC/21/0001',
      temporaryPassword: TEMP_PASSWORD
    }],
    timing: { hash_ms: 10, transaction_ms: 5 }
  };
}

describe('Admin-protected bulk user import routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userBulkImportService.parseUserImportWorkbook.mockResolvedValue(stubParsedWorkbook());
    userBulkImportService.classifyUserImportRows.mockResolvedValue(stubClassification());
    userBulkImportService.commitUserImport.mockResolvedValue(stubCommitResult());
  });

  describe('authorization', () => {
    test.each([
      ['preview', '/api/v1/admin/users/import/preview'],
      ['commit', '/api/v1/admin/users/import/commit']
    ])('unauthenticated %s is denied', async (_label, url) => {
      authService.authenticateToken.mockRejectedValue({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required.'
      });

      const response = await request(app).post(url).expect(401);
      expect(response.body.details.error_code).toBe('AUTHENTICATION_REQUIRED');
      expect(userBulkImportService.parseUserImportWorkbook).not.toHaveBeenCalled();
      expect(userBulkImportService.commitUserImport).not.toHaveBeenCalled();
    });

    test.each([
      ['student', 'preview', '/api/v1/admin/users/import/preview'],
      ['student', 'commit', '/api/v1/admin/users/import/commit'],
      ['lecturer', 'preview', '/api/v1/admin/users/import/preview'],
      ['lecturer', 'commit', '/api/v1/admin/users/import/commit']
    ])('%s cannot call %s', async (role, _label, url) => {
      authService.authenticateToken.mockResolvedValue(role === 'student' ? studentUser : lecturerUser);

      const response = await request(app)
        .post(url)
        .set('Cookie', ['rtadss_session=token'])
        .expect(403);
      expect(response.body.details.error_code).toBe('FORBIDDEN');
      expect(userBulkImportService.parseUserImportWorkbook).not.toHaveBeenCalled();
      expect(userBulkImportService.commitUserImport).not.toHaveBeenCalled();
    });

    test('non-admins cannot download the template', async () => {
      authService.authenticateToken.mockResolvedValue(lecturerUser);
      await request(app)
        .get('/api/v1/admin/users/import/template')
        .set('Cookie', ['rtadss_session=token'])
        .expect(403);
    });
  });

  describe('admin preview', () => {
    beforeEach(() => {
      authService.authenticateToken.mockResolvedValue(adminUser);
    });

    test('classifies the uploaded workbook without creating anything and audits the preview', async () => {
      const response = await xlsxAttachment(
        request(app)
          .post('/api/v1/admin/users/import/preview')
          .set('Cookie', ['rtadss_session=token'])
      ).expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          mode: 'preview',
          summary: { valid_new: 1 }
        }
      });
      expect(userBulkImportService.commitUserImport).not.toHaveBeenCalled();
      expect(auditLogService.createAuditLogSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BULK_USER_IMPORT_PREVIEWED',
          actorId: adminUser.id,
          targetType: 'UserBulkImport',
          metadata: expect.objectContaining({
            mode: 'preview',
            filename: 'cohort.xlsx'
          })
        })
      );
    });

    test('rejects requests without a file and non-xlsx uploads', async () => {
      const missing = await request(app)
        .post('/api/v1/admin/users/import/preview')
        .set('Cookie', ['rtadss_session=token'])
        .expect(400);
      expect(missing.body.error.code).toBe('MISSING_FILE');

      const wrongType = await request(app)
        .post('/api/v1/admin/users/import/preview')
        .set('Cookie', ['rtadss_session=token'])
        .attach('file', Buffer.from('a,b,c'), { filename: 'cohort.csv', contentType: 'text/csv' })
        .expect(400);
      expect(wrongType.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    test('reports malformed workbooks cleanly', async () => {
      const { UserBulkImportError } = jest.requireActual('../services/userBulkImport.service');
      userBulkImportService.parseUserImportWorkbook.mockRejectedValue(
        new UserBulkImportError('The file could not be read as an .xlsx workbook.', { code: 'MALFORMED_WORKBOOK', field: 'file' })
      );

      const response = await xlsxAttachment(
        request(app)
          .post('/api/v1/admin/users/import/preview')
          .set('Cookie', ['rtadss_session=token'])
      ).expect(400);
      expect(response.body.error.code).toBe('MALFORMED_WORKBOOK');
    });
  });

  describe('admin commit', () => {
    beforeEach(() => {
      authService.authenticateToken.mockResolvedValue(adminUser);
    });

    test('re-parses the file, commits, applies no-store semantics and returns a decodable one-time manifest', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const warnSpy = jest.spyOn(logger, 'warn');
      const errorSpy = jest.spyOn(logger, 'error');

      const response = await xlsxAttachment(
        request(app)
          .post('/api/v1/admin/users/import/commit')
          .set('Cookie', ['rtadss_session=token'])
          .field('role', 'admin')
          .field('status', 'active')
      ).expect(200);

      // Commit derives everything from the uploaded file: the classification
      // passed to the service came from server-side parse+classify, and body
      // fields (role=admin above) are never consulted.
      expect(userBulkImportService.parseUserImportWorkbook).toHaveBeenCalledTimes(1);
      expect(userBulkImportService.classifyUserImportRows).toHaveBeenCalledTimes(1);
      const commitArgs = userBulkImportService.commitUserImport.mock.calls[0][0];
      expect(Object.keys(commitArgs).sort()).toEqual(['actor', 'classification', 'req', 'sourceFilename']);
      expect(commitArgs.classification).toEqual(stubClassification());

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers.pragma).toBe('no-cache');

      expect(response.body.data.created_users).toHaveLength(1);
      expect(response.body.data.created_users[0].role).toBe('student');
      expect(JSON.stringify(response.body.data.created_users)).not.toContain(TEMP_PASSWORD);
      expect(response.body.meta.credentialNotice).toMatch(/shown once/);

      const manifest = response.body.data.credential_manifest;
      expect(manifest.rows).toBe(1);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(manifest.content_base64, 'base64'));
      const sheet = workbook.getWorksheet('Credentials');
      expect(sheet.rowCount).toBe(2);
      expect(sheet.getRow(2).values.slice(1)).toEqual([
        'Ada', 'ada@uniosun.edu.ng', 'student', 'CSC/21/0001', TEMP_PASSWORD
      ]);

      // The plaintext credential never reaches the application logs.
      for (const spy of [infoSpy, warnSpy, errorSpy]) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(TEMP_PASSWORD);
        spy.mockRestore();
      }
    });

    test('omits the manifest when nothing new was created', async () => {
      userBulkImportService.commitUserImport.mockResolvedValue({
        ...stubCommitResult(),
        createdUsers: [],
        credentialRows: []
      });

      const response = await xlsxAttachment(
        request(app)
          .post('/api/v1/admin/users/import/commit')
          .set('Cookie', ['rtadss_session=token'])
      ).expect(200);

      expect(response.body.data.credential_manifest).toBeUndefined();
      expect(response.body.meta.credentialNotice).toBeUndefined();
    });

    test('reports a contested batch as 409 without partial creation claims', async () => {
      const { BulkImportStateChangedError } = jest.requireActual('../services/userBulkImport.service');
      userBulkImportService.commitUserImport.mockRejectedValue(
        new BulkImportStateChangedError([{ email: 'raced@uniosun.edu.ng', reason: 'email now belongs to an existing account' }])
      );

      const response = await xlsxAttachment(
        request(app)
          .post('/api/v1/admin/users/import/commit')
          .set('Cookie', ['rtadss_session=token'])
      ).expect(409);

      expect(response.body.error.code).toBe('BULK_IMPORT_STATE_CHANGED');
      expect(response.body.error.message).toMatch(/No accounts were created/);
      expect(response.body.error.contested[0].email).toBe('raced@uniosun.edu.ng');
    });
  });

  describe('one-time semantics of the manifest', () => {
    test('there is no GET endpoint that can return credentials again', async () => {
      authService.authenticateToken.mockResolvedValue(adminUser);

      for (const url of [
        '/api/v1/admin/users/import/commit',
        '/api/v1/admin/users/import/preview',
        '/api/v1/admin/users/import/manifest',
        '/api/v1/admin/users/import/credentials'
      ]) {
        const response = await request(app)
          .get(url)
          .set('Cookie', ['rtadss_session=token']);
        expect(response.status).toBe(404);
      }
    });

    test('the template download is credential-free xlsx', async () => {
      authService.authenticateToken.mockResolvedValue(adminUser);

      const response = await request(app)
        .get('/api/v1/admin/users/import/template')
        .set('Cookie', ['rtadss_session=token'])
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml');
      expect(response.headers['content-disposition']).toContain('user-onboarding-template.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(response.body);
      const headers = workbook.worksheets[0].getRow(1).values.slice(1);
      expect(headers).toEqual(['name', 'email', 'role', 'matric_number']);
    });
  });
});
