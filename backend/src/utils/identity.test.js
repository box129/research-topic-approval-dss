const {
  IDENTIFIER_KIND,
  normalizeEmail,
  normalizeMatricNumber,
  isValidEmail,
  isValidMatricNumber,
  classifyLoginIdentifier,
  canonicalizeIdentifierForKey
} = require('./identity');

describe('identity canonicalization', () => {
  test('emails are lower-cased and trimmed, absence is null rather than empty', () => {
    expect(normalizeEmail('  Ada.Obi@Example.COM ')).toBe('ada.obi@example.com');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });

  test('matric numbers are upper-cased with all whitespace removed', () => {
    expect(normalizeMatricNumber('  phs/22/0042 ')).toBe('PHS/22/0042');
    expect(normalizeMatricNumber('phs / 22 / 0042')).toBe('PHS/22/0042');
    expect(normalizeMatricNumber('')).toBeNull();
    expect(normalizeMatricNumber(null)).toBeNull();
  });

  test('no email domain is ever required', () => {
    for (const email of [
      'a@gmail.com', 'b@yahoo.com', 'c@outlook.com', 'd@hotmail.co.uk',
      'e@proton.me', 'f@uniosun.edu.ng', 'g@any-domain.example'
    ]) {
      expect(isValidEmail(email)).toBe(true);
    }
    for (const email of ['not-an-email', 'missing@domain', 'two @spaces.com', '@nolocal.com']) {
      expect(isValidEmail(email)).toBe(false);
    }
  });

  test('matric format follows the established policy', () => {
    expect(isValidMatricNumber('CSC/21/0451')).toBe(true);
    expect(isValidMatricNumber('PHS.22.0042')).toBe(true);
    expect(isValidMatricNumber('ABC-123')).toBe(true);
    expect(isValidMatricNumber('ab')).toBe(false);
    expect(isValidMatricNumber('!!bad!!')).toBe(false);
    expect(isValidMatricNumber('/leading-slash')).toBe(false);
  });
});

describe('login identifier classification', () => {
  test('an "@" routes to the email lookup and never to the matric lookup', () => {
    expect(classifyLoginIdentifier('Ada@Example.com'))
      .toEqual({ kind: IDENTIFIER_KIND.EMAIL, value: 'ada@example.com' });
    // A malformed address is NOT retried as a matric number: falling through
    // would let a caller probe both identifier spaces with one request.
    expect(classifyLoginIdentifier('broken@').kind).toBe(IDENTIFIER_KIND.UNKNOWN);
  });

  test('a value with no "@" is treated as a matric number when it is well formed', () => {
    expect(classifyLoginIdentifier(' phs/22/0042 '))
      .toEqual({ kind: IDENTIFIER_KIND.MATRIC, value: 'PHS/22/0042' });
    expect(classifyLoginIdentifier('!!').kind).toBe(IDENTIFIER_KIND.UNKNOWN);
    expect(classifyLoginIdentifier('').kind).toBe(IDENTIFIER_KIND.UNKNOWN);
    expect(classifyLoginIdentifier(null).kind).toBe(IDENTIFIER_KIND.UNKNOWN);
  });

  test('the throttling key is stable across how an identifier was typed', () => {
    expect(canonicalizeIdentifierForKey('PHS/22/0042'))
      .toBe(canonicalizeIdentifierForKey(' phs/22/0042 '));
    expect(canonicalizeIdentifierForKey('Ada@Example.com'))
      .toBe(canonicalizeIdentifierForKey('  ada@example.COM '));
    // Different accounts never collapse into one bucket.
    expect(canonicalizeIdentifierForKey('PHS/22/0042'))
      .not.toBe(canonicalizeIdentifierForKey('PHS/22/0043'));
    expect(canonicalizeIdentifierForKey('')).toBeNull();
  });

  test('unrecognised input is still canonicalized so it cannot escape throttling', () => {
    expect(canonicalizeIdentifierForKey('  garbage  ')).toBe('GARBAGE');
    expect(canonicalizeIdentifierForKey('GARBAGE')).toBe('GARBAGE');
  });
});
