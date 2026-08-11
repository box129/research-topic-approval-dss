const crypto = require('crypto');
const { formatStructuredContext, calculateSpearman, calculateConcordance } = require('./sbertInputRepresentation.helpers');

const CLASSES = ['LOW', 'MEDIUM', 'HIGH'];
const round = value => Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function seededHash(seed, value) { return digest(`${seed}|${value}`); }
function support(items) { return items.reduce((out, item) => { out[item.expected_class] += 1; return out; }, { LOW: 0, MEDIUM: 0, HIGH: 0 }); }

function buildComponents(cases, format = formatStructuredContext) {
  const parent = cases.map((_, index) => index);
  const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left, right) => { const a = find(left); const b = find(right); if (a !== b) parent[b] = a; };
  const topicCases = new Map();
  const caseTopics = cases.map(item => [format(item.submitted), format(item.existing)]);
  caseTopics.forEach((topics, index) => topics.forEach(topic => {
    if (topicCases.has(topic)) join(index, topicCases.get(topic)[0]);
    const values = topicCases.get(topic) || []; values.push(index); topicCases.set(topic, values);
  }));
  const grouped = new Map();
  cases.forEach((item, index) => { const root = find(index); const values = grouped.get(root) || []; values.push({ ...item, canonicalTopics: caseTopics[index] }); grouped.set(root, values); });
  return [...grouped.values()].map(items => {
    const caseIds = items.map(item => item.id).sort();
    return { id: `component-${digest(caseIds.join('|')).slice(0, 16)}`, caseIds, cases: items, support: support(items), canonicalTopicHashes: [...new Set(items.flatMap(item => item.canonicalTopics))].sort().map(digest) };
  }).sort((a, b) => a.caseIds[0].localeCompare(b.caseIds[0]));
}

function targetSupports() { return [{ LOW: 8, MEDIUM: 9, HIGH: 8 }, ...Array.from({ length: 3 }, () => ({ LOW: 8, MEDIUM: 8, HIGH: 8 })), { LOW: 7, MEDIUM: 8, HIGH: 8 }]; }
function sizeDeviation(values, target) { return Math.abs(values - target); }
function classDeviation(actual, target) { return CLASSES.reduce((total, label) => total + Math.abs(actual[label] - target[label]), 0); }
function maxImbalance(actual) { const values = CLASSES.map(label => actual[label]); return Math.max(...values) - Math.min(...values); }

function groupedFolds(components, { seed = 20260810, folds = 5 } = {}) {
  if (folds !== 5) throw new Error('The predeclared grouped reanalysis uses exactly five folds.');
  const targetSize = [25, 24, 24, 24, 23]; const targetClass = targetSupports();
  const orderedByHash = values => [...values].sort((a, b) => seededHash(seed, a.caseIds.join('|')).localeCompare(seededHash(seed, b.caseIds.join('|'))) || a.id.localeCompare(b.id));
  const multiCase = orderedByHash(components.filter(component => component.cases.length > 1));
  const singletonBuckets = Object.fromEntries(CLASSES.map(label => [label, orderedByHash(components.filter(component => component.cases.length === 1 && component.support[label] === 1))]));
  const ordered = [...multiCase];
  while (CLASSES.some(label => singletonBuckets[label].length)) CLASSES.forEach(label => { if (singletonBuckets[label].length) ordered.push(singletonBuckets[label].shift()); });
  const assignments = Array.from({ length: folds }, (_, index) => ({ fold: index + 1, components: [], cases: [], support: { LOW: 0, MEDIUM: 0, HIGH: 0 } }));
  ordered.forEach(component => {
    const allChoices = assignments.map((fold, index) => {
      const nextSupport = CLASSES.reduce((out, label) => ({ ...out, [label]: fold.support[label] + component.support[label] }), {});
      return { index, key: [sizeDeviation(fold.cases.length + component.cases.length, targetSize[index]), classDeviation(nextSupport, targetClass[index]), maxImbalance(nextSupport), index], nextSupport };
    });
    // Preserve the predeclared target sizes whenever a non-overflow assignment exists.
    // This is a feasibility constraint, not an additional ranking priority.
    const choices = (allChoices.some(choice => assignments[choice.index].cases.length + component.cases.length <= targetSize[choice.index])
      ? allChoices.filter(choice => assignments[choice.index].cases.length + component.cases.length <= targetSize[choice.index])
      : allChoices).sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.key[3] - b.key[3]);
    const selected = choices[0]; const fold = assignments[selected.index]; fold.components.push(component); fold.cases.push(...component.cases); fold.support = selected.nextSupport;
  });
  return assignments.map(fold => ({ ...fold, caseIds: fold.cases.map(item => item.id).sort(), componentIds: fold.components.map(item => item.id).sort(), canonicalTopicHashes: [...new Set(fold.components.flatMap(item => item.canonicalTopicHashes))].sort() }));
}

function assertNoTopicLeakage(folds) {
  folds.forEach(heldOut => {
    const held = new Set(heldOut.canonicalTopicHashes);
    const training = new Set(folds.filter(fold => fold.fold !== heldOut.fold).flatMap(fold => fold.canonicalTopicHashes));
    for (const hash of held) if (training.has(hash)) throw new Error(`Canonical topic identity crosses fold ${heldOut.fold}.`);
  });
  const all = folds.flatMap(fold => fold.caseIds); if (new Set(all).size !== all.length || all.length !== 120) throw new Error('Cases must be assigned exactly once.');
  return true;
}

function predict(score, t1, t2) { return score < t1 ? 'LOW' : score < t2 ? 'MEDIUM' : 'HIGH'; }
function classMetrics(actual, predicted, label) { let tp = 0; let fp = 0; let fn = 0; actual.forEach((value, index) => { if (predicted[index] === label && value === label) tp += 1; if (predicted[index] === label && value !== label) fp += 1; if (predicted[index] !== label && value === label) fn += 1; }); const precision = tp + fp ? tp / (tp + fp) : 0; const recall = tp + fn ? tp / (tp + fn) : 0; return { precision: round(precision), recall: round(recall), f1: round(precision + recall ? 2 * precision * recall / (precision + recall) : 0) }; }
function macroF1(actual, predicted) { return CLASSES.reduce((sum, label) => sum + classMetrics(actual, predicted, label).f1, 0) / CLASSES.length; }
function fitThresholds(training, key) { const values = [...new Set(training.map(item => item.scores[key]))].sort((a, b) => a - b); let best = null; for (let first = 0; first < values.length - 1; first += 1) for (let second = first + 1; second < values.length; second += 1) { const t1 = (values[first] + values[first + 1]) / 2; const t2 = (values[second] + values[second + 1]) / 2; const score = macroF1(training.map(item => item.expected_class), training.map(item => predict(item.scores[key], t1, t2))); if (!best || score > best.score || (score === best.score && (t1 < best.t1 || (t1 === best.t1 && t2 < best.t2)))) best = { t1, t2, score }; } if (!best) throw new Error('Threshold fitting requires at least three distinct training scores.'); return best; }

function groupedCrossValidate(caseResults, folds, key) {
  const byId = new Map(caseResults.map(item => [item.id, item])); const predictions = []; const details = [];
  folds.forEach(heldOut => {
    const test = heldOut.caseIds.map(id => byId.get(id)); const testIds = new Set(heldOut.caseIds); const training = caseResults.filter(item => !testIds.has(item.id)); const fit = fitThresholds(training, key);
    details.push({ fold: heldOut.fold, trainingCases: training.length, heldOutCases: test.length, heldOutSupport: heldOut.support, componentIds: heldOut.componentIds, t1: round(fit.t1), t2: round(fit.t2), trainingMacroF1: round(fit.score) });
    test.forEach(item => predictions.push({ id: item.id, componentId: heldOut.components.find(component => component.caseIds.includes(item.id)).id, actual: item.expected_class, predicted: predict(item.scores[key], fit.t1, fit.t2) }));
  });
  const actual = predictions.map(item => item.actual); const predicted = predictions.map(item => item.predicted); const perClass = Object.fromEntries(CLASSES.map(label => [label, classMetrics(actual, predicted, label)])); const confusionMatrix = Object.fromEntries(CLASSES.map(label => [label, { LOW: 0, MEDIUM: 0, HIGH: 0 }])); predictions.forEach(item => { confusionMatrix[item.actual][item.predicted] += 1; });
  return { seed: 20260810, folds: details, predictions: predictions.sort((a, b) => a.id.localeCompare(b.id)), overall: { accuracy: round(actual.filter((value, index) => value === predicted[index]).length / actual.length), macroPrecision: round(Object.values(perClass).reduce((sum, item) => sum + item.precision, 0) / 3), macroRecall: round(Object.values(perClass).reduce((sum, item) => sum + item.recall, 0) / 3), macroF1: round(Object.values(perClass).reduce((sum, item) => sum + item.f1, 0) / 3) }, perClass, confusionMatrix };
}

function random(seed) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }; }
function percentile(values, value) { const index = (values.length - 1) * value; const lower = Math.floor(index); const upper = Math.ceil(index); return values[lower] + (values[upper] - values[lower]) * (index - lower); }
function interval(values) { const sorted = [...values].sort((a, b) => a - b); return { lower: round(percentile(sorted, .025)), upper: round(percentile(sorted, .975)) }; }

function componentBootstrap(caseResultsByModel, groupedPredictions, components, { seed = 20260810, replicates = 5000 } = {}) {
  const models = Object.keys(caseResultsByModel); const componentIds = components.map(component => component.id); const casesByComponent = new Map(components.map(component => [component.id, component.caseIds])); const raw = Object.fromEntries(models.map(key => [key, Object.fromEntries(caseResultsByModel[key].map(item => [item.id, item]))])); const predictions = Object.fromEntries(models.map(key => [key, Object.fromEntries(groupedPredictions[key].map(item => [item.id, item]))])); const rng = random(seed); const perModel = Object.fromEntries(models.map(key => [key, { spearman: [], concordance: [], accuracy: [], macroF1: [] }])); const paired = Object.fromEntries(['sbert', 'openai', 'gemini'].map(key => [key, { spearman: [], concordance: [], macroF1: [] }]));
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const ids = Array.from({ length: componentIds.length }, () => componentIds[Math.floor(rng() * componentIds.length)]).flatMap(id => casesByComponent.get(id));
    const perReplicate = {};
    models.forEach(key => {
      const scores = ids.map(id => raw[key][id]); const actual = ids.map(id => predictions[key][id].actual); const predicted = ids.map(id => predictions[key][id].predicted); const spearman = calculateSpearman(scores, key).coefficient; const concordance = calculateConcordance(scores, key).overall.rate; const accuracy = actual.filter((value, index) => value === predicted[index]).length / actual.length; const f1 = macroF1(actual, predicted); perReplicate[key] = { spearman, concordance, macroF1: f1 }; perModel[key].spearman.push(spearman); perModel[key].concordance.push(concordance); perModel[key].accuracy.push(accuracy); perModel[key].macroF1.push(f1);
    });
    ['sbert', 'openai', 'gemini'].forEach(key => { paired[key].spearman.push(perReplicate.voyage.spearman - perReplicate[key].spearman); paired[key].concordance.push(perReplicate.voyage.concordance - perReplicate[key].concordance); paired[key].macroF1.push(perReplicate.voyage.macroF1 - perReplicate[key].macroF1); });
  }
  return { seed, replicates, resamplingUnit: 'connected_component', perModel: Object.fromEntries(models.map(key => [key, Object.fromEntries(Object.entries(perModel[key]).map(([metric, values]) => [metric, interval(values)]))])), voyageMinus: Object.fromEntries(Object.entries(paired).map(([key, values]) => [key, Object.fromEntries(Object.entries(values).map(([metric, samples]) => [metric, interval(samples)]))])) };
}

module.exports = { buildComponents, groupedFolds, assertNoTopicLeakage, fitThresholds, groupedCrossValidate, componentBootstrap, support, targetSupports };
