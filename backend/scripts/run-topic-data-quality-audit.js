const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const prisma = require('../src/config/database');
const {
  runTopicDataQualityAudit
} = require('../src/services/topicDataQualityAudit.service');

const repoRoot = path.join(__dirname, '..', '..');
const backendRoot = path.join(__dirname, '..');
const resultsDir = path.join(backendRoot, 'evaluation', 'results');
const jsonReportPath = path.join(resultsDir, 'topic-data-quality-audit.json');
const markdownReportPath = path.join(repoRoot, 'docs', 'testing', 'topic-data-quality-report.md');

function parseArgs(argv) {
  const args = {
    fixture: null
  };

  argv.forEach((arg, index) => {
    if (arg === '--fixture') {
      args.fixture = argv[index + 1];
    }
  });

  return args;
}

function resolveInputPath(inputPath) {
  if (!inputPath) {
    return null;
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.join(backendRoot, inputPath);
}

function getCommitHash() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim();
  } catch (error) {
    try {
      const gitHeadPath = path.join(repoRoot, '.git', 'HEAD');
      const head = fs.readFileSync(gitHeadPath, 'utf8').trim();
      if (head.startsWith('ref:')) {
        const refPath = head.replace('ref:', '').trim();
        return fs.readFileSync(path.join(repoRoot, '.git', refPath), 'utf8').trim().slice(0, 7);
      }
      return head.slice(0, 7);
    } catch (readError) {
      return 'unknown';
    }
  }
}

function ensureOutputDirectories() {
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.mkdirSync(path.dirname(markdownReportPath), { recursive: true });
}

function loadFixture(fixturePath) {
  const resolvedPath = resolveInputPath(fixturePath);
  return {
    resolvedPath,
    recordsByLifecycle: JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  };
}

function renderLifecycleTable(report) {
  const rows = [
    '| Lifecycle | Total | Blank Title | Missing Category | Missing Session | Missing Supervisor | Incomplete Context | With Embeddings | Without Embeddings | Import Warnings |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];

  Object.entries(report.byLifecycle).forEach(([lifecycle, summary]) => {
    rows.push(`| ${lifecycle} | ${summary.total} | ${summary.blankTitle} | ${summary.missingCategory} | ${summary.missingSessionYear} | ${summary.missingSupervisorName} | ${summary.incompleteContext} | ${summary.withEmbeddings} | ${summary.withoutEmbeddings} | ${summary.withImportWarnings} |`);
  });

  return rows.join('\n');
}

function renderGroupedCounts(items, fieldName) {
  if (!items.length) {
    return '- None';
  }

  return items
    .map(item => `- ${item[fieldName]}: ${item.count}`)
    .join('\n');
}

function renderMarkdownReport(report) {
  return `# Topic Data Quality Report

Generated: ${report.generatedAt}

Commit: \`${report.commitHash}\`

Mode: ${report.mode}

Fixture path: ${report.fixturePath ? `\`${report.fixturePath}\`` : 'not used'}

## Safety

- Read-only: ${report.dataSafety.readOnly}
- Mutates database: ${report.dataSafety.mutatesDatabase}
- Raw titles included: ${report.dataSafety.rawTitlesIncluded}
- Duplicate title values hashed: ${report.dataSafety.duplicateTitlesHashed}

## Totals

- Total topic records inspected: ${report.totals.total}
- Blank titles: ${report.totals.blankTitle}
- Missing categories: ${report.totals.missingCategory}
- Missing session years: ${report.totals.missingSessionYear}
- Missing supervisors: ${report.totals.missingSupervisorName}
- Missing keywords: ${report.totals.missingKeywords}
- Incomplete context records: ${report.totals.incompleteContext}
- With embeddings: ${report.totals.withEmbeddings}
- Without embeddings: ${report.totals.withoutEmbeddings}
- With import warnings: ${report.totals.withImportWarnings}

Scope note:

- This is a ${report.mode} snapshot of the connected local database or fixture input.
- It does not represent the complete departmental repository.
- Departmental-scale data quality remains NOT YET VERIFIED.
- No broad data-quality conclusion should be drawn from ${report.totals.total} inspected records.

## By Lifecycle

${renderLifecycleTable(report)}

## Grouped Counts

Source type:

${renderGroupedCounts(report.groupedCounts.sourceType, 'sourceType')}

Import batch:

${renderGroupedCounts(report.groupedCounts.importBatchId, 'importBatchId')}

## Duplicate Title Candidates

- Candidate groups: ${report.duplicateTitleCandidates.totalCandidateGroups}
- Within-lifecycle groups: ${report.duplicateTitleCandidates.withinLifecycleGroups}
- Across-lifecycle groups: ${report.duplicateTitleCandidates.acrossLifecycleGroups}

Candidate details are stored with hashed normalized titles and lifecycle/id references only in the JSON artifact.

## Limitations

${report.limitations.map(limitation => `- ${limitation}`).join('\n')}

## Reproduction

\`\`\`powershell
cd backend
npm run audit:data-quality
\`\`\`

If a safe local database is unavailable:

\`\`\`powershell
cd backend
npm run audit:data-quality -- --fixture evaluation/fixtures/topic-data-quality-fixture.json
\`\`\`

JSON artifact: \`${path.relative(repoRoot, jsonReportPath).replace(/\\/g, '/')}\`
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let mode = 'database';
  let fixturePath = null;
  let report;

  if (args.fixture) {
    const fixture = loadFixture(args.fixture);
    mode = 'fixture';
    fixturePath = path.relative(repoRoot, fixture.resolvedPath).replace(/\\/g, '/');
    report = await runTopicDataQualityAudit({
      recordsByLifecycle: fixture.recordsByLifecycle,
      mode
    });
  } else {
    report = await runTopicDataQualityAudit({
      mode
    });
  }

  const finalReport = {
    ...report,
    generatedAt: report.generatedAt,
    commitHash: getCommitHash(),
    fixturePath,
    reproduction: {
      command: args.fixture
        ? `cd backend && npm run audit:data-quality -- --fixture ${args.fixture}`
        : 'cd backend && npm run audit:data-quality',
      jsonReportPath: path.relative(repoRoot, jsonReportPath).replace(/\\/g, '/'),
      markdownReportPath: path.relative(repoRoot, markdownReportPath).replace(/\\/g, '/')
    }
  };

  ensureOutputDirectories();
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(finalReport, null, 2)}\n`);
  fs.writeFileSync(markdownReportPath, renderMarkdownReport(finalReport));

  console.log(JSON.stringify({
    success: true,
    mode: finalReport.mode,
    jsonReportPath: finalReport.reproduction.jsonReportPath,
    markdownReportPath: finalReport.reproduction.markdownReportPath,
    totalRecords: finalReport.totals.total,
    duplicateCandidateGroups: finalReport.duplicateTitleCandidates.totalCandidateGroups
  }, null, 2));
}

main()
  .catch(error => {
    console.error('Topic data-quality audit failed.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });
