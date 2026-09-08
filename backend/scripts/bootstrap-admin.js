#!/usr/bin/env node
/**
 * Production first-administrator bootstrap.
 *
 * Usage (from backend/):
 *   npm run bootstrap:admin -- --email admin@department.example --name "Departmental Administrator"
 *
 * Properties:
 * - Operator-invoked only; never runs at application startup.
 * - No credential is ever displayed, printed, or logged: the first
 *   administrator receives an emailed activation link (the existing
 *   invitation acceptance flow) and chooses a private password the operator
 *   never learns. The account is created with an unrevealed random
 *   placeholder hash that activation replaces.
 * - Requires configured SMTP before creating anything, because activation is
 *   delivered by email; if delivery later fails, rerunning this same command
 *   rotates the activation link and retries — a failed email can never strand
 *   the first administrator.
 * - Idempotent: once the administrator has completed activation, re-running
 *   reports that bootstrap is complete and issues nothing new. Conflicting
 *   state (another administrator, or the email owned by a non-admin account)
 *   is refused.
 * - Prints only safe status information. Never prints passwords, activation
 *   tokens, or activation links.
 */

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--email') {
      args.email = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--name') {
      args.name = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

const ACTIVATION_NEXT_STEP = 'The administrator must use the emailed activation link to establish a private password.';

async function main({
  argv = process.argv.slice(2),
  provisioning = require('../src/services/userProvisioning.service'),
  out = console
} = {}) {
  const { email, name } = parseArgs(argv);

  if (!email || !name) {
    out.error('Usage: npm run bootstrap:admin -- --email <admin-email> --name "<admin name>"');
    out.error('Creates the first administrator on a clean production database.');
    return 1;
  }

  const result = await provisioning.bootstrapFirstAdmin({ email, name });

  for (const warning of result.warnings || []) {
    out.warn(`WARNING: ${warning}`);
  }

  switch (result.status) {
    case 'conflict':
    case 'email-unavailable':
      out.error(`REFUSED: ${result.message}`);
      return 1;

    case 'already-bootstrapped':
      out.log(`Bootstrap already complete: administrator ${result.user.email} exists and has activated their account.`);
      out.log('No new activation was issued. Use the forgot-password flow or an existing session to manage this account.');
      return 0;

    case 'activation-resent':
      out.log('Administrator account already exists but activation is incomplete.');
      out.log('A new activation email was sent; any previous activation link is no longer valid.');
      out.log(ACTIVATION_NEXT_STEP);
      return 0;

    case 'activation-delivery-failed':
      out.error(result.created
        ? 'First administrator account was created, but the activation email could not be delivered.'
        : 'Administrator account exists, but the activation email could not be delivered.');
      out.error(`Reason: ${result.reasonCode}`);
      out.error('No usable credential was disclosed. Correct SMTP/delivery configuration and rerun this same bootstrap command to send a new activation email.');
      return 1;

    case 'created-activation-sent':
      out.log('First administrator created.');
      out.log('');
      out.log(`  Email: ${result.user.email}`);
      out.log(`  Name:  ${result.user.name}`);
      out.log('');
      out.log('Activation email sent.');
      out.log(ACTIVATION_NEXT_STEP);
      out.log('No credential was generated for the operator, and none is printed or logged.');
      return 0;

    default:
      out.error(`Unexpected bootstrap outcome: ${result.status}`);
      return 1;
  }
}

if (require.main === module) {
  const prisma = require('../src/config/database');
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(`Bootstrap failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main, parseArgs };
