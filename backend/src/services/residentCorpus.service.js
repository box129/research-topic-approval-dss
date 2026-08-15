const prisma = require('../config/database');
const { validStoredEmbedding } = require('./voyageEmbedding.service');

const COLLECTIONS = [['HISTORICAL', 'historicalTopic'], ['CURRENT_SESSION', 'currentSessionTopic'], ['UNDER_REVIEW', 'underReviewTopic']];
const REFRESH_INTERVAL_MS = 5000;

function decorate(rows, collection) { return rows.map(row => ({ ...row, collection, studyFocus: row.studyFocus ?? row.study_focus })); }
function isEligible(topic, now = Date.now()) { return topic.collection !== 'UNDER_REVIEW' || new Date(topic.reviewStartedAt).getTime() > now - 48 * 3600000; }
function build(rows) {
  const topics = COLLECTIONS.flatMap(([collection, key]) => decorate(rows[key] || [], collection)).filter(validStoredEmbedding);
  return Object.freeze({ topics: Object.freeze(topics), builtAt: new Date().toISOString() });
}
class ResidentCorpus {
  constructor(client = prisma) { this.client = client; this.snapshot = null; this.lastRefreshError = null; this.lastRefreshAt = 0; }
  async refresh() {
    try {
      const rows = Object.fromEntries(await Promise.all(COLLECTIONS.map(async ([, key]) => [key, await this.client[key].findMany()])));
      const next = build(rows); this.snapshot = next; this.lastRefreshAt = Date.now(); this.lastRefreshError = null; return next;
    } catch (error) { this.lastRefreshError = error.message; throw error; }
  }
  async get() { return !this.snapshot || Date.now() - this.lastRefreshAt >= REFRESH_INTERVAL_MS ? this.refresh() : this.snapshot; }
  searchable(snapshot = this.snapshot, now = Date.now()) { if (!snapshot) throw new Error('Resident corpus is unavailable.'); return snapshot.topics.filter(topic => isEligible(topic, now)); }
}
const residentCorpus = new ResidentCorpus();
module.exports = { ResidentCorpus, residentCorpus, build, isEligible, REFRESH_INTERVAL_MS };
