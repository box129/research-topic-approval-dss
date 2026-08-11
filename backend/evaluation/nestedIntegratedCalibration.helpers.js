const crypto = require('crypto');
const { support } = require('./groupedCrossValidation.helpers');
const { calculateSpearman, calculateConcordance, calculateClassStatistics, calculateClassMargins } = require('./sbertInputRepresentation.helpers');

const CLASSES = ['LOW', 'MEDIUM', 'HIGH'];
const round = value => Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function simplexGrid() {
  const grid = [];
  for (let j = 0; j <= 10; j += 1) for (let t = 0; t <= 10 - j; t += 1) {
    grid.push({ jaccard: j / 10, tfidf: t / 10, semantic: (10 - j - t) / 10 });
  }
  return grid;
}
function strictTri(grid) { return grid.filter(w => w.jaccard >= .1 && w.tfidf >= .1 && w.semantic >= .1); }
function weightKey(w) { return `${w.jaccard.toFixed(1)}/${w.tfidf.toFixed(1)}/${w.semantic.toFixed(1)}`; }
function score(row, weights) { return round(row.jaccard * weights.jaccard + row.tfidf * weights.tfidf + row.semantic * weights.semantic); }
function decorate(rows, weights) { return rows.map(row => ({ ...row, scores: { combined: score(row, weights) } })); }
function predict(value, t1, t2) { return value < t1 ? 'LOW' : value < t2 ? 'MEDIUM' : 'HIGH'; }
function fitThresholdsFast(rows) {
  const grouped = new Map(); rows.forEach(row => { const score = row.scores.combined; const counts = grouped.get(score) || { LOW:0, MEDIUM:0, HIGH:0 }; counts[row.expected_class] += 1; grouped.set(score, counts); });
  const values = [...grouped.keys()].sort((a,b)=>a-b); if (values.length < 3) throw new Error('Threshold fitting requires at least three distinct scores.');
  const total = Object.fromEntries(CLASSES.map(label => [label, rows.filter(row => row.expected_class === label).length])); const prefix=[]; let running={LOW:0,MEDIUM:0,HIGH:0};
  values.forEach(value => { running={...running}; CLASSES.forEach(label=>{running[label]+=grouped.get(value)[label];}); prefix.push(running); });
  const f1 = (tp, fp, fn) => { const p=tp+fp?tp/(tp+fp):0, r=tp+fn?tp/(tp+fn):0; return p+r?2*p*r/(p+r):0; };
  let best=null;
  for(let first=0;first<values.length-2;first+=1) for(let second=first+1;second<values.length-1;second+=1) {
    const low = prefix[first];
    const mid = Object.fromEntries(CLASSES.map(label => [label, prefix[second][label] - low[label]]));
    const high = Object.fromEntries(CLASSES.map(label => [label, total[label] - prefix[second][label]]));
    const macro=CLASSES.reduce((sum,label)=>sum+f1((label==='LOW'?low:label==='MEDIUM'?mid:high)[label], (label==='LOW'?low:label==='MEDIUM'?mid:high).LOW+(label==='LOW'?low:label==='MEDIUM'?mid:high).MEDIUM+(label==='LOW'?low:label==='MEDIUM'?mid:high).HIGH-(label==='LOW'?low:label==='MEDIUM'?mid:high)[label], total[label]-(label==='LOW'?low:label==='MEDIUM'?mid:high)[label]),0)/3;
    const t1=(values[first]+values[first+1])/2,t2=(values[second]+values[second+1])/2;if(!best||macro>best.score||(macro===best.score&&(t1<best.t1||(t1===best.t1&&t2<best.t2))))best={t1,t2,score:macro};
  } return best;
}
function metrics(predictions) {
  const actual = predictions.map(row => row.actual); const predicted = predictions.map(row => row.predicted);
  const perClass = Object.fromEntries(CLASSES.map(label => {
    let tp = 0; let fp = 0; let fn = 0;
    actual.forEach((value, i) => { if (predicted[i] === label && value === label) tp += 1; if (predicted[i] === label && value !== label) fp += 1; if (predicted[i] !== label && value === label) fn += 1; });
    const precision = tp + fp ? tp / (tp + fp) : 0; const recall = tp + fn ? tp / (tp + fn) : 0;
    return [label, { precision: round(precision), recall: round(recall), f1: round(precision + recall ? 2 * precision * recall / (precision + recall) : 0) }];
  }));
  const confusionMatrix = Object.fromEntries(CLASSES.map(label => [label, { LOW: 0, MEDIUM: 0, HIGH: 0 }]));
  predictions.forEach(row => { confusionMatrix[row.actual][row.predicted] += 1; });
  return { overall: { accuracy: round(actual.filter((v, i) => v === predicted[i]).length / actual.length), macroPrecision: round(CLASSES.reduce((sum, l) => sum + perClass[l].precision, 0) / 3), macroRecall: round(CLASSES.reduce((sum, l) => sum + perClass[l].recall, 0) / 3), macroF1: round(CLASSES.reduce((sum, l) => sum + perClass[l].f1, 0) / 3) }, perClass, confusionMatrix };
}

function innerFolds(components, { seed = 20260810, folds = 4 } = {}) {
  const buckets = Array.from({ length: folds }, (_, i) => ({ fold: i + 1, components: [], cases: [], support: { LOW: 0, MEDIUM: 0, HIGH: 0 } }));
  const ordered = [...components].sort((a, b) => hash(`${seed}|${a.id}`).localeCompare(hash(`${seed}|${b.id}`)) || a.id.localeCompare(b.id));
  ordered.forEach(component => {
    const selected = buckets.map((bucket, index) => ({ bucket, index, size: bucket.cases.length + component.cases.length, imbalance: CLASSES.reduce((sum, label) => sum + Math.abs((bucket.support[label] + component.support[label]) - (components.reduce((n, c) => n + c.support[label], 0) / folds)), 0) }))
      .sort((a, b) => a.size - b.size || a.imbalance - b.imbalance || a.index - b.index)[0].bucket;
    selected.components.push(component); selected.cases.push(...component.cases);
    CLASSES.forEach(label => { selected.support[label] += component.support[label]; });
  });
  return buckets.map(bucket => ({ ...bucket, caseIds: bucket.cases.map(item => item.id).sort(), componentIds: bucket.components.map(item => item.id).sort(), canonicalTopicHashes: [...new Set(bucket.components.flatMap(c => c.canonicalTopicHashes))].sort() }));
}
function assertFoldIntegrity(folds) {
  folds.forEach(held => { const heldTopics = new Set(held.canonicalTopicHashes); const trainTopics = new Set(folds.filter(f => f.fold !== held.fold).flatMap(f => f.canonicalTopicHashes)); heldTopics.forEach(topic => { if (trainTopics.has(topic)) throw new Error('Topic leakage in grouped fold.'); }); });
  return true;
}
function crossValidate(rows, folds, weights) {
  const byId = new Map(rows.map(row => [row.id, row])); const predictions = [];
  folds.forEach(held => {
    const testIds = new Set(held.caseIds); const training = decorate(rows.filter(row => !testIds.has(row.id)), weights); const test = decorate(held.caseIds.map(id => byId.get(id)), weights); const fit = fitThresholdsFast(training);
    test.forEach(row => predictions.push({ id: row.id, componentId: held.components.find(c => c.caseIds.includes(row.id)).id, actual: row.expected_class, predicted: predict(row.scores.combined, fit.t1, fit.t2), score: row.scores.combined }));
  });
  return { predictions: predictions.sort((a, b) => a.id.localeCompare(b.id)), ...metrics(predictions) };
}
function compareSelection(a, b, track) {
  const eps = 1e-12; if (!b) return -1;
  if (Math.abs(a.result.overall.macroF1 - b.result.overall.macroF1) > eps) return b.result.overall.macroF1 - a.result.overall.macroF1;
  if (Math.abs(a.result.overall.accuracy - b.result.overall.accuracy) > eps) return b.result.overall.accuracy - a.result.overall.accuracy;
  if (track === 'unrestricted') { const an = [a.weights.jaccard, a.weights.tfidf, a.weights.semantic].filter(x => x > 0).length; const bn = [b.weights.jaccard, b.weights.tfidf, b.weights.semantic].filter(x => x > 0).length; if (an !== bn) return an - bn; const al = a.weights.jaccard + a.weights.tfidf; const bl = b.weights.jaccard + b.weights.tfidf; if (al !== bl) return al - bl; }
  else { const distance = w => Math.sqrt((w.jaccard-.2)**2+(w.tfidf-.3)**2+(w.semantic-.5)**2); const ad=distance(a.weights),bd=distance(b.weights); if (ad !== bd) return ad-bd; if (a.weights.semantic !== b.weights.semantic) return a.weights.semantic-b.weights.semantic; }
  return weightKey(a.weights).localeCompare(weightKey(b.weights));
}
function select(rows, inner, candidates, track) {
  const ranked = candidates.map(weights => ({ weights, result: crossValidate(rows, inner, weights) })).sort((a, b) => compareSelection(a, b, track));
  return { selected: ranked[0], innerSummary: ranked.map(item => ({ weights: item.weights, macroF1: item.result.overall.macroF1, accuracy: item.result.overall.accuracy })) };
}
function outerPrediction(rows, outerFold, weights) {
  const testIds = new Set(outerFold.caseIds); const training = decorate(rows.filter(row => !testIds.has(row.id)), weights); const fit = fitThresholdsFast(training); const test = decorate(rows.filter(row => testIds.has(row.id)), weights);
  const predictions = test.map(row => ({ id: row.id, componentId: outerFold.components.find(c => c.caseIds.includes(row.id)).id, actual: row.expected_class, predicted: predict(row.scores.combined, fit.t1, fit.t2), score: row.scores.combined }));
  return { fit: { t1: round(fit.t1), t2: round(fit.t2), trainingMacroF1: round(fit.score) }, predictions, ...metrics(predictions) };
}
function ordering(predictions) { const rows = predictions.map(row => ({ expected_class: row.actual, scores: { combined: row.score } })); const stats = calculateClassStatistics(rows, 'combined'); return { spearman: calculateSpearman(rows, 'combined'), concordance: calculateConcordance(rows, 'combined'), classMargins: calculateClassMargins(stats) }; }
function countWeights(folds) { return Object.entries(folds.reduce((out, fold) => { const key = weightKey(fold.selected.weights); out[key] = (out[key] || 0) + 1; return out; }, {})).map(([weights, count]) => ({ weights, count })); }

function random(seed) { let state = seed >>> 0; return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296); }
function interval(values) { const sorted = [...values].sort((a,b)=>a-b); const pick = q => { const index=(sorted.length-1)*q, low=Math.floor(index), high=Math.ceil(index); return round(sorted[low]+(sorted[high]-sorted[low])*(index-low)); }; return { lower: pick(.025), upper: pick(.975) }; }
function bootstrapTracks(trackPredictions, components, { seed = 20260810, replicates = 5000 } = {}) {
  const names = Object.keys(trackPredictions); const ids = components.map(c => c.id); const caseIds = new Map(components.map(c => [c.id, c.caseIds])); const byName = Object.fromEntries(names.map(name => [name, Object.fromEntries(trackPredictions[name].map(p => [p.id, p]))])); const rng=random(seed); const values=Object.fromEntries(names.map(n=>[n,{accuracy:[],macroF1:[]}]));
  for(let r=0;r<replicates;r+=1){const sample=Array.from({length:ids.length},()=>ids[Math.floor(rng()*ids.length)]).flatMap(id=>caseIds.get(id));names.forEach(name=>{const rows=sample.map(id=>byName[name][id]);const m=metrics(rows);values[name].accuracy.push(m.overall.accuracy);values[name].macroF1.push(m.overall.macroF1);});}
  return { seed, replicates, resamplingUnit:'connected_component', perConfiguration:Object.fromEntries(names.map(n=>[n,{accuracy:interval(values[n].accuracy),macroF1:interval(values[n].macroF1)}])), samples:values };
}
function pairedInterval(left, right) { return interval(left.map((v, i) => v - right[i])); }
module.exports = { simplexGrid, strictTri, weightKey, score, innerFolds, assertFoldIntegrity, crossValidate, select, outerPrediction, metrics, ordering, countWeights, bootstrapTracks, pairedInterval, support };
