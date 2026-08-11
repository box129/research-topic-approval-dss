const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const benchmark = require('./datasets/expanded-semantic-benchmark.json');
const semantic = require('./results/expanded-semantic-model-evaluation.json');
const grouped = require('./results/expanded-semantic-grouped-reanalysis.json');
const { calculateJaccard } = require('../src/services/jaccard.service');
const { calculateTfIdfSimilarity } = require('../src/services/tfidf.service');
const { CURRENT_WEIGHTS, ABLATIONS, titleOnlyLexical, records, predictFixed, groupedCrossValidate, bootstrap } = require('./integratedDssEvaluation.helpers');
const { buildComponents, groupedFolds, assertNoTopicLeakage } = require('./groupedCrossValidation.helpers');
const { formatStructuredContext } = require('./sbertInputRepresentation.helpers');

describe('integrated DSS evaluation', () => {
  const lexical = titleOnlyLexical(benchmark.cases);
  const lexicalById = new Map(lexical.map(item => [item.id, item]));
  const components = buildComponents(benchmark.cases, formatStructuredContext);
  const folds = groupedFolds(components);
  const benchmarkIds = benchmark.cases.map(item => item.id).sort();

  test('uses title-only production lexical behavior', () => {
    const fixture = benchmark.cases[0];
    const actual = lexicalById.get(fixture.id);
    expect(actual.jaccard).toBe(calculateJaccard(fixture.submitted.title, fixture.existing.title).score);
    expect(actual.tfidf).toBe(calculateTfIdfSimilarity(fixture.submitted.title, [{ id: fixture.id, title: fixture.existing.title }])[0].score);
    expect(lexical).toHaveLength(120);
  });

  test('uses exact fixed weights, ablations, and risk thresholds', () => {
    expect(CURRENT_WEIGHTS).toEqual({ jaccard: .2, tfidf: .3, semantic: .5 });
    expect(ABLATIONS).toEqual({
      jaccard: { jaccard: 1 }, tfidf: { tfidf: 1 }, semantic: { semantic: 1 },
      lexical: { jaccard: .4, tfidf: .6 },
      jaccard_semantic: { jaccard: .2857142857, semantic: .7142857143 },
      tfidf_semantic: { tfidf: .375, semantic: .625 }, full: CURRENT_WEIGHTS
    });
    expect([.399999, .4, .699999, .7].map(predictFixed)).toEqual(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH']);
  });

  test('aligns each stored semantic model 120-for-120 without provider execution', () => {
    ['sbert', 'openai', 'voyage', 'gemini'].forEach(key => {
      const ids = semantic.models[key].rawCaseResults.map(item => item.id);
      expect(ids).toHaveLength(120);
      expect(new Set(ids).size).toBe(120);
      expect([...ids].sort()).toEqual(benchmarkIds);
    });
  });

  test('reuses Stage A.1 folds with training-only threshold fitting', () => {
    expect(assertNoTopicLeakage(folds)).toBe(true);
    expect(folds.map(item => item.caseIds)).toEqual(grouped.grouping.folds.map(item => item.caseIds));
    const scores = new Map(semantic.models.voyage.rawCaseResults.map(item => [item.id, item.scores.voyage]));
    const rows = records(benchmark.cases, lexicalById, scores, 'voyage', CURRENT_WEIGHTS);
    expect(groupedCrossValidate(rows, folds, 'voyage').predictions).toHaveLength(120);
  });

  test('keeps the frozen benchmark SHA and uses deterministic paired bootstrap inputs', () => {
    const benchmarkPath = path.join(__dirname, 'datasets', 'expanded-semantic-benchmark.json');
    expect(crypto.createHash('sha256').update(fs.readFileSync(benchmarkPath)).digest('hex')).toBe('b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0');
    const keys = ['sbert', 'openai', 'voyage', 'gemini'];
    const models = Object.fromEntries(keys.map(key => {
      const scores = new Map(semantic.models[key].rawCaseResults.map(item => [item.id, item.scores[key]]));
      return [key, { rows: records(benchmark.cases, lexicalById, scores, key, CURRENT_WEIGHTS) }];
    }));
    const cv = Object.fromEntries(keys.map(key => [key, groupedCrossValidate(models[key].rows, folds, key)]));
    const first = bootstrap(models, cv, components, { replicates: 10 });
    expect(bootstrap(models, cv, components, { replicates: 10 })).toEqual(first);
  });
});
