#!/usr/bin/env node

const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..', '..');
const backendRequire = createRequire(path.join(root, 'backend', 'package.json'));
const nodemailer = backendRequire('nodemailer');

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

function parsePort(value) {
  const normalized = envValue('SMTP_PORT');
  if (!/^\d+$/.test(normalized || '')) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }

  const port = Number.parseInt(value, 10);
  if (port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }

  return port;
}

function parseBoolean(key, defaultValue = false) {
  const value = envValue(key);
  if (value === undefined) {
    return defaultValue;
  }

  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true') {
    return true;
  }

  if (lowerValue === 'false') {
    return false;
  }

  throw new Error(`${key} must be either true or false.`);
}

function requireEnv(key) {
  const value = envValue(key);
  if (!value) {
    throw new Error(`${key} is required for SMTP smoke verification.`);
  }

  return value;
}

function buildSmtpConfig() {
  const provider = envValue('EMAIL_PROVIDER');
  if (provider !== 'smtp') {
    throw new Error('SMTP smoke verification only runs when EMAIL_PROVIDER=smtp.');
  }

  const smtpUser = envValue('SMTP_USER');
  const smtpPassword = envValue('SMTP_PASSWORD');
  if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be provided together when SMTP authentication is used.');
  }

  const timeoutMs = envValue('SMTP_TIMEOUT_MS')
    ? Number.parseInt(envValue('SMTP_TIMEOUT_MS'), 10)
    : 10000;

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('SMTP_TIMEOUT_MS must be a positive integer when supplied.');
  }

  return {
    host: requireEnv('SMTP_HOST'),
    port: parsePort(requireEnv('SMTP_PORT')),
    secure: parseBoolean('SMTP_SECURE', false),
    from: requireEnv('EMAIL_FROM'),
    to: requireEnv('SMTP_SMOKE_TO'),
    auth: smtpUser && smtpPassword
      ? {
          user: smtpUser,
          pass: smtpPassword
        }
      : undefined,
    timeoutMs
  };
}

async function main() {
  const smtpConfig = buildSmtpConfig();
  const generatedAt = new Date().toISOString();
  const subject = '[SMOKE] Research Topic Approval DSS SMTP provider verification';

  console.log('SMTP provider smoke verification');
  console.log(`Provider: smtp`);
  console.log(`Host: ${smtpConfig.host}`);
  console.log(`Port: ${smtpConfig.port}`);
  console.log(`Secure: ${smtpConfig.secure}`);
  console.log(`From: ${smtpConfig.from}`);
  console.log(`To: ${smtpConfig.to}`);
  console.log(`Auth configured: ${Boolean(smtpConfig.auth)}`);
  console.log('Secrets are not printed by this script.');

  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
    connectionTimeout: smtpConfig.timeoutMs,
    greetingTimeout: smtpConfig.timeoutMs,
    socketTimeout: smtpConfig.timeoutMs
  });

  const info = await transport.sendMail({
    from: smtpConfig.from,
    to: smtpConfig.to,
    subject,
    text: [
      'This is a manual SMTP provider smoke test for the Research Topic Approval DSS.',
      '',
      'Purpose: verify that the configured SMTP provider accepts one controlled test email.',
      `Generated at: ${generatedAt}`,
      '',
      'This message does not contain reset tokens, passwords, database data, or student records.'
    ].join('\n'),
    html: [
      '<p>This is a manual SMTP provider smoke test for the Research Topic Approval DSS.</p>',
      '<p><strong>Purpose:</strong> verify that the configured SMTP provider accepts one controlled test email.</p>',
      `<p><strong>Generated at:</strong> ${generatedAt}</p>`,
      '<p>This message does not contain reset tokens, passwords, database data, or student records.</p>'
    ].join('')
  });

  const acceptedCount = Array.isArray(info.accepted) ? info.accepted.length : 0;
  const rejectedCount = Array.isArray(info.rejected) ? info.rejected.length : 0;

  console.log('SMTP smoke result:');
  console.log(`Accepted recipients: ${acceptedCount}`);
  console.log(`Rejected recipients: ${rejectedCount}`);
  console.log(`Message id: ${info.messageId || 'not returned'}`);

  if (acceptedCount < 1 || rejectedCount > 0) {
    throw new Error('SMTP provider did not accept the smoke email for exactly the configured recipient set.');
  }

  console.log('SMTP smoke verification passed. Confirm recipient inbox delivery outside this script.');
}

main().catch((error) => {
  console.error(`SMTP smoke verification failed: ${error.message}`);
  process.exit(1);
});
