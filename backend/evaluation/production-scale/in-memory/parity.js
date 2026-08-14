const { retrieve, classify } = require('../../../src/services/voyageSemanticSimilarity.service');
const { fixedQueryVector, collectionRows } = require('../lib');
const { inMemoryCheck } = require('./corpus-loader');

function deterministicVector(seed) { return Array.from({ length: 1024 }, (_, index) => (((index * seed * 29) % 211) - 105) / 105); }
function parityQuerySet() { return [fixedQueryVector(), deterministicVector(3), deterministicVector(7), deterministicVector(11)]; }
function databaseBackedCheck(rowsByCollection, query, { now = Date.now(), topK = 5 } = {}) {
  const matches = retrieve(query, collectionRows(rowsByCollection, now), topK);
  return { overallRisk: classify(matches[0]?.score ?? 0), matches: matches.map(match => ({ ...match, similarityClass: classify(match.score) })) };
}
function compareChecks(baseline, candidate, tolerance = 1e-12) {
  const differences = [];
  const baselineOrder = baseline.matches.map(match => [match.topic.collection, match.topic.id]); const candidateOrder = candidate.matches.map(match => [match.topic.collection, match.topic.id]);
  const overallRiskParity = baseline.overallRisk === candidate.overallRisk; if (!overallRiskParity) differences.push({ field: 'overallRisk', baseline: baseline.overallRisk, candidate: candidate.overallRisk });
  const topKMatchCount = baseline.matches.length; if (baseline.matches.length !== candidate.matches.length) differences.push({ field: 'top5Length', baseline: baseline.matches.length, candidate: candidate.matches.length });
  const compared = Math.min(baseline.matches.length, candidate.matches.length);
  let identityOrderParity = baseline.matches.length === candidate.matches.length; let classParity = baseline.matches.length === candidate.matches.length; let maxAbsoluteScoreDifference = 0;
  for (let index = 0; index < compared; index += 1) {
    const left = baseline.matches[index]; const right = candidate.matches[index];
    if (left.topic.collection !== right.topic.collection || left.topic.id !== right.topic.id) { identityOrderParity = false; differences.push({ field: 'identityOrOrder', index, baseline: [left.topic.collection, left.topic.id], candidate: [right.topic.collection, right.topic.id] }); }
    if (left.similarityClass !== right.similarityClass) { classParity = false; differences.push({ field: 'similarityClass', index, baseline: left.similarityClass, candidate: right.similarityClass }); }
    const scoreDifference = Math.abs(left.score - right.score); maxAbsoluteScoreDifference = Math.max(maxAbsoluteScoreDifference, scoreDifference); if (scoreDifference > tolerance) differences.push({ field: 'rawScore', index, scoreDifference, tolerance });
  }
  return { passed: differences.length === 0, differences, topKMatchCount, baselineOrder, candidateOrder, identityOrderParity, classParity, overallRiskParity, maxAbsoluteScoreDifference, tolerance };
}
function compareCorpusParity(rowsByCollection, corpus, queries = parityQuerySet(), now = Date.now()) {
  return queries.map((query, index) => ({ queryIndex: index, ...compareChecks(databaseBackedCheck(rowsByCollection, query, { now }), inMemoryCheck(corpus, query, { now })) }));
}
module.exports = { deterministicVector, parityQuerySet, databaseBackedCheck, compareChecks, compareCorpusParity };
