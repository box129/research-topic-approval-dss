const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/env');
const emailService = require('./email.service');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');
const { serializeUser, serializeInvitationState } = require('./adminUser.service');
const { validatePasswordPolicy } = require('./auth.service');

// Email invitations attach to accounts that Phase-2/3 provisioning already
// created; this module never creates users, never changes email or role, and
// never stores a plaintext token. The Phase-2 temporary-credential path stays
// valid until the invitation is accepted, so manual distribution remains an
// operational fallback.

// 32 random bytes = 256 bits of entropy, base64url-encoded (43 chars).
const INVITATION_TOKEN_BYTES = 32;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{40,64}$/;

// Only STUDENT and LECTURER accounts are invitable; administrators are
// provisioned through the operator bootstrap path only.
const INVITABLE_ROLES = new Set(['STUDENT', 'LECTURER']);

// Bounded parallelism for cohort-scale sends: enough to overlap SMTP
// round-trips without hammering the provider with hundreds of connections.
const BULK_INVITATION_CONCURRENCY = 5;

class UserInvitationError extends Error {
  constructor(message, { code = 'USER_INVITATION_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'UserInvitationError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function generateInvitationToken() {
  return crypto.randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
}

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeTokenInput(token) {
  const value = String(token || '').trim();
  if (!value || !TOKEN_FORMAT.test(value)) {
    return null;
  }
  return value;
}

function parsePositiveId(value, field) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new UserInvitationError(`${field} must be a positive integer.`, {
      code: 'USER_INVITATION_INVALID_ID',
      field
    });
  }
  return id;
}

function createUserInvitationService({
  prismaClient = prisma,
  emailProvider = emailService,
  authConfig = config.auth,
  audit = { createAuditLogSafely },
  hashPassword = (value) => bcrypt.hash(value, 12),
  generateToken = generateInvitationToken,
  now = () => new Date()
} = {}) {
  // Session token creation mirrors auth.service exactly (same claim
  // contract: sub / role / cv), so acceptance can sign the user in through
  // the standard cookie flow without a second login round-trip.
  const createSessionTokenFor = (user) => jwt.sign(
    {
      sub: String(user.id),
      role: String(user.role || '').toLowerCase(),
      cv: user.credentialVersion ?? 1
    },
    authConfig.jwtSecret,
    { expiresIn: authConfig.jwtExpiresIn }
  );

  const assertInvitable = (user) => {
    if (!INVITABLE_ROLES.has(user.role)) {
      throw new UserInvitationError('Only student or lecturer accounts can be invited.', {
        code: 'USER_INVITATION_ROLE_NOT_ALLOWED',
        statusCode: 403
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UserInvitationError('Suspended accounts cannot be invited. Reactivate the account first.', {
        code: 'USER_INVITATION_ACCOUNT_SUSPENDED',
        statusCode: 409
      });
    }

    if (!user.mustChangePassword) {
      throw new UserInvitationError('This account has already established its own password. Use credential reset if access is lost.', {
        code: 'USER_INVITATION_ALREADY_COMPLETED',
        statusCode: 409
      });
    }
  };

  /**
   * Issues (or re-issues) the single active invitation for one provisioned
   * account and attempts delivery. Persisting the new token hash before the
   * delivery attempt guarantees any previous invitation link is invalidated
   * the moment a new one is issued. Delivery failure keeps the account fully
   * provisioned and manually recoverable; the outcome is reported truthfully.
   */
  const issueInvitation = async ({ id: idValue, actor, req } = {}) => {
    const id = parsePositiveId(idValue, 'id');
    const user = await prismaClient.user.findUnique({ where: { id } });
    if (!user) {
      return null;
    }

    assertInvitable(user);

    const isResend = Boolean(user.invitationTokenHash || user.invitationLastAttemptAt);
    const token = generateToken();
    const tokenHash = hashInvitationToken(token);
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + authConfig.invitationExpiresHours * 60 * 60 * 1000);

    // Rotate the stored hash first: from this moment the previous link is
    // dead regardless of how delivery goes.
    await prismaClient.user.update({
      where: { id },
      data: {
        invitationTokenHash: tokenHash,
        invitationExpiresAt: expiresAt,
        invitationLastAttemptAt: issuedAt,
        invitationLastError: null
      }
    });

    let delivery;
    try {
      const sendResult = await emailProvider.sendInvitationEmail({
        to: user.email,
        name: user.name,
        token,
        expiresHours: authConfig.invitationExpiresHours
      });
      delivery = {
        status: 'sent',
        provider: sendResult.provider,
        providerStatus: sendResult.status
      };
    } catch (error) {
      const reasonCode = error?.reasonCode || 'delivery-failed';
      await prismaClient.user.update({
        where: { id },
        data: { invitationLastError: reasonCode }
      });

      await audit.createAuditLogSafely({
        eventType: AUDIT_EVENT_TYPES.USER_INVITATION_DELIVERY_FAILED,
        ...buildAuditContextFromRequest(req),
        targetType: 'User',
        targetId: String(id),
        metadata: {
          targetUserId: id,
          targetUserEmail: user.email,
          targetUserRole: user.role,
          reasonCode,
          resend: isResend,
          invitedByAdminId: actor?.id ?? null
        }
      });

      const updated = await prismaClient.user.findUnique({ where: { id } });
      return {
        user: serializeUser(updated),
        invitation: serializeInvitationState(updated, now()),
        delivery: { status: 'failed', reasonCode }
      };
    }

    const sentAt = now();
    const updated = await prismaClient.user.update({
      where: { id },
      data: {
        invitationLastSentAt: sentAt,
        invitationLastError: null
      }
    });

    await audit.createAuditLogSafely({
      eventType: isResend ? AUDIT_EVENT_TYPES.USER_INVITATION_RESENT : AUDIT_EVENT_TYPES.USER_INVITATION_SENT,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(id),
      metadata: {
        targetUserId: id,
        targetUserEmail: user.email,
        targetUserRole: user.role,
        expiresAt: expiresAt.toISOString(),
        resend: isResend,
        invitedByAdminId: actor?.id ?? null
      }
    });

    return {
      user: serializeUser(updated),
      invitation: serializeInvitationState(updated, now()),
      delivery
    };
  };

  /**
   * Sends invitations to a set of provisioned accounts with bounded
   * concurrency. Every account gets an individual truthful outcome —
   * sent / failed / skipped(reason) — and one batch audit event records the
   * counts. This is a synchronous batch operation, honestly reported as such.
   */
  const sendBulkInvitations = async ({ userIds, actor, req, concurrency = BULK_INVITATION_CONCURRENCY } = {}) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new UserInvitationError('userIds must be a non-empty array of user ids.', {
        code: 'USER_INVITATION_IDS_REQUIRED',
        field: 'userIds'
      });
    }
    if (userIds.length > 1000) {
      throw new UserInvitationError('At most 1000 invitations can be sent per batch.', {
        code: 'USER_INVITATION_BATCH_TOO_LARGE',
        field: 'userIds'
      });
    }

    const ids = userIds.map((value) => parsePositiveId(value, 'userIds'));
    const uniqueIds = [...new Set(ids)];
    const results = new Array(uniqueIds.length);
    let cursor = 0;

    const worker = async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= uniqueIds.length) {
          return;
        }
        const id = uniqueIds[index];
        try {
          const outcome = await issueInvitation({ id, actor, req });
          if (!outcome) {
            results[index] = { userId: id, status: 'skipped', reasonCode: 'user-not-found' };
          } else if (outcome.delivery.status === 'sent') {
            results[index] = { userId: id, status: 'sent', email: outcome.user.email };
          } else {
            results[index] = {
              userId: id,
              status: 'failed',
              email: outcome.user.email,
              reasonCode: outcome.delivery.reasonCode
            };
          }
        } catch (error) {
          if (error instanceof UserInvitationError) {
            results[index] = { userId: id, status: 'skipped', reasonCode: error.code };
          } else {
            results[index] = { userId: id, status: 'failed', reasonCode: 'internal-error' };
          }
        }
      }
    };

    const poolSize = Math.max(1, Math.min(concurrency, uniqueIds.length));
    await Promise.all(Array.from({ length: poolSize }, worker));

    const summary = {
      requested: uniqueIds.length,
      sent: results.filter((entry) => entry.status === 'sent').length,
      failed: results.filter((entry) => entry.status === 'failed').length,
      skipped: results.filter((entry) => entry.status === 'skipped').length
    };

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.BULK_USER_INVITATIONS_SENT,
      ...buildAuditContextFromRequest(req),
      targetType: 'UserInvitationBatch',
      targetId: null,
      metadata: {
        ...summary,
        sentByAdminId: actor?.id ?? null
      }
    });

    return { summary, results };
  };

  const findUserByActiveToken = async (tokenValue) => {
    const token = normalizeTokenInput(tokenValue);
    if (!token) {
      return null;
    }

    const tokenHash = hashInvitationToken(token);
    const user = await prismaClient.user.findFirst({
      where: {
        invitationTokenHash: tokenHash,
        invitationExpiresAt: { gt: now() }
      }
    });

    // A suspended account's invitation is inert; an accepted invitation has
    // its hash cleared, so completed accounts can never reuse an old link.
    // All ineligible cases collapse into the same "not found" so the token
    // endpoint reveals nothing beyond valid/invalid.
    if (!user || user.status !== 'ACTIVE' || !user.mustChangePassword) {
      return null;
    }

    return user;
  };

  /**
   * Public token validation for the acceptance screen. Reveals only what the
   * legitimate email recipient already knows (their own name/email), and
   * nothing at all for invalid tokens.
   */
  const validateInvitationToken = async ({ token } = {}) => {
    const user = await findUserByActiveToken(token);
    if (!user) {
      throw new UserInvitationError('This invitation link is invalid or has expired. Ask an administrator to send a new invitation.', {
        code: 'INVITATION_INVALID',
        statusCode: 400
      });
    }

    return {
      valid: true,
      account: {
        name: user.name,
        email: user.email,
        role: String(user.role || '').toLowerCase()
      },
      expiresAt: user.invitationExpiresAt.toISOString()
    };
  };

  /**
   * One-shot acceptance: the token holder establishes the private password
   * for the already-provisioned account. Nothing else about the account can
   * be changed through this path. Completing it invalidates the invitation
   * token, any outstanding reset token, the temporary credential, and every
   * previously issued session.
   */
  const acceptInvitation = async ({ token, password, req } = {}) => {
    const user = await findUserByActiveToken(token);
    if (!user) {
      throw new UserInvitationError('This invitation link is invalid or has expired. Ask an administrator to send a new invitation.', {
        code: 'INVITATION_INVALID',
        statusCode: 400
      });
    }

    if (!validatePasswordPolicy(password)) {
      throw new UserInvitationError('Password must be at least 8 characters and contain at least one number.', {
        code: 'WEAK_PASSWORD',
        field: 'password'
      });
    }

    const passwordHash = await hashPassword(String(password));

    // updateMany with the token hash in the WHERE clause makes acceptance
    // atomic and single-use: two concurrent submissions of the same link can
    // only consume the token once.
    const updateResult = await prismaClient.user.updateMany({
      where: {
        id: user.id,
        invitationTokenHash: user.invitationTokenHash,
        status: 'ACTIVE'
      },
      data: {
        passwordHash,
        mustChangePassword: false,
        credentialVersion: { increment: 1 },
        invitationTokenHash: null,
        invitationExpiresAt: null,
        invitationAcceptedAt: now(),
        invitationLastError: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null
      }
    });

    if (updateResult.count !== 1) {
      throw new UserInvitationError('This invitation link is invalid or has expired. Ask an administrator to send a new invitation.', {
        code: 'INVITATION_INVALID',
        statusCode: 400
      });
    }

    const updated = await prismaClient.user.findUnique({ where: { id: user.id } });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.USER_INVITATION_ACCEPTED,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(user.id),
      metadata: {
        targetUserId: user.id,
        targetUserEmail: user.email,
        targetUserRole: user.role,
        priorSessionsInvalidated: true,
        method: 'invitation-acceptance'
      }
    });

    // Establish a fresh session exactly like login/change-password do, so the
    // user lands in the app without re-entering the password they just chose.
    const sessionToken = createSessionTokenFor(updated);

    return {
      token: sessionToken,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: String(updated.role || '').toLowerCase(),
        status: String(updated.status || '').toLowerCase(),
        matricNumber: updated.matricNumber || null,
        mustChangePassword: false
      },
      message: 'Your password has been set. You are now signed in.'
    };
  };

  return {
    issueInvitation,
    sendBulkInvitations,
    validateInvitationToken,
    acceptInvitation
  };
}

module.exports = {
  ...createUserInvitationService(),
  createUserInvitationService,
  UserInvitationError,
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TOKEN_BYTES,
  INVITABLE_ROLES,
  BULK_INVITATION_CONCURRENCY
};
