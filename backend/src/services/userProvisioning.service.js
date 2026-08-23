const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const {
  AUDIT_EVENT_TYPES,
  buildAuditContextFromRequest,
  createAuditLogSafely
} = require('./auditLog.service');
const { normalizeEmail } = require('./auth.service');
const { serializeUser } = require('./adminUser.service');

// Roles an administrator may provision through the individual-provisioning
// API. Additional-administrator creation is intentionally excluded in this
// phase; it remains an institutional-policy decision for a later phase.
const PROVISIONABLE_ROLES = new Set(['STUDENT', 'LECTURER']);

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The repository documents matric numbers as a student-facing identifier in
// the approved UI designs, but contains no official institutional format
// specification. Normalization is therefore conservative: trim, uppercase,
// and restrict to characters observed in institutional identifier styles.
const MATRIC_FORMAT = /^[A-Z0-9][A-Z0-9/.-]{2,49}$/;

const TEMP_PASSWORD_LENGTH = 16;
// Unambiguous alphabet (no 0/O, 1/l/I) so operators can transcribe the
// one-time credential reliably.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

class UserProvisioningError extends Error {
  constructor(message, { code = 'USER_PROVISIONING_ERROR', field, statusCode = 400 } = {}) {
    super(message);
    this.name = 'UserProvisioningError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

function generateTemporaryPassword() {
  // Regenerate until the credential satisfies the documented password policy
  // (at least 8 characters and one number) so first login is never blocked
  // by a policy-violating generated credential.
  for (;;) {
    let candidate = '';
    for (let index = 0; index < TEMP_PASSWORD_LENGTH; index += 1) {
      candidate += TEMP_PASSWORD_ALPHABET[crypto.randomInt(TEMP_PASSWORD_ALPHABET.length)];
    }

    if (/\d/.test(candidate) && /[a-zA-Z]/.test(candidate)) {
      return candidate;
    }
  }
}

function normalizeName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new UserProvisioningError('Name is required.', {
      code: 'USER_PROVISION_NAME_REQUIRED',
      field: 'name'
    });
  }

  if (name.length > 200) {
    throw new UserProvisioningError('Name cannot exceed 200 characters.', {
      code: 'USER_PROVISION_NAME_TOO_LONG',
      field: 'name'
    });
  }

  return name;
}

function normalizeCanonicalEmail(value) {
  const email = normalizeEmail(value);
  if (!email) {
    throw new UserProvisioningError('Email is required.', {
      code: 'USER_PROVISION_EMAIL_REQUIRED',
      field: 'email'
    });
  }

  if (email.length > 200 || !EMAIL_FORMAT.test(email)) {
    throw new UserProvisioningError('Email address is not valid.', {
      code: 'USER_PROVISION_EMAIL_INVALID',
      field: 'email'
    });
  }

  return email;
}

function normalizeProvisionRole(value) {
  const role = String(value || '').trim().replace(/-/g, '_').toUpperCase();
  if (!role) {
    throw new UserProvisioningError('Role is required.', {
      code: 'USER_PROVISION_ROLE_REQUIRED',
      field: 'role'
    });
  }

  if (!PROVISIONABLE_ROLES.has(role)) {
    throw new UserProvisioningError('Only student or lecturer accounts can be provisioned here.', {
      code: 'USER_PROVISION_ROLE_NOT_ALLOWED',
      field: 'role'
    });
  }

  return role;
}

function normalizeMatricNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const matricNumber = String(value).trim().replace(/\s+/g, '').toUpperCase();
  if (!MATRIC_FORMAT.test(matricNumber)) {
    throw new UserProvisioningError(
      'Matric number must be 3-50 characters using letters, numbers, "/", "." or "-".',
      {
        code: 'USER_PROVISION_MATRIC_INVALID',
        field: 'matricNumber'
      }
    );
  }

  return matricNumber;
}

function parsePositiveId(value, field) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new UserProvisioningError(`${field} must be a positive integer.`, {
      code: 'USER_PROVISION_INVALID_ID',
      field
    });
  }

  return id;
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function createUserProvisioningService({
  prismaClient = prisma,
  audit = { createAuditLogSafely },
  hashPassword = (value) => bcrypt.hash(value, 12),
  generatePassword = generateTemporaryPassword
} = {}) {
  const assertNoDuplicates = async (tx, { email, matricNumber, excludeId }) => {
    const existingEmail = await tx.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== excludeId) {
      throw new UserProvisioningError('An account with this email already exists.', {
        code: 'USER_PROVISION_EMAIL_EXISTS',
        field: 'email',
        statusCode: 409
      });
    }

    if (matricNumber) {
      const existingMatric = await tx.user.findUnique({ where: { matricNumber } });
      if (existingMatric && existingMatric.id !== excludeId) {
        throw new UserProvisioningError('An account with this matric number already exists.', {
          code: 'USER_PROVISION_MATRIC_EXISTS',
          field: 'matricNumber',
          statusCode: 409
        });
      }
    }
  };

  // Admin-only individual provisioning. Fields are picked explicitly so
  // request bodies can never mass-assign status, credential state, or role
  // values outside the provisionable set.
  const provisionUser = async ({ input = {}, actor, req } = {}) => {
    const name = normalizeName(input.name);
    const email = normalizeCanonicalEmail(input.email);
    const role = normalizeProvisionRole(input.role);
    const matricNumber = normalizeMatricNumber(input.matricNumber);

    if (matricNumber && role !== 'STUDENT') {
      throw new UserProvisioningError('Matric numbers only apply to student accounts.', {
        code: 'USER_PROVISION_MATRIC_ROLE_MISMATCH',
        field: 'matricNumber'
      });
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await hashPassword(temporaryPassword);

    let created;
    try {
      created = await prismaClient.$transaction(async (tx) => {
        await assertNoDuplicates(tx, { email, matricNumber });

        return tx.user.create({
          data: {
            name,
            email,
            role,
            status: 'ACTIVE',
            passwordHash,
            matricNumber,
            mustChangePassword: true
          }
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserProvisioningError('An account with this email or matric number already exists.', {
          code: 'USER_PROVISION_DUPLICATE',
          statusCode: 409
        });
      }
      throw error;
    }

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.USER_PROVISIONED,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(created.id),
      metadata: {
        targetUserId: created.id,
        targetUserRole: created.role,
        targetUserEmail: created.email,
        matricNumberProvided: Boolean(matricNumber),
        provisionedByAdminId: actor?.id ?? null
      }
    });

    return {
      user: serializeUser(created),
      temporaryPassword
    };
  };

  // Admin-mediated credential recovery: replaces the target's credential with
  // a fresh one-time temporary password, invalidates prior sessions via the
  // credential version, and re-enables the forced first password change.
  const resetUserCredential = async ({ id: idValue, actor, req } = {}) => {
    const id = parsePositiveId(idValue, 'id');

    if (Number(actor?.id) === id) {
      throw new UserProvisioningError('Administrators cannot reset their own credential here. Use change password instead.', {
        code: 'USER_CREDENTIAL_RESET_SELF_FORBIDDEN',
        statusCode: 409
      });
    }

    const target = await prismaClient.user.findUnique({ where: { id } });
    if (!target) {
      return null;
    }

    if (target.role === 'ADMIN') {
      throw new UserProvisioningError('Administrator credentials cannot be reset through this endpoint.', {
        code: 'USER_CREDENTIAL_RESET_ADMIN_TARGET_FORBIDDEN',
        statusCode: 403
      });
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const updated = await prismaClient.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        credentialVersion: { increment: 1 },
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        // A credential reset changes who should be able to establish the
        // account password. Any previously emailed invitation must therefore
        // be dead rather than remaining a second valid credential path.
        invitationTokenHash: null,
        invitationExpiresAt: null
      }
    });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.USER_CREDENTIAL_RESET,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(id),
      metadata: {
        targetUserId: updated.id,
        targetUserRole: updated.role,
        targetUserEmail: updated.email,
        priorSessionsInvalidated: true,
        resetByAdminId: actor?.id ?? null
      }
    });

    return {
      user: serializeUser(updated),
      temporaryPassword
    };
  };

  // Admin-only correction of provisioned identity data (name, email, student
  // matric number). Role and status are deliberately not editable here: role
  // changes are an institutional decision outside operational corrections and
  // status is managed by the existing suspend/reactivate action. Fields are
  // picked explicitly so nothing else can be mass-assigned.
  const correctUserIdentity = async ({ id: idValue, input = {}, actor, req } = {}) => {
    const id = parsePositiveId(idValue, 'id');

    if (Object.prototype.hasOwnProperty.call(input, 'role')) {
      throw new UserProvisioningError('Role cannot be changed through identity correction.', {
        code: 'USER_IDENTITY_ROLE_NOT_EDITABLE',
        field: 'role'
      });
    }

    if (Object.prototype.hasOwnProperty.call(input, 'status')) {
      throw new UserProvisioningError('Status is managed through the suspend/reactivate action, not identity correction.', {
        code: 'USER_IDENTITY_STATUS_NOT_EDITABLE',
        field: 'status'
      });
    }

    const target = await prismaClient.user.findUnique({ where: { id } });
    if (!target) {
      return null;
    }

    if (target.role === 'ADMIN') {
      throw new UserProvisioningError('Administrator identities cannot be edited through this endpoint.', {
        code: 'USER_IDENTITY_ADMIN_TARGET_FORBIDDEN',
        statusCode: 403
      });
    }

    const changes = {};
    if (Object.prototype.hasOwnProperty.call(input, 'name')) {
      changes.name = normalizeName(input.name);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'email')) {
      changes.email = normalizeCanonicalEmail(input.email);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'matricNumber')) {
      const matricNumber = normalizeMatricNumber(input.matricNumber);
      if (matricNumber && target.role !== 'STUDENT') {
        throw new UserProvisioningError('Matric numbers only apply to student accounts.', {
          code: 'USER_PROVISION_MATRIC_ROLE_MISMATCH',
          field: 'matricNumber'
        });
      }
      changes.matricNumber = matricNumber;
    }

    if (Object.keys(changes).length === 0) {
      throw new UserProvisioningError('Provide at least one of name, email or matricNumber.', {
        code: 'USER_IDENTITY_NO_FIELDS'
      });
    }

    const changedFields = Object.keys(changes).filter((field) => changes[field] !== target[field]);
    if (changedFields.length === 0) {
      return {
        user: serializeUser(target),
        changedFields: [],
        sessionsInvalidated: false
      };
    }

    const previousValues = changedFields.reduce((values, field) => {
      values[field] = target[field] ?? null;
      return values;
    }, {});

    // A changed email changes the login identity itself, so sessions issued
    // for the previous identity (and any pending reset/invitation token) stop
    // working. Otherwise the former mailbox holder could accept an old link.
    const emailChanged = changedFields.includes('email');

    let updated;
    try {
      updated = await prismaClient.$transaction(async (tx) => {
        await assertNoDuplicates(tx, {
          email: emailChanged ? changes.email : target.email,
          matricNumber: changedFields.includes('matricNumber') ? changes.matricNumber : null,
          excludeId: id
        });

        return tx.user.update({
          where: { id },
          data: {
            ...changes,
            ...(emailChanged
              ? {
                credentialVersion: { increment: 1 },
                resetTokenHash: null,
                resetTokenExpiresAt: null,
                invitationTokenHash: null,
                invitationExpiresAt: null
              }
              : {})
          }
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserProvisioningError('An account with this email or matric number already exists.', {
          code: 'USER_PROVISION_DUPLICATE',
          statusCode: 409
        });
      }
      throw error;
    }

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.USER_IDENTITY_CORRECTED,
      ...buildAuditContextFromRequest(req),
      targetType: 'User',
      targetId: String(id),
      metadata: {
        targetUserId: target.id,
        targetUserRole: target.role,
        changedFields,
        previous: previousValues,
        next: changedFields.reduce((values, field) => {
          values[field] = changes[field] ?? null;
          return values;
        }, {}),
        priorSessionsInvalidated: emailChanged,
        correctedByAdminId: actor?.id ?? null
      }
    });

    return {
      user: serializeUser(updated),
      changedFields,
      sessionsInvalidated: emailChanged
    };
  };

  // Operator-invoked production initialization. Never runs automatically,
  // never uses a fixed password, and refuses ambiguous bootstrap state.
  const bootstrapFirstAdmin = async ({ email: emailValue, name: nameValue } = {}) => {
    const name = normalizeName(nameValue);
    const email = normalizeCanonicalEmail(emailValue);

    const existingAdmins = await prismaClient.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: { id: 'asc' }
    });

    if (existingAdmins.length > 0) {
      const sameEmailAdmin = existingAdmins.find((admin) => admin.email === email);
      if (sameEmailAdmin) {
        return {
          status: 'already-bootstrapped',
          user: serializeUser(sameEmailAdmin),
          message: 'An administrator with this email already exists. No changes were made and no credential was issued.'
        };
      }

      return {
        status: 'conflict',
        message: `Bootstrap refused: ${existingAdmins.length} administrator account(s) already exist (${existingAdmins.map((admin) => admin.email).join(', ')}). This command only creates the first administrator.`
      };
    }

    const emailOwner = await prismaClient.user.findUnique({ where: { email } });
    if (emailOwner) {
      return {
        status: 'conflict',
        message: `Bootstrap refused: ${email} already belongs to an existing ${emailOwner.role} account. Choose a different administrator email or resolve the conflicting account first.`
      };
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await hashPassword(temporaryPassword);

    let created;
    try {
      created = await prismaClient.$transaction(async (tx) => {
        const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
        if (adminCount > 0) {
          throw new UserProvisioningError('Bootstrap refused: an administrator account was created concurrently.', {
            code: 'BOOTSTRAP_CONFLICT',
            statusCode: 409
          });
        }

        return tx.user.create({
          data: {
            name,
            email,
            role: 'ADMIN',
            status: 'ACTIVE',
            passwordHash,
            mustChangePassword: true
          }
        });
      });
    } catch (error) {
      if (error instanceof UserProvisioningError || isUniqueConstraintError(error)) {
        return {
          status: 'conflict',
          message: 'Bootstrap refused: conflicting account state was detected while creating the administrator. Re-inspect the user table before retrying.'
        };
      }
      throw error;
    }

    const demoUserCount = await prismaClient.user.count({
      where: { email: { endsWith: '.demo@uniosun.edu.ng' } }
    });

    await audit.createAuditLogSafely({
      eventType: AUDIT_EVENT_TYPES.ADMIN_BOOTSTRAPPED,
      targetType: 'User',
      targetId: String(created.id),
      metadata: {
        targetUserId: created.id,
        targetUserEmail: created.email,
        mustChangePassword: true,
        source: 'bootstrap-admin-script'
      }
    });

    return {
      status: 'created',
      user: serializeUser(created),
      temporaryPassword,
      warnings: demoUserCount > 0
        ? [`${demoUserCount} demo seed account(s) exist in this database. Demo accounts are development-only and must not be present in production.`]
        : []
    };
  };

  return {
    provisionUser,
    resetUserCredential,
    correctUserIdentity,
    bootstrapFirstAdmin
  };
}

module.exports = {
  ...createUserProvisioningService(),
  createUserProvisioningService,
  UserProvisioningError,
  generateTemporaryPassword,
  normalizeName,
  normalizeCanonicalEmail,
  normalizeProvisionRole,
  normalizeMatricNumber,
  PROVISIONABLE_ROLES
};
