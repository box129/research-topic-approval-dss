const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  createUserInvitationService,
  generateInvitationToken,
  hashInvitationToken,
  UserInvitationError,
  INVITATION_TOKEN_BYTES
} = require('./userInvitation.service');
const { validatePasswordPolicy } = require('./auth.service');

const BASE_TIME = new Date('2026-08-23T10:00:00.000Z');

function createPrismaMock({ users = [] } = {}) {
  const store = users.map((user) => ({ ...user }));

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

  return {
    user: {
      findUnique: jest.fn(({ where }) => Promise.resolve(
        store.find((user) => user.id === where.id) ? { ...store.find((user) => user.id === where.id) } : null
      )),
      findFirst: jest.fn(({ where }) => Promise.resolve(
        store.find((user) => matchesWhere(user, where)) ? { ...store.find((user) => matchesWhere(user, where)) } : null
      )),
      update: jest.fn(({ where, data }) => {
        const existing = store.find((user) => user.id === where.id);
        return Promise.resolve(applyUpdate(existing, data));
      }),
      updateMany: jest.fn(({ where, data }) => {
        const matches = store.filter((user) => matchesWhere(user, where));
        matches.forEach((user) => applyUpdate(user, data));
        return Promise.resolve({ count: matches.length });
      })
    },
    __store: store
  };
}

const invitableStudent = {
  id: 5,
  name: 'Synthetic Student',
  email: 'synthetic.student@uniosun.edu.ng',
  passwordHash: '$2a$04$temporaryhash',
  role: 'STUDENT',
  status: 'ACTIVE',
  matricNumber: 'CSC/26/0001',
  mustChangePassword: true,
  credentialVersion: 1,
  invitationTokenHash: null,
  invitationExpiresAt: null,
  invitationLastAttemptAt: null,
  invitationLastSentAt: null,
  invitationLastError: null,
  invitationAcceptedAt: null
};

const invitableLecturer = {
  ...invitableStudent,
  id: 6,
  name: 'Synthetic Lecturer',
  email: 'synthetic.lecturer@uniosun.edu.ng',
  role: 'LECTURER',
  matricNumber: null
};

function createService(prismaMock, overrides = {}) {
  const emailProvider = overrides.emailProvider || {
    sendInvitationEmail: jest.fn().mockResolvedValue({ provider: 'mock', status: 'mocked', delivered: false })
  };
  const audit = overrides.audit || { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
  const service = createUserInvitationService({
    prismaClient: prismaMock,
    emailProvider,
    audit,
    authConfig: {
      jwtSecret: 'test-secret-value-for-invitation-suite',
      jwtExpiresIn: '1h',
      invitationExpiresHours: 168
    },
    hashPassword: (value) => bcrypt.hash(value, 4),
    now: overrides.now || (() => new Date(BASE_TIME)),
    ...(overrides.generateToken ? { generateToken: overrides.generateToken } : {})
  });
  return { service, emailProvider, audit };
}

describe('invitation token generation', () => {
  test('produces high-entropy unique url-safe tokens', () => {
    const tokens = new Set();
    for (let index = 0; index < 50; index += 1) {
      const token = generateInvitationToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      tokens.add(token);
    }
    expect(tokens.size).toBe(50);
    expect(INVITATION_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
  });

  test('hash is SHA-256 of the token, not the token itself', () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });
});

describe('issueInvitation', () => {
  test('stores only the token hash with expiry and emails the plaintext token once', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider, audit } = createService(prismaMock);

    const result = await service.issueInvitation({ id: 5, actor: { id: 1, role: 'admin' } });

    const emailArgs = emailProvider.sendInvitationEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe('synthetic.student@uniosun.edu.ng');
    expect(emailArgs.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = prismaMock.__store.find((user) => user.id === 5);
    expect(stored.invitationTokenHash).toBe(hashInvitationToken(emailArgs.token));
    expect(stored.invitationTokenHash).not.toBe(emailArgs.token);
    expect(stored.invitationExpiresAt.getTime()).toBe(BASE_TIME.getTime() + 168 * 60 * 60 * 1000);
    expect(stored.invitationLastSentAt).toEqual(BASE_TIME);
    expect(stored.invitationLastError).toBeNull();

    expect(result.delivery.status).toBe('sent');
    expect(result.invitation.status).toBe('pending');
    expect(JSON.stringify(result)).not.toContain(emailArgs.token);

    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('USER_INVITATION_SENT');
    expect(JSON.stringify(auditEvent)).not.toContain(emailArgs.token);
    expect(JSON.stringify(auditEvent)).not.toContain(stored.invitationTokenHash);
  });

  test('students and lecturers can be invited; admins cannot', async () => {
    const admin = { ...invitableStudent, id: 1, role: 'ADMIN', email: 'admin@uniosun.edu.ng' };
    const prismaMock = createPrismaMock({ users: [invitableStudent, invitableLecturer, admin] });
    const { service } = createService(prismaMock);

    await expect(service.issueInvitation({ id: 5 })).resolves.toMatchObject({ delivery: { status: 'sent' } });
    await expect(service.issueInvitation({ id: 6 })).resolves.toMatchObject({ delivery: { status: 'sent' } });
    await expect(service.issueInvitation({ id: 1 })).rejects.toMatchObject({
      code: 'USER_INVITATION_ROLE_NOT_ALLOWED',
      statusCode: 403
    });
  });

  test('suspended and already-completed accounts cannot be invited; missing users return null', async () => {
    const suspended = { ...invitableStudent, id: 7, status: 'SUSPENDED' };
    const completed = { ...invitableStudent, id: 8, mustChangePassword: false };
    const prismaMock = createPrismaMock({ users: [suspended, completed] });
    const { service } = createService(prismaMock);

    await expect(service.issueInvitation({ id: 7 })).rejects.toMatchObject({
      code: 'USER_INVITATION_ACCOUNT_SUSPENDED'
    });
    await expect(service.issueInvitation({ id: 8 })).rejects.toMatchObject({
      code: 'USER_INVITATION_ALREADY_COMPLETED'
    });
    await expect(service.issueInvitation({ id: 99 })).resolves.toBeNull();
  });

  test('resend rotates the token hash so the previous link is invalidated, and audits as resent', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider, audit } = createService(prismaMock);

    await service.issueInvitation({ id: 5 });
    const firstToken = emailProvider.sendInvitationEmail.mock.calls[0][0].token;

    await service.issueInvitation({ id: 5 });
    const secondToken = emailProvider.sendInvitationEmail.mock.calls[1][0].token;

    expect(secondToken).not.toBe(firstToken);
    const stored = prismaMock.__store.find((user) => user.id === 5);
    expect(stored.invitationTokenHash).toBe(hashInvitationToken(secondToken));
    expect(stored.invitationTokenHash).not.toBe(hashInvitationToken(firstToken));

    const eventTypes = audit.createAuditLogSafely.mock.calls.map(([event]) => event.eventType);
    expect(eventTypes).toEqual(['USER_INVITATION_SENT', 'USER_INVITATION_RESENT']);
  });

  test('delivery failure keeps the account provisioned, records a safe reason, and audits the failure', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const failingProvider = {
      sendInvitationEmail: jest.fn().mockRejectedValue(Object.assign(new Error('smtp down'), { reasonCode: 'smtp-connect-failed' }))
    };
    const { service, audit } = createService(prismaMock, { emailProvider: failingProvider });

    const result = await service.issueInvitation({ id: 5, actor: { id: 1 } });

    expect(result.delivery).toEqual({ status: 'failed', reasonCode: 'smtp-connect-failed' });
    expect(result.invitation.status).toBe('failed');

    const stored = prismaMock.__store.find((user) => user.id === 5);
    expect(stored.invitationLastError).toBe('smtp-connect-failed');
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).toBe('$2a$04$temporaryhash');

    const auditEvent = audit.createAuditLogSafely.mock.calls[0][0];
    expect(auditEvent.eventType).toBe('USER_INVITATION_DELIVERY_FAILED');
    expect(auditEvent.metadata.reasonCode).toBe('smtp-connect-failed');
  });

  test('resend after a failed delivery succeeds and clears the failure state', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const flakyProvider = {
      sendInvitationEmail: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('down'), { reasonCode: 'smtp-timeout' }))
        .mockResolvedValueOnce({ provider: 'smtp', status: 'sent', delivered: true })
    };
    const { service } = createService(prismaMock, { emailProvider: flakyProvider });

    const first = await service.issueInvitation({ id: 5 });
    expect(first.delivery.status).toBe('failed');

    const second = await service.issueInvitation({ id: 5 });
    expect(second.delivery.status).toBe('sent');
    expect(second.invitation.status).toBe('pending');
    expect(prismaMock.__store.find((user) => user.id === 5).invitationLastError).toBeNull();
  });
});

describe('acceptInvitation', () => {
  async function issueFor(service, emailProvider, id) {
    await service.issueInvitation({ id });
    const calls = emailProvider.sendInvitationEmail.mock.calls;
    return calls[calls.length - 1][0].token;
  }

  test('establishes the private password, clears forced-change, bumps credentialVersion, and single-uses the token', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider, audit } = createService(prismaMock);
    const token = await issueFor(service, emailProvider, 5);

    const result = await service.acceptInvitation({ token, password: 'MyPrivatePass1' });

    const stored = prismaMock.__store.find((user) => user.id === 5);
    expect(await bcrypt.compare('MyPrivatePass1', stored.passwordHash)).toBe(true);
    expect(stored.mustChangePassword).toBe(false);
    expect(stored.credentialVersion).toBe(2);
    expect(stored.invitationTokenHash).toBeNull();
    expect(stored.invitationExpiresAt).toBeNull();
    expect(stored.invitationAcceptedAt).toEqual(BASE_TIME);
    expect(stored.resetTokenHash).toBeNull();

    expect(result.user).toMatchObject({
      id: 5,
      email: 'synthetic.student@uniosun.edu.ng',
      role: 'student',
      mustChangePassword: false
    });
    expect(typeof result.token).toBe('string');

    // Second use of the same link fails.
    await expect(service.acceptInvitation({ token, password: 'AnotherPass1' }))
      .rejects.toMatchObject({ code: 'INVITATION_INVALID' });

    const acceptedEvent = audit.createAuditLogSafely.mock.calls
      .map(([event]) => event)
      .find((event) => event.eventType === 'USER_INVITATION_ACCEPTED');
    expect(acceptedEvent).toBeDefined();
    expect(JSON.stringify(acceptedEvent)).not.toContain(token);
    expect(JSON.stringify(acceptedEvent)).not.toContain('MyPrivatePass1');
  });

  test('expired tokens are refused', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    let currentTime = BASE_TIME;
    const { service, emailProvider } = createService(prismaMock, { now: () => new Date(currentTime) });
    const token = await issueFor(service, emailProvider, 5);

    currentTime = new Date(BASE_TIME.getTime() + 169 * 60 * 60 * 1000);
    await expect(service.acceptInvitation({ token, password: 'ValidPass123' }))
      .rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });

  test('suspended accounts cannot accept even with a valid token', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider } = createService(prismaMock);
    const token = await issueFor(service, emailProvider, 5);

    prismaMock.__store.find((user) => user.id === 5).status = 'SUSPENDED';

    await expect(service.acceptInvitation({ token, password: 'ValidPass123' }))
      .rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(prismaMock.__store.find((user) => user.id === 5).mustChangePassword).toBe(true);
  });

  test('nonexistent and malformed tokens are handled safely without user information', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service } = createService(prismaMock);

    for (const bad of [generateInvitationToken(), 'short', '', null, undefined, 'x'.repeat(500), '<script>alert(1)</script>']) {
      await expect(service.acceptInvitation({ token: bad, password: 'ValidPass123' }))
        .rejects.toMatchObject({ code: 'INVITATION_INVALID', statusCode: 400 });
    }
  });

  test('enforces the standard password policy', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider } = createService(prismaMock);
    const token = await issueFor(service, emailProvider, 5);

    await expect(service.acceptInvitation({ token, password: 'short1' }))
      .rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    await expect(service.acceptInvitation({ token, password: 'nonumberpassword' }))
      .rejects.toMatchObject({ code: 'WEAK_PASSWORD' });

    // The failed attempts did not consume the token.
    await expect(service.acceptInvitation({ token, password: 'ValidPass123' }))
      .resolves.toMatchObject({ user: { mustChangePassword: false } });
    expect(validatePasswordPolicy('ValidPass123')).toBe(true);
  });

  test('acceptance cannot create accounts or change email/role, and a resend invalidates the first link', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider } = createService(prismaMock);

    const firstToken = await issueFor(service, emailProvider, 5);
    await service.issueInvitation({ id: 5 });
    const secondToken = emailProvider.sendInvitationEmail.mock.calls[1][0].token;

    // First link is dead after resend.
    await expect(service.acceptInvitation({ token: firstToken, password: 'ValidPass123' }))
      .rejects.toMatchObject({ code: 'INVITATION_INVALID' });

    // Replacement link works.
    await expect(service.acceptInvitation({ token: secondToken, password: 'ValidPass123' }))
      .resolves.toMatchObject({ user: { id: 5 } });

    // No new account appeared, identity unchanged.
    expect(prismaMock.__store).toHaveLength(1);
    const stored = prismaMock.__store[0];
    expect(stored.email).toBe('synthetic.student@uniosun.edu.ng');
    expect(stored.role).toBe('STUDENT');
  });

  test('validateInvitationToken reveals only the account display identity for valid tokens', async () => {
    const prismaMock = createPrismaMock({ users: [invitableStudent] });
    const { service, emailProvider } = createService(prismaMock);
    const token = await issueFor(service, emailProvider, 5);

    const result = await service.validateInvitationToken({ token });
    expect(result).toEqual({
      valid: true,
      account: {
        name: 'Synthetic Student',
        email: 'synthetic.student@uniosun.edu.ng',
        role: 'student'
      },
      expiresAt: new Date(BASE_TIME.getTime() + 168 * 60 * 60 * 1000).toISOString()
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');

    await expect(service.validateInvitationToken({ token: generateInvitationToken() }))
      .rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });
});

describe('sendBulkInvitations', () => {
  function cohort(count, startId = 100) {
    return Array.from({ length: count }, (_, index) => ({
      ...invitableStudent,
      id: startId + index,
      email: `bulk.student.${index}@uniosun.edu.ng`,
      matricNumber: `CSC/26/${String(1000 + index)}`
    }));
  }

  test('uses bounded concurrency and reports truthful per-user outcomes', async () => {
    const users = cohort(20);
    const prismaMock = createPrismaMock({ users });
    let inFlight = 0;
    let peakInFlight = 0;
    const emailProvider = {
      sendInvitationEmail: jest.fn(async ({ to }) => {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        if (to === 'bulk.student.3@uniosun.edu.ng') {
          throw Object.assign(new Error('mailbox unavailable'), { reasonCode: 'smtp-recipient-rejected' });
        }
        return { provider: 'smtp', status: 'sent', delivered: true };
      })
    };
    const { service, audit } = createService(prismaMock, { emailProvider });

    const suspended = { ...invitableStudent, id: 300, status: 'SUSPENDED', email: 'suspended@uniosun.edu.ng' };
    prismaMock.__store.push(suspended);

    const { summary, results } = await service.sendBulkInvitations({
      userIds: [...users.map((user) => user.id), 300, 999],
      actor: { id: 1 },
      concurrency: 4
    });

    expect(peakInFlight).toBeLessThanOrEqual(4);
    expect(summary).toEqual({ requested: 22, sent: 19, failed: 1, skipped: 2 });

    const failedEntry = results.find((entry) => entry.status === 'failed');
    expect(failedEntry).toMatchObject({ email: 'bulk.student.3@uniosun.edu.ng', reasonCode: 'smtp-recipient-rejected' });
    const skippedReasons = results.filter((entry) => entry.status === 'skipped').map((entry) => entry.reasonCode).sort();
    expect(skippedReasons).toEqual(['USER_INVITATION_ACCOUNT_SUSPENDED', 'user-not-found']);

    // One failure does not falsely mark others successful — every sent row
    // really got a provider call.
    expect(results.filter((entry) => entry.status === 'sent')).toHaveLength(19);
    expect(emailProvider.sendInvitationEmail).toHaveBeenCalledTimes(20);

    const batchEvent = audit.createAuditLogSafely.mock.calls
      .map(([event]) => event)
      .find((event) => event.eventType === 'BULK_USER_INVITATIONS_SENT');
    expect(batchEvent.metadata).toMatchObject({ requested: 22, sent: 19, failed: 1, skipped: 2 });
  });

  test('rejects empty and oversized batches', async () => {
    const { service } = createService(createPrismaMock());
    await expect(service.sendBulkInvitations({ userIds: [] })).rejects.toBeInstanceOf(UserInvitationError);
    await expect(service.sendBulkInvitations({ userIds: null })).rejects.toBeInstanceOf(UserInvitationError);
    await expect(service.sendBulkInvitations({ userIds: Array.from({ length: 1001 }, (_, index) => index + 1) }))
      .rejects.toMatchObject({ code: 'USER_INVITATION_BATCH_TOO_LARGE' });
  });
});
