const {
  parseDatabaseUrl,
  redactDatabaseUrl,
  buildBackupPlan,
  buildRestorePlan,
  defaultBackupFilename,
  BackupRestoreError,
  DESTRUCTIVE_ACK_FLAG
} = require('./backupRestore');

const SOURCE_URL = 'postgresql://opsuser:TopSecretPw123@db.internal:5433/topic_similarity_v1';

describe('parseDatabaseUrl', () => {
  test('parses postgresql URLs into discrete connection fields', () => {
    expect(parseDatabaseUrl(SOURCE_URL)).toEqual({
      host: 'db.internal',
      port: '5433',
      user: 'opsuser',
      password: 'TopSecretPw123',
      database: 'topic_similarity_v1'
    });
  });

  test('fails loudly on missing or invalid configuration', () => {
    for (const bad of [undefined, '', '   ', 'mysql://u:p@h/db', 'not-a-url', 'postgresql://user:pw@host:5432/']) {
      expect(() => parseDatabaseUrl(bad)).toThrow(BackupRestoreError);
    }
    expect(() => parseDatabaseUrl('')).toThrow(/required/);
  });

  test('redacted display form never contains the password', () => {
    const redacted = redactDatabaseUrl(parseDatabaseUrl(SOURCE_URL));
    expect(redacted).toBe('postgresql://opsuser@db.internal:5433/topic_similarity_v1');
    expect(redacted).not.toContain('TopSecretPw123');
  });
});

describe('buildBackupPlan', () => {
  const fixedNow = new Date('2026-08-23T10:00:00.000Z');

  test('builds a pg_dump custom-format plan with credentials only in the child env', () => {
    const plan = buildBackupPlan({
      databaseUrl: SOURCE_URL,
      outputDir: '/backups',
      now: fixedNow,
      existsSync: () => false
    });

    expect(plan.command).toBe('pg_dump');
    expect(plan.args).toEqual(expect.arrayContaining(['--format=custom', '--no-owner', '--no-privileges', '--dbname', 'topic_similarity_v1']));
    expect(plan.env).toEqual({ PGPASSWORD: 'TopSecretPw123' });
    // The password must never be in argv or in the printable summary.
    expect(plan.args.join(' ')).not.toContain('TopSecretPw123');
    expect(JSON.stringify(plan.summary)).not.toContain('TopSecretPw123');
    expect(plan.outputPath).toContain(defaultBackupFilename('topic_similarity_v1', fixedNow));
  });

  test('refuses to overwrite an existing archive without --force', () => {
    expect(() => buildBackupPlan({
      databaseUrl: SOURCE_URL,
      outputDir: '/backups',
      now: fixedNow,
      existsSync: () => true
    })).toThrow(/--force/);

    expect(buildBackupPlan({
      databaseUrl: SOURCE_URL,
      outputDir: '/backups',
      now: fixedNow,
      force: true,
      existsSync: () => true
    }).outputPath).toBeTruthy();
  });

  test('requires explicit configuration', () => {
    expect(() => buildBackupPlan({ outputDir: '/backups' })).toThrow(BackupRestoreError);
    expect(() => buildBackupPlan({ databaseUrl: SOURCE_URL })).toThrow(/--output-dir/);
  });
});

describe('buildRestorePlan', () => {
  test('restores into scratch-named targets and keeps credentials out of argv', () => {
    const plan = buildRestorePlan({
      databaseUrl: 'postgresql://opsuser:AnotherSecret9@localhost:5432/topic_similarity_restore_drill',
      inputFile: 'backup.dump',
      existsSync: () => true
    });

    expect(plan.command).toBe('pg_restore');
    expect(plan.args).toEqual(expect.arrayContaining(['--clean', '--if-exists', '--dbname', 'topic_similarity_restore_drill']));
    expect(plan.env).toEqual({ PGPASSWORD: 'AnotherSecret9' });
    expect(plan.args.join(' ')).not.toContain('AnotherSecret9');
    expect(JSON.stringify(plan.summary)).not.toContain('AnotherSecret9');
  });

  test('refuses non-scratch targets without the explicit destructive acknowledgement', () => {
    expect(() => buildRestorePlan({
      databaseUrl: 'postgresql://u:p@h:5432/topic_similarity_production',
      inputFile: 'backup.dump',
      existsSync: () => true
    })).toThrow(/does not look like a scratch\/restore database/);

    const acknowledged = buildRestorePlan({
      databaseUrl: 'postgresql://u:p@h:5432/topic_similarity_production',
      inputFile: 'backup.dump',
      acknowledgeDestructiveTarget: true,
      existsSync: () => true
    });
    expect(acknowledged.summary.destructiveAcknowledged).toBe(true);
    expect(DESTRUCTIVE_ACK_FLAG).toMatch(/^--i-understand/);
  });

  test('requires an explicit target and an existing archive', () => {
    expect(() => buildRestorePlan({ inputFile: 'backup.dump', existsSync: () => true }))
      .toThrow(/restore target --database-url/);
    expect(() => buildRestorePlan({
      databaseUrl: 'postgresql://u:p@h:5432/scratch_db',
      existsSync: () => true
    })).toThrow(/--file/);
    expect(() => buildRestorePlan({
      databaseUrl: 'postgresql://u:p@h:5432/scratch_db',
      inputFile: 'missing.dump',
      existsSync: () => false
    })).toThrow(/not found/);
  });
});
