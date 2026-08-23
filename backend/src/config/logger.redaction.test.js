const { redactSensitiveValues, SENSITIVE_LOG_KEY_PATTERN } = require('./logger');

describe('logger redaction', () => {
  test('credential-shaped keys are redacted at any depth before reaching transports', () => {
    const redacted = redactSensitiveValues({
      requestId: 'req-1',
      password: 'PlaintextPw1',
      temporaryCredential: 'TempCred123',
      invitationToken: 'tok_abcdef',
      resetTokenHash: 'deadbeef',
      nested: {
        authorization: 'Bearer jwt.value.here',
        cookie: 'rtadss_session=abc',
        smtp: { smtpPassword: 'MailPw' },
        databaseUrl: 'postgresql://u:pw@host/db'
      },
      list: [{ apiKey: 'voyage-key' }, 'plain']
    });

    expect(redacted.requestId).toBe('req-1');
    expect(redacted.password).toBe('[redacted]');
    expect(redacted.temporaryCredential).toBe('[redacted]');
    expect(redacted.invitationToken).toBe('[redacted]');
    expect(redacted.resetTokenHash).toBe('[redacted]');
    expect(redacted.nested.authorization).toBe('[redacted]');
    expect(redacted.nested.cookie).toBe('[redacted]');
    expect(redacted.nested.smtp.smtpPassword).toBe('[redacted]');
    expect(redacted.nested.databaseUrl).toBe('[redacted]');
    expect(redacted.list[0].apiKey).toBe('[redacted]');
    expect(redacted.list[1]).toBe('plain');

    const serialized = JSON.stringify(redacted);
    for (const secret of ['PlaintextPw1', 'TempCred123', 'tok_abcdef', 'jwt.value.here', 'MailPw', 'voyage-key', 'postgresql://u:pw']) {
      expect(serialized).not.toContain(secret);
    }
  });

  test('errors are reduced to name and message without enumerable secrets', () => {
    const error = Object.assign(new Error('boom'), { secretToken: 'leaky' });
    const redacted = redactSensitiveValues({ error });
    expect(redacted.error).toEqual({ name: 'Error', message: 'boom' });
  });

  test('the sensitive pattern covers the credential families used by this codebase', () => {
    for (const key of ['password', 'SMTP_PASSWORD', 'jwtSecret', 'temporaryPassword', 'sessionCookie', 'VOYAGE_API_KEY', 'DATABASE_URL', 'connectionString', 'resetToken']) {
      expect(SENSITIVE_LOG_KEY_PATTERN.test(key)).toBe(true);
    }
    for (const key of ['requestId', 'statusCode', 'durationMs', 'userId', 'category']) {
      expect(SENSITIVE_LOG_KEY_PATTERN.test(key)).toBe(false);
    }
  });
});
