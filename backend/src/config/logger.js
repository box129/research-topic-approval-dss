const winston = require('winston');

/**
 * Winston logger configuration.
 *
 * Production emits one JSON object per line on stdout/stderr so the hosting
 * platform's log capture is the primary durable record. The local file
 * transports are SECONDARY convenience copies only: container/host filesystem
 * logs are not durable and must never be treated as the system of record.
 * Development keeps a human-friendly console format.
 */

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Defense in depth: even if a caller accidentally passes credential-shaped
// metadata, the value is redacted before any transport sees it. This mirrors
// the audit-log redaction contract.
const SENSITIVE_LOG_KEY_PATTERN = /(password|passwd|credential|token|secret|authorization|cookie|jwt|session|apikey|api_key|databaseurl|database_url|connectionstring)/i;
const MAX_REDACTION_DEPTH = 6;

function redactSensitiveValues(value, depth = 0) {
  if (depth > MAX_REDACTION_DEPTH) {
    return '[truncated]';
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValues(entry, depth + 1));
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((redacted, [key, nested]) => {
      redacted[key] = SENSITIVE_LOG_KEY_PATTERN.test(key)
        ? '[redacted]'
        : redactSensitiveValues(nested, depth + 1);
      return redacted;
    }, {});
  }
  return value;
}

const redactFormat = winston.format((info) => {
  for (const [key, value] of Object.entries(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp') {
      continue;
    }
    info[key] = SENSITIVE_LOG_KEY_PATTERN.test(key)
      ? '[redacted]'
      : redactSensitiveValues(value);
  }
  return info;
});

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || 'development').trim().toLowerCase() === 'production';
}

// Machine-readable production format: timestamp, level, message and safe
// metadata fields flattened into one JSON line.
const productionFormat = winston.format.combine(
  redactFormat(),
  winston.format.timestamp(),
  winston.format.json()
);

// Human-friendly development format; structured metadata is appended as JSON
// so request IDs and categories remain visible locally too.
const developmentFormat = winston.format.combine(
  redactFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info;
    const metadataKeys = Object.keys(metadata).filter((key) => typeof key === 'string');
    const suffix = metadataKeys.length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} ${level}: ${message}${suffix}`;
  })
);

// Define transports. Console/stdout is the primary production channel; the
// file copies are local-only and non-durable.
const transports = [
  new winston.transports.Console(),

  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: isProductionEnvironment() ? productionFormat : developmentFormat,
  transports,
});

module.exports = logger;
module.exports.redactSensitiveValues = redactSensitiveValues;
module.exports.SENSITIVE_LOG_KEY_PATTERN = SENSITIVE_LOG_KEY_PATTERN;
