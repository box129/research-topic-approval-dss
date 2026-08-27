const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const {
  createUserBulkImportService,
  parseUserImportWorkbook,
  buildCredentialManifestWorkbookBuffer,
  buildUserImportTemplateWorkbookBuffer,
  UserBulkImportError,
  BulkImportStateChangedError,
  USER_IMPORT_ROW_STATUS,
  MAX_IMPORT_DATA_ROWS,
  TEMPLATE_HEADERS
} = require('./userBulkImport.service');
const { generateTemporaryPassword } = require('./userProvisioning.service');
const { validatePasswordPolicy } = require('./auth.service');
const { redactMetadata } = require('./auditLog.service');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-user-import-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let workbookCounter = 0;

async function writeWorkbook(rows, { headers = ['name', 'email', 'role', 'matric_number'], sheetName = 'Users' } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  if (headers) {
    sheet.addRow(headers);
  }
  rows.forEach((row) => sheet.addRow(row));
  workbookCounter += 1;
  const filePath = path.join(tmpDir, `workbook-${workbookCounter}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

function createPrismaMock({ users = [] } = {}) {
  const store = users.map((user) => ({ ...user }));
  let nextId = store.reduce((max, user) => Math.max(max, user.id), 0) + 1;

  const api = {
    user: {
      findMany: jest.fn(({ where } = {}) => {
        if (where?.email?.in) {
          return Promise.resolve(store.filter((user) => where.email.in.includes(user.email)).map((user) => ({ ...user })));
        }
        if (where?.matricNumber?.in) {
          return Promise.resolve(store.filter((user) => user.matricNumber && where.matricNumber.in.includes(user.matricNumber)).map((user) => ({ ...user })));
        }
        return Promise.resolve(store.map((user) => ({ ...user })));
      }),
      createMany: jest.fn(({ data }) => {
        for (const row of data) {
          if (store.some((user) => user.email === row.email)) {
            return Promise.reject({ code: 'P2002' });
          }
          if (row.matricNumber && store.some((user) => user.matricNumber === row.matricNumber)) {
            return Promise.reject({ code: 'P2002' });
          }
        }
        const created = data.map((row) => ({
          id: nextId++,
          credentialVersion: 1,
          createdAt: new Date('2026-08-22T09:00:00.000Z'),
          updatedAt: new Date('2026-08-22T09:00:00.000Z'),
          ...row
        }));
        store.push(...created);
        return Promise.resolve({ count: created.length });
      })
    },
    // Emulates transactional atomicity: any error restores the pre-transaction
    // store so partial-persistence assertions are meaningful.
    $transaction: jest.fn(async (fn) => {
      const snapshot = store.map((user) => ({ ...user }));
      try {
        return await fn(api);
      } catch (error) {
        store.length = 0;
        store.push(...snapshot);
        throw error;
      }
    }),
    __store: store
  };

  return api;
}

function createService(prismaMock, overrides = {}) {
  return createUserBulkImportService({
    prismaClient: prismaMock,
    audit: { createAuditLogSafely: jest.fn().mockResolvedValue(null) },
    hashPasswords: (passwords) => Promise.all(passwords.map((password) => bcrypt.hash(password, 4))),
    ...overrides
  });
}

function parsedRow(rowNumber, values) {
  return {
    rowNumber,
    values: {
      name: '',
      email: '',
      role: '',
      matricNumber: '',
      ...values
    }
  };
}

const student = (rowNumber, overrides = {}) => parsedRow(rowNumber, {
  name: 'Synthetic Student',
  email: `student${rowNumber}@uniosun.edu.ng`,
  role: 'student',
  matricNumber: `CSC/21/${String(rowNumber).padStart(4, '0')}`,
  ...overrides
});

// Students at the target institution may have no email at all, so the row that
// omits it is a first-class case rather than an edge case.
const studentNoEmail = (rowNumber, overrides = {}) => parsedRow(rowNumber, {
  name: 'No Email Student',
  email: '',
  role: 'student',
  matricNumber: `PHS/22/${String(rowNumber).padStart(4, '0')}`,
  ...overrides
});

const existingStudent = {
  id: 10,
  name: 'Existing Student',
  email: 'existing.student@uniosun.edu.ng',
  passwordHash: '$2a$04$existinghash',
  role: 'STUDENT',
  status: 'ACTIVE',
  matricNumber: 'CSC/20/0100',
  mustChangePassword: false,
  credentialVersion: 1
};

describe('parseUserImportWorkbook', () => {
  test('parses canonical headers into logical fields with row numbers', async () => {
    const filePath = await writeWorkbook([
      ['Ada Student', 'Ada.Student@UNIOSUN.edu.ng', 'Student', 'csc/21/0001'],
      ['Bola Lecturer', 'bola.lecturer@uniosun.edu.ng', 'lecturer', '']
    ]);

    const result = await parseUserImportWorkbook(filePath);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      values: {
        name: 'Ada Student',
        email: 'Ada.Student@UNIOSUN.edu.ng',
        role: 'Student',
        matricNumber: 'csc/21/0001'
      }
    });
    expect(result.rows[1].rowNumber).toBe(3);
    expect(result.metadata.total_parsed_rows).toBe(2);
    expect(result.metadata.ignored_columns).toEqual([]);
  });

  test('accepts alias headers case-insensitively and reports ignored columns', async () => {
    const filePath = await writeWorkbook(
      [['Ada', 'ada@uniosun.edu.ng', 'STUDENT', 'CSC/21/0001', 'ignore me']],
      { headers: ['Full Name', 'Email Address', 'Role', 'Matric No', 'Department'] }
    );

    const result = await parseUserImportWorkbook(filePath);
    expect(result.rows[0].values).toMatchObject({
      name: 'Ada',
      email: 'ada@uniosun.edu.ng',
      matricNumber: 'CSC/21/0001'
    });
    expect(result.metadata.ignored_columns).toEqual(['Department']);
    expect(result.metadata.warnings[0]).toMatch(/Unrecognized column/);
  });

  test('rejects a workbook that is not valid xlsx', async () => {
    const filePath = path.join(tmpDir, 'malformed.xlsx');
    fs.writeFileSync(filePath, 'this is not a zip archive');

    await expect(parseUserImportWorkbook(filePath)).rejects.toMatchObject({
      code: 'MALFORMED_WORKBOOK'
    });
  });

  test('rejects workbooks without data rows', async () => {
    const headerOnly = await writeWorkbook([]);
    await expect(parseUserImportWorkbook(headerOnly)).rejects.toMatchObject({ code: 'EMPTY_IMPORT' });

    const blank = await writeWorkbook([], { headers: null });
    await expect(parseUserImportWorkbook(blank)).rejects.toMatchObject({ code: 'EMPTY_IMPORT' });
  });

  test('rejects workbooks missing required columns', async () => {
    const filePath = await writeWorkbook(
      [['ada@uniosun.edu.ng', 'student']],
      { headers: ['email', 'role'] }
    );

    await expect(parseUserImportWorkbook(filePath)).rejects.toMatchObject({
      code: 'IMPORT_TEMPLATE_UNRECOGNIZED'
    });
  });

  test('rejects workbooks above the row cap', async () => {
    const rows = Array.from({ length: MAX_IMPORT_DATA_ROWS + 1 }, (_, index) => (
      [`User ${index}`, `user${index}@uniosun.edu.ng`, 'student', '']
    ));
    const filePath = await writeWorkbook(rows);

    await expect(parseUserImportWorkbook(filePath)).rejects.toMatchObject({
      code: 'IMPORT_TOO_MANY_ROWS'
    });
  }, 30000);

  test('rejects ambiguous duplicate identity columns', async () => {
    const filePath = await writeWorkbook(
      [['Ada', 'a@uniosun.edu.ng', 'x@uniosun.edu.ng', 'student']],
      { headers: ['name', 'email', 'Email Address', 'role'] }
    );

    await expect(parseUserImportWorkbook(filePath)).rejects.toMatchObject({
      code: 'IMPORT_TEMPLATE_AMBIGUOUS'
    });
  });

  test('parses the downloadable template round-trip', async () => {
    const buffer = await buildUserImportTemplateWorkbookBuffer();
    const filePath = path.join(tmpDir, 'template.xlsx');
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    const headers = sheet.getRow(1).values.slice(1);
    expect(headers).toEqual(TEMPLATE_HEADERS);
  });
});

describe('classifyUserImportRows', () => {
  test('classifies a valid student row as VALID_NEW with normalized identity', async () => {
    const service = createService(createPrismaMock());
    const result = await service.classifyUserImportRows([
      student(2, { name: '  Ada   Obi ', email: 'Ada.OBI@UNIOSUN.edu.ng', matricNumber: ' csc/21/0451 ' })
    ]);

    expect(result.rows[0]).toMatchObject({
      row_number: 2,
      status: USER_IMPORT_ROW_STATUS.VALID_NEW,
      name: 'Ada Obi',
      email: 'ada.obi@uniosun.edu.ng',
      role: 'student',
      matric_number: 'CSC/21/0451'
    });
    expect(result.summary).toMatchObject({ total_rows: 1, valid_new: 1, invalid: 0 });
  });

  test('classifies a valid lecturer row without matric as VALID_NEW', async () => {
    const service = createService(createPrismaMock());
    const result = await service.classifyUserImportRows([
      parsedRow(2, { name: 'Dr. Bola', email: 'bola@uniosun.edu.ng', role: 'Lecturer' })
    ]);

    expect(result.rows[0]).toMatchObject({
      status: USER_IMPORT_ROW_STATUS.VALID_NEW,
      role: 'lecturer',
      matric_number: null
    });
  });

  test('marks missing name, invalid email, unsupported role and bad matric as INVALID', async () => {
    const service = createService(createPrismaMock());
    const result = await service.classifyUserImportRows([
      parsedRow(2, { email: 'x@uniosun.edu.ng', role: 'student' }),
      parsedRow(3, { name: 'B', email: 'not-an-email', role: 'student', matricNumber: 'CSC/21/0008' }),
      parsedRow(4, { name: 'C', email: 'c@uniosun.edu.ng', role: 'registrar' }),
      parsedRow(5, { name: 'D', email: 'd@uniosun.edu.ng', role: 'student', matricNumber: '!!' }),
      parsedRow(6, { name: 'E', email: 'e@uniosun.edu.ng', role: 'lecturer', matricNumber: 'CSC/21/0009' })
    ]);

    expect(result.rows.map((row) => row.status)).toEqual(
      Array(5).fill(USER_IMPORT_ROW_STATUS.INVALID)
    );
    expect(result.rows[0].messages[0]).toMatch(/Name is required/);
    expect(result.rows[1].messages[0]).toMatch(/Email address is not valid/);
    expect(result.rows[2].messages[0]).toMatch(/Only student or lecturer/);
    expect(result.rows[3].messages[0]).toMatch(/Matric number/);
    expect(result.rows[4].messages[0]).toMatch(/only apply to student accounts/);
    expect(result.summary.invalid).toBe(5);
  });

  test('rejects admin roles in any casing', async () => {
    const service = createService(createPrismaMock());
    const result = await service.classifyUserImportRows([
      parsedRow(2, { name: 'A', email: 'a@uniosun.edu.ng', role: 'admin' }),
      parsedRow(3, { name: 'B', email: 'b@uniosun.edu.ng', role: 'ADMIN' })
    ]);

    for (const row of result.rows) {
      expect(row.status).toBe(USER_IMPORT_ROW_STATUS.INVALID);
      expect(row.messages[0]).toMatch(/Only student or lecturer/);
    }
  });

  test('marks identical repeated rows (including case-variant emails) as DUPLICATE_IN_FILE', async () => {
    const service = createService(createPrismaMock());
    const result = await service.classifyUserImportRows([
      student(2, { email: 'same@uniosun.edu.ng', matricNumber: 'CSC/21/0001' }),
      student(3, { email: 'SAME@uniosun.edu.ng', matricNumber: 'CSC/21/0002' }),
      student(4, { email: 'Same@UNIOSUN.edu.ng', matricNumber: 'CSC/21/0002' })
    ]);

    // The same email appears with two different matric numbers: that is a
    // contradiction, not a replay, so nothing is silently picked.
    expect(result.rows.map((row) => row.status)).toEqual([
      USER_IMPORT_ROW_STATUS.CONFLICT,
      USER_IMPORT_ROW_STATUS.CONFLICT,
      USER_IMPORT_ROW_STATUS.CONFLICT
    ]);

    const cleanDuplicates = await service.classifyUserImportRows([
      student(2, { email: 'dup@uniosun.edu.ng', matricNumber: 'CSC/21/0005' }),
      student(3, { email: 'DUP@uniosun.edu.ng', matricNumber: 'csc/21/0005' })
    ]);
    expect(cleanDuplicates.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.VALID_NEW);
    expect(cleanDuplicates.rows[1].status).toBe(USER_IMPORT_ROW_STATUS.DUPLICATE_IN_FILE);
    expect(cleanDuplicates.rows[1].messages[0]).toMatch(/Duplicate of row 2/);
    expect(cleanDuplicates.summary).toMatchObject({ valid_new: 1, duplicate_in_file: 1 });
  });

  test('marks the same matric with contradictory identity details in the file as CONFLICT', async () => {
    const service = createService(createPrismaMock());
    const result = await service.classifyUserImportRows([
      student(2, { email: 'one@uniosun.edu.ng', matricNumber: 'CSC/21/0042' }),
      student(3, { email: 'two@uniosun.edu.ng', matricNumber: 'csc/21/0042' })
    ]);

    expect(result.rows.map((row) => row.status)).toEqual([
      USER_IMPORT_ROW_STATUS.CONFLICT,
      USER_IMPORT_ROW_STATUS.CONFLICT
    ]);
    expect(result.rows[0].messages[0]).toMatch(/appears in rows 2, 3 with different identity details/);
  });

  describe('role-aware identity requirements', () => {
    test('a student row with a blank email is VALID_NEW', async () => {
      const service = createService(createPrismaMock());
      const result = await service.classifyUserImportRows([
        studentNoEmail(2),
        studentNoEmail(3),
        studentNoEmail(4)
      ]);

      expect(result.rows.map((row) => row.status)).toEqual(
        Array(3).fill(USER_IMPORT_ROW_STATUS.VALID_NEW)
      );
      // Three students who all lack an email are three different people, never
      // duplicates of one another.
      expect(result.summary.duplicate_in_file).toBe(0);
      expect(result.summary.valid_new).toBe(3);
      expect(result.rows.every((row) => row.email === null)).toBe(true);
    });

    test('a student row with no matric number is INVALID', async () => {
      const service = createService(createPrismaMock());
      const result = await service.classifyUserImportRows([
        parsedRow(2, { name: 'No Matric', email: 'has.email@example.com', role: 'student' }),
        parsedRow(3, { name: 'Nothing', email: '', role: 'student' })
      ]);

      expect(result.rows.map((row) => row.status)).toEqual([
        USER_IMPORT_ROW_STATUS.INVALID,
        USER_IMPORT_ROW_STATUS.INVALID
      ]);
      expect(result.rows[0].messages[0]).toMatch(/Matric number is required for a student account/);
    });

    test('a lecturer row with a blank email is INVALID', async () => {
      const service = createService(createPrismaMock());
      const result = await service.classifyUserImportRows([
        parsedRow(2, { name: 'Dr Blank', email: '', role: 'lecturer' })
      ]);

      expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.INVALID);
      expect(result.rows[0].messages[0]).toMatch(/Email is required/);
    });

    test('a repeated matric with identical identity is DUPLICATE_IN_FILE', async () => {
      const service = createService(createPrismaMock());
      const result = await service.classifyUserImportRows([
        studentNoEmail(2, { matricNumber: 'PHS/22/0500' }),
        studentNoEmail(3, { matricNumber: 'phs/22/0500' })
      ]);

      expect(result.rows.map((row) => row.status)).toEqual([
        USER_IMPORT_ROW_STATUS.VALID_NEW,
        USER_IMPORT_ROW_STATUS.DUPLICATE_IN_FILE
      ]);
    });

    test('a matric already held by an existing account is CONFLICT', async () => {
      const prismaMock = createPrismaMock({ users: [existingStudent] });
      const service = createService(prismaMock);
      const result = await service.classifyUserImportRows([
        studentNoEmail(2, { name: 'Someone Else', matricNumber: existingStudent.matricNumber })
      ]);

      expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.CONFLICT);
    });

    test('an optional email already owned by another account is still CONFLICT', async () => {
      const prismaMock = createPrismaMock({ users: [existingStudent] });
      const service = createService(prismaMock);
      const result = await service.classifyUserImportRows([
        parsedRow(2, {
          name: 'New Person',
          email: existingStudent.email,
          role: 'student',
          matricNumber: 'PHS/22/0600'
        })
      ]);

      expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.CONFLICT);
    });

    test('commits a mixed cohort and identifies no-email students by matric in the manifest', async () => {
      const prismaMock = createPrismaMock();
      const service = createService(prismaMock);

      const rows = [
        studentNoEmail(2, { name: 'No Email A', matricNumber: 'PHS/22/0701' }),
        student(3, { name: 'With Email B', email: 'b@example.com', matricNumber: 'PHS/22/0702' }),
        parsedRow(4, { name: 'Dr Lecturer', email: 'lect@example.com', role: 'lecturer' })
      ];

      const classification = await service.classifyUserImportRows(rows);
      expect(classification.summary.valid_new).toBe(3);

      const committed = await service.commitUserImport({ classification, actor: { id: 1, role: 'admin' } });
      expect(committed.createdUsers).toHaveLength(3);
      expect(committed.credentialRows).toHaveLength(3);

      const noEmailRow = committed.credentialRows.find((row) => row.name === 'No Email A');
      expect(noEmailRow.matricNumber).toBe('PHS/22/0701');
      expect(noEmailRow.email).toBeNull();
      expect(noEmailRow.temporaryPassword).toEqual(expect.any(String));
      // No placeholder address may be invented to fill the column.
      expect(JSON.stringify(committed.createdUsers)).not.toMatch(/placeholder|noreply|no-reply|@example\.invalid/i);

      const stored = prismaMock.__store.find((user) => user.matricNumber === 'PHS/22/0701');
      expect(stored.email).toBeNull();

      // Replay: the same file creates nothing further and yields no credentials.
      const replayClassification = await service.classifyUserImportRows(rows);
      expect(replayClassification.summary.valid_new).toBe(0);
      expect(replayClassification.summary.already_exists).toBe(3);

      const replay = await service.commitUserImport({ classification: replayClassification, actor: { id: 1, role: 'admin' } });
      expect(replay.createdUsers).toHaveLength(0);
      expect(replay.credentialRows).toHaveLength(0);
    });
  });

  test('marks an exact existing account as ALREADY_EXISTS without touching it', async () => {
    const prismaMock = createPrismaMock({ users: [existingStudent] });
    const service = createService(prismaMock);
    const result = await service.classifyUserImportRows([
      parsedRow(2, {
        name: 'existing student',
        email: 'EXISTING.STUDENT@uniosun.edu.ng',
        role: 'student',
        matricNumber: 'csc/20/0100'
      })
    ]);

    expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.ALREADY_EXISTS);
    expect(result.summary.already_exists).toBe(1);
  });

  test('flags name drift on an existing account as a warning, not a change', async () => {
    const service = createService(createPrismaMock({ users: [existingStudent] }));
    const result = await service.classifyUserImportRows([
      parsedRow(2, {
        name: 'Renamed Person',
        email: existingStudent.email,
        role: 'student',
        matricNumber: existingStudent.matricNumber
      })
    ]);

    expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.ALREADY_EXISTS);
    expect(result.rows[0].warnings[0]).toMatch(/Name differs from the existing record/);
  });

  test('marks role disagreement with an existing account as CONFLICT', async () => {
    const service = createService(createPrismaMock({ users: [existingStudent] }));
    const result = await service.classifyUserImportRows([
      parsedRow(2, { name: 'X', email: existingStudent.email, role: 'lecturer' })
    ]);

    expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.CONFLICT);
    expect(result.rows[0].messages[0]).toMatch(/existing student account/);
  });

  test('marks matric disagreements and matric collisions as CONFLICT', async () => {
    const service = createService(createPrismaMock({ users: [existingStudent] }));
    const result = await service.classifyUserImportRows([
      parsedRow(2, { name: 'X', email: existingStudent.email, role: 'student', matricNumber: 'CSC/20/0999' }),
      parsedRow(3, { name: 'Y', email: 'new.person@uniosun.edu.ng', role: 'student', matricNumber: existingStudent.matricNumber })
    ]);

    expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.CONFLICT);
    expect(result.rows[0].messages[0]).toMatch(/has matric number CSC\/20\/0100/);
    expect(result.rows[1].status).toBe(USER_IMPORT_ROW_STATUS.CONFLICT);
    expect(result.rows[1].messages[0]).toMatch(/already belongs to an existing account with a different email address on record/);
  });

  test('marks adding a matric to an account that has none as CONFLICT (never a silent update)', async () => {
    const service = createService(createPrismaMock({
      users: [{ ...existingStudent, matricNumber: null }]
    }));
    const result = await service.classifyUserImportRows([
      parsedRow(2, { name: 'X', email: existingStudent.email, role: 'student', matricNumber: 'CSC/20/0100' })
    ]);

    expect(result.rows[0].status).toBe(USER_IMPORT_ROW_STATUS.CONFLICT);
    expect(result.rows[0].messages[0]).toMatch(/identity correction/);
  });

  test('uses batched lookups instead of per-row queries', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);
    await service.classifyUserImportRows(
      Array.from({ length: 40 }, (_, index) => student(index + 2))
    );

    expect(prismaMock.user.findMany.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('commitUserImport', () => {
  async function classifyAndCommit(service, rows, { actor = { id: 1, role: 'admin' } } = {}) {
    const classification = await service.classifyUserImportRows(rows);
    return service.commitUserImport({
      classification,
      actor,
      sourceFilename: 'cohort.xlsx'
    });
  }

  test('creates a mixed student/lecturer cohort with hashed one-time credentials', async () => {
    const prismaMock = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await classifyAndCommit(service, [
      student(2, { email: 'ada@uniosun.edu.ng', matricNumber: 'csc/21/0001' }),
      parsedRow(3, { name: 'Dr. Bola', email: 'bola@uniosun.edu.ng', role: 'lecturer' })
    ]);

    expect(result.createdUsers).toHaveLength(2);
    expect(result.credentialRows).toHaveLength(2);
    expect(prismaMock.__store).toHaveLength(2);

    const createdStudent = prismaMock.__store.find((user) => user.email === 'ada@uniosun.edu.ng');
    expect(createdStudent).toMatchObject({
      role: 'STUDENT',
      status: 'ACTIVE',
      matricNumber: 'CSC/21/0001',
      mustChangePassword: true
    });
    const createdLecturer = prismaMock.__store.find((user) => user.email === 'bola@uniosun.edu.ng');
    expect(createdLecturer).toMatchObject({ role: 'LECTURER', matricNumber: null, mustChangePassword: true });

    for (const credential of result.credentialRows) {
      const stored = prismaMock.__store.find((user) => user.email === credential.email);
      expect(stored.passwordHash).toMatch(/^\$2/);
      expect(stored.passwordHash).not.toBe(credential.temporaryPassword);
      expect(await bcrypt.compare(credential.temporaryPassword, stored.passwordHash)).toBe(true);
    }
  });

  test('uses the Phase-2 secure generator by default and never a fixed password', async () => {
    const source = fs.readFileSync(path.join(__dirname, 'userBulkImport.service.js'), 'utf8');
    expect(source).toMatch(/generateTemporaryPassword/);
    expect(source).not.toMatch(/DemoPass123/);

    const service = createService(createPrismaMock(), { generatePassword: generateTemporaryPassword });
    const result = await classifyAndCommit(service, [student(2), student(3, { email: 'b@uniosun.edu.ng' })]);

    const passwords = result.credentialRows.map((row) => row.temporaryPassword);
    expect(new Set(passwords).size).toBe(2);
    for (const password of passwords) {
      expect(validatePasswordPolicy(password)).toBe(true);
      expect(password).toHaveLength(16);
    }
  });

  test('only ever writes student or lecturer roles regardless of input', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);

    await classifyAndCommit(service, [
      parsedRow(2, { name: 'Sneaky', email: 'sneaky@uniosun.edu.ng', role: 'admin' }),
      student(3, { email: 'fine@uniosun.edu.ng', matricNumber: 'CSC/21/0003' })
    ]);

    const writtenRoles = prismaMock.user.createMany.mock.calls
      .flatMap(([args]) => args.data.map((row) => row.role));
    expect(writtenRoles).toEqual(['STUDENT']);
    expect(prismaMock.__store.some((user) => user.role === 'ADMIN')).toBe(false);
  });

  test('replaying the same cohort creates zero users and zero credentials', async () => {
    const prismaMock = createPrismaMock();
    const generatePassword = jest.fn(generateTemporaryPassword);
    const service = createService(prismaMock, { generatePassword });
    const rows = [
      student(2, { email: 'r1@uniosun.edu.ng', matricNumber: 'CSC/21/0011' }),
      parsedRow(3, { name: 'Dr. R', email: 'r2@uniosun.edu.ng', role: 'lecturer' })
    ];

    const first = await classifyAndCommit(service, rows);
    expect(first.createdUsers).toHaveLength(2);
    expect(generatePassword).toHaveBeenCalledTimes(2);

    const replay = await classifyAndCommit(service, rows);
    expect(replay.createdUsers).toHaveLength(0);
    expect(replay.credentialRows).toHaveLength(0);
    expect(replay.summary.already_exists).toBe(2);
    expect(generatePassword).toHaveBeenCalledTimes(2);
    expect(prismaMock.__store).toHaveLength(2);
    expect(prismaMock.__store.every((user) => user.mustChangePassword === true)).toBe(true);
  });

  test('a database failure during the batch leaves no partial cohort behind', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.user.createMany.mockRejectedValueOnce(new Error('connection reset'));
    const service = createService(prismaMock);

    await expect(classifyAndCommit(service, [student(2), student(3, { email: 'x@uniosun.edu.ng', matricNumber: 'CSC/21/0033' })]))
      .rejects.toThrow('connection reset');
    expect(prismaMock.__store).toHaveLength(0);
  });

  test('a preview→commit race aborts the whole batch truthfully', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);
    const classification = await service.classifyUserImportRows([
      student(2, { email: 'raced@uniosun.edu.ng', matricNumber: 'CSC/21/0044' }),
      student(3, { email: 'other@uniosun.edu.ng', matricNumber: 'CSC/21/0045' })
    ]);
    expect(classification.summary.valid_new).toBe(2);

    // Another administrator provisions one of the accounts after preview.
    prismaMock.__store.push({ ...existingStudent, id: 90, email: 'raced@uniosun.edu.ng', matricNumber: 'CSC/21/0044' });

    let caught;
    try {
      await service.commitUserImport({ classification, actor: { id: 1 } });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BulkImportStateChangedError);
    expect(caught.statusCode).toBe(409);
    expect(JSON.stringify(caught.contested)).toContain('raced@uniosun.edu.ng');
    // Nothing beyond the concurrently created account exists.
    expect(prismaMock.__store).toHaveLength(1);
  });

  test('a uniqueness-constraint race during insert also aborts the whole batch', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.user.createMany.mockRejectedValueOnce({ code: 'P2002' });
    const service = createService(prismaMock);

    await expect(classifyAndCommit(service, [student(2)]))
      .rejects.toBeInstanceOf(BulkImportStateChangedError);
    expect(prismaMock.__store).toHaveLength(0);
  });

  test('hashing happens before the database transaction opens', async () => {
    const events = [];
    const prismaMock = createPrismaMock();
    const originalTransaction = prismaMock.$transaction;
    prismaMock.$transaction = jest.fn((fn, options) => {
      events.push('transaction');
      return originalTransaction(fn, options);
    });
    const service = createService(prismaMock, {
      hashPasswords: async (passwords) => {
        events.push('hash');
        return passwords.map((password) => `$2a$04$stub-${password.length}`);
      }
    });

    await classifyAndCommit(service, [student(2)]);
    expect(events).toEqual(['hash', 'transaction']);
  });

  test('commit with nothing to create is a safe audited no-op', async () => {
    const prismaMock = createPrismaMock({ users: [existingStudent] });
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await classifyAndCommit(service, [
      parsedRow(2, {
        name: existingStudent.name,
        email: existingStudent.email,
        role: 'student',
        matricNumber: existingStudent.matricNumber
      })
    ]);

    expect(result.createdUsers).toHaveLength(0);
    expect(result.credentialRows).toHaveLength(0);
    expect(prismaMock.user.createMany).not.toHaveBeenCalled();
    const batchEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(batchEvent.eventType).toBe('BULK_USER_IMPORT_COMMITTED');
    expect(batchEvent.metadata.outcome).toBe('no-new-accounts');
  });

  test('audit events carry counts and batch identity but never credentials or hashes', async () => {
    const prismaMock = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await classifyAndCommit(service, [
      student(2, { email: 'audit1@uniosun.edu.ng', matricNumber: 'CSC/21/0061' }),
      parsedRow(3, { name: 'Dr. Audit', email: 'audit2@uniosun.edu.ng', role: 'lecturer' }),
      parsedRow(4, { name: 'Bad', email: 'not-an-email', role: 'student' })
    ]);

    const auditPayloads = JSON.stringify(audit.createAuditLogSafely.mock.calls);
    for (const credential of result.credentialRows) {
      expect(auditPayloads).not.toContain(credential.temporaryPassword);
    }
    for (const user of prismaMock.__store) {
      expect(auditPayloads).not.toContain(user.passwordHash);
    }

    const [batchEvent, ...userEvents] = audit.createAuditLogSafely.mock.calls.map(([event]) => event);
    expect(batchEvent).toMatchObject({
      eventType: 'BULK_USER_IMPORT_COMMITTED',
      targetType: 'UserBulkImport',
      metadata: expect.objectContaining({
        sourceFilename: 'cohort.xlsx',
        totalRows: 3,
        createdCount: 2,
        invalidCount: 1,
        createdStudentCount: 1,
        createdLecturerCount: 1
      })
    });
    expect(batchEvent.targetId).toMatch(/^user-import-/);
    expect(userEvents).toHaveLength(2);
    expect(userEvents[0]).toMatchObject({
      eventType: 'USER_PROVISIONED',
      metadata: expect.objectContaining({
        source: 'bulk-import',
        importBatchId: batchEvent.targetId
      })
    });
  });

  test('even a hostile credential-shaped metadata key would be redacted by the audit layer', () => {
    expect(redactMetadata({ temporaryPassword: 'Secret123', nested: { passwordHash: 'x' } })).toEqual({
      temporaryPassword: '[redacted]',
      nested: { passwordHash: '[redacted]' }
    });
  });
});

describe('buildCredentialManifestWorkbookBuffer', () => {
  test('contains exactly the newly created accounts as literal strings', async () => {
    const buffer = await buildCredentialManifestWorkbookBuffer([
      {
        name: '=HYPERLINK("http://evil.example","click")',
        email: 'ada@uniosun.edu.ng',
        role: 'student',
        matricNumber: 'CSC/21/0001',
        temporaryPassword: 'Temp1234Temp1234'
      },
      {
        name: '+SUM(A1:A9)',
        email: 'bola@uniosun.edu.ng',
        role: 'lecturer',
        matricNumber: null,
        temporaryPassword: 'Temp5678Temp5678'
      }
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Credentials');
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(1).values.slice(1)).toEqual(['Name', 'Email', 'Role', 'Matric Number', 'Temporary Password']);
    expect(sheet.getRow(2).values.slice(1)).toEqual([
      '=HYPERLINK("http://evil.example","click")',
      'ada@uniosun.edu.ng',
      'student',
      'CSC/21/0001',
      'Temp1234Temp1234'
    ]);

    // Formula-looking values stay plain text: no cell in the sheet is a
    // formula object.
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        expect(typeof cell.value).toBe('string');
        expect(cell.formula).toBeUndefined();
      });
    });

    expect(workbook.getWorksheet('READ ME')).toBeDefined();
  });
});

describe('UserBulkImportError', () => {
  test('carries code, field and status code', () => {
    const error = new UserBulkImportError('boom', { code: 'X', field: 'file', statusCode: 422 });
    expect(error).toMatchObject({ name: 'UserBulkImportError', code: 'X', field: 'file', statusCode: 422 });
  });
});
