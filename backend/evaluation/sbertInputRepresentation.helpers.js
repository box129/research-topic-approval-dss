const CLASS_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Topic ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalLine(label, value) {
  return typeof value === 'string' && value.trim() ? `${label}: ${value.trim()}` : null;
}

function formatTitleOnly(topic) {
  return requiredText(topic?.title, 'title');
}

function formatStructuredContext(topic) {
  const lines = [
    `Title: ${requiredText(topic?.title, 'title')}`,
    optionalLine('Population', topic?.population),
    optionalLine('Location', topic?.location),
    optionalLine('Study focus', topic?.study_focus)
  ].filter(Boolean);
  return lines.join('\n');
}

function valuesForClass(caseResults, representation, className) {
  return caseResults
    .filter(item => item.expected_class === className)
    .map(item => item.scores[representation])
    .filter(Number.isFinite);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function calculateClassStatistics(caseResults, representation) {
  return ['LOW', 'MEDIUM', 'HIGH'].reduce((result, className) => {
    const values = valuesForClass(caseResults, representation, className);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const variance = values.length ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length : null;
    result[className] = {
      support: values.length,
      mean: round(mean),
      median: round(median(values)),
      minimum: values.length ? round(Math.min(...values)) : null,
      maximum: values.length ? round(Math.max(...values)) : null,
      standardDeviation: round(variance === null ? null : Math.sqrt(variance))
    };
    return result;
  }, {});
}

function averageRank(values) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  let start = 0;
  while (start < indexed.length) {
    let end = start;
    while (end + 1 < indexed.length && indexed[end + 1].value === indexed[start].value) end += 1;
    const rank = (start + 1 + end + 1) / 2;
    for (let i = start; i <= end; i += 1) ranks[indexed[i].index] = rank;
    start = end + 1;
  }
  return ranks;
}

function pearson(x, y) {
  if (!x.length || x.length !== y.length) return null;
  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;
  const numerator = x.reduce((sum, value, index) => sum + ((value - xMean) * (y[index] - yMean)), 0);
  const denominator = Math.sqrt(x.reduce((sum, value) => sum + ((value - xMean) ** 2), 0) * y.reduce((sum, value) => sum + ((value - yMean) ** 2), 0));
  return denominator === 0 ? null : numerator / denominator;
}

function calculateSpearman(caseResults, representation) {
  const usable = caseResults.filter(item => Number.isFinite(item.scores[representation]) && CLASS_ORDER[item.expected_class] !== undefined);
  const expected = usable.map(item => CLASS_ORDER[item.expected_class]);
  const scores = usable.map(item => item.scores[representation]);
  return { support: usable.length, coefficient: round(pearson(averageRank(expected), averageRank(scores))) };
}

function calculateConcordance(caseResults, representation) {
  const comparisons = [['HIGH', 'MEDIUM'], ['HIGH', 'LOW'], ['MEDIUM', 'LOW']];
  let overallCorrect = 0;
  let overallTotal = 0;
  const result = {};
  comparisons.forEach(([higher, lower]) => {
    const highScores = valuesForClass(caseResults, representation, higher);
    const lowScores = valuesForClass(caseResults, representation, lower);
    let correct = 0;
    let ties = 0;
    highScores.forEach(high => lowScores.forEach(low => {
      if (high > low) correct += 1;
      else if (high === low) ties += 1;
    }));
    const total = highScores.length * lowScores.length;
    overallCorrect += correct;
    overallTotal += total;
    result[`${higher}_gt_${lower}`] = { comparisons: total, correct, ties, rate: total ? round(correct / total) : null };
  });
  result.overall = { comparisons: overallTotal, correct: overallCorrect, rate: overallTotal ? round(overallCorrect / overallTotal) : null };
  return result;
}

function calculateClassMargins(classStatistics) {
  const mean = name => classStatistics[name].mean;
  const subtract = (a, b) => a === null || b === null ? null : round(a - b);
  return { highMinusMedium: subtract(mean('HIGH'), mean('MEDIUM')), mediumMinusLow: subtract(mean('MEDIUM'), mean('LOW')), highMinusLow: subtract(mean('HIGH'), mean('LOW')) };
}

function calculateBaselineReproduction(caseResults, historicalScores, tolerance = 0.005) {
  const differences = caseResults.map(item => Math.abs(item.scores.title_only - historicalScores[item.id])).filter(Number.isFinite);
  return { tolerance, comparedCases: differences.length, meanAbsoluteDifference: round(differences.reduce((sum, value) => sum + value, 0) / differences.length), maximumAbsoluteDifference: round(Math.max(...differences)), casesOutsideTolerance: differences.filter(value => value > tolerance).length };
}

module.exports = { formatTitleOnly, formatStructuredContext, calculateClassStatistics, calculateSpearman, calculateConcordance, calculateClassMargins, calculateBaselineReproduction };
