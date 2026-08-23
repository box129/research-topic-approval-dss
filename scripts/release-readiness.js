#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');
const sbertDir = path.join(root, 'sbert-service');
const generatedEvidencePaths = [
  path.join(root, 'backend', 'evaluation', 'results', 'topic-similarity-evaluation.json'),
  path.join(root, 'backend', 'evaluation', 'results', 'topic-data-quality-audit.json'),
  path.join(root, 'docs', 'testing', 'topic-similarity-evaluation-report.md'),
  path.join(root, 'docs', 'testing', 'topic-data-quality-report.md')
];

const isWindows = process.platform === 'win32';
const allowDirty = process.env.RELEASE_CHECK_ALLOW_DIRTY === '1';
const runSmoke = process.env.RELEASE_CHECK_SMOKE === '1';
const runLegacySbert = process.env.RELEASE_CHECK_LEGACY_SBERT === '1';
const prismaCli = path.join(backendDir, 'node_modules', '.bin', isWindows ? 'prisma.cmd' : 'prisma');

const results = [];

function commandName(command) {
  return command;
}

function quoteForShell(value) {
  const text = String(value);
  if (!/["\s]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

function commandLine(command, args = []) {
  return [commandName(command), ...args].map(quoteForShell).join(' ');
}

function snapshotFiles(paths) {
  return paths.map((filePath) => ({
    filePath,
    exists: fs.existsSync(filePath),
    content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
  }));
}

function restoreSnapshot(snapshot) {
  snapshot.forEach((entry) => {
    if (entry.exists) {
      fs.writeFileSync(entry.filePath, entry.content, 'utf8');
    } else if (fs.existsSync(entry.filePath)) {
      fs.rmSync(entry.filePath);
    }
  });
}

function run(label, command, args = [], options = {}) {
  console.log(`\n=== ${label} ===`);
  const line = commandLine(command, args);
  console.log(`$ ${line}`);
  const snapshot = options.preserveGeneratedEvidence ? snapshotFiles(generatedEvidencePaths) : null;

  const result = spawnSync(line, {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    stdio: 'inherit',
    shell: true
  });

  if (snapshot) {
    restoreSnapshot(snapshot);
    console.log('Generated evaluation/data-quality evidence restored to its pre-run state.');
  }

  const status = result.status === 0 ? 'passed' : 'failed';
  results.push({ label, status, required: options.required !== false });

  if (result.status !== 0 && options.required !== false) {
    console.error(`FAILED (REQUIRED) - ${label}`);
    console.error(`\nRelease readiness failed during: ${label}`);
    process.exit(result.status || 1);
  }

  return result.status === 0;
}

function runCapture(label, command, args = [], options = {}) {
  const result = spawnSync(commandLine(command, args), {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    shell: true
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const status = result.status === 0 ? 'passed' : 'failed';
  results.push({ label, status, required: options.required !== false });

  if (result.status !== 0 && options.required !== false) {
    console.error(`FAILED (REQUIRED) - ${label}`);
    console.error(`\nRelease readiness failed during: ${label}`);
    process.exit(result.status || 1);
  }

  return result;
}

function findPython() {
  if (process.env.SBERT_PYTHON) {
    return process.env.SBERT_PYTHON;
  }

  const venvPython = isWindows
    ? path.join(sbertDir, 'venv', 'Scripts', 'python.exe')
    : path.join(sbertDir, 'venv', 'bin', 'python');

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  return 'python';
}

function checkGitState() {
  const result = spawnSync(commandLine('git', ['status', '--short']), {
    cwd: root,
    encoding: 'utf8',
    shell: true
  });

  if (result.status !== 0) {
    console.error(result.stderr || 'Unable to inspect git status.');
    process.exit(result.status || 1);
  }

  const status = result.stdout.trim();
  if (status && !allowDirty) {
    console.error('FAILED (REQUIRED) - Git state');
    console.error('Tracked worktree changes are present. Set RELEASE_CHECK_ALLOW_DIRTY=1 while validating an uncommitted PR.');
    console.error(status);
    process.exit(1);
  }

  results.push({
    label: allowDirty ? 'Git state (dirty allowed)' : 'Git state',
    status: status ? 'passed-with-expected-dirty-state' : 'passed',
    required: true
  });
}

function checkDockerAvailability() {
  const result = spawnSync(commandLine('docker', ['--version']), {
    cwd: root,
    encoding: 'utf8',
    shell: true
  });

  console.log('\n=== Docker/Compose verification ===');
  if (result.status === 0) {
    console.log((result.stdout || '').trim());
    const daemon = spawnSync(commandLine('docker', ['info']), {
      cwd: root,
      encoding: 'utf8',
      shell: true
    });

    if (daemon.status !== 0) {
      const reason = (daemon.stderr || daemon.stdout || 'Docker daemon is unavailable.').trim();
      console.log(`IMAGE BUILD NOT VERIFIED. Docker daemon is unavailable: ${reason}`);
      results.push({ label: 'Docker/Compose verification', status: 'skipped-daemon-unavailable', required: false });
      return;
    }

    console.log('IMAGE BUILD NOT VERIFIED. Docker daemon is available, but this release gate intentionally skips image build/run. Run docker compose config/build/up and npm run docker:smoke for PR-level container validation.');
    results.push({ label: 'Docker/Compose verification', status: 'skipped-manual-pr-check-required', required: false });
    return;
  }

  console.log('IMAGE BUILD NOT VERIFIED. Docker CLI is unavailable in this shell.');
  results.push({ label: 'Docker/Compose verification', status: 'skipped-not-verified', required: false });
}

function missingSmokeCredentials() {
  return [
    'SMOKE_STUDENT_EMAIL',
    'SMOKE_STUDENT_PASSWORD',
    'SMOKE_LECTURER_EMAIL',
    'SMOKE_LECTURER_PASSWORD',
    'SMOKE_ADMIN_EMAIL',
    'SMOKE_ADMIN_PASSWORD'
  ].filter((key) => !process.env[key]);
}

function main() {
  console.log('Topic Similarity MVP release readiness gate');
  console.log(`Repository: ${root}`);
  console.log(`Dirty worktree allowed: ${allowDirty ? 'yes' : 'no'}`);
  console.log(`Credentialed smoke enabled: ${runSmoke ? 'yes' : 'no'}`);
  console.log(`Legacy SBERT evaluation enabled: ${runLegacySbert ? 'yes' : 'no'}`);

  checkGitState();

  run('Node version', 'node', ['--version']);
  run('npm version', 'npm', ['--version']);
  run('Backend dependency tree available', 'npm', ['--prefix', 'backend', 'ls', '--depth=0']);
  run('Prisma schema validation', prismaCli, ['validate'], { cwd: backendDir });
  run('Prisma migration status', prismaCli, ['migrate', 'status'], { cwd: backendDir });
  run('Backend test suite', 'npm', ['test', '--', '--runInBand'], { cwd: backendDir });

  if (runLegacySbert) {
    const python = findPython();
    run('Legacy SBERT quick test', python, ['quick_test.py'], { cwd: sbertDir });
    run('Legacy SBERT service test', python, ['test_service.py'], {
      cwd: sbertDir,
      env: { PYTHONIOENCODING: 'utf-8' }
    });
    run('Legacy SBERT topic evaluation', 'npm', ['run', 'evaluate:topics'], {
      cwd: backendDir,
      preserveGeneratedEvidence: true
    });
  } else {
    results.push({ label: 'Legacy SBERT research checks', status: 'skipped', required: false });
    console.log('\n=== Legacy SBERT research checks ===');
    console.log('Skipped. Set RELEASE_CHECK_LEGACY_SBERT=1 to run the historical Python/SBERT evaluation suite.');
  }

  run('Data-quality audit', 'npm', ['run', 'audit:data-quality'], {
    cwd: backendDir,
    preserveGeneratedEvidence: true
  });

  run('Frontend build', 'npm', ['run', 'build'], { cwd: frontendDir });
  run('Frontend test suite', 'npm', ['test', '--', '--run', '--maxWorkers=1', '--minWorkers=1'], { cwd: frontendDir });
  run('Deployment contract verification', 'npm', ['run', 'verify:deployment-contract']);

  if (runSmoke) {
    const missing = missingSmokeCredentials();
    if (missing.length > 0) {
      console.error(`FAILED (REQUIRED) - Credentialed frontend smoke. Missing smoke credentials: ${missing.join(', ')}`);
      process.exit(1);
    }
    run('Credentialed frontend smoke', 'npm', ['run', 'smoke:figma-ui'], { cwd: frontendDir });
  } else {
    results.push({ label: 'Credentialed frontend smoke', status: 'skipped', required: false });
    console.log('\n=== Credentialed frontend smoke ===');
    console.log('Skipped. Set RELEASE_CHECK_SMOKE=1 and provide SMOKE_* credentials to include it.');
  }

  checkDockerAvailability();

  run('Whitespace diff check', 'git', ['diff', '--check']);
  runCapture('Diff stat', 'git', ['diff', '--stat'], { required: false });
  runCapture('Diff name-only', 'git', ['diff', '--name-only'], { required: false });

  console.log('\n=== Release readiness summary ===');
  results.forEach((result) => {
    const requirement = result.required ? 'REQUIRED' : 'OPTIONAL';
    const status = result.status.toUpperCase();
    console.log(`${status} (${requirement}) - ${result.label}`);
  });
}

main();
