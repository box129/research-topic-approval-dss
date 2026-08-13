const fs = require('fs');
const { cosine, main } = require('../scripts/run-voyage-production-direction-calibration');
const { bootstrap, grouped } = require('./voyageSemanticThresholdCalibration.helpers');

describe('C1.5 production-direction calibration', () => {
  test('uses only explicit submitted/existing roles and completed C1.2 vectors', () => {
    main();
    const result = JSON.parse(fs.readFileSync('backend/evaluation/results/voyage-production-direction-calibration.json'));
    expect(result.orientation.status).toBe('BENCHMARK_PRODUCTION_ROLES_EXPLICIT');
    expect(result.benchmark).toMatchObject({ pairs: 120, components: 113, sha256Before: 'b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0' });
    expect(result.source).toMatchObject({ model: 'voyage-4-large', dimension: 1024, representation: 'structured-context-v1' });
    expect(result.productionContract.thresholds.t1).toBeLessThan(result.productionContract.thresholds.t2);
  });
  test('reproduces directional and existing pair-mean evidence', () => {
    const result = JSON.parse(fs.readFileSync('backend/evaluation/results/voyage-production-direction-calibration.json'));
    const c12 = JSON.parse(fs.readFileSync('backend/evaluation/results/production-semantic-retrieval-validation-completed.json'));
    expect(result.directions.pairMean.grouped.overall).toEqual(c12.providers.voyage.grouped.overall);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [-1, 0])).toBe(-1);
  });
  test('reuses 113 grouped components and has deterministic bootstrap', () => {
    const benchmark = JSON.parse(fs.readFileSync('backend/evaluation/datasets/expanded-semantic-benchmark.json'));
    const source = JSON.parse(fs.readFileSync('backend/evaluation/results/production-semantic-retrieval-validation-completed.json'));
    const ab = source.providers.voyage.rows.map(row => ({ id: row.id, expected_class: row.expected_class, scores: { value: row.score_ab } }));
    const structure = grouped(ab, benchmark);
    expect(structure.components).toHaveLength(113);
    expect(bootstrap(ab, structure.components, { replicates: 10 })).toEqual(bootstrap(ab, structure.components, { replicates: 10 }));
  });
});
