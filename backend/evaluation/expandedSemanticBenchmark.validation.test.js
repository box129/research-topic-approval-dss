const dataset = require('./datasets/expanded-semantic-benchmark.json');
const { validateExpandedSemanticBenchmark, pairKey } = require('./expandedSemanticBenchmark.validation');

describe('expanded semantic benchmark validation', () => {
  test('has exactly 120 near-balanced, valid frozen cases', () => {
    const result = validateExpandedSemanticBenchmark(dataset);
    expect(result).toMatchObject({ valid: true, totalCases: 120, support: { LOW: 39, MEDIUM: 41, HIGH: 40 }, maxClassDifference: 2, uniquePairCount: 120, errors: [] });
  });
  test('rejects a class distribution that is not near-balanced', () => {
    let changes = 0;
    const cases = dataset.cases.map(item => item.expected_class === 'MEDIUM' && changes++ < 3 ? { ...item, expected_class: 'LOW' } : item);
    const result = validateExpandedSemanticBenchmark({ ...dataset, cases });
    expect(result.errors.join('\n')).toMatch(/Expected 39 LOW|differs by more than two cases/);
  });
  test('rejects reversed topic-pair duplicates and metadata leakage', () => {
    const first = dataset.cases[0];
    const invalid = { ...dataset, cases: [first, { ...first, id: 'reversed', submitted: first.existing, existing: { ...first.submitted, expected_class: 'HIGH' } }] };
    const result = validateExpandedSemanticBenchmark(invalid);
    expect(pairKey(first)).toBe(pairKey(invalid.cases[1]));
    expect(result.errors.join('\n')).toMatch(/duplicates a topic pair|leaks expected_class/);
  });
});
