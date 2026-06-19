const ORIGINAL_ENV = process.env;

function loadConfigWith(env) {
  jest.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    ...env
  };
  delete process.env.EMAIL_PROVIDER;
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  return require('./env');
}

describe('env email configuration', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  test('defaults to mock email provider outside production', () => {
    const config = loadConfigWith({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://example'
    });

    expect(config.email.provider).toBe('mock');
  });

  test('production fails clearly when EMAIL_PROVIDER is missing', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: 'production-secret',
      EMAIL_PROVIDER: undefined
    })).toThrow(/Missing required environment variables: EMAIL_PROVIDER/);
  });

  test('production rejects mock email provider', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: 'production-secret',
      EMAIL_PROVIDER: 'mock'
    })).toThrow(/EMAIL_PROVIDER=mock is not allowed in production/);
  });

  test('smtp provider requires provider configuration', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: 'production-secret',
      EMAIL_PROVIDER: 'smtp'
    })).toThrow(/Missing SMTP email configuration: SMTP_HOST, SMTP_PORT, EMAIL_FROM/);
  });
});
