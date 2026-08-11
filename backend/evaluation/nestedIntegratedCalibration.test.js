const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const benchmark = require('./datasets/expanded-semantic-benchmark.json');
const { buildComponents, groupedFolds, assertNoTopicLeakage } = require('./groupedCrossValidation.helpers');
const { formatStructuredContext } = require('./sbertInputRepresentation.helpers');
const { simplexGrid, strictTri, weightKey, innerFolds, assertFoldIntegrity, select, crossValidate, outerPrediction, bootstrapTracks } = require('./nestedIntegratedCalibration.helpers');

describe('nested integrated calibration', () => {
  const grid = simplexGrid(); const strict = strictTri(grid);
  const components = buildComponents(benchmark.cases, formatStructuredContext); const outer = groupedFolds(components);
  const rows = benchmark.cases.map((item, index) => ({ id:item.id, expected_class:item.expected_class, jaccard:index / 200, tfidf:index / 180, semantic:index / 150 }));
  test('has exactly 66 simplex configurations including frozen baselines', () => {
    expect(grid).toHaveLength(66); expect(grid.every(w => Math.abs(w.jaccard + w.tfidf + w.semantic - 1) < 1e-12)).toBe(true);
    expect(grid.map(weightKey)).toContain('0.2/0.3/0.5'); expect(grid.map(weightKey)).toContain('0.0/0.0/1.0');
    expect(strict).toHaveLength(36); expect(strict.every(w => w.jaccard >= .1 && w.tfidf >= .1 && w.semantic >= .1)).toBe(true);
  });
  test('preserves outer and inner component integrity', () => {
    expect(components).toHaveLength(113); expect(assertNoTopicLeakage(outer)).toBe(true);
    const inner = innerFolds(outer.filter(f => f.fold !== 1).flatMap(f => f.components)); expect(inner).toHaveLength(4); expect(assertFoldIntegrity(inner)).toBe(true);
  });
  test('selects with inner data and predicts every outer held-out case once', () => {
    const held = outer[0]; const trainIds = new Set(held.caseIds); const inner = innerFolds(outer.slice(1).flatMap(f => f.components));
    const selection = select(rows.filter(row => !trainIds.has(row.id)), inner, grid, 'unrestricted');
    expect(selection.selected).toHaveProperty('weights'); expect(selection.innerSummary).toHaveLength(66);
    const result = outerPrediction(rows, held, selection.selected.weights); expect(result.predictions).toHaveLength(held.caseIds.length);
    expect(crossValidate(rows.filter(row => !trainIds.has(row.id)), inner, selection.selected.weights).predictions).toHaveLength(95);
  });
  test('uses deterministic paired component bootstrap and preserves benchmark SHA', () => {
    const predictions = outer.flatMap(fold => fold.caseIds.map(id => ({ id, componentId: fold.components.find(c => c.caseIds.includes(id)).id, actual: rows.find(r => r.id === id).expected_class, predicted: 'LOW', score: 0 })));
    expect(bootstrapTracks({ a:predictions, b:predictions },components,{replicates:10})).toEqual(bootstrapTracks({ a:predictions, b:predictions },components,{replicates:10}));
    const input=fs.readFileSync(path.join(__dirname,'datasets','expanded-semantic-benchmark.json')); expect(crypto.createHash('sha256').update(input).digest('hex')).toBe('b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0');
  });
});
