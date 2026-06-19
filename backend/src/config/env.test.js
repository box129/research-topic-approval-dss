const ORIGINAL_ENV = process.env;
const STRONG_JWT_SECRET = 'a-strong-production-secret-value-32-plus-chars';

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
      JWT_SECRET: STRONG_JWT_SECRET,
      FRONTEND_URL: 'https://example.edu',
      EMAIL_PROVIDER: undefined
    })).toThrow(/Missing required environment variables: EMAIL_PROVIDER/);
  });

  test('production rejects mock email provider', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: STRONG_JWT_SECRET,
      FRONTEND_URL: 'https://example.edu',
      EMAIL_PROVIDER: 'mock'
    })).toThrow(/EMAIL_PROVIDER=mock is not allowed in production/);
  });

  test('smtp provider requires provider configuration', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: STRONG_JWT_SECRET,
      FRONTEND_URL: 'https://example.edu',
      EMAIL_PROVIDER: 'smtp'
    })).toThrow(/Missing SMTP email configuration: SMTP_HOST, SMTP_PORT, EMAIL_FROM/);
  });

  test('production rejects weak or placeholder JWT secrets', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: 'replace_with_a_long_random_secret_before_production',
      FRONTEND_URL: 'https://example.edu',
      EMAIL_PROVIDER: 'disabled'
    })).toThrow(/JWT_SECRET must be a strong production secret/);

    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: 'short-secret',
      FRONTEND_URL: 'https://example.edu',
      EMAIL_PROVIDER: 'disabled'
    })).toThrow(/JWT_SECRET must be a strong production secret/);
  });

  test('production requires an explicit trusted CORS origin', () => {
    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: STRONG_JWT_SECRET,
      FRONTEND_URL: '',
      CORS_ORIGIN: '',
      EMAIL_PROVIDER: 'disabled'
    })).toThrow(/Missing required environment variables: FRONTEND_URL or CORS_ORIGIN/);

    expect(() => loadConfigWith({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: STRONG_JWT_SECRET,
      CORS_ORIGIN: '*',
      EMAIL_PROVIDER: 'disabled'
    })).toThrow(/Production CORS origin must be an explicit trusted origin/);
  });
});
