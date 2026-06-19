require('dotenv').config();

function envValue(key) {
  const value = process.env[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

/**
 * Validate required environment variables
 */
function validateEnv() {
  const required = ['DATABASE_URL'];
  if (process.env.NODE_ENV === 'production') {
    required.push('JWT_SECRET');
    required.push('EMAIL_PROVIDER');
    if (!envValue('FRONTEND_URL') && !envValue('CORS_ORIGIN')) {
      required.push('FRONTEND_URL or CORS_ORIGIN');
    }
  }

  const missing = required.filter(key => !envValue(key));
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = envValue('JWT_SECRET') || '';
    const unsafeJwtSecrets = new Set([
      'local-dev-auth-secret-change-before-production',
      'replace_with_a_long_random_secret_before_production',
      'production-secret'
    ]);

    if (jwtSecret.length < 32 || unsafeJwtSecrets.has(jwtSecret)) {
      throw new Error('JWT_SECRET must be a strong production secret with at least 32 characters.');
    }

    const corsOrigin = envValue('FRONTEND_URL') || envValue('CORS_ORIGIN') || '';
    if (!corsOrigin || corsOrigin === '*') {
      throw new Error('Production CORS origin must be an explicit trusted origin.');
    }
  }

  const emailProvider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const allowedEmailProviders = new Set(['', 'mock', 'disabled', 'smtp']);
  if (!allowedEmailProviders.has(emailProvider)) {
    throw new Error('EMAIL_PROVIDER must be one of: mock, disabled, smtp.');
  }

  if (process.env.NODE_ENV === 'production' && emailProvider === 'mock') {
    throw new Error('EMAIL_PROVIDER=mock is not allowed in production.');
  }

  if (emailProvider === 'smtp') {
    const smtpRequired = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM'];
    const missingSmtp = smtpRequired.filter(key => !process.env[key]);
    if (missingSmtp.length > 0) {
      throw new Error(`Missing SMTP email configuration: ${missingSmtp.join(', ')}`);
    }
  }
}

// Validate environment on load
validateEnv();

/**
 * Configuration object with all application settings
 */
const config = {
  // Application environment
  env: process.env.NODE_ENV || 'development',
  
  // Server configuration
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // API version
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL
  },
  
  // SBERT Service configuration
  sbertService: {
    url: process.env.SBERT_SERVICE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.SBERT_TIMEOUT, 10) || 30000, // 30 seconds
    retryAttempts: parseInt(process.env.SBERT_RETRY_ATTEMPTS, 10) || 3
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100 // limit each IP to 100 requests per windowMs
  },
  
  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  },

  // Auth configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'local-dev-auth-secret-change-before-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    cookieName: process.env.AUTH_COOKIE_NAME || 'rtadss_session',
    cookieSecure: process.env.NODE_ENV === 'production',
    resetTokenExpiresMinutes: parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES, 10) || 30,
    frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173'
  },

  // Email delivery configuration
  email: {
    provider: (process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'production' ? 'disabled' : 'mock')).toLowerCase(),
    from: process.env.EMAIL_FROM || 'no-reply@localhost',
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      passwordConfigured: Boolean(process.env.SMTP_PASSWORD)
    }
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  },
  
  // Similarity thresholds and settings
  similarity: {
    tier2Threshold: parseFloat(process.env.SIMILARITY_TIER2_THRESHOLD) || 0.60,
    tier3TimeWindowHours: parseInt(process.env.SIMILARITY_TIER3_TIME_WINDOW_HOURS, 10) || 48
  }
};

module.exports = config;
