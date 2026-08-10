const VALID_CLASSES = new Set(['LOW', 'MEDIUM', 'HIGH']);
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const topicKey = topic => [topic.title, topic.population, topic.location, topic.study_focus].map(normalize).join('|');
const pairKey = item => [topicKey(item.submitted), topicKey(item.existing)].sort().join(' <=> ');

function validateExpandedSemanticBenchmark(dataset) {
  const errors = []; const ids = new Set(); const pairs = new Set(); const topics = new Map(); const support = { LOW: 0, MEDIUM: 0, HIGH: 0 }; const missing = { pairs: new Set(), population: 0, location: 0, study_focus: 0 };
  if (!dataset || !Array.isArray(dataset.cases)) return { valid: false, errors: ['Dataset must contain a cases array.'], support };
  dataset.cases.forEach((item, index) => {
    const prefix = item?.id || `case_${index}`;
    if (!item?.id || ids.has(item.id)) errors.push(`Duplicate or missing case id: ${prefix}`); else ids.add(item.id);
    if (!VALID_CLASSES.has(item?.expected_class)) errors.push(`${prefix} has unsupported expected class.`); else support[item.expected_class] += 1;
    ['submitted', 'existing'].forEach(side => { if (!item?.[side]?.title || !item[side].title.trim()) errors.push(`${prefix} is missing ${side}.title.`); ['population', 'location', 'study_focus'].forEach(field => { if (!item?.[side]?.[field]) { missing.pairs.add(item.id); missing[field] += 1; } }); const key = topicKey(item?.[side]); topics.set(key, (topics.get(key) || 0) + 1); });
    if (!item?.category || !item?.rationale) errors.push(`${prefix} is missing scenario metadata.`);
    if (item?.source_classification !== 'manually_constructed_expanded_benchmark') errors.push(`${prefix} has invalid provenance.`);
    if (item?.review_status !== 'not_department_expert_validated') errors.push(`${prefix} has invalid review status.`);
    const key = pairKey(item); if (pairs.has(key)) errors.push(`${prefix} duplicates a topic pair or reversed pair.`); else pairs.add(key);
    const forbidden = ['expected_class', 'expected_label', 'expected_risk', 'rationale', 'category', 'tags', 'notes', 'source_classification', 'review_status'];
    [item.submitted, item.existing].forEach(value => forbidden.forEach(field => { if (Object.prototype.hasOwnProperty.call(value || {}, field)) errors.push(`${prefix} leaks ${field} into topic input.`); }));
  });
  if (dataset.cases.length !== 120) errors.push(`Expected 120 cases, got ${dataset.cases.length}.`);
  const frozenSupport = { LOW: 39, MEDIUM: 41, HIGH: 40 };
  Object.entries(frozenSupport).forEach(([label, count]) => { if (support[label] !== count) errors.push(`Expected ${count} ${label} cases, got ${support[label]}.`); });
  const supportCounts = Object.values(support);
  const maxClassDifference = Math.max(...supportCounts) - Math.min(...supportCounts);
  if (maxClassDifference > 2) errors.push(`Class support differs by more than two cases: ${JSON.stringify(support)}.`);
  if (missing.pairs.size < 12 || missing.pairs.size > 18) errors.push(`Expected 12-18 incomplete-record pairs, got ${missing.pairs.size}.`);
  ['population', 'location', 'study_focus'].forEach(field => { if (!missing[field]) errors.push(`Missing-context coverage lacks ${field} omissions.`); });
  const repeatedTopicCount = [...topics.values()].filter(count => count > 1).length;
  if ([...topics.values()].some(count => count > 2)) errors.push('Obvious copy duplication: a complete topic record occurs more than twice.');
  return { valid: errors.length === 0, errors, support, maxClassDifference, totalCases: dataset.cases.length, uniquePairCount: pairs.size, repeatedTopicCount, missingContext: { pairs: missing.pairs.size, population: missing.population, location: missing.location, study_focus: missing.study_focus } };
}
module.exports = { validateExpandedSemanticBenchmark, pairKey, topicKey };
