const fs = require('fs');
const { candidates, fit, bootstrap, neighborhoods, grouped } = require('./voyageSemanticThresholdCalibration.helpers');
const { main } = require('../scripts/run-voyage-semantic-threshold-calibration');

const benchmark = JSON.parse(fs.readFileSync('backend/evaluation/datasets/expanded-semantic-benchmark.json'));
const source = JSON.parse(fs.readFileSync('backend/evaluation/results/production-semantic-retrieval-validation-completed.json'));
const rows = source.providers.voyage.rows;

describe('Voyage C1.4 threshold calibration', () => {
  test('uses only complete C1.2 Voyage production pair scores', () => {
    expect(source.providers.voyage.status).toBe('COMPLETE'); expect(rows).toHaveLength(120);
    expect(source.providers.voyage.configuration).toMatchObject({ model: 'voyage-4-large', dimension: 1024, dtype: 'float', representation: 'structured-context-v1', query: { input_type: 'query' }, document: { input_type: 'document' } });
  });
  test('generates adjacent score midpoints and deterministic ordered thresholds', () => {
    const values = candidates(rows); const first = fit(rows); const second = fit(rows);
    expect(values.length).toBeGreaterThan(2); expect(first).toEqual(second); expect(first.t1).toBeLessThan(first.t2);
    expect(first.metrics.macroF1).toBe(0.880801);
  });
  test('uses lower thresholds as deterministic macro-F1 tie-breaks', () => {
    const tied = [{ id:'a', expected_class:'LOW', scores:{value:0} }, { id:'b', expected_class:'MEDIUM', scores:{value:1} }, { id:'c', expected_class:'HIGH', scores:{value:2} }, { id:'d', expected_class:'HIGH', scores:{value:3} }];
    expect(fit(tied)).toMatchObject({ t1: .5, t2: 1.5 });
  });
  test('preserves grouped held-out performance and no topic leakage', () => {
    const result = grouped(rows, benchmark); expect(result.components).toHaveLength(113);
    expect(result.result.overall).toEqual(source.providers.voyage.grouped.overall);
  });
  test('has deterministic component bootstrap and boundary counts', () => {
    const { components } = grouped(rows, benchmark); const one = bootstrap(rows, components, { replicates: 30 }); const two = bootstrap(rows, components, { replicates: 30 });
    expect(one).toEqual(two); expect(neighborhoods(rows, fit(rows).t1)[0].total).toBe(7);
  });
  test('runner produces the frozen-source calibration artifact without provider calls', () => {
    main(); const output = JSON.parse(fs.readFileSync('backend/evaluation/results/voyage-semantic-threshold-calibration.json'));
    expect(output.benchmark.pairs).toBe(120); expect(output.deploymentCalibration.thresholds.t1).toBeLessThan(output.deploymentCalibration.thresholds.t2);
  });
});
