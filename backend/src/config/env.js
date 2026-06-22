require('dotenv').config();

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
      'replace_with_a_long_random_secret_before_production',
      'production-secret'
    ]);

    if (jwtSecret.length < 32 || unsafeJwtSecrets.has(jwtSecret)) {
      throw new Error('JWT_SECRET must be a strong production secret with at least 32 characters.');
    }

    const corsOrigin = effectiveCorsOrigin(source) || '';
    if (!corsOrigin || corsOrigin === '*') {
      throw new Error('Production CORS origin must be an explicit trusted origin.');
    }
  }

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
  }

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

  const browserOrigin = effectiveCorsOrigin(source) || 'http://localhost:5173';

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

    // Rate limiting configuration
    rateLimit: {
      windowMs: parseInt(source.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(source.RATE_LIMIT_MAX, 10) || 100 // limit each IP to 100 requests per windowMs
    },

    // CORS configuration
    cors: {
      origin: browserOrigin,
      credentials: source.CORS_CREDENTIALS !== 'false'
    },

    // Auth configuration
    auth: {
      jwtSecret: source.JWT_SECRET || 'local-dev-auth-secret-change-before-production',
      jwtExpiresIn: source.JWT_EXPIRES_IN || '24h',
      cookieName: source.AUTH_COOKIE_NAME || 'rtadss_session',
      cookieSecure: source.NODE_ENV === 'production',
      resetTokenExpiresMinutes: parseInt(source.RESET_TOKEN_EXPIRES_MINUTES, 10) || 30,
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
  validateEnv: { value: validateEnv },
  effectiveCorsOrigin: { value: effectiveCorsOrigin }
});
