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
      input: { name: 'Dup', email: 'TAKEN@uniosun.edu.ng', role: 'student' }
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
      input: { name: 'Race', email: 'race@uniosun.edu.ng', role: 'student' }
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
