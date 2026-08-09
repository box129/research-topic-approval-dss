const { formatTitleOnly, formatStructuredContext, calculateSpearman, calculateConcordance } = require('./sbertInputRepresentation.helpers');

describe('SBERT input representation evaluation helpers', () => {
  test('formats a title-only representation exactly as the title', () => {
    expect(formatTitleOnly({ title: '  Malaria prevention  ', expected_class: 'LOW' })).toBe('Malaria prevention');
  });

  test('formats structured context in canonical order and omits missing values', () => {
    expect(formatStructuredContext({ title: 'Topic', population: 'Mothers', location: ' ', study_focus: 'Prevention' })).toBe('Title: Topic\nPopulation: Mothers\nStudy focus: Prevention');
  });

  test('does not leak benchmark metadata or keywords into structured context', () => {
    const value = formatStructuredContext({ title: 'Topic', population: 'Adults', keywords: ['secret'], expected_class: 'HIGH', expected_risk: 'HIGH', rationale: 'secret rationale', category: 'secret category', tags: ['secret tag'], notes: 'secret notes', source_classification: 'secret source' });
    expect(value).toBe('Title: Topic\nPopulation: Adults');
    expect(value).not.toMatch(/secret|HIGH|keywords/i);
  });

  test('calculates rank correlation and strict cross-class ordering', () => {
    const cases = [
      { expected_class: 'LOW', scores: { title_only: 0.1 } },
      { expected_class: 'MEDIUM', scores: { title_only: 0.5 } },
      { expected_class: 'HIGH', scores: { title_only: 0.9 } }
    ];
    expect(calculateSpearman(cases, 'title_only')).toEqual({ support: 3, coefficient: 1 });
    expect(calculateConcordance(cases, 'title_only').overall).toEqual({ comparisons: 3, correct: 3, rate: 1 });
  });
});
