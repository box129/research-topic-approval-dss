#!/usr/bin/env node
/**
 * Operator logical-backup command.
 *
 * Usage (from backend/):
 *   npm run db:backup -- --output-dir <directory> [--database-url <url>] [--force] [--print-plan]
 *
 * Contract:
 * - the source is --database-url, or BACKUP_DATABASE_URL, or DATABASE_URL;
 *   missing configuration fails loudly instead of guessing;
 * - output is a timestamped pg_dump custom-format archive in an explicit
 *   directory; an existing file is never overwritten without --force;
 * - the connection password is passed to pg_dump via PGPASSWORD only and is
 *   never printed or placed in argv;
 * - non-zero exit when pg_dump fails; --print-plan shows the redacted plan
 *   without executing anything.
 */
const fs = require('fs');
const { spawnSync } = require('child_process');
const { buildBackupPlan, BackupRestoreError } = require('../src/utils/backupRestore');

function parseArgs(argv) {
  const args = { force: false, printPlan: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--output-dir') {
      args.outputDir = argv[index + 1];
      index += 1;
    } else if (value === '--database-url') {
      args.databaseUrl = argv[index + 1];
      index += 1;
    } else if (value === '--force') {
      args.force = true;
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
  const databaseUrl = args.databaseUrl || process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;

  let plan;
  try {
    plan = buildBackupPlan({
      databaseUrl,
      outputDir: args.outputDir,
      force: args.force
    });
  } catch (error) {
    if (error instanceof BackupRestoreError) {
      console.error(`Backup refused (${error.code}): ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  console.log('Logical backup plan:');
  console.log(`  Source:  ${plan.summary.source}`);
  console.log(`  Output:  ${plan.summary.outputPath}`);
  console.log(`  Format:  ${plan.summary.format}`);
  console.log('  Credentials are supplied to pg_dump via PGPASSWORD and are not printed.');

  if (args.printPlan) {
    console.log(`  Command: ${plan.command} ${plan.args.join(' ')}`);
    console.log('Plan only; nothing was executed.');
    return;
  }

  fs.mkdirSync(require('path').dirname(plan.outputPath), { recursive: true });

  const result = spawnSync(plan.command, plan.args, {
    stdio: 'inherit',
    env: { ...process.env, ...plan.env }
  });

  if (result.error) {
    console.error(`Backup failed: could not run ${plan.command} (${result.error.message}). Install the PostgreSQL client tools.`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Backup failed: ${plan.command} exited with status ${result.status}.`);
    process.exit(result.status || 1);
  }

  const size = fs.existsSync(plan.outputPath) ? fs.statSync(plan.outputPath).size : 0;
  if (size < 1) {
    console.error('Backup failed: the archive file is missing or empty.');
    process.exit(1);
  }

  console.log(`Backup completed: ${plan.outputPath} (${size} bytes).`);
  console.log('Store the archive outside the application host with restricted access; it contains the full database.');
}

main();
