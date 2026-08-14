const { positiveInteger } = require('../lib');
const { eligibleTopics } = require('./corpus-loader');

function expectedRecords(scale, expectedSize) {
  if (scale === 'small') { if (expectedSize === undefined) throw new Error('--expected-size is required when --scale is small.'); return positiveInteger(expectedSize, '--expected-size'); }
  const numeric = positiveInteger(scale, '--scale'); if (![1000, 5000, 10000].includes(numeric)) throw new Error('--scale must be small, 1000, 5000, or 10000.'); return numeric;
}
function assertFixtureIntegrity(corpus, expected, now = Date.now()) {
  const searchable = eligibleTopics(corpus, now).length; const report = { expectedRecords: expected, loadedRecords: corpus.counts.loaded, admittedRecords: corpus.counts.admitted, rejectedRecords: corpus.counts.rejected, searchableRecordsAtStart: searchable };
  if (report.rejectedRecords !== 0 || report.admittedRecords !== expected || report.searchableRecordsAtStart !== expected) throw new Error(`Fixture integrity failed: expected ${expected}; loaded ${report.loadedRecords}; admitted ${report.admittedRecords}; rejected ${report.rejectedRecords}; searchable ${report.searchableRecordsAtStart}.`);
  return report;
}
module.exports = { expectedRecords, assertFixtureIntegrity };
