const ORIGINAL_ENV = { ...process.env };
const STRONG_JWT_SECRET = 'a-strong-production-secret-value-32-plus-chars';

const MODULE_BOOT_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://example',
  JWT_SECRET: STRONG_JWT_SECRET,
  FRONTEND_URL: 'http://localhost:5173',
  EMAIL_PROVIDER: 'mock'
};

function loadEnvModule(ambient = {}) {
  jest.resetModules();
  process.env = {
    ...MODULE_BOOT_ENV,
    ...ambient
  };

  return require('./env');
}

function buildConfigWith(source) {
  return loadEnvModule().buildConfig(source);
}

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example',
    JWT_SECRET: STRONG_JWT_SECRET,
    FRONTEND_URL: 'https://example.edu',
    EMAIL_PROVIDER: 'disabled',
    ...overrides
  };
}

describe('env email configuration', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  test('defaults to mock email provider outside production', () => {
    const config = buildConfigWith({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://example'
    });

    expect(config.email.provider).toBe('mock');
  });

  test('development remains practical with local defaults', () => {
    const config = buildConfigWith({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://example'
    });

    expect(config.cors.origin).toBe('http://localhost:5173');
    expect(config.auth.jwtSecret).toBe('local-dev-auth-secret-change-before-production');
    expect(config.email.provider).toBe('mock');
  });

  test('production fails clearly when EMAIL_PROVIDER is missing', () => {
    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: undefined
    }))).toThrow(/Missing required environment variables: EMAIL_PROVIDER/);
  });

  test('production rejects mock email provider', () => {
    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'mock'
    }))).toThrow(/EMAIL_PROVIDER=mock is not allowed in production/);
  });

  test('smtp provider requires provider configuration', () => {
    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp'
    }))).toThrow(/Missing SMTP email configuration: SMTP_HOST, SMTP_PORT, EMAIL_FROM/);
  });

  test('production rejects weak or placeholder JWT secrets', () => {
    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'replace_with_a_long_random_secret_before_production'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);

    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'short-secret'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);
  });

  test('production with neither trusted origin variable throws', () => {
    expect(() => buildConfigWith(productionEnv({
      FRONTEND_URL: undefined,
      CORS_ORIGIN: undefined
    }))).toThrow(/Missing required environment variables: FRONTEND_URL or CORS_ORIGIN/);
  });

  test('production with effective wildcard origin throws', () => {
    expect(() => buildConfigWith(productionEnv({
      FRONTEND_URL: undefined,
      CORS_ORIGIN: '*'
    }))).toThrow(/Production CORS origin must be an explicit trusted origin/);
  });

  test('production with explicit trusted FRONTEND_URL passes', () => {
    const config = buildConfigWith(productionEnv({
      FRONTEND_URL: 'https://frontend.example.edu',
      CORS_ORIGIN: undefined
    }));

    expect(config.cors.origin).toBe('https://frontend.example.edu');
    expect(config.auth.frontendUrl).toBe('https://frontend.example.edu');
  });

  test('production with explicit trusted CORS_ORIGIN passes', () => {
    const config = buildConfigWith(productionEnv({
      FRONTEND_URL: undefined,
      CORS_ORIGIN: 'https://cors.example.edu'
    }));

    expect(config.cors.origin).toBe('https://cors.example.edu');
    expect(config.auth.frontendUrl).toBe('https://cors.example.edu');
  });

  test('FRONTEND_URL takes precedence over CORS_ORIGIN when both are supplied', () => {
    const config = buildConfigWith(productionEnv({
      FRONTEND_URL: 'https://frontend.example.edu',
      CORS_ORIGIN: 'https://cors.example.edu'
    }));

    expect(config.cors.origin).toBe('https://frontend.example.edu');
    expect(config.auth.frontendUrl).toBe('https://frontend.example.edu');
  });

  test('CI ambient environment cannot alter wildcard rejection', () => {
    jest.resetModules();
    process.env = {
      ...MODULE_BOOT_ENV,
      FRONTEND_URL: 'http://127.0.0.1:5173',
      CORS_ORIGIN: 'http://127.0.0.1:5173'
    };

    const { buildConfig } = require('./env');

    expect(() => buildConfig(productionEnv({
      FRONTEND_URL: undefined,
      CORS_ORIGIN: '*'
    }))).toThrow(/Production CORS origin must be an explicit trusted origin/);
  });
});
