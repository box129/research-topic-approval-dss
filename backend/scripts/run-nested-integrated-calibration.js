const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildComponents, groupedFolds, assertNoTopicLeakage } = require('../evaluation/groupedCrossValidation.helpers');
const { formatStructuredContext } = require('../evaluation/sbertInputRepresentation.helpers');
const { simplexGrid, strictTri, innerFolds, assertFoldIntegrity, select, outerPrediction, metrics, ordering, countWeights, bootstrapTracks, pairedInterval } = require('../evaluation/nestedIntegratedCalibration.helpers');

const root = path.join(__dirname, '..', '..'); const backend = path.join(root, 'backend');
const target = (...parts) => path.join(backend, ...parts);
const benchmarkPath = target('evaluation', 'datasets', 'expanded-semantic-benchmark.json');
const stageB1Path = target('evaluation', 'results', 'integrated-dss-baseline-evaluation.json');
const stageA1Path = target('evaluation', 'results', 'expanded-semantic-grouped-reanalysis.json');
const semanticPath = target('evaluation', 'results', 'expanded-semantic-model-evaluation.json');
const outputPath = target('evaluation', 'results', 'nested-integrated-calibration.json');
const docPath = path.join(root, 'docs', 'testing', 'nested-integrated-calibration.md'); const methodPath = path.join(root, 'docs', 'testing', 'nested-integrated-calibration-methodology.md');
const sha = input => crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');

function runTrack(rows, outer, candidates, track) {
  const folds = [];
  outer.forEach(heldOut => {
    const outerIds = new Set(heldOut.caseIds); const outerTrainComponents = outer.filter(fold => fold.fold !== heldOut.fold).flatMap(fold => fold.components);
    const inner = innerFolds(outerTrainComponents); assertFoldIntegrity(inner);
    const trainingRows = rows.filter(row => !outerIds.has(row.id));
    const selection = select(trainingRows, inner, candidates, track);
    const test = outerPrediction(rows, heldOut, selection.selected.weights);
    folds.push({ outerFold: heldOut.fold, outerTestCaseIds: heldOut.caseIds, outerTestComponentIds: heldOut.componentIds, innerFolds: inner.map(fold => ({ fold: fold.fold, componentIds: fold.componentIds, caseIds: fold.caseIds, support: fold.support })), selected: { weights: selection.selected.weights, innerMacroF1: selection.selected.result.overall.macroF1, innerAccuracy: selection.selected.result.overall.accuracy }, thresholds: test.fit, heldOutMetrics: { overall: test.overall, perClass: test.perClass, confusionMatrix: test.confusionMatrix }, predictions: test.predictions });
  });
  const predictions = folds.flatMap(fold => fold.predictions).sort((a,b) => a.id.localeCompare(b.id));
  if (predictions.length !== 120 || new Set(predictions.map(p => p.id)).size !== 120) throw new Error('Outer prediction assignment failure.');
  return { folds, selectedWeightDistribution: countWeights(folds), thresholds: folds.map(fold => ({ outerFold: fold.outerFold, ...fold.thresholds })), heldOut: { ...metrics(predictions), ordering: ordering(predictions) }, predictions };
}
function markdown(result) { const rows = Object.entries(result.providers).flatMap(([provider, tracks]) => ['unrestricted','strictTri'].map(track => `| ${provider} | ${track} | ${tracks[track].heldOut.overall.accuracy} | ${tracks[track].heldOut.overall.macroF1} | ${tracks[track].selectedWeightDistribution.map(x=>`${x.weights} (${x.count})`).join(', ')} |`)).join('\n'); return `# Nested Group-Aware Integrated Calibration\n\nNested five-fold grouped outer evaluation with four inner grouped folds, a predeclared 0.10 simplex grid, and stored Stage B1 scores only.\n\n| Provider | Track | Accuracy | Macro-F1 | Selected weights across outer folds |\n| --- | --- | ---: | ---: | --- |\n${rows}\n\nThe unrestricted and strict-tri tracks are separate exploratory calibration analyses; no selected configuration is a production recommendation.\n`; }
function methodology() { return `# Nested Integrated Calibration Methodology\n\n- Frozen title-only Jaccard and TF-IDF scores were read from Stage B1; stored structured-context-v1 semantic scores were read from Stage B1/Experiment 2B.\n- The exact Stage A.1 connected components and five outer folds were reused.\n- Each outer training partition was divided into deterministic four-way group-aware inner folds.\n- All 66 .10-step simplex weights were considered for unrestricted selection; strict tri requires every weight at least .10.\n- Inner validation selected mean macro-F1, then accuracy and predeclared deterministic tie-breaks. Thresholds were fitted on training data only.\n- Outer test labels were excluded from selection and used once for final evaluation.\n`; }
function main() {
  const before = sha(benchmarkPath), benchmark = JSON.parse(fs.readFileSync(benchmarkPath)), b1 = JSON.parse(fs.readFileSync(stageB1Path)), a1 = JSON.parse(fs.readFileSync(stageA1Path)), semanticArtifact = JSON.parse(fs.readFileSync(semanticPath));
  if (before !== 'b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0' || before !== b1.benchmark.sha256After || before !== a1.benchmark.sha256After) throw new Error('Frozen source mismatch.');
  const support = benchmark.cases.reduce((out, item) => (out[item.expected_class] += 1, out), { LOW:0, MEDIUM:0, HIGH:0 }); if (benchmark.cases.length !== 120 || support.LOW !== 39 || support.MEDIUM !== 41 || support.HIGH !== 40) throw new Error('Support mismatch.');
  const components = buildComponents(benchmark.cases, formatStructuredContext), outer = groupedFolds(components); assertNoTopicLeakage(outer);
  if (JSON.stringify(outer.map(f=>f.caseIds)) !== JSON.stringify(a1.grouping.folds.map(f=>f.caseIds))) throw new Error('Stage A.1 outer fold mismatch.');
  const lexical = new Map(b1.lexicalScores.map(row => [row.id, row])); const grid = simplexGrid(), strict = strictTri(grid); if (grid.length !== 66 || strict.length !== 36) throw new Error('Grid mismatch.');
  const providers = {};
  ['sbert','openai','voyage','gemini'].forEach(provider => {
    const semanticRows = semanticArtifact.models[provider].rawCaseResults;
    if (semanticRows.length !== 120 || new Set(semanticRows.map(row => row.id)).size !== 120) throw new Error(`${provider} stored semantic score mismatch.`);
    const semantic = new Map(semanticRows.map(row => [row.id, row.scores[provider]]));
    const rows = benchmark.cases.map(item => ({ id:item.id, expected_class:item.expected_class, jaccard:lexical.get(item.id).jaccard, tfidf:lexical.get(item.id).tfidf, semantic:semantic.get(item.id) }));
    providers[provider] = { semanticOnly: runTrack(rows, outer, [{ jaccard: 0, tfidf: 0, semantic: 1 }], 'unrestricted'), unrestricted: runTrack(rows, outer, grid, 'unrestricted'), strictTri: runTrack(rows, outer, strict, 'strictTri') };
  });
  const bootstrap = {}; ['unrestricted','strictTri'].forEach(track => {
    const maps = Object.fromEntries(Object.entries(providers).flatMap(([name, value]) => [[name, value[track].predictions], [`${name}_semantic`, value.semanticOnly.predictions]]));
    const sampled = bootstrapTracks(maps, components);
    const versusSemantic = Object.fromEntries(Object.keys(providers).map(name => [name, pairedInterval(sampled.samples[name].macroF1, sampled.samples[`${name}_semantic`].macroF1)]));
    bootstrap[track] = { intervals: Object.fromEntries(Object.keys(providers).map(name => [name, sampled.perConfiguration[name]])), paired: { versusSemantic, voyageMinusSbert: pairedInterval(sampled.samples.voyage.macroF1, sampled.samples.sbert.macroF1) } };
  });
  // Semantic-only baseline predictions are reused from Stage A.1; compare its held-out macro-F1 scalar separately in the report, because Stage A.1 bootstrap samples are immutable and not regenerated here.
  const result = { experiment:{ id:'nested-integrated-calibration', scope:'Local nested grouped calibration using frozen Stage B1/Experiment 2B scores only.' }, benchmark:{ sha256Before:before, sha256After:sha(benchmarkPath), support }, grouping:{ componentCount:components.length, outerFolds:outer.map(f=>({fold:f.fold,componentIds:f.componentIds,caseIds:f.caseIds,support:f.support})), leakageAssertion:'PASS' }, grid:{ count:grid.length, unrestrictedEligible:grid.length, strictTriEligible:strict.length, step:.1 }, providers, baselines:{ semanticOnlyGrouped:Object.fromEntries(Object.entries(a1.models).map(([k,v])=>[k,v.grouped.overall])), currentContractGrouped:Object.fromEntries(Object.entries(b1.fullModels).map(([k,v])=>[k,v.groupedThreshold.overall])), lexicalOnlyGrouped:b1.ablation.lexical.groupedThreshold.overall }, bootstrap, methodologyLimitation:'Nested selections vary by outer fold; no single global calibrated weight is estimated or promoted to production.' };
  if (result.benchmark.sha256Before !== result.benchmark.sha256After) throw new Error('Benchmark changed.'); fs.writeFileSync(outputPath, JSON.stringify(result,null,2)+'\n'); fs.writeFileSync(docPath,markdown(result)); fs.writeFileSync(methodPath,methodology());
}
if(require.main===module) main(); module.exports={main};
