const config = require('../config/env');
const logger = require('../config/logger');

const EMAIL_PROVIDERS = {
  MOCK: 'mock',
  DISABLED: 'disabled',
  SMTP: 'smtp'
};

class EmailServiceError extends Error {
  constructor(message, { code = 'EMAIL_DELIVERY_FAILED', statusCode = 503 } = {}) {
    super(message);
    this.name = 'EmailServiceError';
    this.code = code;
    this.statusCode = statusCode;
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
      statusCode: 400
    });
  }

  return email;
}

function buildResetUrl({ frontendUrl, token }) {
  return `${String(frontendUrl || '').replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPasswordResetEmailContent({ to, name, token, frontendUrl }) {
  const recipient = assertSafeRecipient(to);
  const displayName = String(name || 'there').trim() || 'there';
  const escapedDisplayName = escapeHtml(displayName);
  const resetUrl = buildResetUrl({ frontendUrl, token });

  return {
    to: recipient,
    subject: 'Reset your Research Topic Approval DSS password',
    text: [
      `Hello ${displayName},`,
      '',
      'A password reset was requested for your account.',
      `Use this reset link to continue: ${resetUrl}`,
      '',
      'If you did not request this reset, you can ignore this message.'
    ].join('\n'),
    html: [
      `<p>Hello ${escapedDisplayName},</p>`,
      '<p>A password reset was requested for your account.</p>',
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      '<p>If you did not request this reset, you can ignore this message.</p>'
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

function createEmailService({
  emailConfig = config.email,
  authConfig = config.auth,
  appEnv = config.env,
  serviceLogger = logger
} = {}) {
  const provider = normalizeProvider(emailConfig?.provider) || (appEnv === 'production' ? EMAIL_PROVIDERS.DISABLED : EMAIL_PROVIDERS.MOCK);

  const sendPasswordResetEmail = async ({ to, name, token }) => {
    const content = buildPasswordResetEmailContent({
      to,
      name,
      token,
      frontendUrl: authConfig.frontendUrl
    });

    if (provider === EMAIL_PROVIDERS.DISABLED) {
      serviceLogger.warn('Email delivery disabled', {
        type: 'password_reset',
        to: content.to
      });
      throw new EmailServiceError('Email delivery is disabled.', {
        code: 'EMAIL_PROVIDER_DISABLED'
      });
    }

    if (provider === EMAIL_PROVIDERS.MOCK) {
      serviceLogger.info('Mock email accepted', {
        type: 'password_reset',
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
      serviceLogger.error('SMTP email provider requested but transport is not implemented', {
        type: 'password_reset',
        to: content.to,
        provider
      });
      throw new EmailServiceError('SMTP email delivery is not implemented in this build.', {
        code: 'EMAIL_PROVIDER_NOT_IMPLEMENTED'
      });
    }

    throw new EmailServiceError('Unsupported email provider configured.', {
      code: 'EMAIL_PROVIDER_UNSUPPORTED'
    });
  };

  return {
    provider,
    sendPasswordResetEmail
  };
}

module.exports = {
  ...createEmailService(),
  EMAIL_PROVIDERS,
  EmailServiceError,
  buildPasswordResetEmailContent,
  createEmailService
};
