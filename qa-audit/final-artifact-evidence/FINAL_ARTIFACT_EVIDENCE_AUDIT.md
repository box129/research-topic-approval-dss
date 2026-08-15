# Final artefact evidence audit

## 1. Scope and frozen methodology

The final production contract is Voyage `voyage-4-large`, 1024 dimensions,
`structured-context-v1`, and raw directional cosine from a submitted `query`
embedding to a stored `document` embedding. `LOW < 0.5571529891797358`,
`MEDIUM < 0.6450102471881145`, and `HIGH` otherwise; no rounding precedes
classification. Evidence: `backend/src/services/voyageEmbedding.service.js`,
`backend/src/services/voyageSemanticSimilarity.service.js`, commit `6e68080`.

## 2. C2 production implementation

`similarity.controller.js` creates one query embedding, reads all three
lifecycle collections, applies the 48-hour under-review rule, ranks locally,
and returns a human-advisory response. It returns HTTP 503
`semantic_unavailable` for a provider failure. Tests:
`backend/src/controllers/similarity.controller.test.js` and
`backend/tests/integration/api.test.js`. Implementation/evidence commits:
`6e68080`, `e3a285b`, `514a82b`.

## 3. Embedding persistence, reuse, invalidation, and regeneration

Each lifecycle model persists `embedding`, provider, model, dimension,
representation, source-text hash, and `embeddedAt` (`backend/prisma/schema.prisma`;
migration `20260813090000_add_voyage_embedding_metadata`).
`validStoredEmbedding()` requires a valid 1024D vector and exact current
metadata plus `sourceHash(topic)`; hence changed semantic source text or any
provider/model/dimension/representation mismatch is stale. `retrieve()` admits
only valid stored embeddings, so checks do not re-embed documents. Explicit
regeneration is `backend/scripts/backfill-topic-embeddings.js`, which reuses
valid records and updates only stale ones. Contract tests:
`backend/src/services/voyageSemanticProduction.test.js`.

## 4. Provider failure, readiness, and privacy boundary

`voyageEmbedding.service.js` rejects missing configuration, transport failure,
non-OK HTTP (including 429/5xx), malformed response, and malformed vectors as
`VoyageProviderError`; the request-time path has no retry or fallback. The
backfill tool alone retries 429/500/502/503. `readiness.service.js` checks the
database and credential configuration but deliberately makes no provider probe;
it reports degraded/unavailable rather than claiming provider reachability.

The request body is exactly model, a single serialized structured topic, query
or document `input_type`, and float output type. The serializer is tested to
exclude unrelated fields (`voyageSemanticProduction.test.js`); code therefore
does not send student identity, matric number, email, account/session/auth
tokens, lecturer identity, or unrelated record metadata.

## 5. Lifecycle/searchability and scoring

Historical and current-session topics are searched; under-review topics are
searched only when `reviewStartedAt` is within 48 hours. Result identities
include collection provenance, avoiding cross-table numeric-ID collisions.
Evidence: `backend/src/controllers/similarity.controller.js`, lifecycle
regression tests, and commit `e3a285b`.

The active path has no hash, SBERT, Jaccard, TF-IDF, weighted, or pair-mean
fallback. Such historical services remain outside this production endpoint.
`embedQuery()` is called once; no submitted-topic document/reverse embedding is
created; `retrieve()` computes raw cosine against persisted document vectors.

## 6. C1.5 frozen directional benchmark

Frozen artifact: `backend/evaluation/results/voyage-production-direction-calibration.json`
at commit `f925a95` (not materialized in this sparse worktree; read directly
from the immutable commit). It records 120 pairs, 113 components, benchmark
SHA-256 `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`.

Grouped held-out performance: accuracy `0.791667`, macro precision `0.791813`,
macro recall `0.792813`, macro-F1 `0.792062`. Confusion matrix (actual rows):
LOW `[32,7,0]`, MEDIUM `[6,28,7]`, HIGH `[0,5,35]`.

Directional AB Spearman is `0.888753` (n=120). Concordance: HIGH>MEDIUM
`1535/1640=0.935976`; HIGH>LOW `1560/1560=1`; MEDIUM>LOW
`1522/1599=0.951845`; overall `4617/4799=0.962075`.

Five grouped folds used thresholds `(T1,T2)`: `(0.557153,0.645010)`,
`(0.529179,0.630801)`, `(0.557153,0.645700)`, `(0.512036,0.644579)`, and
`(0.516126,0.645010)`; held-out sizes were 25,24,24,24,23. All-data deployment
thresholds are the frozen production values in section 1. Bootstrap used 5,000
connected-component resamples: T1 median `0.545841`, 95% interval
`[0.504517,0.560869]`; T2 median `0.644724`, 95% interval
`[0.630203,0.655772]`. Artifact timestamp and Git metadata: NOT PRESENT IN
FROZEN ARTIFACT. Historical bidirectional results are not used here.

## 7. C4 baseline scalability

Frozen artifacts: `qa-audit/c4-production-scale/results/local-*.json`, commit
`7d7fe37` / harness `c61d00a`. All had zero failures. At 5,000/c1, database
p50/p95/max was `3439.8066/6617.0973/7648.6645 ms`; ranking
`36.1635/100.5595/106.1976 ms`; total `3482.1164/6726.1219/7763.714 ms`; peak
RSS `1267236864` bytes. This establishes database/JSON-vector retrieval as the
primary bottleneck, not exact local ranking. The artifacts also preserve the
small and 1,000/c1,c5,c10 measurements and their RSS values.

## 8. C4B selected 5,000-record architecture

`c4b-parity.json` (commit `7a65772`) reports 4/4 queries passed, exact identity
order/class/overall-risk parity, and maximum score difference 0 (tolerance
1e-12). Resident in-memory exact corpus was selected; ANN/HNSW and pgvector
exact retrieval remain deferred.

At 5,000/c1: request p50/p95/max `116.0424/191.0711/230.4101 ms`, service p95
`190.999 ms`, ranking p95 `188.9982 ms`, throughput p50 `8.4493/s`, peak RSS
`269012992` bytes; startup build was `12630.4183 ms`. At c5: request p95
`276.5702 ms`, service p95 `67.9522 ms`, ranking p95 `67.6783 ms`. At c10:
request p95 `1122.1017 ms`, service p95 `157.4678 ms`, ranking p95 `156.2477
ms`, throughput p50 `13.6003/s`, peak RSS `266854400` bytes. Artifacts:
`c4b-5000-c1.json`, `c4b-5000-c5.json`, `c4b-5000-c10.json`.

Baseline 5k p95 `6726.1219 ms` to C4B c1 request p95 `191.0711 ms` is a
`97.15926795795954%` reduction and `35.202x` speedup. These are cloned technical
fixture results, not a departmental-distribution claim.

## 9. C5, C6, and C7

C5 (`qa-audit/c5-provider-latency/results/voyage-4-large-query-latency.json`,
commit `d1409e4`): 10/10 successes; 0 failures, 429s, 5xx, or transport
failures; min/p50/p95/max/mean/SD `797.1802/942.0516/1854.5033/1854.5033/
1054.00815/291.08092 ms`. This is a small technical sample, not a provider SLA.

C6 (`qa-audit/c6-end-to-end/results/c6-end-to-end.json`, commit `d5d8af8`):
5,000/5,000 loaded/admitted, zero failures. Provider p50/p95
`1002.5374/1515.1621 ms`; local p50/p95 `132.5002/211.3693 ms`; directly
observed end-to-end p50/p95/max/mean `1193.0964/1680.9298/1680.9298/
1260.56156 ms`. It is semantic-pipeline latency, not browser/network/API SLA.

C7 (`qa-audit/c7-query-repeatability/results/c7-repeatability.json`, evidence
commit `8057f18`, harness `a46306d`): 10/10 successes; zero failures/429/5xx/
transport failures; one fingerprint; all vectors bit-identical; minimum cosine
1; maximum component difference 0; top-1, top-5, and overall-risk stable; all
five rank score ranges 0; zero threshold-probe class crossings. This did not
establish universal provider determinism.

## 10. Final regression and cost evidence

## Resident Corpus Coherence

Production now owns a single-process resident exact-vector snapshot in
`backend/src/services/residentCorpus.service.js` (commit pending). It loads all
three lifecycle tables once on first semantic check, admits only the frozen
`validStoredEmbedding` contract, builds a complete immutable next snapshot, and
only then atomically replaces the active snapshot. Import persistence triggers
an immediate refresh after an actual insert; otherwise a controlled five-second
refresh interval detects ordinary persisted updates/backfill regeneration without
a database read on every check. Failed refresh preserves the prior snapshot and
records the failure; an initial failure leaves similarity unavailable rather
than enabling lexical/fake fallback.

Under-review records can remain in the snapshot, but `isEligible()` applies the
48-hour boundary at each request, so expiry does not require a rebuild. 48-hour
UNDER_REVIEW eligibility is a researcher/system-design rule unless a separate
stakeholder artifact explicitly establishes it as departmental policy. This is
single-process coherence; multiple Node instances maintain independent snapshots
and obtain bounded refresh convergence rather than distributed push coherence.

Focused proof: `backend/src/services/residentCorpus.service.test.js`; controller
use: `backend/src/controllers/similarity.controller.js`; import trigger:
`backend/src/services/topicImportPersistence.service.js`. The final local
semantic-retrieval architecture demonstrated practical exact retrieval over a
5,000-topic technical corpus.

On the disposable `topic_similarity_test` database, full backend verification
passed 54/54 suites and 617/617 tests: 85.91% statements, 70.90% branches,
94.19% functions, 85.85% lines. Repair commit: `514a82b`.

The architecture uses one request-time query embedding and document embeddings
once then on stale regeneration; it does not re-embed every historical document.
No current monetary pricing is recorded in repository evidence, so cost requires
an external pricing lookup and is not asserted here.

## 11. Claim boundaries and readiness

The benchmark is research evidence rather than departmental ground truth; scale
fixtures are technical clones; latency samples are not SLAs; C7 is not a
provider-wide determinism guarantee. Within those boundaries, implementation,
5,000-topic exact-corpus scalability, and the final artefact evidence package
are complete enough for Chapters Four and Five. No additional technical evidence
is indispensable before writing.

## 12. Artifact/commit index

Production: `6e68080`; provenance correction: `e3a285b`; directional freeze:
`f925a95`; C4 harness/result: `c61d00a` / `7d7fe37`; C4B: `db7ac49`,
`7a65772`, `c4091ae`, `8b7ede3`, `81a9711`; C5: `d1409e4`; C6:
`816f7c2`, `d5d8af8`; C7: `a46306d`, `8057f18`; final repair: `514a82b`.
