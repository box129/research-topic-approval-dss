const {
  buildPasswordResetEmailContent,
  buildInvitationEmailContent,
  classifySmtpError,
  createEmailService
} = require('./email.service');

const authConfig = {
  frontendUrl: 'http://localhost:5173',
  resetTokenExpiresMinutes: 30,
  invitationExpiresHours: 168
};

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('email.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('mock mode accepts password reset email without real delivery or token exposure in result', async () => {
    const transportFactory = jest.fn();
    const service = createEmailService({
      emailConfig: { provider: 'mock' },
      authConfig,
      appEnv: 'test',
      serviceLogger: silentLogger,
      transportFactory
    });

    const result = await service.sendPasswordResetEmail({
      to: 'student@example.edu',
      name: 'Student User',
      token: 'plain-reset-token'
    });

    expect(result).toEqual({
      provider: 'mock',
      status: 'mocked',
      delivered: false,
      to: 'student@example.edu',
      subject: 'Reset your Research Topic Approval DSS password'
    });
    expect(JSON.stringify(result)).not.toContain('plain-reset-token');
    expect(transportFactory).not.toHaveBeenCalled();
    expect(silentLogger.info).toHaveBeenCalledWith('Mock email accepted', {
      type: 'password_reset',
      to: 'student@example.edu',
      provider: 'mock'
    });
  });

  test('disabled mode fails clearly without pretending delivery succeeded', async () => {
    const transportFactory = jest.fn();
    const service = createEmailService({
      emailConfig: { provider: 'disabled' },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory
    });

    await expect(service.sendPasswordResetEmail({
      to: 'student@example.edu',
      name: 'Student User',
      token: 'plain-reset-token'
    })).rejects.toMatchObject({
      name: 'EmailServiceError',
      code: 'EMAIL_PROVIDER_DISABLED',
      statusCode: 503
    });
    expect(transportFactory).not.toHaveBeenCalled();
  });

  test('smtp mode creates and sends through an injected transport', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      accepted: ['student@example.edu'],
      rejected: [],
      messageId: 'safe-message-id'
    });
    const transportFactory = jest.fn().mockReturnValue({ sendMail });
    const service = createEmailService({
      emailConfig: {
        provider: 'smtp',
        from: 'no-reply@example.edu',
        smtp: {
          host: 'smtp.example.edu',
          port: 587,
          secure: false,
          user: 'smtp-user',
          password: 'smtp-secret-password'
        }
      },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory
    });

    const result = await service.sendPasswordResetEmail({
      to: 'student@example.edu',
      name: 'Student User',
      token: 'plain-reset-token'
    });

    expect(transportFactory).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'no-reply@example.edu',
      to: 'student@example.edu',
      subject: 'Reset your Research Topic Approval DSS password',
      text: expect.stringContaining('/reset-password?token=plain-reset-token'),
      html: expect.stringContaining('/reset-password?token=plain-reset-token')
    }));
    expect(result).toEqual({
      provider: 'smtp',
      status: 'sent',
      delivered: true,
      to: 'student@example.edu',
      subject: 'Reset your Research Topic Approval DSS password',
      acceptedCount: 1,
      rejectedCount: 0,
      messageId: 'safe-message-id'
    });
  });

  test('smtp success returns safe metadata only', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      accepted: ['student@example.edu'],
      rejected: [],
      messageId: 'safe-message-id'
    });
    const service = createEmailService({
      emailConfig: {
        provider: 'smtp',
        from: 'no-reply@example.edu',
        smtp: {
          host: 'smtp.example.edu',
          port: 587,
          secure: false,
          user: 'smtp-user',
          password: 'smtp-secret-password'
        }
      },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory: jest.fn().mockReturnValue({ sendMail })
    });

    const result = await service.sendPasswordResetEmail({
      to: 'student@example.edu',
      name: 'Student User',
      token: 'plain-reset-token'
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('smtp-secret-password');
    expect(serialized).not.toContain('plain-reset-token');
    expect(serialized).not.toContain('resetTokenHash');
    expect(serialized).not.toContain('passwordHash');
  });

  test('smtp failure fails clearly without pretending delivery succeeded', async () => {
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error('provider rejected'), {
      code: 'EAUTH'
    }));
    const service = createEmailService({
      emailConfig: {
        provider: 'smtp',
        from: 'no-reply@example.edu',
        smtp: {
          host: 'smtp.example.edu',
          port: 587,
          secure: false,
          user: 'smtp-user',
          password: 'smtp-secret-password'
        }
      },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory: jest.fn().mockReturnValue({ sendMail })
    });

    await expect(service.sendPasswordResetEmail({
      to: 'student@example.edu',
      name: 'Student User',
      token: 'plain-reset-token'
    })).rejects.toMatchObject({
      name: 'EmailServiceError',
      code: 'EMAIL_DELIVERY_FAILED',
      statusCode: 503
    });
    expect(silentLogger.error).toHaveBeenCalledWith('SMTP email delivery failed', expect.objectContaining({
      type: 'password_reset',
      to: 'student@example.edu',
      provider: 'smtp',
      errorName: 'Error',
      errorCode: 'EAUTH',
      reasonCode: 'smtp-auth-failed',
      transient: false
    }));
  });

  test('password reset email content includes the reset flow and excludes hashes/secrets', () => {
    const content = buildPasswordResetEmailContent({
      to: 'student@example.edu',
      name: 'Student <User>',
      token: 'plain-reset-token',
      frontendUrl: authConfig.frontendUrl
    });

    expect(content.to).toBe('student@example.edu');
    expect(content.text).toContain('/reset-password?token=plain-reset-token');
    expect(content.html).toContain('Student &lt;User&gt;');
    expect(JSON.stringify(content)).not.toContain('resetTokenHash');
    expect(JSON.stringify(content)).not.toContain('passwordHash');
    expect(JSON.stringify(content)).not.toContain('authToken');
  });

  test('invitation email uses the configured application URL, states expiry, and contains no password', () => {
    const content = buildInvitationEmailContent({
      to: 'invitee@example.edu',
      name: 'New <Student>',
      token: 'invitation-token-value',
      frontendUrl: 'https://dss.department.example',
      expiresHours: 168
    });

    expect(content.subject).toContain('Activate');
    expect(content.text).toContain('https://dss.department.example/accept-invitation?token=invitation-token-value');
    expect(content.html).toContain('https://dss.department.example/accept-invitation?token=invitation-token-value');
    expect(content.text).toContain('expires in 7 days');
    expect(content.text).toContain('ignore this message');
    // HTML-escaping of user-controlled names.
    expect(content.html).toContain('New &lt;Student&gt;');
    expect(content.html).not.toContain('New <Student>');
    // No credential material of any kind: the invitation contains a link,
    // never a password value.
    for (const forbidden of ['temporary password', 'your password is', 'passwordHash', 'DemoPass']) {
      expect(content.text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(content.html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  test('reset email states its expiry from configuration', () => {
    const content = buildPasswordResetEmailContent({
      to: 'student@example.edu',
      name: 'Student',
      token: 't0kenT0ken',
      frontendUrl: authConfig.frontendUrl,
      expiresMinutes: 30
    });
    expect(content.text).toContain('expires in 30 minutes');
  });

  test('production never claims delivery through a mock provider', async () => {
    const service = createEmailService({
      emailConfig: { provider: 'mock' },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory: jest.fn()
    });

    await expect(service.sendInvitationEmail({
      to: 'user@example.edu',
      name: 'User',
      token: 'tok_abc',
      expiresHours: 168
    })).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_UNSUPPORTED' });
  });

  test('classifies SMTP failures into transient and permanent reasons', () => {
    expect(classifySmtpError({ code: 'EAUTH' })).toEqual({ reasonCode: 'smtp-auth-failed', transient: false });
    expect(classifySmtpError({ code: 'EENVELOPE' })).toEqual({ reasonCode: 'smtp-recipient-rejected', transient: false });
    expect(classifySmtpError({ code: 'ETIMEDOUT' })).toEqual({ reasonCode: 'smtp-timeout', transient: true });
    expect(classifySmtpError({ code: 'ECONNECTION' })).toEqual({ reasonCode: 'smtp-connect-failed', transient: true });
    expect(classifySmtpError({ responseCode: 451 })).toEqual({ reasonCode: 'smtp-transient-rejected', transient: true });
    expect(classifySmtpError({ code: 'ESOMETHING' })).toEqual({ reasonCode: 'smtp-failed', transient: false });
  });

  test('transient failures are retried exactly once with the same message, then reported', async () => {
    const sendMail = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce({ accepted: ['user@example.edu'], rejected: [], messageId: 'retry-ok' });
    const service = createEmailService({
      emailConfig: { provider: 'smtp', from: 'no-reply@example.edu', smtp: {} },
      authConfig,
      appEnv: 'test',
      serviceLogger: silentLogger,
      transportFactory: () => ({ sendMail }),
      sleep: () => Promise.resolve()
    });

    const result = await service.sendInvitationEmail({
      to: 'user@example.edu',
      name: 'User',
      token: 'tok_retry',
      expiresHours: 24
    });

    expect(result.status).toBe('sent');
    expect(sendMail).toHaveBeenCalledTimes(2);
    // Retry re-sent the same logical message (same token link), not a new one.
    expect(sendMail.mock.calls[0][0].text).toBe(sendMail.mock.calls[1][0].text);
  });

  test('permanent failures (auth, rejected recipient) are not retried', async () => {
    for (const permanentError of [{ code: 'EAUTH' }, { code: 'EENVELOPE' }]) {
      const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error('permanent'), permanentError));
      const service = createEmailService({
        emailConfig: { provider: 'smtp', from: 'no-reply@example.edu', smtp: {} },
        authConfig,
        appEnv: 'test',
        serviceLogger: silentLogger,
        transportFactory: () => ({ sendMail }),
        sleep: () => Promise.resolve()
      });

      await expect(service.sendInvitationEmail({
        to: 'user@example.edu',
        name: 'User',
        token: 'tok_perm',
        expiresHours: 24
      })).rejects.toMatchObject({ code: 'EMAIL_DELIVERY_FAILED', transient: false });
      expect(sendMail).toHaveBeenCalledTimes(1);
    }
  });

  test('persistent transient failure stays bounded to one retry', async () => {
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error('still down'), { code: 'ETIMEDOUT' }));
    const service = createEmailService({
      emailConfig: { provider: 'smtp', from: 'no-reply@example.edu', smtp: {} },
      authConfig,
      appEnv: 'test',
      serviceLogger: silentLogger,
      transportFactory: () => ({ sendMail }),
      sleep: () => Promise.resolve()
    });

    await expect(service.sendInvitationEmail({
      to: 'user@example.edu',
      name: 'User',
      token: 'tok_transient',
      expiresHours: 24
    })).rejects.toMatchObject({ code: 'EMAIL_DELIVERY_FAILED', reasonCode: 'smtp-timeout', transient: true });
    expect(sendMail).toHaveBeenCalledTimes(2);

    // Logs classify the failure but never contain the token or its link.
    const loggedPayloads = JSON.stringify([...silentLogger.error.mock.calls, ...silentLogger.info.mock.calls, ...silentLogger.warn.mock.calls]);
    expect(loggedPayloads).not.toContain('tok_transient');
    expect(loggedPayloads).not.toContain('accept-invitation');
  });

  test('email capability description distinguishes ready from disabled without secrets', () => {
    const smtpService = createEmailService({
      emailConfig: { provider: 'smtp', from: 'no-reply@example.edu', smtp: { host: 'smtp.example.edu', password: 'super-secret' } },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory: jest.fn()
    });
    const disabledService = createEmailService({
      emailConfig: { provider: 'disabled' },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger,
      transportFactory: jest.fn()
    });

    expect(smtpService.describeEmailCapability()).toMatchObject({ provider: 'smtp', status: 'configured' });
    expect(JSON.stringify(smtpService.describeEmailCapability())).not.toContain('super-secret');
    expect(disabledService.describeEmailCapability()).toMatchObject({
      provider: 'disabled',
      status: 'disabled',
      message: expect.stringContaining('EMAIL CAPABILITY DISABLED')
    });
  });
});
