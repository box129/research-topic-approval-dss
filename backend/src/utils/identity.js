/**
 * Canonical identity rules shared by authentication, provisioning, bulk import
 * and rate limiting.
 *
 * Students at the target institution are not issued university email
 * addresses, so the matric number is a student's primary institutional
 * identifier and an email address is optional. Lecturers and administrators
 * keep email as their required identity. One nullable column cannot express
 * that, so the role invariants live at the service boundary and every caller
 * canonicalizes identifiers through this module so the same string always
 * resolves to the same account and the same rate-limit bucket.
 */

// Deliberately permissive: any working address a person can actually access is
// acceptable, including a personal one. No domain allowlist may be introduced.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Established matric policy: 3-50 characters, letters/digits plus "/", "." and
// "-", beginning with a letter or digit.
const MATRIC_FORMAT = /^[A-Z0-9][A-Z0-9/.-]{2,49}$/;

const IDENTIFIER_KIND = Object.freeze({
  EMAIL: 'email',
  MATRIC: 'matric',
  UNKNOWN: 'unknown'
});

/** Lower-cases and trims an email, returning null when nothing was supplied. */
function normalizeEmail(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const email = String(value).trim().toLowerCase();
  return email || null;
}

/** Upper-cases and strips whitespace, returning null when nothing was supplied. */
function normalizeMatricNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const matricNumber = String(value).trim().replace(/\s+/g, '').toUpperCase();
  return matricNumber || null;
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email) && email.length <= 200 && EMAIL_FORMAT.test(email);
}

function isValidMatricNumber(value) {
  const matricNumber = normalizeMatricNumber(value);
  return Boolean(matricNumber) && MATRIC_FORMAT.test(matricNumber);
}

/**
 * Decides how a login identifier should be looked up.
 *
 * An "@" is the discriminator: anything containing one is treated as an email
 * attempt and is never retried as a matric number, so a caller cannot use the
 * classification to probe which identifier spaces exist. Callers must return
 * the same generic failure for every UNKNOWN result.
 */
function classifyLoginIdentifier(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { kind: IDENTIFIER_KIND.UNKNOWN, value: null };
  }

  if (raw.includes('@')) {
    const email = normalizeEmail(raw);
    return isValidEmail(email)
      ? { kind: IDENTIFIER_KIND.EMAIL, value: email }
      : { kind: IDENTIFIER_KIND.UNKNOWN, value: email };
  }

  const matricNumber = normalizeMatricNumber(raw);
  return isValidMatricNumber(matricNumber)
    ? { kind: IDENTIFIER_KIND.MATRIC, value: matricNumber }
    : { kind: IDENTIFIER_KIND.UNKNOWN, value: matricNumber };
}

/**
 * Stable canonical form for rate limiting and safe failed-login auditing.
 *
 * The same account must map to one bucket however the identifier was typed, so
 * "csc/21/0001" and "CSC/21/0001" collapse together, as do mixed-case emails.
 * Unrecognised input is still canonicalized rather than discarded, so garbage
 * attempts cannot escape throttling by varying their case.
 */
function canonicalizeIdentifierForKey(value) {
  const { kind, value: canonical } = classifyLoginIdentifier(value);
  if (!canonical) {
    return null;
  }
  return kind === IDENTIFIER_KIND.EMAIL ? canonical : normalizeMatricNumber(canonical);
}

module.exports = {
  EMAIL_FORMAT,
  MATRIC_FORMAT,
  IDENTIFIER_KIND,
  normalizeEmail,
  normalizeMatricNumber,
  isValidEmail,
  isValidMatricNumber,
  classifyLoginIdentifier,
  canonicalizeIdentifierForKey
};
