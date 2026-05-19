const config = require('../config/env');
const logger = require('../config/logger');

async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${config.auth.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const payload = {
    provider: 'mock',
    type: 'password_reset',
    to,
    subject: 'Reset your Research Topic Approval DSS password',
    body: `Hello ${name}, use this local-only reset link: ${resetUrl}`,
    resetUrl
  };

  logger.info('Mock email generated', {
    type: payload.type,
    to: payload.to,
    resetUrl: config.env === 'production' ? '[redacted]' : resetUrl
  });

  if (config.env !== 'production') {
    console.log('[mock-email]', payload);
  }

  return payload;
}

module.exports = {
  sendPasswordResetEmail
};
