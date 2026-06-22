const {
  buildPasswordResetEmailContent,
  createEmailService
} = require('./email.service');

const authConfig = {
  frontendUrl: 'http://localhost:5173'
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
    expect(silentLogger.error).toHaveBeenCalledWith('SMTP email delivery failed', {
      type: 'password_reset',
      to: 'student@example.edu',
      provider: 'smtp',
      errorName: 'Error',
      errorCode: 'EAUTH'
    });
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
});
