const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { main, parseArgs } = require('./bootstrap-admin');
const { createUserProvisioningService } = require('../src/services/userProvisioning.service');
const { createUserInvitationService, hashInvitationToken } = require('../src/services/userInvitation.service');
const { createAuthService } = require('../src/services/auth.service');
const logger = require('../src/config/logger');

const TEST_JWT_SECRET = 'test-secret-value-for-bootstrap-suite';

// End-to-end secret-exposure regression for the bootstrap CLI: the real
// provisioning + bootstrap-activation services run over an in-memory store
// with a deterministic sentinel placeholder credential and a captured raw
// activation token. Nothing secret-shaped may reach stdout, stderr, the
// logger, or audit serialization.
const SENTINEL = 'SENTINEL-BOOTSTRAP-CREDENTIAL-492817';

function createStorePrisma({ users = [] } = {}) {
  const store = users.map((user) => ({ ...user }));
  let nextId = store.reduce((max, user) => Math.max(max, user.id), 0) + 1;

  const applyUpdate = (existing, data) => {
    const next = { ...existing, ...data };
    if (data.credentialVersion?.increment) {
      next.credentialVersion = (existing.credentialVersion || 1) + data.credentialVersion.increment;
    }
    Object.assign(existing, next);
    return { ...existing };
  };

  const matchesWhere = (user, where) => {
    if (where.id !== undefined && user.id !== where.id) return false;
    if (where.invitationTokenHash !== undefined && user.invitationTokenHash !== where.invitationTokenHash) return false;
    if (where.status !== undefined && user.status !== where.status) return false;
    if (where.invitationExpiresAt?.gt !== undefined) {
      if (!user.invitationExpiresAt || user.invitationExpiresAt.getTime() <= where.invitationExpiresAt.gt.getTime()) {
        return false;
      }
    }
    return true;
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(({ where }) => {
        if (where.email) return Promise.resolve(store.find((user) => user.email === where.email) || null);
        return Promise.resolve(store.find((user) => user.id === where.id) || null);
      }),
      findFirst: jest.fn(({ where }) => {
        const match = store.find((user) => matchesWhere(user, where));
        return Promise.resolve(match ? { ...match } : null);
      }),
      findMany: jest.fn(({ where } = {}) => Promise.resolve(
        where?.role ? store.filter((user) => user.role === where.role) : [...store]
      )),
      create: jest.fn(({ data }) => {
        const created = { id: nextId, credentialVersion: 1, ...data };
        nextId += 1;
        store.push(created);
        return Promise.resolve({ ...created });
      }),
      update: jest.fn(({ where, data }) => {
        const existing = store.find((user) => user.id === where.id);
        return Promise.resolve(applyUpdate(existing, data));
      }),
      count: jest.fn(({ where } = {}) => {
        if (where?.role) return Promise.resolve(store.filter((user) => user.role === where.role).length);
        if (where?.email?.endsWith) {
          return Promise.resolve(store.filter((user) => user.email?.endsWith(where.email.endsWith)).length);
        }
        return Promise.resolve(store.length);
      })
    },
    $transaction: jest.fn((fn) => fn(prismaMock)),
    __store: store
  };

  return prismaMock;
}

function createCapturingOut() {
  const lines = { log: [], warn: [], error: [] };
  return {
    lines,
    log: (...args) => lines.log.push(args.join(' ')),
    warn: (...args) => lines.warn.push(args.join(' ')),
    error: (...args) => lines.error.push(args.join(' ')),
    all: () => [...lines.log, ...lines.warn, ...lines.error].join('\n')
  };
}

function createHarness({ emailProvider } = {}) {
  const prismaMock = createStorePrisma();
  const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
  const capturedTokens = [];
  const mailer = emailProvider || {
    sendInvitationEmail: jest.fn(({ token }) => {
      capturedTokens.push(token);
      return Promise.resolve({ provider: 'smtp', status: 'sent' });
    })
  };

  const invitationService = createUserInvitationService({
    prismaClient: prismaMock,
    emailProvider: mailer,
    audit,
    authConfig: {
      jwtSecret: TEST_JWT_SECRET,
      jwtExpiresIn: '1h',
      invitationExpiresHours: 168
    },
    hashPassword: (value) => bcrypt.hash(value, 4)
  });

  const provisioning = createUserProvisioningService({
    prismaClient: prismaMock,
    audit,
    hashPassword: (value) => bcrypt.hash(value, 4),
    generatePassword: () => SENTINEL,
    emailCapability: () => ({ provider: 'smtp', status: 'configured', message: 'SMTP transport is configured.' }),
    issueBootstrapActivation: (args) => invitationService.issueBootstrapAdminActivation(args)
  });

  return { prismaMock, audit, mailer, capturedTokens, provisioning, invitationService };
}

describe('bootstrap-admin CLI', () => {
  test('parseArgs extracts email and name', () => {
    expect(parseArgs(['--email', 'a@example.com', '--name', 'A Name'])).toEqual({
      email: 'a@example.com',
      name: 'A Name'
    });
  });

  test('successful bootstrap prints only safe status — never the placeholder credential or the activation token', async () => {
    const { prismaMock, audit, capturedTokens, provisioning } = createHarness();
    const out = createCapturingOut();
    const loggerSpies = ['error', 'warn', 'info'].map((level) => jest.spyOn(logger, level));

    const exitCode = await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning,
      out
    });

    expect(exitCode).toBe(0);

    const output = out.all();
    expect(output).toMatch(/First administrator created/);
    expect(output).toMatch(/Activation email sent/);
    expect(output).toMatch(/emailed activation link/);
    expect(output).not.toMatch(/Temporary password/i);

    // The sentinel placeholder credential appears nowhere.
    expect(output).not.toContain(SENTINEL);

    // The raw activation token was captured by the mailer stub exactly once
    // and appears in no CLI output and no audit serialization.
    expect(capturedTokens).toHaveLength(1);
    expect(output).not.toContain(capturedTokens[0]);
    const auditSerialized = JSON.stringify(audit.createAuditLogSafely.mock.calls);
    expect(auditSerialized).not.toContain(SENTINEL);
    expect(auditSerialized).not.toContain(capturedTokens[0]);

    // The application logger was never used by the CLI path at all.
    for (const spy of loggerSpies) {
      const calls = JSON.stringify(spy.mock.calls);
      expect(calls).not.toContain(SENTINEL);
      expect(calls).not.toContain(capturedTokens[0]);
      spy.mockRestore();
    }

    // The account itself carries only the bcrypt hash of the sentinel.
    const stored = prismaMock.__store.find((user) => user.role === 'ADMIN');
    expect(stored.passwordHash).not.toBe(SENTINEL);
    expect(stored.invitationTokenHash).toBe(hashInvitationToken(capturedTokens[0]));
  });

  test('delivery failure prints safe recovery guidance, exits non-zero, and a rerun rotates the token and succeeds', async () => {
    const failure = Object.assign(new Error('mailer down'), { reasonCode: 'smtp-auth-failed' });
    const mailer = {
      sendInvitationEmail: jest.fn()
        .mockRejectedValueOnce(failure)
        .mockImplementation(({ token }) => {
          mailer.deliveredToken = token;
          return Promise.resolve({ provider: 'smtp', status: 'sent' });
        })
    };
    const { prismaMock, provisioning } = createHarness({ emailProvider: mailer });

    const firstOut = createCapturingOut();
    const firstExit = await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning,
      out: firstOut
    });

    expect(firstExit).toBe(1);
    const firstOutput = firstOut.all();
    expect(firstOutput).toMatch(/could not be delivered/);
    expect(firstOutput).toMatch(/Reason: smtp-auth-failed/);
    expect(firstOutput).toMatch(/rerun this same bootstrap command/i);
    expect(firstOutput).not.toContain(SENTINEL);
    expect(firstOutput).not.toMatch(/Temporary password/i);

    const afterFailure = prismaMock.__store.find((user) => user.role === 'ADMIN');
    expect(afterFailure.mustChangePassword).toBe(true);
    const failedHash = afterFailure.invitationTokenHash;

    const secondOut = createCapturingOut();
    const secondExit = await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning,
      out: secondOut
    });

    expect(secondExit).toBe(0);
    expect(secondOut.all()).toMatch(/A new activation email was sent/);
    expect(secondOut.all()).not.toContain(mailer.deliveredToken);

    const afterRetry = prismaMock.__store.find((user) => user.role === 'ADMIN');
    expect(afterRetry.invitationTokenHash).toBe(hashInvitationToken(mailer.deliveredToken));
    expect(afterRetry.invitationTokenHash).not.toBe(failedHash);
    expect(prismaMock.__store.filter((user) => user.role === 'ADMIN')).toHaveLength(1);
  });

  test('after activation completes, rerunning reports bootstrap complete and sends nothing', async () => {
    const { prismaMock, mailer, provisioning } = createHarness();

    await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning,
      out: createCapturingOut()
    });

    // Simulate completed activation.
    const admin = prismaMock.__store.find((user) => user.role === 'ADMIN');
    admin.mustChangePassword = false;

    const out = createCapturingOut();
    const exitCode = await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning,
      out
    });

    expect(exitCode).toBe(0);
    expect(out.all()).toMatch(/Bootstrap already complete/);
    expect(mailer.sendInvitationEmail).toHaveBeenCalledTimes(1);
  });

  test('refuses without SMTP capability before creating anything', async () => {
    const { prismaMock } = createHarness();
    const refusingProvisioning = {
      // The refusal happens before any activation attempt, so the default
      // bootstrap-activation dependency is never invoked here.
      bootstrapFirstAdmin: (args) => createUserProvisioningService({
        prismaClient: prismaMock,
        audit: { createAuditLogSafely: jest.fn().mockResolvedValue(null) },
        hashPassword: (value) => bcrypt.hash(value, 4),
        generatePassword: () => SENTINEL,
        emailCapability: () => ({ provider: 'disabled', status: 'disabled', message: 'EMAIL CAPABILITY DISABLED' })
      }).bootstrapFirstAdmin(args)
    };

    const out = createCapturingOut();
    const exitCode = await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning: refusingProvisioning,
      out
    });

    expect(exitCode).toBe(1);
    expect(out.all()).toMatch(/REFUSED: Bootstrap requires configured SMTP/);
    expect(out.all()).not.toContain(SENTINEL);
    expect(prismaMock.__store).toHaveLength(0);
  });

  test('legacy incomplete-admin recovery kills the disclosed password, old sessions, old reset link, and old activation link', async () => {
    const KNOWN_LEGACY_PASSWORD = 'LegacyPrintedTemp9x';
    const OLD_ACTIVATION_TOKEN = 'legacy-activation-token-legacy-activation-01';
    const { prismaMock, audit, capturedTokens, provisioning, invitationService } = createHarness();

    // An incomplete administrator as the OLD bootstrap implementation left it:
    // a temporary password whose plaintext reached operator logs, an old reset
    // link, an old activation link, and sessions issued at credentialVersion 1.
    prismaMock.__store.push({
      id: 41,
      name: 'First Admin',
      email: 'first.admin@department.example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
      credentialVersion: 1,
      passwordHash: await bcrypt.hash(KNOWN_LEGACY_PASSWORD, 4),
      resetTokenHash: 'old-reset-hash',
      resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      invitationTokenHash: hashInvitationToken(OLD_ACTIVATION_TOKEN),
      invitationExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    const preRecoverySession = jwt.sign({ sub: '41', role: 'admin', cv: 1 }, TEST_JWT_SECRET, { expiresIn: '1h' });

    const out = createCapturingOut();
    const loggerSpies = ['error', 'warn', 'info'].map((level) => jest.spyOn(logger, level));

    const exitCode = await main({
      argv: ['--email', 'first.admin@department.example.com', '--name', 'First Admin'],
      provisioning,
      out
    });

    expect(exitCode).toBe(0);
    expect(out.all()).toMatch(/A new activation email was sent/);

    const updated = prismaMock.__store.find((user) => user.id === 41);
    // The possibly-disclosed legacy password is dead; only the unrevealed
    // placeholder's hash remains.
    expect(await bcrypt.compare(KNOWN_LEGACY_PASSWORD, updated.passwordHash)).toBe(false);
    expect(await bcrypt.compare(SENTINEL, updated.passwordHash)).toBe(true);
    expect(updated.credentialVersion).toBe(2);
    expect(updated.resetTokenHash).toBeNull();
    expect(updated.resetTokenExpiresAt).toBeNull();
    expect(updated.mustChangePassword).toBe(true);

    // The old activation link is dead; the newly emailed one is the only
    // valid path and belongs to the admin account.
    await expect(invitationService.validateInvitationToken({ token: OLD_ACTIVATION_TOKEN }))
      .rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    const newToken = capturedTokens[capturedTokens.length - 1];
    const validated = await invitationService.validateInvitationToken({ token: newToken });
    expect(validated.account.role).toBe('admin');

    // A session issued before recovery dies at the production
    // credential-version check; a post-recovery session passes it.
    const authService = createAuthService({
      prismaClient: prismaMock,
      authConfig: { jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: '1h' }
    });
    await expect(authService.authenticateToken(preRecoverySession))
      .rejects.toMatchObject({ code: 'INVALID_SESSION' });
    const postRecoverySession = jwt.sign({ sub: '41', role: 'admin', cv: 2 }, TEST_JWT_SECRET, { expiresIn: '1h' });
    await expect(authService.authenticateToken(postRecoverySession)).resolves.toMatchObject({ id: 41 });

    // No secret reached any output channel during recovery.
    const output = out.all();
    expect(output).not.toContain(SENTINEL);
    expect(output).not.toContain(newToken);
    expect(output).not.toMatch(/Temporary password/i);
    const auditSerialized = JSON.stringify(audit.createAuditLogSafely.mock.calls);
    expect(auditSerialized).not.toContain(SENTINEL);
    expect(auditSerialized).not.toContain(newToken);
    for (const spy of loggerSpies) {
      const calls = JSON.stringify(spy.mock.calls);
      expect(calls).not.toContain(SENTINEL);
      expect(calls).not.toContain(newToken);
      spy.mockRestore();
    }

    // Exactly one administrator exists; recovery created nothing.
    expect(prismaMock.__store.filter((user) => user.role === 'ADMIN')).toHaveLength(1);
  });


  test('missing arguments print usage without touching the service', async () => {
    const provisioning = { bootstrapFirstAdmin: jest.fn() };
    const out = createCapturingOut();

    const exitCode = await main({ argv: ['--email', 'only@example.com'], provisioning, out });

    expect(exitCode).toBe(1);
    expect(out.all()).toMatch(/Usage:/);
    expect(provisioning.bootstrapFirstAdmin).not.toHaveBeenCalled();
  });
});
