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
    const service = createEmailService({
      emailConfig: { provider: 'mock' },
      authConfig,
      appEnv: 'test',
      serviceLogger: silentLogger
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
    expect(silentLogger.info).toHaveBeenCalledWith('Mock email accepted', {
      type: 'password_reset',
      to: 'student@example.edu',
      provider: 'mock'
    });
  });

  test('disabled mode fails clearly without pretending delivery succeeded', async () => {
    const service = createEmailService({
      emailConfig: { provider: 'disabled' },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger
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
  });

  test('smtp mode is provider-ready but fails closed because transport is deferred', async () => {
    const service = createEmailService({
      emailConfig: {
        provider: 'smtp',
        smtp: {
          host: 'smtp.example.edu',
          port: 587
        }
      },
      authConfig,
      appEnv: 'production',
      serviceLogger: silentLogger
    });

    await expect(service.sendPasswordResetEmail({
      to: 'student@example.edu',
      name: 'Student User',
      token: 'plain-reset-token'
    })).rejects.toMatchObject({
      name: 'EmailServiceError',
      code: 'EMAIL_PROVIDER_NOT_IMPLEMENTED'
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
