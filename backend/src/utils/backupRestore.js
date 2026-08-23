const fs = require('fs');
const path = require('path');

// Vendor-neutral logical backup/restore planning for the operator scripts.
// These helpers only construct pg_dump/pg_restore invocations and enforce the
// safety contract; they never execute anything themselves, which keeps every
// guard unit-testable without a database.
//
// Safety contract:
// - connection credentials travel via PGPASSWORD in the child environment,
//   never inside argv (argv is visible in process listings) and never in any
//   printed summary;
// - backups refuse to overwrite an existing file unless --force is given;
// - restores must name their target explicitly, and the target database name
//   must look like a scratch/restore database unless the operator passes the
//   explicit destructive acknowledgement flag. There is no casually
//   executable production-overwrite command.

const BACKUP_FILE_PREFIX = 'rtadss-backup';
// Database names that are safe default restore targets. Anything else is
// treated as potentially production and requires the acknowledgement flag.
const SCRATCH_TARGET_PATTERN = /(scratch|restore|rehearsal|drill|test|staging)/i;
const DESTRUCTIVE_ACK_FLAG = '--i-understand-this-overwrites-the-target-database';

class BackupRestoreError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BackupRestoreError';
    this.code = code;
  }
}

function parseDatabaseUrl(value, { label = 'DATABASE_URL' } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new BackupRestoreError(`${label} is required and was not provided.`, 'MISSING_DATABASE_URL');
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BackupRestoreError(`${label} is not a valid connection URL.`, 'INVALID_DATABASE_URL');
  }

  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new BackupRestoreError(`${label} must be a postgresql:// connection URL.`, 'INVALID_DATABASE_URL');
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database) {
    throw new BackupRestoreError(`${label} must include a database name.`, 'INVALID_DATABASE_URL');
  }

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database
  };
}

// Safe display form: identifies the target without the password.
function redactDatabaseUrl(connection) {
  const userPart = connection.user ? `${connection.user}@` : '';
  return `postgresql://${userPart}${connection.host}:${connection.port}/${connection.database}`;
}

function defaultBackupFilename(database, at = new Date()) {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
  return `${BACKUP_FILE_PREFIX}-${database}-${stamp}.dump`;
}

/**
 * Plans a pg_dump logical backup (custom format, compressed by default,
 * owner/privilege-neutral so it restores across differently named roles).
 */
function buildBackupPlan({
  databaseUrl,
  outputDir,
  force = false,
  now = new Date(),
  existsSync = fs.existsSync
} = {}) {
  const connection = parseDatabaseUrl(databaseUrl);

  const directory = String(outputDir || '').trim();
  if (!directory) {
    throw new BackupRestoreError('An explicit --output-dir is required.', 'MISSING_OUTPUT_DIR');
  }

  const outputPath = path.resolve(directory, defaultBackupFilename(connection.database, now));
  if (!force && existsSync(outputPath)) {
    throw new BackupRestoreError(
      `Backup file already exists: ${outputPath}. Re-run with --force only if overwriting it is deliberate.`,
      'BACKUP_FILE_EXISTS'
    );
  }

  return {
    command: 'pg_dump',
    args: [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--host', connection.host,
      '--port', connection.port,
      ...(connection.user ? ['--username', connection.user] : []),
      '--dbname', connection.database,
      '--file', outputPath
    ],
    // Password reaches the client tool through the environment only.
    env: connection.password ? { PGPASSWORD: connection.password } : {},
    outputPath,
    summary: {
      action: 'backup',
      source: redactDatabaseUrl(connection),
      outputPath,
      format: 'pg_dump custom (compressed)'
    }
  };
}

/**
 * Plans a pg_restore into an explicitly named target. The default contract
 * only accepts scratch-looking database names; restoring into anything else
 * requires the explicit destructive acknowledgement flag.
 */
function buildRestorePlan({
  databaseUrl,
  inputFile,
  acknowledgeDestructiveTarget = false,
  existsSync = fs.existsSync
} = {}) {
  const connection = parseDatabaseUrl(databaseUrl, { label: 'restore target --database-url' });

  const file = String(inputFile || '').trim();
  if (!file) {
    throw new BackupRestoreError('An explicit --file backup archive is required.', 'MISSING_INPUT_FILE');
  }
  const inputPath = path.resolve(file);
  if (!existsSync(inputPath)) {
    throw new BackupRestoreError(`Backup archive not found: ${inputPath}`, 'INPUT_FILE_NOT_FOUND');
  }

  if (!SCRATCH_TARGET_PATTERN.test(connection.database) && !acknowledgeDestructiveTarget) {
    throw new BackupRestoreError(
      `Refusing to restore into "${connection.database}": the target database name does not look like a scratch/restore database. `
      + `Restores are destructive to the target. If this is genuinely intended, re-run with ${DESTRUCTIVE_ACK_FLAG}.`,
      'RESTORE_TARGET_NOT_SCRATCH'
    );
  }

  return {
    command: 'pg_restore',
    args: [
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      '--host', connection.host,
      '--port', connection.port,
      ...(connection.user ? ['--username', connection.user] : []),
      '--dbname', connection.database,
      inputPath
    ],
    env: connection.password ? { PGPASSWORD: connection.password } : {},
    summary: {
      action: 'restore',
      target: redactDatabaseUrl(connection),
      inputPath,
      destructiveAcknowledged: Boolean(acknowledgeDestructiveTarget)
    }
  };
}

module.exports = {
  BackupRestoreError,
  parseDatabaseUrl,
  redactDatabaseUrl,
  defaultBackupFilename,
  buildBackupPlan,
  buildRestorePlan,
  SCRATCH_TARGET_PATTERN,
  DESTRUCTIVE_ACK_FLAG,
  BACKUP_FILE_PREFIX
};
