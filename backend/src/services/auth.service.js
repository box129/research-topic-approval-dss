const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/env');
const emailService = require('./email.service');
const { createNotificationEventService } = require('./notificationEvent.service');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');

const ROLE_TO_CLIENT = {
  ADMIN: 'admin',
  LECTURER: 'lecturer',
  STUDENT: 'student'
};

class AuthServiceError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'AuthServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function toClientRole(role) {
  return ROLE_TO_CLIENT[role] || String(role || '').toLowerCase();
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: toClientRole(user.role),
    status: String(user.status || '').toLowerCase(),
    matricNumber: user.matricNumber || null,
    mustChangePassword: Boolean(user.mustChangePassword)
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePasswordPolicy(password) {
  const value = String(password || '');
  return value.length >= 8 && /\d/.test(value);
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.cookieSecure,
    maxAge: 24 * 60 * 60 * 1000
  };
}

function getClearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.cookieSecure
  };
}

function createAuthService({
  prismaClient = prisma,
  emailProvider = emailService,
  authConfig = config.auth,
  notificationEvents = createNotificationEventService({ prismaClient }),
  audit = { createAuditLogSafely }
} = {}) {
  const createSessionToken = (user) => jwt.sign(
    {
      sub: String(user.id),
      role: toClientRole(user.role),
      cv: user.credentialVersion ?? 1
    },
    authConfig.jwtSecret,
    { expiresIn: authConfig.jwtExpiresIn }
  );

  const login = async ({ email, password }) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      throw new AuthServiceError('Email and password are required.', 400, 'AUTH_REQUIRED_FIELDS');
    }

    const user = await prismaClient.user.findUnique({
      where: { email: normalizedEmail }
    });

    const validPassword = user
      ? await bcrypt.compare(String(password), user.passwordHash)
      : false;

    if (!user || !validPassword) {
      throw new AuthServiceError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthServiceError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
    }

    return {
      token: createSessionToken(user),
      user: serializeUser(user)
    };
  };

  const authenticateToken = async (token) => {
    if (!token) {
      throw new AuthServiceError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED');
    }

    let payload;
    try {
      payload = jwt.verify(token, authConfig.jwtSecret);
    } catch {
      throw new AuthServiceError('Authentication required.', 401, 'INVALID_SESSION');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      throw new AuthServiceError('Authentication required.', 401, 'INVALID_SESSION');
    }

    const user = await prismaClient.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AuthServiceError('Authentication required.', 401, 'INVALID_SESSION');
    }

    // Credential/session versioning: a password change, admin credential reset,
    // or reset-token recovery bumps credentialVersion, so tokens issued before
    // the change (including tokens without a cv claim) stop being accepted.
    const tokenCredentialVersion = Number(payload.cv);
    if (!Number.isInteger(tokenCredentialVersion) || tokenCredentialVersion !== (user.credentialVersion ?? 1)) {
      throw new AuthServiceError('Authentication required.', 401, 'INVALID_SESSION');
    }

    return serializeUser(user);
  };

  const changePassword = async ({ userId, currentPassword, newPassword, req }) => {
    if (!currentPassword || !newPassword) {
      throw new AuthServiceError('Current password and new password are required.', 400, 'CHANGE_REQUIRED_FIELDS');
    }

    if (!validatePasswordPolicy(newPassword)) {
      throw new AuthServiceError(
        'Password must be at least 8 characters and contain at least one number.',
        400,
        'WEAK_PASSWORD'
      );
    }

    const user = await prismaClient.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AuthServiceError('Authentication required.', 401, 'INVALID_SESSION');
    }

    const validCurrentPassword = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!validCurrentPassword) {
      throw new AuthServiceError('Current password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
    }

    if (String(currentPassword) === String(newPassword)) {
      throw new AuthServiceError('New password must be different from the current password.', 400, 'PASSWORD_UNCHANGED');
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    const updated = await prismaClient.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        credentialVersion: { increment: 1 },
        resetTokenHash: null,
        resetTokenExpiresAt: null
      }
    });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.PASSWORD_CHANGED,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(user.id),
      metadata: {
        method: user.mustChangePassword ? 'forced-initial-change' : 'authenticated-change',
        priorSessionsInvalidated: true
      }
    });

    return {
      token: createSessionToken(updated),
      user: serializeUser(updated),
      message: 'Password has been changed.'
    };
  };

  const requestPasswordReset = async ({ email }) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw new AuthServiceError('Email is required.', 400, 'EMAIL_REQUIRED');
    }

    const user = await prismaClient.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (user && user.status === 'ACTIVE') {
      const token = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = hashResetToken(token);
      const resetTokenExpiresAt = new Date(Date.now() + authConfig.resetTokenExpiresMinutes * 60 * 1000);

      await prismaClient.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash,
          resetTokenExpiresAt
        }
      });

      await emailProvider.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token
      });

      await notificationEvents.notifyPasswordResetRequestedSafely({ user });
    }

    return {
      message: 'If that email exists, a password reset link has been sent.'
    };
  };

  const resetPassword = async ({ token, password, req }) => {
    if (!token || !password) {
      throw new AuthServiceError('Reset token and password are required.', 400, 'RESET_REQUIRED_FIELDS');
    }

    if (!validatePasswordPolicy(password)) {
      throw new AuthServiceError(
        'Password must be at least 8 characters and contain at least one number.',
        400,
        'WEAK_PASSWORD'
      );
    }

    const resetTokenHash = hashResetToken(token);
    const user = await prismaClient.user.findFirst({
      where: {
        resetTokenHash,
        resetTokenExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new AuthServiceError('Reset token is invalid or expired.', 400, 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        credentialVersion: { increment: 1 },
        resetTokenHash: null,
        resetTokenExpiresAt: null
      }
    });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.PASSWORD_CHANGED,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(user.id),
      metadata: {
        method: 'reset-token',
        priorSessionsInvalidated: true
      }
    });

    return {
      message: 'Password has been reset.'
    };
  };

  return {
    login,
    authenticateToken,
    changePassword,
    requestPasswordReset,
    resetPassword
  };
}

module.exports = {
  ...createAuthService(),
  AuthServiceError,
  createAuthService,
  getClearCookieOptions,
  getCookieOptions,
  hashResetToken,
  normalizeEmail,
  serializeUser,
  validatePasswordPolicy
};
