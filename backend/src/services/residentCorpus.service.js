const prisma = require('../config/database');
const logger = require('../config/logger');
const { validStoredEmbedding } = require('./voyageEmbedding.service');

const COLLECTIONS = [['HISTORICAL', 'historicalTopic'], ['CURRENT_SESSION', 'currentSessionTopic'], ['UNDER_REVIEW', 'underReviewTopic']];
const REFRESH_INTERVAL_MS = 5000;

function decorate(rows, collection) { return rows.map(row => ({ ...row, collection, studyFocus: row.studyFocus ?? row.study_focus })); }
function isEligible(topic, now = Date.now()) { return topic.collection !== 'UNDER_REVIEW' || new Date(topic.reviewStartedAt).getTime() > now - 48 * 3600000; }
// A snapshot carries its own partial-corpus accounting: rows whose stored
// embedding fails the production validity contract are excluded from search,
// and that exclusion must be visible to operators instead of silently
// shrinking the comparison corpus. Counts only — never titles, vectors, or
// identities. The counts are frozen onto the snapshot so stats() always
// describes the exact snapshot being served, never a half-built replacement.
function build(rows) {
  const candidates = COLLECTIONS.flatMap(([collection, key]) => decorate(rows[key] || [], collection));
  const topics = candidates.filter(validStoredEmbedding);
  return Object.freeze({
    topics: Object.freeze(topics),
    builtAt: new Date().toISOString(),
    sourceTopicCount: candidates.length,
    skippedInvalidEmbeddingCount: candidates.length - topics.length
  });
}
class ResidentCorpus {
  constructor(client = prisma, log = logger) { this.client = client; this.log = log; this.snapshot = null; this.lastRefreshError = null; this.lastRefreshAt = 0; this.inFlightRefresh = null; this.queuedFollowUp = null; }
  // One actual read/build/swap attempt. Only the serialization layer below may
  // call this: refresh attempts must never run concurrently, because an
  // older-started attempt finishing last would overwrite a newer snapshot,
  // advance lastRefreshAt with stale data, and let an obsolete failure mark a
  // healthy snapshot degraded (all reproduced in the single-flight audit).
  async _refreshOnce() {
    try {
      const rows = Object.fromEntries(await Promise.all(COLLECTIONS.map(async ([, key]) => [key, await this.client[key].findMany()])));
      const next = build(rows);
      const previousSkipped = this.snapshot ? this.snapshot.skippedInvalidEmbeddingCount : 0;
      this.snapshot = next; this.lastRefreshAt = Date.now();
      // Recovery is logged once per outage, not on every routine refresh.
      if (this.lastRefreshError) { this.log.info('Resident corpus refresh recovered', { topics: next.topics.length }); }
      this.lastRefreshError = null;
      // Partial-corpus state changes are logged once per change, not on every
      // equivalent refresh: a new or changed skipped count warns, and a return
      // to full embedding coverage is announced once.
      if (next.skippedInvalidEmbeddingCount > 0 && next.skippedInvalidEmbeddingCount !== previousSkipped) {
        // admittedTopicCount counts every valid row frozen into the snapshot;
        // how many of those are CURRENTLY searchable also depends on the
        // 48-hour under-review eligibility window evaluated at query time, so
        // that time-dependent number is deliberately not named here.
        this.log.warn('Resident corpus snapshot is partial: stored rows with invalid embeddings were excluded from search', {
          sourceTopicCount: next.sourceTopicCount,
          admittedTopicCount: next.topics.length,
          skippedInvalidEmbeddingCount: next.skippedInvalidEmbeddingCount
        });
      } else if (next.skippedInvalidEmbeddingCount === 0 && previousSkipped > 0) {
        this.log.info('Resident corpus recovered full embedding coverage', {
          sourceTopicCount: next.sourceTopicCount
        });
      }
      return next;
    } catch (error) {
      // State-change logging: the first failure of an outage is logged; a
      // continuing identical failure is not repeated on each retry.
      if (this.lastRefreshError !== error.message) { this.log.error('Resident corpus refresh failed', { error: error.message }); }
      this.lastRefreshError = error.message; throw error;
    }
  }
  // Explicit freshness barrier for callers that just committed a write
  // (submission create/revise, lecturer decision, topic import, startup).
  // Contract: when the returned promise resolves, at least one attempt whose
  // database reads BEGAN after this call has completed — a caller's committed
  // row can therefore never be missing because it joined an attempt that read
  // the tables before the commit became visible. While an attempt is running,
  // all explicit callers share ONE queued follow-up (bounded, never an
  // unbounded queue); the follow-up starts only after the running attempt
  // settles, runs even if that attempt failed, and a further explicit call
  // arriving while the follow-up itself runs queues another one, so no
  // write-triggered refresh is ever lost.
  refresh() {
    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this._refreshOnce().finally(() => { this.inFlightRefresh = null; });
      return this.inFlightRefresh;
    }
    if (!this.queuedFollowUp) {
      this.queuedFollowUp = this.inFlightRefresh
        .catch(() => {})
        .then(() => {
          // Clear before starting the next generation so an explicit refresh
          // arriving while the follow-up runs queues a fresh follow-up.
          this.queuedFollowUp = null;
          return this.refresh();
        });
    }
    return this.queuedFollowUp;
  }
  // Read-side freshness accessor: a fresh snapshot is returned immediately; a
  // stale/absent one joins the attempt already in flight (recency is all a
  // reader needs) or starts exactly one. Stale-boundary bursts therefore
  // collapse to a single set of database reads.
  async get() {
    if (this.snapshot && Date.now() - this.lastRefreshAt < REFRESH_INTERVAL_MS) { return this.snapshot; }
    if (this.inFlightRefresh) { return this.inFlightRefresh; }
    return this.refresh();
  }
  searchable(snapshot = this.snapshot, now = Date.now()) { if (!snapshot) throw new Error('Resident corpus is unavailable.'); return snapshot.topics.filter(topic => isEligible(topic, now)); }
  // Safe operational summary for admin diagnostics and readiness: sizes and
  // timestamps only, never topic content. sourceTopicCount and
  // skippedInvalidEmbeddingCount are frozen on the active snapshot, while
  // searchableTopicCount is deliberately CURRENT-TIME derived: under-review
  // rows age out of the 48-hour eligibility window without a rebuild, so the
  // searchable number tracks what a check would actually compare against.
  stats(now = Date.now()) {
    if (!this.snapshot) {
      return {
        built: false,
        topics: null,
        searchable: null,
        builtAt: null,
        sourceTopicCount: null,
        searchableTopicCount: null,
        skippedInvalidEmbeddingCount: null,
        lastRefreshError: this.lastRefreshError
      };
    }
    const searchableCount = this.searchable(this.snapshot, now).length;
    return {
      built: true,
      topics: this.snapshot.topics.length,
      searchable: searchableCount,
      builtAt: this.snapshot.builtAt,
      sourceTopicCount: this.snapshot.sourceTopicCount,
      searchableTopicCount: searchableCount,
      skippedInvalidEmbeddingCount: this.snapshot.skippedInvalidEmbeddingCount,
      lastRefreshError: this.lastRefreshError
    };
  }
}
const residentCorpus = new ResidentCorpus();
module.exports = { ResidentCorpus, residentCorpus, build, isEligible, REFRESH_INTERVAL_MS };
