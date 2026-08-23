require('dotenv').config();

const { isIP } = require('net');

function envValue(source, key) {
  const value = source[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

function effectiveCorsOrigin(source) {
  return envValue(source, 'FRONTEND_URL') || envValue(source, 'CORS_ORIGIN');
}

function normalizeOrigin(value, key) {
  const normalized = envValue({ [key]: value }, key);
  if (normalized === undefined) {
    return undefined;
  }

  if (normalized === '*') {
    // This application uses cookie sessions. A wildcard cannot safely be
    // combined with credentialed browser requests, and the CORS middleware
    // intentionally never reflects hostile origins. Reject it consistently
    // instead of accepting a configuration that cannot work as intended.
    throw new Error(`${key} must not be wildcard (*); configure one explicit http(s) origin.`);
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${key} must be a valid absolute URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${key} must be an http(s) origin without a path, query, fragment, or credentials.`);
  }

  return parsed.origin;
}

function isValidIpOrCidr(value) {
  const parts = String(value).split('/');
  if (parts.length > 2) {
    return false;
  }

  const [address, prefixLength] = parts;
  const version = isIP(address);
  if (!version) {
    return false;
  }

  if (prefixLength === undefined) {
    return true;
  }

  if (!/^\d+$/.test(prefixLength)) {
    return false;
  }

  const prefix = Number.parseInt(prefixLength, 10);
  return prefix >= 0 && prefix <= (version === 4 ? 32 : 128);
}

function parseTrustProxy(value) {
  const normalized = envValue({ TRUST_PROXY: value }, 'TRUST_PROXY');
  if (normalized === undefined || normalized.toLowerCase() === 'false' || normalized === '0') {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (lowered === 'true' || normalized === '*') {
    throw new Error('TRUST_PROXY must not be true or *. Use a specific proxy hop count, named subnet, IP address, or CIDR range.');
  }

  if (/^\d+$/.test(normalized)) {
    const hops = Number.parseInt(normalized, 10);
    if (hops > 10) {
      throw new Error('TRUST_PROXY hop count must be between 0 and 10.');
    }
    return hops;
  }

  const namedSubnets = new Set(['loopback', 'linklocal', 'uniquelocal']);
  const entries = normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length || !entries.every((entry) => namedSubnets.has(entry.toLowerCase()) || isValidIpOrCidr(entry))) {
    throw new Error('TRUST_PROXY must be false, a hop count, loopback/linklocal/uniquelocal, or a comma-separated list of IP/CIDR ranges.');
  }

  // proxy-addr accepts these named subnets only in lowercase. Validation is
  // deliberately case-insensitive for operators, so canonicalize before
  // handing the values to Express rather than allowing a valid-looking
  // deployment setting to fail during app initialization.
  const canonicalEntries = entries.map((entry) => (
    namedSubnets.has(entry.toLowerCase()) ? entry.toLowerCase() : entry
  ));

  return canonicalEntries.length === 1 ? canonicalEntries[0] : canonicalEntries;
}

function parseBooleanEnv(value, key) {
  const normalized = envValue({ [key]: value }, key);
  if (normalized === undefined) {
    return false;
  }

  const lowerValue = normalized.toLowerCase();
  if (lowerValue === 'true') {
    return true;
  }

  if (lowerValue === 'false') {
    return false;
  }

  throw new Error(`${key} must be either true or false.`);
}

function parseOptionalInteger(value, key) {
  const normalized = envValue({ [key]: value }, key);
  if (normalized === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${key} must be a valid integer.`);
  }

  return Number.parseInt(normalized, 10);
}

function parseBoundedPositiveInteger(value, key, { defaultValue, min = 1, max }) {
  const parsed = parseOptionalInteger(value, key);
  const finalValue = parsed === undefined ? defaultValue : parsed;

  if (!Number.isInteger(finalValue) || finalValue < min) {
    throw new Error(`${key} must be a positive integer${min > 1 ? ` greater than or equal to ${min}` : ''}.`);
  }

  if (max && finalValue > max) {
    throw new Error(`${key} must be less than or equal to ${max}.`);
  }

  return finalValue;
}

function parseSecurityLimit(source, key, defaultValue, { min = 1, max = 1000000 } = {}) {
  return parseBoundedPositiveInteger(source[key], key, {
    defaultValue,
    min,
    max
  });
}

/**
 * Validate required environment variables
 */
function validateEnv(source = process.env) {
  const required = ['DATABASE_URL'];
  if (source.NODE_ENV === 'production') {
    required.push('JWT_SECRET');
    required.push('EMAIL_PROVIDER');
    if (!effectiveCorsOrigin(source)) {
      required.push('FRONTEND_URL or CORS_ORIGIN');
    }
  }

  const missing = required.filter(key => {
    if (key === 'FRONTEND_URL or CORS_ORIGIN') {
      return !effectiveCorsOrigin(source);
    }

    return !envValue(source, key);
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (source.NODE_ENV === 'production') {
    const jwtSecret = envValue(source, 'JWT_SECRET') || '';
    const unsafeJwtSecrets = new Set([
      'local-dev-auth-secret-change-before-production',
      'local-compose-jwt-secret-change-before-any-shared-environment',
      'replace_with_a_long_random_secret_for_shared_or_staging_use',
      'local-ci-only-secret-not-for-production',
      'local-development-secret',
      'replace_with_a_long_random_secret_before_production',
      'production-secret'
    ]);

    if (jwtSecret.length < 32 || unsafeJwtSecrets.has(jwtSecret)) {
      throw new Error('JWT_SECRET must be a strong production secret with at least 32 characters.');
    }

    const corsOrigin = normalizeOrigin(effectiveCorsOrigin(source), 'FRONTEND_URL or CORS_ORIGIN') || '';
    if (!corsOrigin) {
      throw new Error('Production CORS origin must be an explicit trusted origin.');
    }

    if (!corsOrigin.startsWith('https://')) {
      throw new Error('Production CORS origin must use https://.');
    }
  }

  // Parse early so invalid proxy topology is rejected at startup rather than
  // silently trusting spoofable forwarding headers at runtime.
  parseTrustProxy(source.TRUST_PROXY);

  const configuredOrigin = effectiveCorsOrigin(source);
  if (configuredOrigin) {
    normalizeOrigin(configuredOrigin, 'FRONTEND_URL or CORS_ORIGIN');
  }

  parseSecurityLimit(source, 'RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000, max: 24 * 60 * 60 * 1000 });
  parseSecurityLimit(source, 'RATE_LIMIT_MAX', 10000, { min: 10 });
  parseSecurityLimit(source, 'AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000, max: 24 * 60 * 60 * 1000 });
  parseSecurityLimit(source, 'SIMILARITY_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000, max: 24 * 60 * 60 * 1000 });
  parseSecurityLimit(source, 'SIMILARITY_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'LOGIN_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'LOGIN_IDENTIFIER_RATE_LIMIT_MAX', 8, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'FORGOT_PASSWORD_RATE_LIMIT_MAX', 15, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'INVITATION_VALIDATION_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'INVITATION_ACCEPTANCE_RATE_LIMIT_MAX', 10, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'RESET_PASSWORD_RATE_LIMIT_MAX', 10, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'ADMIN_ACCOUNT_ACTION_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'ADMIN_BULK_INVITATION_RATE_LIMIT_MAX', 10, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'ADMIN_TOPIC_IMPORT_RATE_LIMIT_MAX', 5, { min: 1, max: 10000 });
  parseSecurityLimit(source, 'JSON_BODY_LIMIT_BYTES', 100 * 1024, { min: 1024, max: 5 * 1024 * 1024 });
  parseSecurityLimit(source, 'IMPORT_UPLOAD_LIMIT_BYTES', 5 * 1024 * 1024, { min: 1024, max: 50 * 1024 * 1024 });
  const importUploadMaxFields = parseSecurityLimit(source, 'IMPORT_UPLOAD_MAX_FIELDS', 10, { min: 1, max: 100 });
  const importUploadMaxParts = parseSecurityLimit(source, 'IMPORT_UPLOAD_MAX_PARTS', 12, { min: 2, max: 200 });
  if (importUploadMaxParts < importUploadMaxFields + 1) {
    throw new Error('IMPORT_UPLOAD_MAX_PARTS must allow the configured fields plus one file part.');
  }
  parseSecurityLimit(source, 'IMPORT_UPLOAD_FIELD_SIZE_BYTES', 16 * 1024, { min: 1024, max: 1024 * 1024 });
  parseSecurityLimit(source, 'RATE_LIMIT_IPV6_SUBNET_PREFIX', 56, { min: 32, max: 64 });
  parseSecurityLimit(source, 'VOYAGE_REQUEST_TIMEOUT_MS', 10000, { min: 1000, max: 60000 });
  parseSecurityLimit(source, 'VOYAGE_READINESS_PROBE_CACHE_MS', 5 * 60 * 1000, { min: 10000, max: 60 * 60 * 1000 });

  const emailProvider = (source.EMAIL_PROVIDER || '').trim().toLowerCase();
  const allowedEmailProviders = new Set(['', 'mock', 'disabled', 'smtp']);
  if (!allowedEmailProviders.has(emailProvider)) {
    throw new Error('EMAIL_PROVIDER must be one of: mock, disabled, smtp.');
  }

  if (source.NODE_ENV === 'production' && emailProvider === 'mock') {
    throw new Error('EMAIL_PROVIDER=mock is not allowed in production.');
  }

  if (emailProvider === 'smtp') {
    const smtpRequired = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM'];
    const missingSmtp = smtpRequired.filter(key => !envValue(source, key));
    if (missingSmtp.length > 0) {
      throw new Error(`Missing SMTP email configuration: ${missingSmtp.join(', ')}`);
    }

    const smtpPort = parseOptionalInteger(source.SMTP_PORT, 'SMTP_PORT');
    if (!smtpPort || smtpPort < 1 || smtpPort > 65535) {
      throw new Error('SMTP_PORT must be a valid TCP port between 1 and 65535.');
    }

    parseBooleanEnv(source.SMTP_SECURE, 'SMTP_SECURE');

    const smtpUser = envValue(source, 'SMTP_USER');
    const smtpPassword = envValue(source, 'SMTP_PASSWORD');
    if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
      throw new Error('SMTP_USER and SMTP_PASSWORD must be provided together when SMTP authentication is used.');
    }

    // Emailed invitation/reset links are built from the public frontend URL;
    // in production those links must never be plain http.
    if (source.NODE_ENV === 'production') {
      const linkBase = effectiveCorsOrigin(source) || '';
      if (!/^https:\/\//i.test(linkBase)) {
        throw new Error('FRONTEND_URL (or CORS_ORIGIN) must be an https:// URL in production when EMAIL_PROVIDER=smtp, because emailed links are built from it.');
      }
    }
  }

  parseBoundedPositiveInteger(source.INVITATION_EXPIRES_HOURS, 'INVITATION_EXPIRES_HOURS', {
    defaultValue: 168,
    min: 1,
    max: 720
  });

  const auditPurgeMinAgeDays = parseBoundedPositiveInteger(source.AUDIT_LOG_PURGE_MIN_AGE_DAYS, 'AUDIT_LOG_PURGE_MIN_AGE_DAYS', {
    defaultValue: 90,
    min: source.NODE_ENV === 'production' ? 1 : 1,
    max: 3650
  });
  parseBoundedPositiveInteger(source.AUDIT_LOG_RETENTION_DAYS, 'AUDIT_LOG_RETENTION_DAYS', {
    defaultValue: 365,
    min: auditPurgeMinAgeDays,
    max: 3650
  });
  parseBoundedPositiveInteger(source.AUDIT_LOG_PURGE_MAX_BATCH, 'AUDIT_LOG_PURGE_MAX_BATCH', {
    defaultValue: 1000,
    min: 1,
    max: 5000
  });
}

/**
 * Build configuration with all application settings.
 * FRONTEND_URL is the preferred browser origin; CORS_ORIGIN is the fallback.
 */
function buildConfig(source = process.env) {
  validateEnv(source);

  const browserOrigin = normalizeOrigin(effectiveCorsOrigin(source), 'FRONTEND_URL or CORS_ORIGIN') || 'http://localhost:5173';
  const generalRateLimitWindowMs = parseSecurityLimit(source, 'RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, {
    min: 1000,
    max: 24 * 60 * 60 * 1000
  });
  const authRateLimitWindowMs = parseSecurityLimit(source, 'AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, {
    min: 1000,
    max: 24 * 60 * 60 * 1000
  });
  const similarityRateLimitWindowMs = parseSecurityLimit(source, 'SIMILARITY_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, {
    min: 1000,
    max: 24 * 60 * 60 * 1000
  });
  const importUploadMaxFields = parseSecurityLimit(source, 'IMPORT_UPLOAD_MAX_FIELDS', 10, {
    min: 1,
    max: 100
  });
  const importUploadMaxParts = parseSecurityLimit(source, 'IMPORT_UPLOAD_MAX_PARTS', 12, {
    min: 2,
    max: 200
  });

  return {
    // Application environment
    env: source.NODE_ENV || 'development',

    // Server configuration
    port: parseInt(source.PORT, 10) || 3000,

    // API version
    apiVersion: source.API_VERSION || 'v1',

    // Database configuration
    database: {
      url: source.DATABASE_URL
    },

    // SBERT Service configuration
    sbertService: {
      url: source.SBERT_SERVICE_URL || 'http://localhost:8000',
      timeout: parseInt(source.SBERT_TIMEOUT, 10) || 30000, // 30 seconds
      retryAttempts: parseInt(source.SBERT_RETRY_ATTEMPTS, 10) || 3
    },

    // Reverse-proxy topology. Disabled by default so direct clients cannot
    // forge X-Forwarded-For and influence client identity/rate-limit keys.
    trustProxy: parseTrustProxy(source.TRUST_PROXY),

    // Rate limiting configuration. The broad limiter deliberately has a high
    // default for a shared departmental NAT; sensitive endpoints are governed
    // by the dedicated limits below.
    rateLimit: {
      windowMs: generalRateLimitWindowMs,
      max: parseSecurityLimit(source, 'RATE_LIMIT_MAX', 10000, { min: 10 }),
      authWindowMs: authRateLimitWindowMs,
      similarityWindowMs: similarityRateLimitWindowMs,
      loginMax: parseSecurityLimit(source, 'LOGIN_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 }),
      loginIdentifierMax: parseSecurityLimit(source, 'LOGIN_IDENTIFIER_RATE_LIMIT_MAX', 8, { min: 1, max: 10000 }),
      forgotPasswordMax: parseSecurityLimit(source, 'FORGOT_PASSWORD_RATE_LIMIT_MAX', 15, { min: 1, max: 10000 }),
      invitationValidationMax: parseSecurityLimit(source, 'INVITATION_VALIDATION_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 }),
      invitationAcceptanceMax: parseSecurityLimit(source, 'INVITATION_ACCEPTANCE_RATE_LIMIT_MAX', 10, { min: 1, max: 10000 }),
      resetPasswordMax: parseSecurityLimit(source, 'RESET_PASSWORD_RATE_LIMIT_MAX', 10, { min: 1, max: 10000 }),
      similarityMax: parseSecurityLimit(source, 'SIMILARITY_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 }),
      adminAccountActionMax: parseSecurityLimit(source, 'ADMIN_ACCOUNT_ACTION_RATE_LIMIT_MAX', 30, { min: 1, max: 10000 }),
      adminBulkInvitationMax: parseSecurityLimit(source, 'ADMIN_BULK_INVITATION_RATE_LIMIT_MAX', 10, { min: 1, max: 10000 }),
      adminTopicImportMax: parseSecurityLimit(source, 'ADMIN_TOPIC_IMPORT_RATE_LIMIT_MAX', 5, { min: 1, max: 10000 }),
      ipv6SubnetPrefix: parseSecurityLimit(source, 'RATE_LIMIT_IPV6_SUBNET_PREFIX', 56, { min: 32, max: 64 })
    },

    requestLimits: {
      jsonBodyBytes: parseSecurityLimit(source, 'JSON_BODY_LIMIT_BYTES', 100 * 1024, {
        min: 1024,
        max: 5 * 1024 * 1024
      }),
      importUploadBytes: parseSecurityLimit(source, 'IMPORT_UPLOAD_LIMIT_BYTES', 5 * 1024 * 1024, {
        min: 1024,
        max: 50 * 1024 * 1024
      }),
      importUploadMaxFields,
      importUploadMaxParts,
      importUploadFieldSizeBytes: parseSecurityLimit(source, 'IMPORT_UPLOAD_FIELD_SIZE_BYTES', 16 * 1024, {
        min: 1024,
        max: 1024 * 1024
      })
    },

    // CORS configuration
    cors: {
      origin: browserOrigin,
      allowedOrigins: [browserOrigin],
      credentials: source.CORS_CREDENTIALS !== 'false'
    },

    csrf: {
      // Browsers send Origin for SPA mutations. In production, missing
      // Origin/Referer is rejected when a session cookie is present; local
      // non-browser tooling can continue to operate outside production.
      requireOrigin: source.NODE_ENV === 'production',
      allowedOrigins: [browserOrigin]
    },

    voyage: {
      requestTimeoutMs: parseSecurityLimit(source, 'VOYAGE_REQUEST_TIMEOUT_MS', 10000, {
        min: 1000,
        max: 60000
      }),
      readinessProbeCacheMs: parseSecurityLimit(source, 'VOYAGE_READINESS_PROBE_CACHE_MS', 5 * 60 * 1000, {
        min: 10000,
        max: 60 * 60 * 1000
      })
    },

    // Auth configuration
    auth: {
      jwtSecret: source.JWT_SECRET || 'local-dev-auth-secret-change-before-production',
      jwtExpiresIn: source.JWT_EXPIRES_IN || '24h',
      cookieName: source.AUTH_COOKIE_NAME || 'rtadss_session',
      cookieSecure: source.NODE_ENV === 'production',
      resetTokenExpiresMinutes: parseInt(source.RESET_TOKEN_EXPIRES_MINUTES, 10) || 30,
      // Departmental invitations tolerate a longer window than password
      // resets: 7 days by default, bounded 1 hour to 30 days.
      invitationExpiresHours: parseBoundedPositiveInteger(source.INVITATION_EXPIRES_HOURS, 'INVITATION_EXPIRES_HOURS', {
        defaultValue: 168,
        min: 1,
        max: 720
      }),
      frontendUrl: browserOrigin
    },

    // Email delivery configuration
    email: {
      provider: (source.EMAIL_PROVIDER || (source.NODE_ENV === 'production' ? 'disabled' : 'mock')).toLowerCase(),
      from: envValue(source, 'EMAIL_FROM') || 'no-reply@localhost',
      smtp: {
        host: envValue(source, 'SMTP_HOST'),
        port: parseOptionalInteger(source.SMTP_PORT, 'SMTP_PORT'),
        secure: parseBooleanEnv(source.SMTP_SECURE, 'SMTP_SECURE'),
        user: envValue(source, 'SMTP_USER'),
        password: envValue(source, 'SMTP_PASSWORD'),
        passwordConfigured: Boolean(envValue(source, 'SMTP_PASSWORD')),
        timeoutMs: parseOptionalInteger(source.SMTP_TIMEOUT_MS, 'SMTP_TIMEOUT_MS') || 10000
      }
    },

    // Audit log governance
    auditLog: {
      retentionDays: parseBoundedPositiveInteger(source.AUDIT_LOG_RETENTION_DAYS, 'AUDIT_LOG_RETENTION_DAYS', {
        defaultValue: 365,
        min: parseBoundedPositiveInteger(source.AUDIT_LOG_PURGE_MIN_AGE_DAYS, 'AUDIT_LOG_PURGE_MIN_AGE_DAYS', {
          defaultValue: 90,
          min: 1,
          max: 3650
        }),
        max: 3650
      }),
      purgeMinAgeDays: parseBoundedPositiveInteger(source.AUDIT_LOG_PURGE_MIN_AGE_DAYS, 'AUDIT_LOG_PURGE_MIN_AGE_DAYS', {
        defaultValue: 90,
        min: 1,
        max: 3650
      }),
      purgeMaxBatch: parseBoundedPositiveInteger(source.AUDIT_LOG_PURGE_MAX_BATCH, 'AUDIT_LOG_PURGE_MAX_BATCH', {
        defaultValue: 1000,
        min: 1,
        max: 5000
      })
    },

    // Logging configuration
    logging: {
      level: source.LOG_LEVEL || 'info',
      file: source.LOG_FILE || 'logs/app.log'
    },

    // Similarity thresholds and settings
    similarity: {
      tier2Threshold: parseFloat(source.SIMILARITY_TIER2_THRESHOLD) || 0.60,
      tier3TimeWindowHours: parseInt(source.SIMILARITY_TIER3_TIME_WINDOW_HOURS, 10) || 48
    }
  };
}

const config = buildConfig(process.env);

module.exports = config;

Object.defineProperties(module.exports, {
  buildConfig: { value: buildConfig },
  parseBooleanEnv: { value: parseBooleanEnv },
  parseBoundedPositiveInteger: { value: parseBoundedPositiveInteger },
  parseTrustProxy: { value: parseTrustProxy },
  normalizeOrigin: { value: normalizeOrigin },
  validateEnv: { value: validateEnv },
  effectiveCorsOrigin: { value: effectiveCorsOrigin }
});
