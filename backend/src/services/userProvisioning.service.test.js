const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const {
  createUserProvisioningService,
  generateTemporaryPassword,
  normalizeMatricNumber
} = require('./userProvisioning.service');
const { validatePasswordPolicy } = require('./auth.service');

function createPrismaMock({ users = [] } = {}) {
  const store = [...users];
  let nextId = store.reduce((max, user) => Math.max(max, user.id), 0) + 1;

  const findUnique = jest.fn(({ where }) => {
    if (where.email) {
      return Promise.resolve(store.find((user) => user.email === where.email) || null);
    }
    if (where.matricNumber) {
      return Promise.resolve(store.find((user) => user.matricNumber === where.matricNumber) || null);
    }
    return Promise.resolve(store.find((user) => user.id === where.id) || null);
  });

  const create = jest.fn(({ data }) => {
    const created = {
      id: nextId,
      credentialVersion: 1,
      createdAt: new Date('2026-08-20T09:00:00.000Z'),
      updatedAt: new Date('2026-08-20T09:00:00.000Z'),
      ...data
    };
    nextId += 1;
    store.push(created);
    return Promise.resolve(created);
  });

  const update = jest.fn(({ where, data }) => {
    const existing = store.find((user) => user.id === where.id);
    const next = { ...existing, ...data };
    if (data.credentialVersion?.increment) {
      next.credentialVersion = (existing.credentialVersion || 1) + data.credentialVersion.increment;
    }
    Object.assign(existing, next);
    return Promise.resolve(next);
  });

  const count = jest.fn(({ where } = {}) => {
    if (where?.role) {
      return Promise.resolve(store.filter((user) => user.role === where.role).length);
    }
    if (where?.email?.endsWith) {
      return Promise.resolve(store.filter((user) => user.email.endsWith(where.email.endsWith)).length);
    }
    return Promise.resolve(store.length);
  });

  const findMany = jest.fn(({ where } = {}) => {
    if (where?.role) {
      return Promise.resolve(store.filter((user) => user.role === where.role));
    }
    return Promise.resolve(store);
  });

  const prismaMock = {
    user: { findUnique, findMany, create, update, count },
    $transaction: jest.fn((fn) => fn(prismaMock)),
    __store: store
  };

  return prismaMock;
}

function createService(prismaMock, overrides = {}) {
  return createUserProvisioningService({
    prismaClient: prismaMock,
    audit: { createAuditLogSafely: jest.fn().mockResolvedValue(null) },
    hashPassword: (value) => bcrypt.hash(value, 4),
    ...overrides
  });
}

const existingAdmin = {
  id: 1,
  name: 'Existing Admin',
  email: 'existing.admin@uniosun.edu.ng',
  passwordHash: 'hash',
  role: 'ADMIN',
  status: 'ACTIVE',
  credentialVersion: 1,
  mustChangePassword: false,
  matricNumber: null
};

describe('generateTemporaryPassword', () => {
  test('produces policy-compliant unique credentials with no fixed value', () => {
    const generated = new Set();
    for (let index = 0; index < 25; index += 1) {
      const password = generateTemporaryPassword();
      expect(validatePasswordPolicy(password)).toBe(true);
      expect(password.length).toBeGreaterThanOrEqual(16);
      expect(password).not.toBe('DemoPass123');
      generated.add(password);
    }
    expect(generated.size).toBe(25);
  });
});

describe('no hardcoded bootstrap password', () => {
  test('bootstrap script and provisioning service contain no fixed demo password', () => {
    const scriptSource = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'bootstrap-admin.js'), 'utf8');
    const serviceSource = fs.readFileSync(path.join(__dirname, 'userProvisioning.service.js'), 'utf8');
    expect(scriptSource).not.toMatch(/DemoPass123/);
    expect(serviceSource).not.toMatch(/DemoPass123/);
    expect(scriptSource).not.toMatch(/password\s*[:=]\s*['"][^'"]+['"]/i);
  });
});

describe('normalizeMatricNumber', () => {
  test('normalizes case and surrounding whitespace', () => {
    expect(normalizeMatricNumber('  csc/21/0451 ')).toBe('CSC/21/0451');
    expect(normalizeMatricNumber(null)).toBeNull();
    expect(normalizeMatricNumber('')).toBeNull();
  });

  test('rejects malformed values', () => {
    expect(() => normalizeMatricNumber('!!bad!!')).toThrow('Matric number');
    expect(() => normalizeMatricNumber('ab')).toThrow('Matric number');
  });
});

describe('provisionUser', () => {
  test('creates a student with hashed temporary credential and forced password change', async () => {
    const prismaMock = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await service.provisionUser({
      input: {
        name: '  Synthetic  Student ',
        email: 'Synthetic.Student@UNIOSUN.edu.ng',
        role: 'student',
        matricNumber: 'csc/21/0451'
      },
      actor: { id: 1, role: 'admin' }
    });

    const createdRow = prismaMock.user.create.mock.calls[0][0].data;
    expect(createdRow).toMatchObject({
      name: 'Synthetic Student',
      email: 'synthetic.student@uniosun.edu.ng',
      role: 'STUDENT',
      status: 'ACTIVE',
      matricNumber: 'CSC/21/0451',
      mustChangePassword: true
    });
    expect(createdRow.passwordHash).not.toBe(result.temporaryPassword);
    expect(await bcrypt.compare(result.temporaryPassword, createdRow.passwordHash)).toBe(true);
    expect(validatePasswordPolicy(result.temporaryPassword)).toBe(true);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.mustChangePassword).toBe(true);

    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('USER_PROVISIONED');
    expect(JSON.stringify(auditEvent)).not.toContain(result.temporaryPassword);
    expect(JSON.stringify(auditEvent)).not.toContain(createdRow.passwordHash);
  });

  // The central change: a student is identified by matric number, and students
  // at the target institution may have no email address at all.
  test('creates a student with a matric number and NO email', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);

    const result = await service.provisionUser({
      input: { name: 'No Email Student', role: 'student', matricNumber: 'phs/22/0101' },
      actor: { id: 1, role: 'admin' }
    });

    const createdRow = prismaMock.user.create.mock.calls[0][0].data;
    expect(createdRow.email).toBeNull();
    expect(createdRow.matricNumber).toBe('PHS/22/0101');
    expect(createdRow.mustChangePassword).toBe(true);
    // The one-time credential is issued exactly as it is for any other account,
    // because it is the only way this student can sign in first.
    expect(validatePasswordPolicy(result.temporaryPassword)).toBe(true);
    expect(await bcrypt.compare(result.temporaryPassword, createdRow.passwordHash)).toBe(true);
    // No placeholder address may ever be fabricated to fill the column.
    expect(JSON.stringify(createdRow)).not.toMatch(/@/);
  });

  test('treats blank and whitespace-only student email as absent rather than invalid', async () => {
    for (const [index, email] of [undefined, null, '', '   '].entries()) {
      const prismaMock = createPrismaMock();
      const service = createService(prismaMock);

      await service.provisionUser({
        input: { name: 'Blank Email', email, role: 'student', matricNumber: `PHS/22/${String(index + 200).padStart(4, '0')}` },
        actor: { id: 1, role: 'admin' }
      });

      expect(prismaMock.user.create.mock.calls[0][0].data.email).toBeNull();
    }
  });

  test('rejects a student with no matric number', async () => {
    const service = createService(createPrismaMock());

    await expect(service.provisionUser({
      input: { name: 'Nameless Identity', email: 'someone@example.com', role: 'student' }
    })).rejects.toMatchObject({
      code: 'USER_PROVISION_MATRIC_REQUIRED',
      field: 'matricNumber'
    });

    // Neither identifier at all must also be refused: the database alone would
    // accept such a row.
    await expect(service.provisionUser({
      input: { name: 'Nothing At All', role: 'student' }
    })).rejects.toMatchObject({ code: 'USER_PROVISION_MATRIC_REQUIRED' });
  });

  test('rejects a lecturer with no email', async () => {
    const service = createService(createPrismaMock());

    for (const email of [undefined, null, '', '   ']) {
      await expect(service.provisionUser({
        input: { name: 'Emailless Lecturer', email, role: 'lecturer' }
      })).rejects.toMatchObject({
        code: 'USER_PROVISION_EMAIL_REQUIRED',
        field: 'email'
      });
    }
  });

  test('many students may have no email while a supplied address stays unique', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);

    for (let index = 0; index < 3; index += 1) {
      await service.provisionUser({
        input: { name: `Student ${index}`, role: 'student', matricNumber: `PHS/22/${String(index + 300).padStart(4, '0')}` },
        actor: { id: 1, role: 'admin' }
      });
    }
    expect(prismaMock.__store.filter((user) => user.email === null)).toHaveLength(3);

    await service.provisionUser({
      input: { name: 'With Email', email: 'unique@example.com', role: 'student', matricNumber: 'PHS/22/0400' },
      actor: { id: 1, role: 'admin' }
    });
    await expect(service.provisionUser({
      input: { name: 'Clash', email: 'unique@example.com', role: 'student', matricNumber: 'PHS/22/0401' }
    })).rejects.toMatchObject({ code: 'USER_PROVISION_EMAIL_EXISTS' });
  });

  test('creates a lecturer without a matric number', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);

    const result = await service.provisionUser({
      input: {
        name: 'Synthetic Lecturer',
        email: 'synthetic.lecturer@uniosun.edu.ng',
        role: 'lecturer'
      },
      actor: { id: 1, role: 'admin' }
    });

    expect(result.user.role).toBe('lecturer');
    expect(result.user.matricNumber).toBeNull();
  });

  // UNIOSUN students are not issued institution-assigned mailboxes, so
  // provisioning must accept whatever working address a person actually has.
  // Any domain restriction would make the departmental pilot impossible.
  test('accepts ordinary personal email domains and imposes no institutional domain', async () => {
    const personalAddresses = [
      'ada.obi@gmail.com',
      'ada_obi@yahoo.com',
      'ada.obi@outlook.com',
      'ada.obi@hotmail.co.uk',
      'ada.obi@proton.me'
    ];

    for (const [index, email] of personalAddresses.entries()) {
      const prismaMock = createPrismaMock();
      const service = createService(prismaMock);

      const result = await service.provisionUser({
        input: {
          name: 'Synthetic Student',
          email,
          role: 'student',
          matricNumber: `CSC/21/${String(index + 1).padStart(4, '0')}`
        },
        actor: { id: 1, role: 'admin' }
      });

      expect(result.user.email).toBe(email.toLowerCase());
      const createdRow = prismaMock.user.create.mock.calls[0][0].data;
      expect(createdRow.email).toBe(email.toLowerCase());
    }
  });

  test('rejects only genuinely malformed addresses, never a permitted domain list', async () => {
    const service = createService(createPrismaMock());

    // A lecturer must supply an email, so every malformed value and the
    // empty value are rejected on the email field.
    for (const email of ['not-an-email', 'missing@domain', 'two @spaces.com', '']) {
      await expect(service.provisionUser({
        input: { name: 'X', email, role: 'lecturer' }
      })).rejects.toMatchObject({
        code: expect.stringMatching(/USER_PROVISION_EMAIL/)
      });
    }

    // A student's email is optional, so a malformed one is still rejected but
    // an absent one is accepted.
    for (const email of ['not-an-email', 'missing@domain', 'two @spaces.com']) {
      await expect(service.provisionUser({
        input: { name: 'X', email, role: 'student', matricNumber: 'CSC/21/0777' }
      })).rejects.toMatchObject({
        code: 'USER_PROVISION_EMAIL_INVALID'
      });
    }
  });

  test('rejects admin and unknown roles strictly', async () => {
    const service = createService(createPrismaMock());

    for (const role of ['admin', 'ADMIN', 'superuser', 'root', '']) {
      await expect(service.provisionUser({
        input: { name: 'X', email: 'x@uniosun.edu.ng', role }
      })).rejects.toMatchObject({
        code: expect.stringMatching(/USER_PROVISION_ROLE/)
      });
    }
  });

  test('ignores mass-assignment of status and credential state', async () => {
    const prismaMock = createPrismaMock();
    const service = createService(prismaMock);

    await service.provisionUser({
      input: {
        name: 'Sneaky Student',
        email: 'sneaky@uniosun.edu.ng',
        role: 'student',
        matricNumber: 'CSC/21/0801',
        status: 'SUSPENDED',
        mustChangePassword: false,
        credentialVersion: 99,
        passwordHash: 'attacker-controlled'
      }
    });

    const createdRow = prismaMock.user.create.mock.calls[0][0].data;
    expect(createdRow.status).toBe('ACTIVE');
    expect(createdRow.mustChangePassword).toBe(true);
    expect(createdRow.credentialVersion).toBeUndefined();
    expect(createdRow.passwordHash).not.toBe('attacker-controlled');
  });

  test('rejects duplicate email regardless of case', async () => {
    const prismaMock = createPrismaMock({
      users: [{ ...existingAdmin, id: 2, email: 'taken@uniosun.edu.ng', role: 'STUDENT' }]
    });
    const service = createService(prismaMock);

    await expect(service.provisionUser({
      input: { name: 'Dup', email: 'TAKEN@uniosun.edu.ng', role: 'student', matricNumber: 'CSC/21/0802' }
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_PROVISION_EMAIL_EXISTS'
    });
  });

  test('rejects duplicate matric number', async () => {
    const prismaMock = createPrismaMock({
      users: [{ ...existingAdmin, id: 3, email: 'other@uniosun.edu.ng', role: 'STUDENT', matricNumber: 'CSC/21/0001' }]
    });
    const service = createService(prismaMock);

    await expect(service.provisionUser({
      input: { name: 'Dup', email: 'new@uniosun.edu.ng', role: 'student', matricNumber: 'csc/21/0001' }
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_PROVISION_MATRIC_EXISTS'
    });
  });

  test('rejects matric numbers on lecturer accounts', async () => {
    const service = createService(createPrismaMock());

    await expect(service.provisionUser({
      input: { name: 'L', email: 'l@uniosun.edu.ng', role: 'lecturer', matricNumber: 'CSC/21/0002' }
    })).rejects.toMatchObject({
      code: 'USER_PROVISION_MATRIC_ROLE_MISMATCH'
    });
  });

  test('maps database unique-constraint races to a conflict error', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.user.create.mockRejectedValue({ code: 'P2002' });
    const service = createService(prismaMock);

    await expect(service.provisionUser({
      input: { name: 'Race', email: 'race@uniosun.edu.ng', role: 'student', matricNumber: 'CSC/21/0803' }
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_PROVISION_DUPLICATE'
    });
  });
});

describe('resetUserCredential', () => {
  const student = {
    id: 5,
    name: 'Synthetic Student',
    email: 'student@uniosun.edu.ng',
    passwordHash: 'old-hash',
    role: 'STUDENT',
    status: 'ACTIVE',
    credentialVersion: 2,
    mustChangePassword: false,
    matricNumber: 'CSC/21/0451'
  };

  test('issues a new one-time credential, forces change, and invalidates sessions', async () => {
    const prismaMock = createPrismaMock({ users: [{ ...student }] });
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await service.resetUserCredential({
      id: '5',
      actor: { id: 1, role: 'admin' }
    });

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.mustChangePassword).toBe(true);
    expect(updateData.credentialVersion).toEqual({ increment: 1 });
    expect(updateData.resetTokenHash).toBeNull();
    expect(await bcrypt.compare(result.temporaryPassword, updateData.passwordHash)).toBe(true);
    expect(result.user.mustChangePassword).toBe(true);

    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('USER_CREDENTIAL_RESET');
    expect(JSON.stringify(auditEvent)).not.toContain(result.temporaryPassword);
  });

  test('invalidates a pending invitation when an administrator resets credentials', async () => {
    const pendingInvitation = {
      ...student,
      resetTokenHash: 'existing-reset-token-hash',
      resetTokenExpiresAt: new Date('2026-08-30T09:00:00.000Z'),
      invitationTokenHash: 'pending-invitation-token-hash',
      invitationExpiresAt: new Date('2026-08-30T09:00:00.000Z')
    };
    const prismaMock = createPrismaMock({ users: [pendingInvitation] });
    const service = createService(prismaMock);

    await service.resetUserCredential({
      id: 5,
      actor: { id: 1, role: 'admin' }
    });

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      credentialVersion: { increment: 1 },
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      invitationTokenHash: null,
      invitationExpiresAt: null
    });
    expect(prismaMock.__store[0]).toMatchObject({
      credentialVersion: 3,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      invitationTokenHash: null,
      invitationExpiresAt: null
    });
  });

  test('returns null for missing users', async () => {
    const service = createService(createPrismaMock());
    await expect(service.resetUserCredential({ id: 99, actor: { id: 1 } })).resolves.toBeNull();
  });

  test('refuses admin self-reset', async () => {
    const service = createService(createPrismaMock({ users: [{ ...existingAdmin }] }));

    await expect(service.resetUserCredential({ id: 1, actor: { id: 1, role: 'admin' } }))
      .rejects.toMatchObject({
        statusCode: 409,
        code: 'USER_CREDENTIAL_RESET_SELF_FORBIDDEN'
      });
  });

  test('refuses administrator targets', async () => {
    const service = createService(createPrismaMock({ users: [{ ...existingAdmin }] }));

    await expect(service.resetUserCredential({ id: 1, actor: { id: 2, role: 'admin' } }))
      .rejects.toMatchObject({
        statusCode: 403,
        code: 'USER_CREDENTIAL_RESET_ADMIN_TARGET_FORBIDDEN'
      });
  });
});

describe('correctUserIdentity', () => {
  const student = {
    id: 5,
    name: 'Misspelled Name',
    email: 'wrong.address@uniosun.edu.ng',
    passwordHash: 'stored-hash',
    role: 'STUDENT',
    status: 'ACTIVE',
    credentialVersion: 3,
    mustChangePassword: false,
    matricNumber: 'CSC/21/0451'
  };

  const lecturer = {
    ...student,
    id: 6,
    email: 'lecturer@uniosun.edu.ng',
    role: 'LECTURER',
    matricNumber: null
  };

  test('corrects name, canonicalizes email, and invalidates sessions on email change', async () => {
    const prismaMock = createPrismaMock({ users: [{ ...student }] });
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await service.correctUserIdentity({
      id: '5',
      input: { name: '  Correct   Name ', email: 'Right.Address@UNIOSUN.edu.ng' },
      actor: { id: 1, role: 'admin' }
    });

    expect(result.user).toMatchObject({
      name: 'Correct Name',
      email: 'right.address@uniosun.edu.ng'
    });
    expect(result.changedFields.sort()).toEqual(['email', 'name']);
    expect(result.sessionsInvalidated).toBe(true);

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.credentialVersion).toEqual({ increment: 1 });
    expect(updateData.resetTokenHash).toBeNull();
    expect(updateData.passwordHash).toBeUndefined();

    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('USER_IDENTITY_CORRECTED');
    expect(auditEvent.metadata.changedFields.sort()).toEqual(['email', 'name']);
    expect(auditEvent.metadata.previous.email).toBe('wrong.address@uniosun.edu.ng');
    expect(auditEvent.metadata.next.email).toBe('right.address@uniosun.edu.ng');
    expect(auditEvent.metadata.priorSessionsInvalidated).toBe(true);
    expect(JSON.stringify(auditEvent)).not.toContain('stored-hash');
  });

  test('invalidates a pending invitation when correcting an email address', async () => {
    const pendingInvitation = {
      ...student,
      resetTokenHash: 'existing-reset-token-hash',
      resetTokenExpiresAt: new Date('2026-08-30T09:00:00.000Z'),
      invitationTokenHash: 'pending-invitation-token-hash',
      invitationExpiresAt: new Date('2026-08-30T09:00:00.000Z')
    };
    const prismaMock = createPrismaMock({ users: [pendingInvitation] });
    const service = createService(prismaMock);

    await service.correctUserIdentity({
      id: 5,
      input: { email: 'corrected.address@uniosun.edu.ng' },
      actor: { id: 1, role: 'admin' }
    });

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      email: 'corrected.address@uniosun.edu.ng',
      credentialVersion: { increment: 1 },
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      invitationTokenHash: null,
      invitationExpiresAt: null
    });
    expect(prismaMock.__store[0]).toMatchObject({
      email: 'corrected.address@uniosun.edu.ng',
      credentialVersion: 4,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      invitationTokenHash: null,
      invitationExpiresAt: null
    });
  });

  test('validates and normalizes matric corrections without touching sessions', async () => {
    const prismaMock = createPrismaMock({ users: [{ ...student }] });
    const service = createService(prismaMock);

    const result = await service.correctUserIdentity({
      id: 5,
      input: { matricNumber: ' csc/21/0999 ' },
      actor: { id: 1 }
    });

    expect(result.user.matricNumber).toBe('CSC/21/0999');
    expect(result.sessionsInvalidated).toBe(false);
    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.credentialVersion).toBeUndefined();

    await expect(service.correctUserIdentity({
      id: 5,
      input: { matricNumber: '!!bad!!' }
    })).rejects.toMatchObject({ code: 'USER_PROVISION_MATRIC_INVALID' });

    await expect(service.correctUserIdentity({
      id: 5,
      input: { email: 'not-an-email' }
    })).rejects.toMatchObject({ code: 'USER_PROVISION_EMAIL_INVALID' });
  });

  // A student's matric number is now their institutional identity and a
  // supported login identifier, so it may be corrected but never cleared.
  test('refuses to clear a student matric and refuses matric values on lecturers', async () => {
    const prismaMock = createPrismaMock({ users: [{ ...student }, { ...lecturer }] });
    const service = createService(prismaMock);

    await expect(service.correctUserIdentity({
      id: 5,
      input: { matricNumber: '' }
    })).rejects.toMatchObject({
      code: 'USER_IDENTITY_MATRIC_REQUIRED_FOR_ROLE',
      field: 'matricNumber'
    });

    const corrected = await service.correctUserIdentity({ id: 5, input: { matricNumber: 'csc/21/9999' } });
    expect(corrected.user.matricNumber).toBe('CSC/21/9999');

    await expect(service.correctUserIdentity({
      id: 6,
      input: { matricNumber: 'CSC/21/0002' }
    })).rejects.toMatchObject({ code: 'USER_PROVISION_MATRIC_ROLE_MISMATCH' });
  });

  // Part J: a student's email is optional contact/recovery information.
  test('a student email can be added, changed and removed without destroying the account', async () => {
    const prismaMock = createPrismaMock({
      users: [{ ...student, email: null, invitationTokenHash: 'pending', resetTokenHash: 'pending' }]
    });
    const service = createService(prismaMock);

    const added = await service.correctUserIdentity({ id: 5, input: { email: 'Later.Address@Example.com' } });
    expect(added.user.email).toBe('later.address@example.com');

    const removed = await service.correctUserIdentity({ id: 5, input: { email: '' } });
    expect(removed.user.email).toBeNull();

    const stored = prismaMock.__store.find((user) => user.id === 5);
    // The account survives intact: role, password and status are untouched.
    expect(stored.role).toBe('STUDENT');
    expect(stored.status).toBe('ACTIVE');
    expect(stored.passwordHash).toBe(student.passwordHash);
    // Pending email-delivered tokens must not survive the address they were
    // sent to being removed.
    expect(stored.invitationTokenHash).toBeNull();
    expect(stored.resetTokenHash).toBeNull();
  });

  test('a lecturer email cannot be removed because it is their login identity', async () => {
    const service = createService(createPrismaMock({ users: [{ ...lecturer }] }));

    for (const email of ['', '   ', null]) {
      await expect(service.correctUserIdentity({
        id: 6,
        input: { email }
      })).rejects.toMatchObject({
        code: 'USER_IDENTITY_EMAIL_REQUIRED_FOR_ROLE',
        field: 'email'
      });
    }

    const corrected = await service.correctUserIdentity({ id: 6, input: { email: 'new.lecturer@example.com' } });
    expect(corrected.user.email).toBe('new.lecturer@example.com');
  });

  test('role and status can never be changed through identity correction', async () => {
    const service = createService(createPrismaMock({ users: [{ ...student }] }));

    await expect(service.correctUserIdentity({
      id: 5,
      input: { role: 'admin', name: 'X' }
    })).rejects.toMatchObject({ code: 'USER_IDENTITY_ROLE_NOT_EDITABLE' });

    await expect(service.correctUserIdentity({
      id: 5,
      input: { status: 'SUSPENDED' }
    })).rejects.toMatchObject({ code: 'USER_IDENTITY_STATUS_NOT_EDITABLE' });
  });

  test('rejects collisions with other accounts', async () => {
    const other = { ...student, id: 9, email: 'taken@uniosun.edu.ng', matricNumber: 'CSC/21/0002' };
    const service = createService(createPrismaMock({ users: [{ ...student }, other] }));

    await expect(service.correctUserIdentity({
      id: 5,
      input: { email: 'TAKEN@uniosun.edu.ng' }
    })).rejects.toMatchObject({ statusCode: 409, code: 'USER_PROVISION_EMAIL_EXISTS' });

    await expect(service.correctUserIdentity({
      id: 5,
      input: { matricNumber: 'csc/21/0002' }
    })).rejects.toMatchObject({ statusCode: 409, code: 'USER_PROVISION_MATRIC_EXISTS' });
  });

  test('refuses admin targets, reports missing users, and requires fields', async () => {
    const service = createService(createPrismaMock({ users: [{ ...existingAdmin }, { ...student }] }));

    await expect(service.correctUserIdentity({ id: 1, input: { name: 'New' } }))
      .rejects.toMatchObject({ statusCode: 403, code: 'USER_IDENTITY_ADMIN_TARGET_FORBIDDEN' });
    await expect(service.correctUserIdentity({ id: 99, input: { name: 'New' } })).resolves.toBeNull();
    await expect(service.correctUserIdentity({ id: 5, input: {} }))
      .rejects.toMatchObject({ code: 'USER_IDENTITY_NO_FIELDS' });
  });

  test('identical values are a no-op without a database write or audit event', async () => {
    const prismaMock = createPrismaMock({ users: [{ ...student }] });
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await service.correctUserIdentity({
      id: 5,
      input: { name: student.name, email: student.email.toUpperCase() }
    });

    expect(result.changedFields).toEqual([]);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(audit.createAuditLogSafely).not.toHaveBeenCalled();
  });
});

describe('bootstrapFirstAdmin', () => {
  test('creates the first administrator on an empty database', async () => {
    const prismaMock = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    const service = createService(prismaMock, { audit });

    const result = await service.bootstrapFirstAdmin({
      email: 'First.Admin@UNIOSUN.edu.ng',
      name: 'First Admin'
    });

    expect(result.status).toBe('created');
    expect(result.user).toMatchObject({
      email: 'first.admin@uniosun.edu.ng',
      role: 'admin',
      status: 'active',
      mustChangePassword: true
    });
    expect(validatePasswordPolicy(result.temporaryPassword)).toBe(true);

    const createdRow = prismaMock.user.create.mock.calls[0][0].data;
    expect(createdRow.mustChangePassword).toBe(true);
    expect(createdRow.passwordHash).not.toBe(result.temporaryPassword);
    expect(await bcrypt.compare(result.temporaryPassword, createdRow.passwordHash)).toBe(true);

    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('ADMIN_BOOTSTRAPPED');
    expect(JSON.stringify(auditEvent)).not.toContain(result.temporaryPassword);
  });

  test('is idempotent for the same administrator email', async () => {
    const prismaMock = createPrismaMock({
      users: [{ ...existingAdmin, email: 'first.admin@uniosun.edu.ng' }]
    });
    const service = createService(prismaMock);

    const result = await service.bootstrapFirstAdmin({
      email: 'FIRST.ADMIN@uniosun.edu.ng',
      name: 'First Admin'
    });

    expect(result.status).toBe('already-bootstrapped');
    expect(result.temporaryPassword).toBeUndefined();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  test('refuses when a different administrator already exists', async () => {
    const prismaMock = createPrismaMock({ users: [{ ...existingAdmin }] });
    const service = createService(prismaMock);

    const result = await service.bootstrapFirstAdmin({
      email: 'second.admin@uniosun.edu.ng',
      name: 'Second Admin'
    });

    expect(result.status).toBe('conflict');
    expect(result.temporaryPassword).toBeUndefined();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  test('refuses when the email belongs to a non-admin account', async () => {
    const prismaMock = createPrismaMock({
      users: [{ ...existingAdmin, id: 4, email: 'owned@uniosun.edu.ng', role: 'STUDENT' }]
    });
    const service = createService(prismaMock);

    const result = await service.bootstrapFirstAdmin({
      email: 'owned@uniosun.edu.ng',
      name: 'Would Be Admin'
    });

    expect(result.status).toBe('conflict');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  test('warns when demo seed accounts exist', async () => {
    const prismaMock = createPrismaMock({
      users: [{
        ...existingAdmin,
        id: 8,
        email: 'student.demo@uniosun.edu.ng',
        role: 'STUDENT'
      }]
    });
    const service = createService(prismaMock);

    const result = await service.bootstrapFirstAdmin({
      email: 'real.admin@uniosun.edu.ng',
      name: 'Real Admin'
    });

    expect(result.status).toBe('created');
    expect(result.warnings.join(' ')).toMatch(/demo seed account/i);
  });

  test('two bootstrap runs generate different temporary credentials', async () => {
    const first = await createService(createPrismaMock()).bootstrapFirstAdmin({
      email: 'a@uniosun.edu.ng',
      name: 'A'
    });
    const second = await createService(createPrismaMock()).bootstrapFirstAdmin({
      email: 'b@uniosun.edu.ng',
      name: 'B'
    });

    expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
  });
});
