# Production-Readiness Finding Adjudication

Baseline: `staging/render-acceptance` = `e5e3fc18555fafde7fa409352b37357c0bb22c43`.
Audit adjudicated: `docs/audits/production-readiness-forensic-audit.md` (commit `01074d9`).

Method: STATIC FINDING → MINIMAL FALSIFYING TEST → OBSERVED RESULT → FINAL SEVERITY →
REMEDIATION DECISION. Every dynamic test ran against the *real* service, transaction and
(where stated) HTTP controller path of the baseline, on two scratch PostgreSQL databases
(`rtadss_adjudication`, `rtadss_adjudication_scale`) created for this pass, migrated with the
baseline's own 14 migrations and dropped afterwards. The Voyage client was replaced at module
level by deterministic 1024-dimensional vectors; **no provider call was made**. Harness scripts
lived in the job scratch directory and are not part of the repository. No application code,
migration, threshold, provider, model or infrastructure was modified; nothing was deployed.

Labels: VERIFIED BY RUNTIME (observed in these tests), VERIFIED FROM CODE, DOCUMENTED BUT NOT
VERIFIED, INFERENCE, UNKNOWN.

A harness error is disclosed in §1: the first three HTTP-path race runs never applied their
start stagger (supertest requests start lazily on `.then()`); those runs are reported for what
they actually exercised, and the corrected run is the one relied upon.

---

## 1. Concurrent lecturer decision race

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1 (audit P1-2); treated here as a P0 candidate |
| TEST | Scratch DB. One synthetic student, two lecturers (A approves, B rejects with a 90-character rationale). Per iteration a fresh `PENDING_REVIEW` submission with a valid under-review corpus row (the state that awaits a decision; an `AWAITING_REVISION` row cannot be decided at all, `submission.service.js:794-800`). **Service/transaction path**: `createSubmissionService({prismaClient}).updateLecturerSubmissionStatus` called by both lecturers with start staggers 0 / 3 / 15 ms, alternating which one starts first, 48 iterations. **Sequential control**: approve, then reject. **HTTP controller path**: `PATCH /api/v1/lecturer/submissions/:id/status` with two real session cookies through the real Express app (`supertest`), approve started 5–70 ms before reject, 36 iterations. After every race: submission row, `current_session_topics`, `under_review_topics`, notifications, audit rows, and a fresh `ResidentCorpus.refresh()` + `searchable()` lookup. |
| OBSERVED RESULT | **Service path (48):** 41 races → both callers succeeded; 7 → one caller got `400 SUBMISSION_NOT_PENDING`. Approve committed last 32×, reject last 16×. **9 races ended `status = REJECTED` with a `current_session_topics` row for the same submission still present and returned by `searchable()` as `CURRENT_SESSION`** (under-review row deleted by both). In the 32 approve-last double-success races the earlier rejection *and its rationale* were overwritten with a 200 to both callers. Student received 2 decision notifications in 41/48 races ("Topic rejected" and "Topic approved" for the same submission). Audit rows written for decisions: 0 (decisions are not audited at all). **Sequential control:** second call `400 SUBMISSION_NOT_PENDING`, state consistent. **HTTP path (36, approve started first):** 17 races → both `200`, final `REJECTED`, `current_session_topics` row present and searchable as `CURRENT_SESSION`; 19 → reject `400`. Three earlier HTTP runs (95 iterations) whose stagger was not applied show the other mode: 81 double-successes where the approve overwrote the rejection silently. Resident corpus disagreement is **permanent** (the stray row survives every refresh), not temporary. |
| CONFIRMED? | **YES — VERIFIED BY RUNTIME**, both orderings, both at the service and the controller path. |
| REAL IMPACT | (1) A rejected proposal is served as an approved `CURRENT_SESSION` topic in every later similarity check — fabricated evidence for other students and lecturers. (2) A lecturer's decision and rationale can be discarded silently while the UI reports success. (3) The student receives contradictory notifications. (4) No audit record exists to reconstruct what happened. Precondition: two lecturers act on the same pending submission within the window between the first caller's status check and its commit (measured ≈ 5–70 ms through HTTP, wider on slower hosts); the review queue is shared by all lecturers, so the precondition is plausible in a busy review session but rare. Root cause: `updateLecturerSubmissionStatus` checks status outside the transaction and updates `where: { id }` without a status predicate (`submission.service.js:784-800, 849-853`). |
| FINAL SEVERITY | **P0** under the audit's own definition (a verified data-integrity defect capable of a false academic result and of corrupting the academic record). Low probability does not lower the class; the model is "capable of". |
| FIX BEFORE HOSTED STAGING? | YES |
| FIX BEFORE REAL DATA? | YES |
| HOSTED ACCEPTANCE ONLY? | No |
| ACCEPTED LIMITATION? | No |

Smallest fix (not implemented): make the transition atomic — update with `where: { id, status: 'PENDING_REVIEW' }`
inside the transaction (or `updateMany` and check `count === 1`), map the no-row case to the existing
`400 SUBMISSION_NOT_PENDING`, and add the two-lecturer concurrency test (real PostgreSQL) asserting exactly one
success and `current_session_topics` present iff the final status is `APPROVED`.

---

## 2. Lecturer similarity snapshot contract

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1 (audit P1-1) |
| TEST | Scratch DB with three crafted HISTORICAL topics whose vectors were built to score ≈ HIGH / MEDIUM / LOW against the submission's query vector, plus incidental rows from the other harnesses. Real HTTP path: lecturer login → `POST /api/v1/lecturer/submissions/:id/similarity-check` (production snapshot persistence via `lecturerSimilarity.controller.js:31-45`) → read `similarity_check_snapshots` → `GET …/similarity-snapshots` (what the lecturer sees later). |
| OBSERVED RESULT | **Lecturer saw** (`response.data`): `overall_risk: HIGH`, `max_similarity: 0.99999…`, `corpus_size`, and `matches[]` with 5 entries carrying `id`, `title`, `collection`, `semantic_score` (0.9999 / 0.6332 / 0.2396 / 0.0579 …), `similarity_class` (HIGH / MEDIUM / LOW / LOW …), `population`, `location`, `study_focus`, `session_year`, `supervisor_name`. Response keys: `input_topic, corpus_size, overall_risk, max_similarity, matches, recommendation`. **Persisted:** `responseStatus: success`, `overallRisk: HIGH` ✓, `maxSimilarity: 0.99999…` ✓, `recommendation` ✓, `resultSummary = { tierCounts: {historical: 0, currentSession: 0, underReview: 0}, topMatches: {historical: [], currentSession: [], underReview: []}, hasSbertScores: true }`. **Listed later:** the same zeros. Match ids, titles, scores, classes, population, location, study focus, session and supervisor: **none persisted**. |
| CONFIRMED? | **YES — VERIFIED BY RUNTIME.** The persistence service reads legacy `data.tier1_historical / tier2_current / tier3_under_review` and per-match `sbert / tfidf / jaccard` (`similaritySnapshot.service.js:16-61`); the controller has emitted a flat `matches[]` with `semantic_score` since the Voyage migration (`similarity.controller.js:29-42,70`). The unit tests feed the legacy shape (`similaritySnapshot.service.test.js:25`, `lecturerSimilarity.controller.test.js:49`), so they pass. |
| REAL IMPACT | *Current lecturer decision*: **not affected** — the decision page renders the live response (`SubmissionDetailPage.jsx:100-211, 498-500`). *Historical auditability*: **lost** — no record of which stored topics the lecturer was shown or how similar they were; only the top score and class survive. *Later decision rendering*: the snapshot history shows "Historical 0 / Current session 0 / Under review 0" next to a HIGH risk — misleading. *Reporting*: **not affected** — the admin export selects `responseStatus/overallRisk/maxSimilarity` and the reports summary groups by `overallRisk` (`adminReportExport.service.js`, `adminReports.service.js:122-127`). |
| FINAL SEVERITY | **P1** (auditability / evidence integrity; not decision-blocking). Every snapshot written before the fix is permanently incomplete. |
| FIX BEFORE HOSTED STAGING? | YES (serializer + the two mirrored tests + a round-trip test; small) |
| FIX BEFORE REAL DATA? | YES |
| HOSTED ACCEPTANCE ONLY? | No |
| ACCEPTED LIMITATION? | No |

---

## 3. 48-hour under-review retention

**Provenance (VERIFIED FROM GIT/CODE):**

| Item | Evidence |
| --- | --- |
| Constant | `residentCorpus.service.js:9` — `isEligible(topic, now)`: `collection !== 'UNDER_REVIEW' || reviewStartedAt > now − 48·3 600 000`; applied by `searchable()` at check time (`:31`). Hard-coded; no configuration. |
| Introducing commit (current form) | `49c7ac7` 2026-08-15 "fix(similarity): keep resident corpus coherent with topic lifecycle" (file added there). |
| Origin | February MVP: `SIMILARITY_TIER3_TIME_WINDOW_HOURS` env (default 48) in `bad6129` 2026-02-08; SQL `WHERE review_started_at > NOW() - INTERVAL '48 hours'` in `a66241d` 2026-02-08. The environment variable no longer exists. |
| Test | `residentCorpus.service.test.js:7` "atomically replaces valid searchable snapshots and filters review expiry at check time" (asserts the filtering, not the number). |
| Documentation | `docs/decisions/business-rules.md:25` — Tier 3 rule "under-review topics with SBERT ≥ 60 % and review_started_at < 48 hours", sourced from the project's `FYP_Selected/` specification (`docs/decisions/source-of-truth.md:25`); archived rationale "balances relevance vs. database load; captures recent submissions; prevents stale data; can be configured via environment variable" (`docs/archive/backend/similarity-endpoint-summary.md:369-374`). Current API doc mentions it only in the legacy section (`docs/api/backend-api.md:126`). |
| Stakeholder requirement | **None found.** No departmental, lecturer or supervisor requirement document states 48 hours; the rule is a project (FYP) specification item authored with the research design. |

**Determination:** A — not a documented *departmental* requirement (it is a documented *project* rule). B — an
engineering/research design choice. C — its stated motive was stale-record hygiene and database load in the
February design, where under-review rows were never removed; since `49c7ac7` under-review rows are deleted on
every decision (`submission.service.js:873-875`), so the hygiene motive no longer applies.

**Reproduction (VERIFIED BY RUNTIME, pure function, synthetic timestamps):**

| Age of `reviewStartedAt` | Participates in similarity search? |
| --- | --- |
| 47 h 59 m | yes |
| 48 h 00 m 00.000 s | **no** (strict `>`) |
| 48 h 00 m 00.001 s | no |
| 48 h 01 m | no |
| 72 h | no |
| HISTORICAL (5 years) / CURRENT_SESSION (400 days) | yes — never time-filtered |

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1 (audit P1-3) |
| CONFIRMED? | Behaviour confirmed; **the code is correct with respect to its rule** |
| REAL IMPACT | Any submission that waits more than two days for review becomes invisible to every other student's pre-check and to lecturer review-time checks of *other* submissions; pending-vs-pending collisions are then only caught after one of them is approved. Review turnaround in the pilot is expected to be days, not hours (INFERENCE from the workflow documents). |
| FINAL SEVERITY | **POLICY DECISION** (code: NOT A DEFECT). Left unexamined it carries P1-class evidence impact. |
| FIX BEFORE HOSTED STAGING? | Decide the policy; if the decision is "pending means visible", the change is one constant plus its test |
| FIX BEFORE REAL DATA? | The policy must be decided before real data |
| HOSTED ACCEPTANCE ONLY? | No |
| ACCEPTED LIMITATION? | Only if the department explicitly accepts the 48-hour blind spot |

**Policy recommendation (separate from correctness):** a proposal should stay in the comparison corpus for as
long as it is pending. Recommend removing the time cutoff (eligibility = row still exists, which the lifecycle
already guarantees), or reinstating a configurable window whose default exceeds the department's review
turnaround, and recording the decision in the semantic contract document. Do not change the value in this pass.

---

## 4. Calibration artefact / threshold provenance

**Verified (VERIFIED BY RUNTIME from Git objects; nothing recalibrated):**

| Item | Value |
| --- | --- |
| T1 / T2 in code | `0.5571529891797358` / `0.6450102471881145` (`voyageSemanticSimilarity.service.js:3`), pinned by `semanticRepresentationContract.test.js` |
| T1 / T2 in artefact | `productionContract.thresholds = { t1: 0.5571529891797358, t2: 0.6450102471881145 }` — identical |
| Model / dimension / representation | `voyage-4-large` / 1024 / `structured-context-v1` (artefact `source` block and code constants agree) |
| Direction | `cosine(submitted_query, existing_document)` — same as the runtime |
| Benchmark SHA-256 | `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0` (before = after) |
| Benchmark size / class distribution | 120 pairs, 113 connected components; class support LOW 39 / MEDIUM 41 / HIGH 40 (`directions.AB.metrics.classStatistics`) |
| Label source | `expanded-semantic-benchmark.json` (`f7cd904`, 2026-08-10): `manually_constructed_expanded_benchmark`, `not_department_expert_validated`, "technical evaluation data, not lecturer-reviewed or departmental ground truth" |
| Calibration commit | `f925a95` 2026-08-13 "test(evaluation): freeze Voyage production scoring contract" |
| Ancestry | Neither `f925a95` nor `f7cd904` is an ancestor of `e5e3fc1` or of `v0.5.0-defense-baseline`; both live only on the local branch `experiment/expanded-semantic-model-evaluation` |
| Remote recoverability | `git branch -r --contains f925a95` → none; `git ls-remote --heads origin 'experiment/*'` → none. **The remote does not hold these commits.** A clean clone of the production branch cannot retrieve the artefact by explicit commit — the objects are absent, not merely unreachable from a branch tip. |

**Runtime correctness vs research reproducibility:** the runtime never reads the artefact; it uses the constants
above, and the contract test pins them. The artefact being off production ancestry **cannot** change runtime
behaviour. What it does put at risk is *reproducibility of the calibration*: if this local clone is lost, the only
evidence of how T1/T2 were derived is prose in `docs/product/semantic-representation-contract-closure.md` and
`qa-audit/final-artifact-evidence/…` (both in the tree), which cite the SHA-256 of a file nobody else can fetch.

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1 (4a labels) + P2 (4b reachability) |
| CONFIRMED? | Facts confirmed; the *runtime* P1 classification is **withdrawn** |
| REAL IMPACT | Research reproducibility and academic defensibility; zero runtime impact |
| FINAL SEVERITY | **RESEARCH LIMITATION** (labels not lecturer-reviewed) + **P2** provenance hygiene (artefacts exist only in one local clone) |
| FIX BEFORE HOSTED STAGING? | Provenance: push the experiment branch (or an annotated tag such as `evaluation/c1.5-frozen` at `f925a95`) to the remote — no code change, immediate, reversible |
| FIX BEFORE REAL DATA? | Labels: no fix possible without the lecturer-reviewed benchmark; record the explicit acceptance that thresholds are advisory pending that study |
| HOSTED ACCEPTANCE ONLY? | No |
| ACCEPTED LIMITATION? | Yes, explicitly, for the pilot |

Smallest provenance improvement: push the branch/tag; optionally a docs-only commit on the production lineage
carrying `voyage-production-direction-calibration.json` and `expanded-semantic-benchmark.json` under
`docs/evaluation/frozen/` with their SHA-256 values.

---

## 5. Corpus refresh scale

**Methodology check of the earlier C4 benchmark (VERIFIED FROM CODE):** `run-local-scale-benchmark.js:9-16`
re-fetches all three tables from PostgreSQL inside *every* iteration before ranking, so its `databaseRetrievalMs`
p50 3.4 s / p95 6.6 s at 5 000 is per-iteration **refresh** latency, not warm query latency; its "peak RSS
1.27 GB" was sampled across 30 repeated full loads in one process (GC pressure), i.e. partly a benchmark
artefact. Its ranking figures (36 ms p50 at 5 000) are genuine warm-path numbers.

**Measurements (VERIFIED BY RUNTIME; scratch DB with valid `voyage-4-large` metadata and source hashes on every
row; laptop-class host; medians of 3 refreshes and 20 warm queries; `--expose-gc`):**

| Valid vectors | PostgreSQL fetch (3 × `findMany`) | Validate + build snapshot | Total refresh | `refresh()` via API | Warm `get()` | Warm similarity query (rank + classify) | RSS warm after GC | Heap warm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 500 | 811 ms | 41 ms | 878 ms | 947 ms | 0.017 ms | 6.4 ms (max 31) | 133 MB | 27 MB |
| 1 000 | 1 847 ms | 13 ms | 1 860 ms | 1 828 ms | 0.024 ms | 15.1 ms (max 28) | 205 MB | 49 MB |
| 2 500 | 4 139 ms | 35 ms | 4 213 ms | 4 043 ms | 0.026 ms | 42.7 ms (max 60) | 480 MB | 110 MB |
| 5 000 | 8 317 ms | 57 ms | 8 456 ms | 8 625 ms | 0.023 ms | 85.8 ms (max 109) | 806 MB | 217 MB |

Table size on disk: 6 / 12 / 31 / 62 MB (JSONB vectors).

**Steady-state behaviour (VERIFIED BY RUNTIME):** `residentCorpus.get()` has **no single-flight**: 10 concurrent
reads of a stale snapshot issued 10 full fetches (fake client); on the real 5 000-row database, **5 concurrent
stale `get()` calls issued 5 full fetches, took 65 s wall-clock and peaked at 1.79 GB RSS**, against 6.7 s and
338 MB for one refresh. The snapshot is considered stale 5 s after the *last completed* refresh
(`REFRESH_INTERVAL_MS = 5000`, `:30`), so under continuous traffic the refresh is on the request path once per
5 s and every request that arrives while a refresh is running starts another one.

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1 (audit P1-5) |
| CONFIRMED? | **YES**, with the mechanism corrected: the problem is refresh-on-request-path **plus unsynchronised concurrent refreshes**, not ranking (warm query ≤ 86 ms at 5 000) and not memory of one snapshot (~0.16 MB per topic warm) |
| REAL IMPACT | At pilot scale (≤ 1 000 topics): ~1.9 s stall for the request that triggers a refresh, ×k when k requests coincide; ~200 MB. At 10× corpus: 8 s stalls, tens of seconds and > 1.5 GB under modest concurrency — a `standard` instance would be OOM-killed. |
| FINAL SEVERITY | **P1** at 10× (availability); **P2** at pilot scale |
| FIX BEFORE HOSTED STAGING? | Recommended: single-flight refresh (share the in-flight promise) and a configurable interval — small, low-risk; measure on the target instance during hosted acceptance |
| FIX BEFORE REAL DATA? | Before the corpus exceeds ~1 000 topics |
| HOSTED ACCEPTANCE ONLY? | Instance sizing and the real refresh cost are hosted items |
| ACCEPTED LIMITATION? | Acceptable for the pilot with the interval documented |

---

## 6. Observability — split

### 6A. Request logging (VERIFIED FROM CODE, all runtime call sites enumerated)

Winston levels: `error 0, warn 1, info 2, http 3, debug 4`; production ships `LOG_LEVEL=info`, so `http` and
`debug` are suppressed (`logger.js:14-20,118`, `render.yaml`).

| Level | Events emitted (message, call site) |
| --- | --- |
| error (12) | `Request failed` (≥500, with requestId/path/status/duration/userId/ip — `requestContext.middleware.js:71`); `Error occurred:` (error handler, stack in operator logs — `errorHandler.middleware.js:105`); `Database connectivity lost`; `Resident corpus refresh failed`; `SMTP email delivery failed`; `HTTP server error.`; `Server startup failed.`; four shutdown/fatal messages (`serverLifecycle.js`) |
| warn (9) | `Voyage provider status changed` (to unavailable); `Failed to store lecturer similarity snapshot`; `Audit log creation failed`; `Notification event creation failed`; `Submission-created notification event failed`; `Password reset email could not be delivered`; `Email delivery disabled`; `Admin dashboard summary section unavailable`; `Graceful shutdown grace period elapsed…` |
| info (9) | `Server is listening.`; `Graceful shutdown started/completed`; duplicate-signal notice; `Database connectivity recovered`; `Resident corpus refresh recovered`; `Voyage provider status changed` (to available); `SMTP email accepted by transport`; `Mock email accepted` |
| http (1) — **suppressed** | `Request completed` (every request: method, path, status, duration, userId, ip) |
| debug (0) | none |

**Successful-request visibility at `info`: none per request.** Only side effects are visible (audit rows for
auth/admin actions, SMTP acceptance lines, provider/DB state changes). **Failed-request visibility:** every 5xx
(two lines with request id); 4xx responses are not logged (failed logins produce an audit row; 429s produce
nothing). Classification: **P2 configuration** (`LOG_LEVEL=http` restores per-request lines) — and a hosted
acceptance item to confirm the platform captures stdout at that volume.

### 6B. Metrics — **none.** No metrics client or exporter in dependencies or code (VERIFIED FROM CODE).

### 6C. Monitoring — **none in repository evidence.** No uptime/availability checker is configured anywhere
(code, Compose, Blueprint, CI). Render's TCP (private backend) and `GET /` (frontend) checks are restart
signals, not monitoring. Classification: HOSTED ACCEPTANCE ITEM.

### 6D. Alerting — **no alert destination exists** (no PagerDuty/Opsgenie/Slack/webhook/e-mail integration; the
monitoring document lists conditions with the vendor "deferred"). Classification: **P1 operational blocker for
unattended production; ACCEPTED LIMITATION for a supervised pilot** if an on-call person watches readiness manually.

### 6E. Bootstrap temporary password (separate security finding)

| Question | Answer (VERIFIED FROM CODE unless noted) |
| --- | --- |
| Automatic or explicit? | Explicit only: `backend/scripts/bootstrap-admin.js` via the Dockerfile `bootstrap` stage / Compose `maintenance` profile / a hosted one-off command (`deployment-runbook.md:160-163`, `render-staging-runbook.md:213-215`). Never runs at service start. |
| Where is the password emitted? | `console.log('  Temporary password: …')` — **stdout**, once (`bootstrap-admin.js:72`) |
| stdout/stderr? | stdout (errors go to stderr) |
| Retained by hosted platforms? | Render captures stdout/stderr of services and one-off jobs into its log stream with a platform-defined retention window — DOCUMENTED BY PLATFORM, NOT VERIFIED HERE. Compose `run --rm` output goes to the operator's terminal only. |
| Can redaction middleware affect it? | **No.** The winston redaction (`logger.js:37-70`) applies to winston metadata; `console.log` bypasses it. |
| Appears only once? | Yes; re-running reports "already bootstrapped" without a credential (`bootstrap-admin.js:58-60`) |
| Does `mustChangePassword` limit exposure? | Partly: the account is created with `mustChangePassword: true` (`userProvisioning.service.js:~555`), so the credential only unlocks `/auth/me` and `/auth/change-password` until a private password is set. It does **not** stop a log reader from being the first to set that password and take the account. |
| Does `credentialVersion` protect after change? | Yes: the change increments `credentialVersion` (`auth.service.js:264-268`), invalidating any session issued with the temporary password. Protection begins only after the legitimate administrator has changed it. |

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1 (audit P1-6c, bundled with alerting) |
| CONFIRMED? | YES (code); platform retention DOCUMENTED BUT NOT VERIFIED |
| REAL IMPACT | Anyone with read access to the hosted log stream can claim the first administrator account before the intended administrator does; exposure window = bootstrap → first legitimate password change |
| FINAL SEVERITY | **P1 security (hosted deployments)**; P2 for a Compose deployment run from an operator terminal |
| FIX BEFORE HOSTED STAGING? | YES — smallest: do not print the credential by default (write to a mode-0600 file path given by `--credential-file`, or require an explicit `--print-credential`), or run the bootstrap from an operator workstation against the database and change the password immediately |
| FIX BEFORE REAL DATA? | YES |
| HOSTED ACCEPTANCE ONLY? | Log retention behaviour is a hosted item; the emission path is not |
| ACCEPTED LIMITATION? | No |

---

## 7. Voyage 429 / long request

**Mocked provider-contract results (VERIFIED BY RUNTIME, `retryVoyageCall` with an injected sleep, no network):**

| Scenario | Attempts | Waits | Outcome | Worst-case wall time incl. 10 s per-attempt timeouts |
| --- | --- | --- | --- | --- |
| 429, 429, 429 | 3 | 61 000, 61 000 ms | provider error → 503 | **152 s** |
| 429, then ok | 2 | 61 000 ms | ok | 81 s |
| 503, 503, 503 | 3 | 1 000, 2 000 ms | 503 | 33 s |
| 500, 502, ok | 3 | 1 000, 2 000 ms | ok | 33 s |
| 400 / 401 / timeout | 1 | — | 503 | 10 s |

Retryable statuses `[429, 500, 502, 503]`, `MAX_VOYAGE_ATTEMPTS = 3`, wait = 61 s after a 429 else 1 s × attempt
(`topicCorpusLifecycle.service.js:5-27`); **`Retry-After` is never read** (no occurrence outside the rate
limiter). Per-attempt timeout `VOYAGE_REQUEST_TIMEOUT_MS` = 10 s. Backend shutdown: the drain window is 300 s
(`SHUTDOWN_GRACE_PERIOD_MS`), so a 152 s request completes during a graceful shutdown; the backend sets no
request timeout of its own (Node defaults). Nginx `PROXY_TIMEOUT` 660 s. **Render edge timeout: UNKNOWN.**

Production write paths that can incur the delay: `createSubmission`, `createRevisionSubmission`, approval when the
stored vector fails validation (`submission.service.js:462-471,755-776`), topic import commit (**per row**, so an
import of N new rows under sustained throttling can wait N × 152 s inside one HTTP request —
`topicImportPersistence.service.js:291-296`), and the backfill CLI. Existing tests cover attempts and statuses with
the sleep mocked, not the wall-clock bound.

| | |
| --- | --- |
| ORIGINAL SEVERITY | P1/P2 borderline (audit P1-7) |
| CONFIRMED? | Behaviour confirmed; it is a **correct, bounded retry** |
| REAL IMPACT | User-facing stalls up to 152 s on submit/revise/approve during provider throttling; imports can exceed any proxy timeout; whether the hosted edge cuts the connection is unproven |
| FINAL SEVERITY | **NOT A DEFECT** (bounded, honest) + **HOSTED ACCEPTANCE ITEM** (edge timeout) + **P2** improvement (honour `Retry-After`, cap total wait, per-row cap for imports) |
| FIX BEFORE HOSTED STAGING? | No |
| FIX BEFORE REAL DATA? | No |
| HOSTED ACCEPTANCE ONLY? | Yes — prove the edge tolerates ≥ 152 s, or cap the wait |
| ACCEPTED LIMITATION? | Yes for the pilot |

---

## 8. Duplicate initial submissions

| | |
| --- | --- |
| ORIGINAL SEVERITY | P2 |
| TEST | Frontend guard: code review of `SubmitTopicPage.jsx:125-155,225`. Backend: real HTTP path (`POST /api/v1/submissions` with one student cookie, Voyage document embedding stubbed and counted): (a) two simultaneous identical requests; (b) a third identical request afterwards ("browser retry after response loss"); then lecturer queue listing and two approvals via `PATCH …/status`. |
| OBSERVED RESULT | Frontend: `submissionPendingRef` + `isSubmitting` + `disabled={isSubmitting}` block a second click **while the first request is in flight**; both reset in `finally`, so a user who retries after an error or lost response submits again. Backend (VERIFIED BY RUNTIME): (a) `201` + `201` → **2 `PENDING_REVIEW` submissions** for one student with identical title/context; (b) `201` → **3**; **3 `under_review_topics` rows; 3 Voyage document calls**; lecturer queue lists **3 identical entries**; approving two of them → `200`, `200` → **2 `current_session_topics` rows for the same topic (competing approvals)**. No service-level check, no unique constraint. |
| CONFIRMED? | **YES** |
| REAL IMPACT | Confuses lecturer review (identical entries), duplicates corpus rows (the same topic then appears twice in every match list and inflates its presence), duplicates paid embeddings, and allows two approvals of one topic — a duplicate academic record, though visible rather than silent. |
| FINAL SEVERITY | **P1** (data hygiene / duplicate academic records) — raised from P2 |
| FIX BEFORE HOSTED STAGING? | Recommended (small) |
| FIX BEFORE REAL DATA? | YES |
| HOSTED ACCEPTANCE ONLY? | No |
| ACCEPTED LIMITATION? | No |

Smallest fix (not implemented): in `createSubmission`, refuse (409) when the same student already has a
`PENDING_REVIEW` submission with the same normalised title, and back it with an **additive** partial unique index
`(student_id, lower(title)) WHERE status = 'PENDING_REVIEW'` in a new migration so simultaneous requests cannot both
pass the check; add the concurrent-POST test.

---

## 9. Final reclassification

| Finding | Original | Test | Observed | Confirmed | Real impact | **Final** | Fix before hosted staging | Fix before real data | Hosted acceptance only | Accepted limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Decision race | P1 (P0 cand.) | service ×48, HTTP ×36 (+95 flawed) | 9/48 and 17/36 REJECTED-with-searchable-CURRENT_SESSION; silent overwrite in the other order; 2 notifications; 0 audit | Yes | false evidence, lost decisions | **P0** | Yes | Yes | No | No |
| 2 Snapshot summary | P1 | HTTP check + DB read + listing | matches/context all lost; only risk, max, recommendation persisted | Yes | auditability, misleading history | **P1** | Yes | Yes | No | No |
| 3 48 h retention | P1 | provenance + boundary reproduction | strict cutoff at 48 h 00 m; project rule, no stakeholder source, hygiene motive obsolete | Behaviour yes; not a code defect | pending-vs-pending blind spot | **POLICY DECISION** | Decide | Decide | No | Only if explicitly accepted |
| 4a Threshold labels | P1 | artefact provenance | 120 pairs, 39/41/40, manually constructed, not expert-validated | Yes | academic defensibility | **RESEARCH LIMITATION** | No | Record acceptance | No | Yes |
| 4b Artefact ancestry | P2 | Git reachability | not on remote; unrecoverable from a clean clone | Yes | reproducibility only; zero runtime effect | **P2** | Push branch/tag (no code) | — | No | No |
| 5 Corpus refresh | P1 | 500–5 000 vectors, single-flight probe, concurrent stale gets | refresh 0.9–8.5 s, warm query 6–86 ms; no single-flight; 5 concurrent stale gets = 65 s / 1.79 GB | Yes (mechanism corrected) | stalls, memory blow-up under concurrency at 10× | **P1 at 10× / P2 at pilot** | Recommended (small) | Before > ~1 000 topics | Sizing | Pilot: yes |
| 6A Request logging | P1 (bundled) | call-site enumeration | no per-request line at `info`; 5xx only | Yes | blind to 2xx/4xx/latency | **P2 config** | Set `LOG_LEVEL=http` | — | Confirm capture | — |
| 6B Metrics | P1 (bundled) | dependency/code scan | none | Yes | no rates/latency | **P2 for pilot / HOSTED ACCEPTANCE ITEM** | No | No | Yes | Pilot: yes |
| 6C Monitoring | P1 (bundled) | repo scan | none | Yes | outages unseen | **HOSTED ACCEPTANCE ITEM** | No | No | Yes | Pilot: with manual watch |
| 6D Alerting | P1 (bundled) | repo scan | no destination | Yes | nobody paged | **P1 operational blocker (production) / ACCEPTED LIMITATION (supervised pilot)** | Decide owner | Before unattended operation | Partly | Pilot: yes |
| 6E Bootstrap credential | P1 (bundled) | script trace | plaintext to stdout once; redaction cannot apply; retained by hosted logs (platform-documented) | Yes | admin takeover window | **P1 security (hosted)** | Yes | Yes | Retention only | No |
| 7 Voyage 429 | P1/P2 | mocked contract | bounded: 152 s max; `Retry-After` ignored; per-row in imports | Yes | stalls; edge timeout unknown | **NOT A DEFECT + HOSTED ACCEPTANCE ITEM + P2 improvement** | No | No | Yes | Pilot: yes |
| 8 Duplicate submissions | P2 | HTTP concurrent + retry + approvals | 3 duplicates, 3 corpus rows, 3 paid calls, 2 approvals | Yes | duplicate academic records, spend | **P1** | Recommended | Yes | No | No |

---

## 10. Remediation order (not implemented)

1. **State integrity — decision race (P0):** conditional status transition inside the transaction; concurrency test.
2. **State integrity — duplicate pending submissions (P1):** service refusal + additive partial unique index; concurrent-POST test.
3. **Secret exposure — bootstrap credential (P1):** stop printing to stdout by default (file path / explicit flag); runbook update.
4. **Auditability — snapshot serializer (P1):** read `matches[]`/`semantic_score`; correct the two mirrored tests; round-trip test. (Optionally, in the same theme but separately scoped: audit events for submission/decision — P2.)
5. **Operational blockers:** name an alert owner and wire platform log-based alerts (`Request failed`, `Database connectivity lost`, provider `unavailable`, readiness 503); set `LOG_LEVEL=http` or promote completion logs; confirm during hosted acceptance.
6. **Scale risk — corpus refresh (P1 at 10×):** single-flight refresh + configurable interval; measure on the target instance.
7. **Policy — 48-hour under-review window:** decide; if "pending means visible", one-constant change + test + contract note.
8. **Research limitation / provenance:** push `experiment/expanded-semantic-model-evaluation` (or a tag at `f925a95`) to the remote; docs-only copy of the two frozen artefacts on the production lineage; record explicit acceptance that thresholds are advisory pending the lecturer-reviewed benchmark.
9. **Cosmetic / P2:** honour `Retry-After` and cap total provider wait (per-row cap in imports), CSV formula neutralisation, logout `credentialVersion` bump, constant-time unknown-identifier login, SPA CSP, Prisma error status mapping, tracked `.env.test`, stale API docs.

---

## Final questions

| | Question | Answer |
| --- | --- | --- |
| A | Is the concurrent decision race reproducible? | **Yes.** Service path 41/48 double-successes (9 inconsistent); real HTTP controller path 17/36 inconsistent with both callers receiving 200. |
| B | Can it leave submission state and searchable corpus state inconsistent? | **Yes, permanently:** `submissions.status = REJECTED` while a `current_session_topics` row for the same submission remains and is returned by `searchable()` as `CURRENT_SESSION` after every refresh. The reverse order silently discards the rejection and its rationale. |
| C | Should it be P0 under the defined severity model? | **Yes** — verified data-integrity defect capable of a false academic result. |
| D | Are lecturer similarity snapshots currently losing evidence? | **Yes.** All match evidence (ids, titles, scores, classes, population, location, study focus, session, supervisor) is dropped; only overall risk, max similarity and the recommendation persist; tier counts are recorded as 0/0/0. |
| E | Is the 48-hour cutoff a requirement or an unsupported design choice? | A **project-specification design choice** (FYP Tier-3 rule, originally configurable, motivated by stale-record hygiene that the current lifecycle already handles); no departmental requirement supports 48 hours. |
| F | Does the calibration artefact being off production ancestry affect runtime correctness? | **No.** Runtime uses pinned constants identical to the artefact. It affects research reproducibility only — and the commits are absent from the remote, so that risk is real. |
| G | Actual warm similarity latency vs corpus-refresh latency at 500–5 000 vectors? | Warm query **6 / 15 / 43 / 86 ms** (p50) vs refresh **0.9 / 1.9 / 4.2 / 8.5 s**; warm `get()` ≈ 0.02 ms; 5 concurrent stale gets at 5 000 → 65 s and 1.79 GB because refreshes are not single-flighted. |
| H | What visibility remains at `LOG_LEVEL=info`? | 5xx failures (two lines with request id), state changes (DB/provider/corpus), lifecycle, SMTP outcomes, and audit rows for auth/admin actions. **No per-request line for 2xx/4xx**, no latency, no rates. |
| I | Does bootstrap expose a temporary credential to retained logs? | **Yes when run as a hosted job**: printed once to stdout via `console.log`, outside redaction; `mustChangePassword` narrows what it unlocks, but a log reader can set the password first. |
| J | Maximum mocked 429 request duration? | **152 s** for one document embedding (3 × 10 s timeouts + 2 × 61 s waits); per row in topic imports. |
| K | Can simultaneous initial submissions create duplicate academic records? | **Yes**: 2 simultaneous + 1 retried request produced 3 pending submissions, 3 corpus rows, 3 paid calls, and two of them were approved into `current_session_topics`. |
| L | What must be fixed before hosted staging? | Decision race (P0); bootstrap credential emission (P1); snapshot serializer (P1); duplicate pending submissions (P1, recommended); corpus single-flight (recommended); push the calibration commits to the remote (no code). |
| M | What only needs hosted verification? | Render edge timeout vs 152 s writes and long imports; `TRUST_PROXY` hop count; log capture at `http` level; platform log retention of job output; instance sizing against the refresh cost; SMTP; provider quota/429 behaviour. |
| N | What should remain unchanged? | T1/T2, model, dimension, representation and direction; the fail-closed provider behaviour and empty-corpus honesty; the bounded retry contract's fail-closed outcome (only the wait algorithm is a P2 improvement); authentication/authorization structure; migrations (only additive additions); the Render topology. |

STOP. No application code modified. Nothing deployed. Scratch databases dropped after this report.
