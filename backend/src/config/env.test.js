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
    expect(config.auditLog).toEqual({
      retentionDays: 365,
      purgeMinAgeDays: 90,
      purgeMaxBatch: 1000
    });
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

  test('smtp config validation rejects missing host', () => {
    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@example.edu',
      SMTP_HOST: undefined,
      SMTP_PORT: '587'
    }))).toThrow(/Missing SMTP email configuration: SMTP_HOST/);
  });

  test('smtp config validation rejects invalid port', () => {
    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@example.edu',
      SMTP_HOST: 'smtp.example.edu',
      SMTP_PORT: 'not-a-port'
    }))).toThrow(/SMTP_PORT must be a valid integer/);

    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@example.edu',
      SMTP_HOST: 'smtp.example.edu',
      SMTP_PORT: '70000'
    }))).toThrow(/SMTP_PORT must be a valid TCP port/);
  });

  test('smtp config validation rejects invalid secure flag and unpaired credentials', () => {
    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@example.edu',
      SMTP_HOST: 'smtp.example.edu',
      SMTP_PORT: '587',
      SMTP_SECURE: 'sometimes'
    }))).toThrow(/SMTP_SECURE must be either true or false/);

    expect(() => buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@example.edu',
      SMTP_HOST: 'smtp.example.edu',
      SMTP_PORT: '587',
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: undefined
    }))).toThrow(/SMTP_USER and SMTP_PASSWORD must be provided together/);
  });

  test('smtp config accepts explicit provider settings and tracks password configuration', () => {
    const config = buildConfigWith(productionEnv({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@example.edu',
      SMTP_HOST: 'smtp.example.edu',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: 'smtp-secret-password',
      SMTP_TIMEOUT_MS: '15000'
    }));

    expect(config.email).toMatchObject({
      provider: 'smtp',
      from: 'no-reply@example.edu',
      smtp: {
        host: 'smtp.example.edu',
        port: 587,
        secure: false,
        user: 'smtp-user',
        passwordConfigured: true,
        timeoutMs: 15000
      }
    });
    expect(config.email.smtp.password).toBe('smtp-secret-password');
  });

  test('production rejects weak or placeholder JWT secrets', () => {
    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'replace_with_a_long_random_secret_before_production'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);

    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'short-secret'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);
  });

  test('production rejects the unsafe Compose default JWT secret', () => {
    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'local-compose-jwt-secret-change-before-any-shared-environment'
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
    }))).toThrow(/must not be wildcard/);
  });

  test('development also rejects a wildcard CORS origin instead of silently denying browser callers', () => {
    expect(() => buildConfigWith({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://example',
      CORS_ORIGIN: '*'
    })).toThrow(/must not be wildcard/);
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
    }))).toThrow(/must not be wildcard/);
  });

  test.each([
    ['false', false],
    ['2', 2],
    ['10.0.0.0/8', '10.0.0.0/8'],
    ['Loopback', 'loopback'],
    ['LINKLOCAL', 'linklocal'],
    ['UniqueLocal', 'uniquelocal']
  ])('accepts TRUST_PROXY=%s and reflects it in configuration', (trustProxy, expected) => {
    const config = buildConfigWith(productionEnv({
      TRUST_PROXY: trustProxy
    }));

    expect(config.trustProxy).toEqual(expected);
  });

  test.each(['true', '*'])('rejects unsafe TRUST_PROXY=%s', (trustProxy) => {
    expect(() => buildConfigWith(productionEnv({
      TRUST_PROXY: trustProxy
    }))).toThrow(/TRUST_PROXY must not be true or \*/);
  });

  test.each(['10.0.0.0/8/garbage', '::1/128/garbage'])('rejects malformed multi-slash TRUST_PROXY CIDR %s', (trustProxy) => {
    expect(() => buildConfigWith(productionEnv({
      TRUST_PROXY: trustProxy
    }))).toThrow(/TRUST_PROXY must be false/);
  });

  test.each([
    ['malformed origin', { FRONTEND_URL: 'not-an-origin' }, /must be a valid absolute URL/],
    ['path-bearing origin', { FRONTEND_URL: 'https://frontend.example.edu/app' }, /must be an http\(s\) origin without a path/],
    ['non-HTTPS CORS fallback', { FRONTEND_URL: undefined, CORS_ORIGIN: 'http://frontend.example.edu' }, /Production CORS origin must use https/]
  ])('rejects a production %s', (_description, overrides, expectedError) => {
    expect(() => buildConfigWith(productionEnv(overrides))).toThrow(expectedError);
  });

  test('reflects configured rate, request, and Voyage limits in buildConfig', () => {
    const config = buildConfigWith(productionEnv({
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '321',
      RATE_LIMIT_IPV6_SUBNET_PREFIX: '64',
      ADMIN_TOPIC_IMPORT_RATE_LIMIT_MAX: '6',
      JSON_BODY_LIMIT_BYTES: '65536',
      IMPORT_UPLOAD_MAX_FIELDS: '8',
      IMPORT_UPLOAD_MAX_PARTS: '9',
      IMPORT_UPLOAD_FIELD_SIZE_BYTES: '8192',
      VOYAGE_REQUEST_TIMEOUT_MS: '12000',
      VOYAGE_READINESS_PROBE_CACHE_MS: '60000'
    }));

    expect(config.rateLimit).toMatchObject({
      windowMs: 60000,
      max: 321,
      ipv6SubnetPrefix: 64,
      adminTopicImportMax: 6
    });
    expect(config.requestLimits).toMatchObject({
      jsonBodyBytes: 65536,
      importUploadMaxFields: 8,
      importUploadMaxParts: 9,
      importUploadFieldSizeBytes: 8192
    });
    expect(config.voyage).toEqual({
      requestTimeoutMs: 12000,
      readinessProbeCacheMs: 60000
    });
  });

  test('rejects multipart limits that cannot accommodate the configured fields and workbook', () => {
    expect(() => buildConfigWith(productionEnv({
      IMPORT_UPLOAD_MAX_FIELDS: '10',
      IMPORT_UPLOAD_MAX_PARTS: '10'
    }))).toThrow(/IMPORT_UPLOAD_MAX_PARTS must allow/);
  });

  test('audit retention config accepts explicit bounded values', () => {
    const config = buildConfigWith(productionEnv({
      AUDIT_LOG_RETENTION_DAYS: '730',
      AUDIT_LOG_PURGE_MIN_AGE_DAYS: '180',
      AUDIT_LOG_PURGE_MAX_BATCH: '500'
    }));

    expect(config.auditLog).toEqual({
      retentionDays: 730,
      purgeMinAgeDays: 180,
      purgeMaxBatch: 500
    });
  });

  test('audit retention config rejects invalid and unsafe values', () => {
    expect(() => buildConfigWith(productionEnv({
      AUDIT_LOG_PURGE_MIN_AGE_DAYS: '0'
    }))).toThrow(/AUDIT_LOG_PURGE_MIN_AGE_DAYS must be a positive integer/);

    expect(() => buildConfigWith(productionEnv({
      AUDIT_LOG_PURGE_MAX_BATCH: '9000'
    }))).toThrow(/AUDIT_LOG_PURGE_MAX_BATCH must be less than or equal to 5000/);

    expect(() => buildConfigWith(productionEnv({
      AUDIT_LOG_RETENTION_DAYS: '30',
      AUDIT_LOG_PURGE_MIN_AGE_DAYS: '90'
    }))).toThrow(/AUDIT_LOG_RETENTION_DAYS must be a positive integer greater than or equal to 90/);

    expect(() => buildConfigWith(productionEnv({
      AUDIT_LOG_RETENTION_DAYS: 'not-a-number'
    }))).toThrow(/AUDIT_LOG_RETENTION_DAYS must be a valid integer/);
  });
});
