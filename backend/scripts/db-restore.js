#!/usr/bin/env node
/**
 * Operator logical-restore command.
 *
 * Usage (from backend/):
 *   npm run db:restore -- --file <archive.dump> --database-url <target-url> [--print-plan]
 *
 * Safety contract:
 * - the target must be named EXPLICITLY with --database-url; the command never
 *   defaults to the application's DATABASE_URL, so the running application
 *   database cannot be overwritten by omission;
 * - by default only scratch-looking target names (scratch/restore/rehearsal/
 *   drill/test/staging) are accepted. Restoring into any other database is
 *   destructive and requires the explicit acknowledgement flag
 *   --i-understand-this-overwrites-the-target-database;
 * - the connection password travels via PGPASSWORD only and is never printed;
 * - non-zero exit when pg_restore fails.
 */
const { spawnSync } = require('child_process');
const { buildRestorePlan, BackupRestoreError, DESTRUCTIVE_ACK_FLAG } = require('../src/utils/backupRestore');

function parseArgs(argv) {
  const args = { printPlan: false, acknowledgeDestructiveTarget: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--file') {
      args.inputFile = argv[index + 1];
      index += 1;
    } else if (value === '--database-url') {
      args.databaseUrl = argv[index + 1];
      index += 1;
    } else if (value === DESTRUCTIVE_ACK_FLAG) {
      args.acknowledgeDestructiveTarget = true;
    } else if (value === '--print-plan') {
      args.printPlan = true;
    } else {
      console.error(`Unknown argument: ${value}`);
      process.exit(2);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let plan;
  try {
    plan = buildRestorePlan({
      databaseUrl: args.databaseUrl,
      inputFile: args.inputFile,
      acknowledgeDestructiveTarget: args.acknowledgeDestructiveTarget
    });
  } catch (error) {
    if (error instanceof BackupRestoreError) {
      console.error(`Restore refused (${error.code}): ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  console.log('Logical restore plan:');
  console.log(`  Archive: ${plan.summary.inputPath}`);
  console.log(`  Target:  ${plan.summary.target}`);
  console.log(`  Destructive acknowledgement: ${plan.summary.destructiveAcknowledged}`);
  console.log('  Credentials are supplied to pg_restore via PGPASSWORD and are not printed.');

  if (args.printPlan) {
    console.log(`  Command: ${plan.command} ${plan.args.join(' ')}`);
    console.log('Plan only; nothing was executed.');
    return;
  }

  const result = spawnSync(plan.command, plan.args, {
    stdio: 'inherit',
    env: { ...process.env, ...plan.env }
  });

  if (result.error) {
    console.error(`Restore failed: could not run ${plan.command} (${result.error.message}). Install the PostgreSQL client tools.`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Restore failed: ${plan.command} exited with status ${result.status}.`);
    process.exit(result.status || 1);
  }

  console.log('Restore completed. Now verify: prisma migrate status, application readiness, and integrity checks per the restore runbook.');
}

main();
