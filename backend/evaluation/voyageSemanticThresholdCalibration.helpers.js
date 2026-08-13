const { buildComponents, groupedFolds, assertNoTopicLeakage, groupedCrossValidate } = require('./groupedCrossValidation.helpers');
const { formatStructuredContext } = require('./sbertInputRepresentation.helpers');

const labels = ['LOW', 'MEDIUM', 'HIGH'];
const round = value => Math.round(value * 1e6) / 1e6;

function predict(score, t1, t2) { return score < t1 ? 'LOW' : score < t2 ? 'MEDIUM' : 'HIGH'; }
function classification(rows, t1, t2) {
  const confusionMatrix = Object.fromEntries(labels.map(label => [label, { LOW: 0, MEDIUM: 0, HIGH: 0 }]));
  const predictions = rows.map(row => ({ id: row.id, actual: row.expected_class, predicted: predict(row.scores.value, t1, t2) }));
  predictions.forEach(row => { confusionMatrix[row.actual][row.predicted] += 1; });
  const perClass = Object.fromEntries(labels.map(label => {
    const tp = confusionMatrix[label][label];
    const fp = labels.reduce((sum, actual) => sum + (actual === label ? 0 : confusionMatrix[actual][label]), 0);
    const fn = labels.reduce((sum, predicted) => sum + (predicted === label ? 0 : confusionMatrix[label][predicted]), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0; const recall = tp + fn ? tp / (tp + fn) : 0;
    return [label, { precision: round(precision), recall: round(recall), f1: round(precision + recall ? 2 * precision * recall / (precision + recall) : 0) }];
  }));
  const accuracy = predictions.filter(row => row.actual === row.predicted).length / predictions.length;
  const macroF1 = labels.reduce((sum, label) => sum + perClass[label].f1, 0) / 3;
  return { accuracy: round(accuracy), macroF1: round(macroF1), perClass, confusionMatrix, predictions };
}
function candidates(rows) {
  const scores = [...new Set(rows.map(row => row.scores.value))].sort((a, b) => a - b);
  return scores.slice(0, -1).map((score, index) => (score + scores[index + 1]) / 2);
}
function fit(rows) {
  const ordered = [...rows].sort((a, b) => a.scores.value - b.scores.value);
  if (new Set(ordered.map(row => row.scores.value)).size < 3) throw new Error('Threshold fitting requires at least three unique scores.');
  const prefix = labels.map(label => {
    let count = 0;
    return ordered.map(row => { if (row.expected_class === label) count += 1; return count; });
  });
  const total = Object.fromEntries(labels.map((label, index) => [label, prefix[index][ordered.length - 1]]));
  function macroF1(first, second) {
    let result = 0;
    labels.forEach((label, labelIndex) => {
      const low = prefix[labelIndex][first]; const medium = prefix[labelIndex][second] - low; const high = total[label] - prefix[labelIndex][second];
      const tp = label === 'LOW' ? low : label === 'MEDIUM' ? medium : high;
      const predicted = label === 'LOW' ? first + 1 : label === 'MEDIUM' ? second - first : ordered.length - second - 1;
      const precision = predicted ? tp / predicted : 0; const recall = total[label] ? tp / total[label] : 0;
      result += precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    });
    return round(result / 3);
  }
  let best = null;
  for (let first = 0; first < ordered.length - 2; first += 1) for (let second = first + 1; second < ordered.length - 1; second += 1) {
    const t1 = (ordered[first].scores.value + ordered[first + 1].scores.value) / 2; const t2 = (ordered[second].scores.value + ordered[second + 1].scores.value) / 2; const score = macroF1(first, second);
    if (!best || score > best.score || (score === best.score && (t1 < best.t1 || (t1 === best.t1 && t2 < best.t2)))) best = { t1, t2, score };
  }
  return { t1: best.t1, t2: best.t2, metrics: classification(rows, best.t1, best.t2) };
}
function percentile(values, q) { const sorted = [...values].sort((a, b) => a - b); const index = (sorted.length - 1) * q; const low = Math.floor(index); const high = Math.ceil(index); return sorted[low] + (sorted[high] - sorted[low]) * (index - low); }
function rng(seed) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }; }
function bootstrap(rows, components, { seed = 20260810, replicates = 5000 } = {}) {
  const random = rng(seed); const byId = new Map(rows.map(row => [row.id, row])); const samples = [];
  for (let i = 0; i < replicates; i += 1) { const sampled = Array.from({ length: components.length }, () => components[Math.floor(random() * components.length)]).flatMap(component => component.caseIds.map(id => byId.get(id))); samples.push(fit(sampled)); }
  const summary = key => { const values = samples.map(sample => sample[key]); return { median: round(percentile(values, .5)), p025: round(percentile(values, .025)), p25: round(percentile(values, .25)), p75: round(percentile(values, .75)), p975: round(percentile(values, .975)), minimum: round(Math.min(...values)), maximum: round(Math.max(...values)) }; };
  return { seed, replicates, resamplingUnit: 'connected_component', t1: summary('t1'), t2: summary('t2'), samples };
}
function neighborhoods(rows, threshold) { return [0.01, 0.02, 0.05].map(radius => ({ radius, total: rows.filter(row => Math.abs(row.scores.value - threshold) <= radius).length, byClass: Object.fromEntries(labels.map(label => [label, rows.filter(row => row.expected_class === label && Math.abs(row.scores.value - threshold) <= radius).length])) })); }
function errors(predictions) { return Object.fromEntries(labels.map(actual => [actual, Object.fromEntries(labels.filter(predicted => predicted !== actual).map(predicted => [`${actual}_to_${predicted}`, predictions.filter(row => row.actual === actual && row.predicted === predicted).map(row => row.id)]))])); }
function sensitivity(rows, fitResult) { const delta = [-.05, -.02, -.01, 0, .01, .02, .05]; return delta.flatMap(left => delta.map(right => ({ t1: fitResult.t1 + left, t2: fitResult.t2 + right })).filter(pair => pair.t1 < pair.t2)).map(pair => ({ ...pair, ...classification(rows, pair.t1, pair.t2) })); }
function grouped(rows, benchmark) { const components = buildComponents(benchmark.cases, formatStructuredContext); const folds = groupedFolds(components); assertNoTopicLeakage(folds); return { components, folds, result: groupedCrossValidate(rows, folds, 'value') }; }
module.exports = { predict, classification, candidates, fit, bootstrap, neighborhoods, errors, sensitivity, grouped };
