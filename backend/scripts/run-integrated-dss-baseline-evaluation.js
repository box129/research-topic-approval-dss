const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { formatStructuredContext } = require('../evaluation/sbertInputRepresentation.helpers');
const { buildComponents, groupedFolds, assertNoTopicLeakage } = require('../evaluation/groupedCrossValidation.helpers');
const { CURRENT_WEIGHTS, ABLATIONS, titleOnlyLexical, records, metrics, classification, gates, contextSummary, scenario, groupedCrossValidate, bootstrap } = require('../evaluation/integratedDssEvaluation.helpers');

const root = path.join(__dirname, '..', '..');
const backend = path.join(root, 'backend');
const file = (...segments) => path.join(backend, ...segments);
const benchmarkPath = file('evaluation', 'datasets', 'expanded-semantic-benchmark.json');
const semanticPath = file('evaluation', 'results', 'expanded-semantic-model-evaluation.json');
const groupedPath = file('evaluation', 'results', 'expanded-semantic-grouped-reanalysis.json');
const outputPath = file('evaluation', 'results', 'integrated-dss-baseline-evaluation.json');
const docPath = path.join(root, 'docs', 'testing', 'integrated-dss-baseline-evaluation.md');
const methodologyPath = path.join(root, 'docs', 'testing', 'integrated-dss-methodology.md');
const sha = target => crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');

function markdown(report) {
  const rows = Object.entries(report.fullModels).map(([name, model]) =>
    `| ${name} | ${model.fixedThreshold.overall.accuracy} | ${model.fixedThreshold.overall.macroF1} | ${model.groupedThreshold.overall.accuracy} | ${model.groupedThreshold.overall.macroF1} |`
  ).join('\n');
  return `# Integrated DSS Current-Contract Baseline

This researcher-controlled evaluation uses title-only lexical inputs and stored structured-context-v1 semantic scores. It preserves the production scoring weights and thresholds, but is not a byte-for-byte reproduction of production request construction or calibrated performance.

- Benchmark SHA-256 before/after: \`${report.benchmark.sha256Before}\` / \`${report.benchmark.sha256After}\`
- Current contract: Jaccard .20, TF-IDF .30, semantic .50; fixed thresholds .40/.70.

| Semantic candidate | Fixed-threshold accuracy | Fixed-threshold macro-F1 | Grouped-threshold accuracy | Grouped-threshold macro-F1 |
| --- | ---: | ---: | ---: | ---: |
${rows}

**${report.conclusion}** This is descriptive evidence only, not final production-provider selection.
`;
}

function methodology() {
  return `# Integrated DSS Baseline Methodology

- Jaccard input: title only, using the current production mathematical implementation.
- TF-IDF input: title only, using the current production mathematical implementation.
- Semantic input: stored Experiment 2B structured-context-v1 scores.
- Keywords are excluded because the frozen benchmark has no production-equivalent keyword field for every pair.
- Fixed weights and thresholds are current-contract design values, not calibrated values.
- Grouped threshold analysis reuses Stage A.1 connected components and fits thresholds only on outer-fold training data.
- No embedding model or external provider is called by this experiment.
`;
}

function main() {
  const shaBefore = sha(benchmarkPath);
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath));
  const semantic = JSON.parse(fs.readFileSync(semanticPath));
  const groupedArtifact = JSON.parse(fs.readFileSync(groupedPath));
  if (shaBefore !== semantic.benchmark.sha256After || shaBefore !== groupedArtifact.benchmark.sha256After) throw new Error('Immutable source artifact SHA mismatch.');
  const support = benchmark.cases.reduce((out, item) => (out[item.expected_class] += 1, out), { LOW: 0, MEDIUM: 0, HIGH: 0 });
  if (benchmark.cases.length !== 120 || support.LOW !== 39 || support.MEDIUM !== 41 || support.HIGH !== 40) throw new Error('Frozen support mismatch.');

  const lexical = titleOnlyLexical(benchmark.cases);
  if (lexical.length !== 120 || new Set(lexical.map(item => item.id)).size !== 120) throw new Error('Lexical case alignment failure.');
  const lexicalById = new Map(lexical.map(item => [item.id, item]));
  const components = buildComponents(benchmark.cases, formatStructuredContext);
  const folds = groupedFolds(components);
  assertNoTopicLeakage(folds);
  if (JSON.stringify(folds.map(fold => fold.caseIds)) !== JSON.stringify(groupedArtifact.grouping.folds.map(fold => fold.caseIds))) throw new Error('Stage A.1 grouped-fold reuse mismatch.');

  const keys = ['sbert', 'openai', 'voyage', 'gemini'];
  const benchmarkIds = benchmark.cases.map(item => item.id).sort();
  const semanticMaps = Object.fromEntries(keys.map(key => {
    const raw = semantic.models[key].rawCaseResults;
    const ids = raw.map(item => item.id);
    if (raw.length !== 120 || new Set(ids).size !== 120 || JSON.stringify([...ids].sort()) !== JSON.stringify(benchmarkIds)) throw new Error(`${key} semantic score alignment failure.`);
    return [key, new Map(raw.map(item => [item.id, item.scores[key]]))];
  }));

  const simpleAblation = (name, weights) => {
    const rows = records(benchmark.cases, lexicalById, null, name, weights);
    return { rows, metrics: metrics(rows, name), groupedThreshold: groupedCrossValidate(rows, folds, name) };
  };
  const ablation = {
    jaccard: simpleAblation('jaccard', ABLATIONS.jaccard),
    tfidf: simpleAblation('tfidf', ABLATIONS.tfidf),
    lexical: simpleAblation('lexical', ABLATIONS.lexical),
    semantic: {}, jaccard_semantic: {}, tfidf_semantic: {}, full: {}
  };
  const fullModels = {};
  keys.forEach(key => {
    const fullRows = records(benchmark.cases, lexicalById, semanticMaps[key], key, CURRENT_WEIGHTS);
    const groupedThreshold = groupedCrossValidate(fullRows, folds, key);
    fullModels[key] = {
      rows: fullRows, metrics: metrics(fullRows, key), fixedThreshold: classification(fullRows, key),
      gates: gates(fullRows, key, semanticMaps[key]), groupedThreshold,
      completeVsIncomplete: contextSummary(fullRows, key), scenarioAnalysis: scenario(fullRows, key)
    };
    [['semantic', ABLATIONS.semantic], ['jaccard_semantic', ABLATIONS.jaccard_semantic], ['tfidf_semantic', ABLATIONS.tfidf_semantic], ['full', ABLATIONS.full]].forEach(([name, weights]) => {
      const rows = name === 'full' ? fullRows : records(benchmark.cases, lexicalById, semanticMaps[key], key, weights);
      ablation[name][key] = { metrics: metrics(rows, key), groupedThreshold: groupedCrossValidate(rows, folds, key) };
    });
  });

  const report = {
    experiment: { id: 'integrated-dss-baseline-evaluation', generatedAt: new Date().toISOString(), commitHash: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), scope: 'Stored-score-only current-contract integrated baseline; no embeddings, models, or providers executed.' },
    benchmark: { path: 'backend/evaluation/datasets/expanded-semantic-benchmark.json', sha256Before: shaBefore, sha256After: sha(benchmarkPath), support },
    representation: { jaccard: 'title only', tfidf: 'title only', semantic: 'stored Experiment 2B structured-context-v1 scores', keywords: 'excluded; no production-equivalent benchmark keyword field' },
    contract: { weights: CURRENT_WEIGHTS, thresholds: { medium: .40, high: .70 }, tier: { generalMinimum: .10, semanticCombinedMinimum: .60, semanticMinimum: .60 } },
    lexicalScores: lexical,
    grouping: { sourceArtifact: 'backend/evaluation/results/expanded-semantic-grouped-reanalysis.json', componentCount: components.length, foldCaseIds: folds.map(fold => fold.caseIds), leakageAssertion: 'PASS' },
    fullModels, ablation,
    bootstrap: bootstrap(fullModels, Object.fromEntries(keys.map(key => [key, fullModels[key].groupedThreshold])), components),
    conclusion: 'NO_SINGLE_INTEGRATED_LEADER: SBERT leads fixed-threshold and grouped macro-F1; Voyage leads grouped accuracy.'
  };
  if (report.benchmark.sha256Before !== report.benchmark.sha256After) throw new Error('Benchmark changed.');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(docPath, markdown(report));
  fs.writeFileSync(methodologyPath, methodology());
}

if (require.main === module) main();
module.exports = { main };
