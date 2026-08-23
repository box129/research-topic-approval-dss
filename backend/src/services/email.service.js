const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../config/logger');

const EMAIL_PROVIDERS = {
  MOCK: 'mock',
  DISABLED: 'disabled',
  SMTP: 'smtp'
};

// One bounded retry for transient transport failures only. Permanent
// failures (bad credentials, rejected recipient, unsupported config) are
// never retried, and the retry re-sends the same logical message — token
// rotation only ever happens through a deliberate resend action upstream.
const SMTP_TRANSIENT_RETRY_LIMIT = 1;
const SMTP_RETRY_DELAY_MS = 500;

// SMTP enhanced status codes that indicate a temporary condition.
const TRANSIENT_SMTP_RESPONSE_CODES = new Set([421, 450, 451, 452]);
const TRANSIENT_TRANSPORT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS']);

class EmailServiceError extends Error {
  constructor(message, { code = 'EMAIL_DELIVERY_FAILED', statusCode = 503, reasonCode = 'delivery-failed', transient = false } = {}) {
    super(message);
    this.name = 'EmailServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.reasonCode = reasonCode;
    this.transient = transient;
  }
}

function normalizeProvider(value) {
  return String(value || '').trim().toLowerCase();
}

function assertSafeRecipient(to) {
  const email = String(to || '').trim();
  if (!email) {
    throw new EmailServiceError('Email recipient is required.', {
      code: 'EMAIL_RECIPIENT_REQUIRED',
      statusCode: 400,
      reasonCode: 'recipient-required'
    });
  }

  return email;
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

function buildResetUrl({ frontendUrl, token }) {
  return `${normalizeBaseUrl(frontendUrl)}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildInvitationUrl({ frontendUrl, token }) {
  return `${normalizeBaseUrl(frontendUrl)}/accept-invitation?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function describeExpiryWindow(hours) {
  const wholeDays = hours % 24 === 0 ? hours / 24 : null;
  if (wholeDays) {
    return wholeDays === 1 ? '1 day' : `${wholeDays} days`;
  }
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function buildPasswordResetEmailContent({ to, name, token, frontendUrl, expiresMinutes }) {
  const recipient = assertSafeRecipient(to);
  const displayName = String(name || 'there').trim() || 'there';
  const escapedDisplayName = escapeHtml(displayName);
  const resetUrl = buildResetUrl({ frontendUrl, token });
  const expiryMinutes = Number.isInteger(expiresMinutes) && expiresMinutes > 0 ? expiresMinutes : 30;

  return {
    to: recipient,
    subject: 'Reset your Research Topic Approval DSS password',
    text: [
      `Hello ${displayName},`,
      '',
      'A password reset was requested for your Research Topic Approval DSS account.',
      `Use this reset link to continue: ${resetUrl}`,
      '',
      `The link expires in ${expiryMinutes} minutes and can be used once.`,
      'If you did not request this reset, you can ignore this message; your password remains unchanged.'
    ].join('\n'),
    html: [
      `<p>Hello ${escapedDisplayName},</p>`,
      '<p>A password reset was requested for your Research Topic Approval DSS account.</p>',
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      `<p>The link expires in ${expiryMinutes} minutes and can be used once.</p>`,
      '<p>If you did not request this reset, you can ignore this message; your password remains unchanged.</p>'
    ].join('')
  };
}

function buildInvitationEmailContent({ to, name, token, frontendUrl, expiresHours }) {
  const recipient = assertSafeRecipient(to);
  const displayName = String(name || 'there').trim() || 'there';
  const escapedDisplayName = escapeHtml(displayName);
  const invitationUrl = buildInvitationUrl({ frontendUrl, token });
  const expiryText = describeExpiryWindow(Number.isInteger(expiresHours) && expiresHours > 0 ? expiresHours : 168);

  return {
    to: recipient,
    subject: 'Activate your Research Topic Approval DSS account',
    text: [
      `Hello ${displayName},`,
      '',
      'An account has been created for you on the Research Topic Approval Decision Support System.',
      'Use this secure activation link to choose your own private password:',
      invitationUrl,
      '',
      `The activation link expires in ${expiryText} and can be used once.`,
      'If you were not expecting this account, you can ignore this message and no account access will be established.'
    ].join('\n'),
    html: [
      `<p>Hello ${escapedDisplayName},</p>`,
      '<p>An account has been created for you on the Research Topic Approval Decision Support System.</p>',
      '<p>Use this secure activation link to choose your own private password:</p>',
      `<p><a href="${invitationUrl}">Activate your account</a></p>`,
      `<p>The activation link expires in ${escapeHtml(expiryText)} and can be used once.</p>`,
      '<p>If you were not expecting this account, you can ignore this message and no account access will be established.</p>'
    ].join('')
  };
}

function createSafeDeliveryResult({ provider, to, subject, delivered = false, status = 'accepted' }) {
  return {
    provider,
    status,
    delivered,
    to,
    subject
  };
}

function countMailRecipients(value) {
  return Array.isArray(value) ? value.length : 0;
}

function createSmtpTransport(emailConfig) {
  const smtpConfig = emailConfig?.smtp || {};
  const auth = smtpConfig.user && smtpConfig.password
    ? {
        user: smtpConfig.user,
        pass: smtpConfig.password
      }
    : undefined;

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: Boolean(smtpConfig.secure),
    auth,
    connectionTimeout: smtpConfig.timeoutMs,
    greetingTimeout: smtpConfig.timeoutMs,
    socketTimeout: smtpConfig.timeoutMs
  });
}

// Maps a raw transport error to a short operator-safe reason code and a
// transient/permanent classification. Raw provider text (which can embed
// hostnames or credentials hints) never leaves this function.
function classifySmtpError(error) {
  const code = String(error?.code || '').toUpperCase();
  const responseCode = Number(error?.responseCode);

  if (code === 'EAUTH') {
    return { reasonCode: 'smtp-auth-failed', transient: false };
  }
  if (code === 'EENVELOPE') {
    return { reasonCode: 'smtp-recipient-rejected', transient: false };
  }
  if (code === 'ETIMEDOUT') {
    return { reasonCode: 'smtp-timeout', transient: true };
  }
  if (TRANSIENT_TRANSPORT_ERROR_CODES.has(code)) {
    return { reasonCode: 'smtp-connect-failed', transient: true };
  }
  if (TRANSIENT_SMTP_RESPONSE_CODES.has(responseCode)) {
    return { reasonCode: 'smtp-transient-rejected', transient: true };
  }

  return { reasonCode: 'smtp-failed', transient: false };
}

function createSafeSmtpDeliveryResult({ to, subject, info }) {
  const acceptedCount = countMailRecipients(info?.accepted);
  const rejectedCount = countMailRecipients(info?.rejected);
  const delivered = acceptedCount > 0 && rejectedCount === 0;
  const status = delivered ? 'sent' : (acceptedCount > 0 ? 'partial' : 'rejected');

  return {
    ...createSafeDeliveryResult({
      provider: EMAIL_PROVIDERS.SMTP,
      to,
      subject,
      delivered,
      status
    }),
    acceptedCount,
    rejectedCount,
    messageId: info?.messageId || null
  };
}

function createEmailService({
  emailConfig = config.email,
  authConfig = config.auth,
  appEnv = config.env,
  serviceLogger = logger,
  transportFactory = createSmtpTransport,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  transientRetryLimit = SMTP_TRANSIENT_RETRY_LIMIT
} = {}) {
  const provider = normalizeProvider(emailConfig?.provider) || (appEnv === 'production' ? EMAIL_PROVIDERS.DISABLED : EMAIL_PROVIDERS.MOCK);
  let smtpTransport;

  const sendThroughSmtp = async ({ type, content }) => {
    if (!smtpTransport) {
      smtpTransport = transportFactory(emailConfig);
    }

    let lastClassification = { reasonCode: 'smtp-failed', transient: false };
    const maxAttempts = 1 + Math.max(0, transientRetryLimit);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const info = await smtpTransport.sendMail({
          from: emailConfig.from,
          to: content.to,
          subject: content.subject,
          text: content.text,
          html: content.html
        });

        const result = createSafeSmtpDeliveryResult({
          to: content.to,
          subject: content.subject,
          info
        });

        serviceLogger.info('SMTP email accepted by transport', {
          type,
          to: content.to,
          provider,
          attempt,
          acceptedCount: result.acceptedCount,
          rejectedCount: result.rejectedCount
        });

        return result;
      } catch (error) {
        lastClassification = classifySmtpError(error);
        serviceLogger.error('SMTP email delivery failed', {
          type,
          to: content.to,
          provider,
          attempt,
          reasonCode: lastClassification.reasonCode,
          transient: lastClassification.transient,
          errorName: error?.name,
          errorCode: error?.code
        });

        if (!lastClassification.transient || attempt === maxAttempts) {
          break;
        }

        await sleep(SMTP_RETRY_DELAY_MS);
      }
    }

    throw new EmailServiceError('SMTP email delivery failed.', {
      code: 'EMAIL_DELIVERY_FAILED',
      reasonCode: lastClassification.reasonCode,
      transient: lastClassification.transient
    });
  };

  // Single hardened delivery path shared by every message type. Logs carry
  // message type and recipient only — never tokens, links, or credentials.
  const deliver = async ({ type, content }) => {
    if (provider === EMAIL_PROVIDERS.DISABLED) {
      serviceLogger.warn('Email delivery disabled', {
        type,
        to: content.to
      });
      throw new EmailServiceError('Email delivery is disabled.', {
        code: 'EMAIL_PROVIDER_DISABLED',
        reasonCode: 'provider-disabled'
      });
    }

    if (provider === EMAIL_PROVIDERS.MOCK) {
      if (appEnv === 'production') {
        // Defense in depth: env validation already rejects mock in
        // production; never let a mock claim delivery there regardless.
        throw new EmailServiceError('Mock email provider is not allowed in production.', {
          code: 'EMAIL_PROVIDER_UNSUPPORTED',
          reasonCode: 'mock-in-production'
        });
      }

      serviceLogger.info('Mock email accepted', {
        type,
        to: content.to,
        provider
      });

      return createSafeDeliveryResult({
        provider,
        to: content.to,
        subject: content.subject,
        delivered: false,
        status: 'mocked'
      });
    }

    if (provider === EMAIL_PROVIDERS.SMTP) {
      return sendThroughSmtp({ type, content });
    }

    throw new EmailServiceError('Unsupported email provider configured.', {
      code: 'EMAIL_PROVIDER_UNSUPPORTED',
      reasonCode: 'provider-unsupported'
    });
  };

  const sendPasswordResetEmail = async ({ to, name, token }) => {
    const content = buildPasswordResetEmailContent({
      to,
      name,
      token,
      frontendUrl: authConfig.frontendUrl,
      expiresMinutes: authConfig.resetTokenExpiresMinutes
    });

    return deliver({ type: 'password_reset', content });
  };

  const sendInvitationEmail = async ({ to, name, token, expiresHours }) => {
    const content = buildInvitationEmailContent({
      to,
      name,
      token,
      frontendUrl: authConfig.frontendUrl,
      expiresHours
    });

    return deliver({ type: 'account_invitation', content });
  };

  // Operator-facing capability summary for readiness/config surfaces.
  // Distinguishes EMAIL READY (real transport configured) from EMAIL
  // CAPABILITY DISABLED; secrets are never included.
  const describeEmailCapability = () => {
    if (provider === EMAIL_PROVIDERS.SMTP) {
      return {
        provider,
        status: 'configured',
        message: 'SMTP transport is configured. Invitations and password recovery can be delivered.'
      };
    }

    if (provider === EMAIL_PROVIDERS.MOCK) {
      return {
        provider,
        status: appEnv === 'production' ? 'invalid' : 'mock',
        message: appEnv === 'production'
          ? 'Mock email provider is not allowed in production.'
          : 'Mock provider accepts email without delivering it (development/test only).'
      };
    }

    return {
      provider: EMAIL_PROVIDERS.DISABLED,
      status: 'disabled',
      message: 'EMAIL CAPABILITY DISABLED: invitations and password-recovery email cannot be delivered until SMTP is configured.'
    };
  };

  return {
    provider,
    deliver,
    sendPasswordResetEmail,
    sendInvitationEmail,
    describeEmailCapability
  };
}

module.exports = {
  ...createEmailService(),
  EMAIL_PROVIDERS,
  EmailServiceError,
  buildPasswordResetEmailContent,
  buildInvitationEmailContent,
  classifySmtpError,
  createEmailService,
  createSmtpTransport,
  SMTP_TRANSIENT_RETRY_LIMIT
};
