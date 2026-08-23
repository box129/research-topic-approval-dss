const crypto = require('crypto');
const { isIP } = require('net');
const rateLimit = require('express-rate-limit');

const DEFAULT_IPV6_SUBNET_PREFIX = 56;

function clientIp(req = {}) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function ipv6ToBigInt(address) {
  let normalized = String(address).toLowerCase();
  if (normalized.includes('.')) {
    const lastColonIndex = normalized.lastIndexOf(':');
    const octets = normalized.slice(lastColonIndex + 1).split('.').map(Number);
    const firstGroup = ((octets[0] << 8) | octets[1]).toString(16);
    const secondGroup = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, lastColonIndex + 1)}${firstGroup}:${secondGroup}`;
  }

  const doubleColonIndex = normalized.indexOf('::');
  const left = doubleColonIndex === -1
    ? normalized.split(':')
    : normalized.slice(0, doubleColonIndex).split(':').filter(Boolean);
  const right = doubleColonIndex === -1
    ? []
    : normalized.slice(doubleColonIndex + 2).split(':').filter(Boolean);
  const groups = doubleColonIndex === -1
    ? left
    : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];

  return groups.reduce((value, group) => (
    (value << 16n) | BigInt(Number.parseInt(group, 16))
  ), 0n);
}

function ipv4FromMappedIpv6(value) {
  const numeric = ipv6ToBigInt(value);
  if ((numeric >> 32n) !== 0xffffn) {
    return null;
  }

  const ipv4 = Number(numeric & 0xffffffffn);
  return [
    (ipv4 >>> 24) & 0xff,
    (ipv4 >>> 16) & 0xff,
    (ipv4 >>> 8) & 0xff,
    ipv4 & 0xff
  ].join('.');
}

function normalizeIpv6SubnetPrefix(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 128
    ? parsed
    : DEFAULT_IPV6_SUBNET_PREFIX;
}

function normalizedClientIp(req, { ipv6SubnetPrefix = DEFAULT_IPV6_SUBNET_PREFIX } = {}) {
  const ip = clientIp(req);
  if (isIP(ip) !== 6) {
    return ip;
  }

  const mappedIpv4 = ipv4FromMappedIpv6(ip);
  if (mappedIpv4) {
    return mappedIpv4;
  }

  const prefix = normalizeIpv6SubnetPrefix(ipv6SubnetPrefix);
  const network = ipv6ToBigInt(ip) >> BigInt(128 - prefix);
  return `ipv6/${prefix}:${network.toString(16)}`;
}

function ipKey(req, options) {
  return `ip:${normalizedClientIp(req, options)}`;
}

function authenticatedUserKey(req, options) {
  const userId = Number(req.user?.id);
  return Number.isInteger(userId) && userId > 0
    ? `user:${userId}`
    : ipKey(req, options);
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function identifierDigest(value) {
  const normalized = normalizedEmail(value);
  if (!normalized) {
    return 'missing';
  }

  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

function loginIdentifierKey(req, options) {
  return `${ipKey(req, options)}:login:${identifierDigest(req.body?.email)}`;
}

function formatWindow(windowMs) {
  const seconds = Math.max(1, Math.ceil(Number(windowMs) / 1000));
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} seconds`;
}

function retryAfterSeconds(req, windowMs) {
  const resetAt = req.rateLimit?.resetTime instanceof Date
    ? req.rateLimit.resetTime.getTime()
    : Number(new Date(req.rateLimit?.resetTime || 0));
  const remainingMs = Number.isFinite(resetAt) && resetAt > Date.now()
    ? resetAt - Date.now()
    : windowMs;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

function createRateLimiter({ name, windowMs, max, keyGenerator = ipKey }) {
  if (!name) {
    throw new Error('Rate limiter name is required.');
  }

  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    legacyHeaders: true,
    standardHeaders: 'draft-7',
    handler: (req, res) => {
      const retryAfter = retryAfterSeconds(req, windowMs);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        details: {
          error_code: 'RATE_LIMIT_EXCEEDED',
          limiter: name,
          retry_after: retryAfter,
          limit: `${max} request${max === 1 ? '' : 's'} per ${formatWindow(windowMs)}`,
          window_seconds: Math.ceil(windowMs / 1000)
        }
      });
    }
  });
}

function createRateLimiters(rateLimitConfig) {
  const ipKeyOptions = {
    ipv6SubnetPrefix: rateLimitConfig.ipv6SubnetPrefix
  };
  const ipKeyGenerator = (req) => ipKey(req, ipKeyOptions);
  const authenticatedUserKeyGenerator = (req) => authenticatedUserKey(req, ipKeyOptions);
  const loginIdentifierKeyGenerator = (req) => loginIdentifierKey(req, ipKeyOptions);

  return {
    global: createRateLimiter({
      name: 'global',
      windowMs: rateLimitConfig.windowMs,
      max: rateLimitConfig.max,
      keyGenerator: authenticatedUserKeyGenerator
    }),
    loginIp: createRateLimiter({
      name: 'login-ip',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.loginMax,
      keyGenerator: ipKeyGenerator
    }),
    loginIdentifier: createRateLimiter({
      name: 'login-identifier',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.loginIdentifierMax,
      keyGenerator: loginIdentifierKeyGenerator
    }),
    forgotPassword: createRateLimiter({
      name: 'forgot-password',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.forgotPasswordMax,
      keyGenerator: ipKeyGenerator
    }),
    invitationValidation: createRateLimiter({
      name: 'invitation-validation',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.invitationValidationMax,
      keyGenerator: ipKeyGenerator
    }),
    invitationAcceptance: createRateLimiter({
      name: 'invitation-acceptance',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.invitationAcceptanceMax,
      keyGenerator: ipKeyGenerator
    }),
    resetPassword: createRateLimiter({
      name: 'reset-password',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.resetPasswordMax,
      keyGenerator: ipKeyGenerator
    }),
    similarity: createRateLimiter({
      name: 'similarity',
      windowMs: rateLimitConfig.similarityWindowMs,
      max: rateLimitConfig.similarityMax,
      keyGenerator: authenticatedUserKeyGenerator
    }),
    adminAccountAction: createRateLimiter({
      name: 'admin-account-action',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.adminAccountActionMax,
      keyGenerator: authenticatedUserKeyGenerator
    }),
    adminBulkInvitation: createRateLimiter({
      name: 'admin-bulk-invitation',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.adminBulkInvitationMax,
      keyGenerator: authenticatedUserKeyGenerator
    }),
    adminTopicImport: createRateLimiter({
      name: 'admin-topic-import',
      windowMs: rateLimitConfig.authWindowMs,
      max: rateLimitConfig.adminTopicImportMax,
      keyGenerator: authenticatedUserKeyGenerator
    })
  };
}

module.exports = {
  DEFAULT_IPV6_SUBNET_PREFIX,
  authenticatedUserKey,
  clientIp,
  createRateLimiter,
  createRateLimiters,
  formatWindow,
  identifierDigest,
  ipKey,
  ipv4FromMappedIpv6,
  ipv6ToBigInt,
  loginIdentifierKey,
  normalizedClientIp,
  retryAfterSeconds
};
