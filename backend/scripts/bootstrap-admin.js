#!/usr/bin/env node
/**
 * Production first-administrator bootstrap.
 *
 * Usage (from backend/):
 *   npm run bootstrap:admin -- --email admin@department.example --name "Departmental Administrator"
 *
 * Properties:
 * - Operator-invoked only; never runs at application startup.
 * - No hardcoded or default password: a cryptographically secure temporary
 *   password is generated, displayed exactly once, and stored only as a
 *   bcrypt hash with the same hashing contract as normal authentication.
 * - Idempotent: re-running with the same email reports the existing
 *   administrator and issues no new credential; conflicting state (another
 *   administrator, or the email owned by a non-admin account) is refused.
 * - The created account is marked mustChangePassword, so the temporary
 *   credential cannot be used for normal application access; the
 *   administrator must establish a private password at first login.
 * - Creates no demo users and prints no secrets other than the one-time
 *   credential itself.
 */

const { bootstrapFirstAdmin } = require('../src/services/userProvisioning.service');
const prisma = require('../src/config/database');

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

async function main() {
  const { email, name } = parseArgs(process.argv.slice(2));

  if (!email || !name) {
    console.error('Usage: npm run bootstrap:admin -- --email <admin-email> --name "<admin name>"');
    console.error('Creates the first administrator on a clean production database.');
    process.exitCode = 1;
    return;
  }

  const result = await bootstrapFirstAdmin({ email, name });

  if (result.status === 'conflict') {
    console.error(`REFUSED: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  if (result.status === 'already-bootstrapped') {
    console.log(`Bootstrap already complete: administrator ${result.user.email} exists.`);
    console.log('No new credential was issued. Use the forgot-password flow or an existing session to manage this account.');
    return;
  }

  for (const warning of result.warnings || []) {
    console.warn(`WARNING: ${warning}`);
  }

  console.log('First administrator created.');
  console.log('');
  console.log(`  Email:              ${result.user.email}`);
  console.log(`  Name:               ${result.user.name}`);
  console.log(`  Temporary password: ${result.temporaryPassword}`);
  console.log('');
  console.log('This temporary password is displayed ONCE and is not stored anywhere in plaintext.');
  console.log('Transfer it to the administrator through a secure channel (never email/chat in plaintext).');
  console.log('The administrator must sign in and establish a new private password before any other access is allowed.');
}

main()
  .catch((error) => {
    console.error(`Bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
