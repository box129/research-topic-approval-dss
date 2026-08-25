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
    VOYAGE_API_KEY: 'test-voyage-key',
    TRUST_PROXY: '1',
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

  test('validates bounded port, reset-token, and SMTP timeout values', () => {
    const config = buildConfigWith(productionEnv({
      PORT: '3100',
      RESET_TOKEN_EXPIRES_MINUTES: '45',
      SMTP_TIMEOUT_MS: '15000'
    }));

    expect(config.port).toBe(3100);
    expect(config.auth.resetTokenExpiresMinutes).toBe(45);
    expect(config.email.smtp.timeoutMs).toBe(15000);

    expect(() => buildConfigWith(productionEnv({ PORT: '0' }))).toThrow(/PORT must be a positive integer/);
    expect(() => buildConfigWith(productionEnv({ PORT: '65536' }))).toThrow(/PORT must be less than or equal to 65535/);
    expect(() => buildConfigWith(productionEnv({ PORT: 'not-a-port' }))).toThrow(/PORT must be a valid integer/);

    expect(() => buildConfigWith(productionEnv({ RESET_TOKEN_EXPIRES_MINUTES: '0' }))).toThrow(/RESET_TOKEN_EXPIRES_MINUTES must be a positive integer/);
    expect(() => buildConfigWith(productionEnv({ RESET_TOKEN_EXPIRES_MINUTES: '1441' }))).toThrow(/RESET_TOKEN_EXPIRES_MINUTES must be less than or equal to 1440/);

    expect(() => buildConfigWith(productionEnv({ SMTP_TIMEOUT_MS: '999' }))).toThrow(/SMTP_TIMEOUT_MS must be a positive integer greater than or equal to 1000/);
    expect(() => buildConfigWith(productionEnv({ SMTP_TIMEOUT_MS: '60001' }))).toThrow(/SMTP_TIMEOUT_MS must be less than or equal to 60000/);
    expect(() => buildConfigWith(productionEnv({ SMTP_TIMEOUT_MS: 'not-a-timeout' }))).toThrow(/SMTP_TIMEOUT_MS must be a valid integer/);
  });

  test('production rejects weak or placeholder JWT secrets', () => {
    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'replace_with_a_long_random_secret_before_production'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);

    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'short-secret'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);
  });

  test('production fails clearly when VOYAGE_API_KEY is missing', () => {
    expect(() => buildConfigWith(productionEnv({
      VOYAGE_API_KEY: undefined
    }))).toThrow(/Missing required environment variables: VOYAGE_API_KEY/);
  });

  test('production requires an explicit reviewed TRUST_PROXY topology', () => {
    expect(() => buildConfigWith(productionEnv({
      TRUST_PROXY: undefined
    }))).toThrow(/Missing required environment variables: TRUST_PROXY/);
  });

  test('production rejects the unsafe Compose default JWT secret', () => {
    expect(() => buildConfigWith(productionEnv({
      JWT_SECRET: 'local-compose-jwt-secret-change-before-any-shared-environment'
    }))).toThrow(/JWT_SECRET must be a strong production secret/);
  });

  test('production requires FRONTEND_URL even when CORS_ORIGIN is supplied', () => {
    expect(() => buildConfigWith(productionEnv({
      FRONTEND_URL: undefined,
      CORS_ORIGIN: 'https://cors.example.edu'
    }))).toThrow(/Missing required environment variables: FRONTEND_URL/);
  });

  test('production cannot use CORS_ORIGIN as a substitute for FRONTEND_URL', () => {
    expect(() => buildConfigWith(productionEnv({
      FRONTEND_URL: undefined,
      CORS_ORIGIN: '*'
    }))).toThrow(/Missing required environment variables: FRONTEND_URL/);
  });

  test('production rejects a supplied wildcard or malformed CORS_ORIGIN even when FRONTEND_URL is valid', () => {
    expect(() => buildConfigWith(productionEnv({
      CORS_ORIGIN: '*'
    }))).toThrow(/CORS_ORIGIN must not be wildcard/);

    expect(() => buildConfigWith(productionEnv({
      CORS_ORIGIN: 'not-an-origin'
    }))).toThrow(/CORS_ORIGIN must be a valid absolute URL/);
  });

  test.each([
    'not-a-database-url',
    'mysql://database.example/topic_similarity',
    'postgresql:///topic_similarity'
  ])('rejects malformed or non-PostgreSQL DATABASE_URL values', (databaseUrl) => {
    expect(() => buildConfigWith(productionEnv({
      DATABASE_URL: databaseUrl
    }))).toThrow(/DATABASE_URL must be a valid PostgreSQL connection URL/);
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

  test('production requires CORS_ORIGIN to match FRONTEND_URL when both are supplied', () => {
    expect(() => buildConfigWith(productionEnv({
      FRONTEND_URL: 'https://frontend.example.edu',
      CORS_ORIGIN: 'https://cors.example.edu'
    }))).toThrow(/CORS_ORIGIN must match FRONTEND_URL/);
  });

  test('production accepts equal explicit FRONTEND_URL and CORS_ORIGIN values', () => {
    const config = buildConfigWith(productionEnv({
      FRONTEND_URL: 'https://frontend.example.edu',
      CORS_ORIGIN: 'https://frontend.example.edu'
    }));
    expect(config.cors.origin).toBe('https://frontend.example.edu');
    expect(config.auth.frontendUrl).toBe('https://frontend.example.edu');
  });

  test('normalizes production NODE_ENV and rejects unsupported runtime modes', () => {
    const config = buildConfigWith(productionEnv({
      NODE_ENV: ' Production '
    }));

    expect(config.env).toBe('production');
    expect(config.auth.cookieSecure).toBe(true);
    expect(() => buildConfigWith(productionEnv({
      NODE_ENV: 'staging'
    }))).toThrow(/NODE_ENV must be one of: development, test, production/);
  });

  test('CORS_CREDENTIALS is a strict boolean', () => {
    expect(buildConfigWith(productionEnv({ CORS_CREDENTIALS: 'false' })).cors.credentials).toBe(false);
    expect(() => buildConfigWith(productionEnv({
      CORS_CREDENTIALS: 'sometimes'
    }))).toThrow(/CORS_CREDENTIALS must be either true or false/);
  });

  test('CI ambient environment cannot alter the FRONTEND_URL production requirement', () => {
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
    }))).toThrow(/Missing required environment variables: FRONTEND_URL/);
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
    ['non-HTTPS CORS origin', { CORS_ORIGIN: 'http://frontend.example.edu' }, /CORS_ORIGIN must match FRONTEND_URL/]
  ])('rejects a production %s', (_description, overrides, expectedError) => {
    expect(() => buildConfigWith(productionEnv(overrides))).toThrow(expectedError);
  });

  test('reflects configured rate, request, and Voyage limits in buildConfig', () => {
    const config = buildConfigWith(productionEnv({
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '321',
      RATE_LIMIT_IPV6_SUBNET_PREFIX: '64',
      ADMIN_TOPIC_IMPORT_RATE_LIMIT_MAX: '6',
      BULK_HASH_CONCURRENCY: '2',
      JSON_BODY_LIMIT_BYTES: '65536',
      IMPORT_UPLOAD_MAX_FIELDS: '8',
      IMPORT_UPLOAD_MAX_PARTS: '9',
      IMPORT_UPLOAD_FIELD_SIZE_BYTES: '8192',
      VOYAGE_REQUEST_TIMEOUT_MS: '12000',
      VOYAGE_READINESS_PROBE_CACHE_MS: '60000',
      VOYAGE_READINESS_STALE_GRACE_MS: '45000',
      SHUTDOWN_GRACE_PERIOD_MS: '240000'
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
      readinessProbeCacheMs: 60000,
      readinessStaleGraceMs: 45000
    });
    expect(config.shutdownGracePeriodMs).toBe(240000);
  });

  test('bounds the Voyage readiness stale-grace window and never allows an open-ended one', () => {
    // Default keeps last-known-good short relative to the probe cache.
    expect(buildConfigWith(productionEnv()).voyage.readinessStaleGraceMs).toBe(60000);

    expect(() => buildConfigWith(productionEnv({ VOYAGE_READINESS_STALE_GRACE_MS: '0' })))
      .toThrow(/VOYAGE_READINESS_STALE_GRACE_MS/);
    expect(() => buildConfigWith(productionEnv({ VOYAGE_READINESS_STALE_GRACE_MS: '999999999' })))
      .toThrow(/VOYAGE_READINESS_STALE_GRACE_MS/);
    expect(() => buildConfigWith(productionEnv({ VOYAGE_READINESS_STALE_GRACE_MS: 'forever' })))
      .toThrow(/VOYAGE_READINESS_STALE_GRACE_MS/);
  });

  test('uses a five-minute shutdown drain by default and rejects unsafe shutdown windows', () => {
    expect(buildConfigWith(productionEnv()).shutdownGracePeriodMs).toBe(300000);

    expect(() => buildConfigWith(productionEnv({
      SHUTDOWN_GRACE_PERIOD_MS: '179999'
    }))).toThrow(/SHUTDOWN_GRACE_PERIOD_MS must be a positive integer greater than or equal to 180000/);

    expect(() => buildConfigWith(productionEnv({
      SHUTDOWN_GRACE_PERIOD_MS: '300001'
    }))).toThrow(/SHUTDOWN_GRACE_PERIOD_MS must be less than or equal to 300000/);

    expect(() => buildConfigWith(productionEnv({
      SHUTDOWN_GRACE_PERIOD_MS: 'not-a-number'
    }))).toThrow(/SHUTDOWN_GRACE_PERIOD_MS must be a valid integer/);
  });

  test('rejects multipart limits that cannot accommodate the configured fields and workbook', () => {
    expect(() => buildConfigWith(productionEnv({
      IMPORT_UPLOAD_MAX_FIELDS: '10',
      IMPORT_UPLOAD_MAX_PARTS: '10'
    }))).toThrow(/IMPORT_UPLOAD_MAX_PARTS must allow/);
  });

  test('validates bounded bulk hashing and import-upload deployment limits', () => {
    expect(() => buildConfigWith(productionEnv({
      BULK_HASH_CONCURRENCY: undefined
    }))).not.toThrow();

    expect(() => buildConfigWith(productionEnv({
      BULK_HASH_CONCURRENCY: '0'
    }))).toThrow(/BULK_HASH_CONCURRENCY must be a positive integer/);

    expect(() => buildConfigWith(productionEnv({
      BULK_HASH_CONCURRENCY: '9'
    }))).toThrow(/BULK_HASH_CONCURRENCY must be less than or equal to 8/);

    expect(() => buildConfigWith(productionEnv({
      BULK_HASH_CONCURRENCY: 'not-a-number'
    }))).toThrow(/BULK_HASH_CONCURRENCY must be a valid integer/);

    expect(() => buildConfigWith(productionEnv({
      IMPORT_UPLOAD_LIMIT_BYTES: '5242881'
    }))).toThrow(/IMPORT_UPLOAD_LIMIT_BYTES must be less than or equal to 5242880/);

    expect(() => buildConfigWith(productionEnv({
      IMPORT_UPLOAD_MAX_FIELDS: '11'
    }))).toThrow(/IMPORT_UPLOAD_MAX_FIELDS must be less than or equal to 10/);

    expect(() => buildConfigWith(productionEnv({
      IMPORT_UPLOAD_FIELD_SIZE_BYTES: '16385'
    }))).toThrow(/IMPORT_UPLOAD_FIELD_SIZE_BYTES must be less than or equal to 16384/);
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
