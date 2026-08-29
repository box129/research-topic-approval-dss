# Production-Readiness Forensic Audit — Research Topic Approval DSS

Evidence-first, adversarial audit of the accepted pre-pilot application baseline.
Nothing in this pass modified application code, migrations, thresholds, provider,
model, representation, authentication or infrastructure; nothing was deployed.

Evidence labels used throughout:

- **VERIFIED FROM CODE** — read directly from the audited tree (`e5e3fc1`), path:line cited.
- **VERIFIED BY RUNTIME** — observed by running tests/tools locally, or from frozen runtime artefacts in the repository.
- **DOCUMENTED BUT NOT VERIFIED** — asserted in documentation only.
- **INFERENCE** — reasoned from verified facts; not directly observed.
- **UNKNOWN** — cannot be established from the repository or local runtime.

## 0. Baseline record

| Item | Value | Evidence |
| --- | --- | --- |
| Audited branch / commit | `staging/render-acceptance` = `e5e3fc18555fafde7fa409352b37357c0bb22c43` (audit performed on `docs/production-readiness-audit`, cut from that commit) | `git rev-parse` — VERIFIED BY RUNTIME |
| Working tree at audit start | clean apart from one untracked, ignored capture log under `docs/product/visual-baseline/` | `git status --short` |
| Defence baseline tag object | `v0.5.0-defense-baseline` = annotated tag `499af758b4adf9265b44034a64724f69d6d77e5c` | `git cat-file -t` |
| Defence baseline peeled commit | `1898a96e95fb2fb635f8f08b777cb129fdb7529f` ("fix(frontend): restore final public auth visual design") | `git rev-list -n1` |
| Migration count | 14 directories, `20260518120000_init_v1_auth_foundation` … `20260829090000_add_submission_semantic_context` | `backend/prisma/migrations/` |
| Production deployment files | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf.template`, `docker-compose.yml`, `docker-compose.acceptance.yml` (local verification only), `render.yaml` (hosted staging blueprint, not yet provisioned) | tree listing |
| Legacy, not production | `sbert-service/`, `deploy/huggingface-sbert-space/`, Compose profile `legacy-sbert` (`docker-compose.yml:26`) | VERIFIED FROM CODE |

The docs/media branch `docs/visual-baseline-handoff` was used only for supporting
evidence (screenshots, observed-defect records); no runtime conclusion below relies on it.

---

# 1. Executive Verdict

## CONDITIONALLY READY

The repository does **not** falsify the core academic-safety claims, and it does
falsify several operational-readiness claims:

**What holds (verified):**

- Incompatible embedding spaces cannot be compared: admission to the searchable corpus
  requires provider `voyage`, model `voyage-4-large`, dimension 1024, representation
  `structured-context-v1` **and** a source hash recomputed from the row's current text
  (`backend/src/services/voyageEmbedding.service.js:73`), applied at corpus build
  (`residentCorpus.service.js:11`) and again at retrieval (`voyageSemanticSimilarity.service.js:6`).
- Provider failure never fabricates evidence: the direct check returns HTTP 503
  `semantic_unavailable` with no score and no class (`similarity.controller.js:67`); the
  empty corpus returns `overall_risk: null` with an explicit non-originality statement
  (`similarity.controller.js:63`); the write paths fail closed (`submission.service.js:462-471`).
- Every backend route is guarded server-side by `requireAuth` + `requireRole`
  (`backend/src/server.js:380-561`); students and lecturers cannot reach admin behaviour by
  bypassing the frontend; student data is scoped by `studentId`; decision history is scoped by
  `decidedById`.
- Production secrets are absent from the tree, the built bundle and Git history; startup
  validation fails closed on missing/weak secrets (`backend/src/config/env.js:196-265`).

**What does not hold (verified), blocking an unconditional verdict:**

1. **P1** Lecturer similarity snapshots persist an *empty* evidence summary because the
   snapshot service still parses the legacy tiered response shape while the live controller
   emits a flat `matches[]` array; the unit tests mirror the legacy shape, so they pass
   while the integration is broken (§9, §12).
2. **P1** Two lecturers deciding the same pending submission concurrently are not
   serialised (read-then-write without a status predicate); the last write wins and a
   `current_session_topics` row from an earlier APPROVED can survive a later REJECTED (§9).
3. **P1** Pending submissions silently leave the comparison corpus 48 hours after
   submission (`residentCorpus.service.js:9`), so pending-vs-pending collisions are
   invisible once review lags beyond two days (§3, §11).
4. **P1** The production thresholds T1/T2 were calibrated on 120 *researcher-constructed*
   pairs explicitly marked "not lecturer-reviewed or departmental ground truth"; the frozen
   calibration artefact is reachable only on `experiment/expanded-semantic-model-evaluation`
   (`f925a95`), not from the audited baseline or the defence tag (§11).
5. **P1** Corpus refresh reloads every topic row including its JSONB vector from PostgreSQL
   up to once per 5 s under traffic; the frozen C4 benchmark measured p50 3.4 s / p95 6.6 s
   and ~1.2 GB RSS at 5 000 topics (§16).
6. **P1** Nothing alerts anyone: no metrics client, no alerting integration, per-request
   completion logs are suppressed at the shipped `LOG_LEVEL=info`, and the first
   administrator's temporary password is printed to stdout by the bootstrap job (§13, §14).

Items 1–3 are small code fixes; items 4–6 are decisions the department must make
explicitly (accept, or remediate) before calling the system production-grade. The
repository alone is therefore **not** sufficient evidence to call the system
production-ready (§24-N); it is sufficient to run a supervised single-department pilot
once items 1–3 are fixed and 4–6 are explicitly accepted.

---

# 2. Verified Architecture Map

Built only from code evidence (paths in §3). PostgreSQL stores vectors as JSONB; it does
**not** rank. pgvector is not installed, referenced, or required (§8).

```
Browser (React SPA, axios, cookie rtadss_session; httpOnly, SameSite=Lax, Secure in prod)
   │  same-origin /api/*                                             frontend/src/api/client.js
   ▼
Nginx (frontend container, unprivileged, :8080)  ── proxy /api/ → backend:3000, 660 s timeouts
   │                                                                  frontend/nginx.conf.template
   ▼
Express backend (Node 20, single instance)                           backend/src/server.js
   ├─ requestContext (X-Request-Id)                                  :136
   ├─ helmet, cors(allow-list), cookieParser, optionallyAuthenticate  :137-154
   ├─ global rate limiter (express-rate-limit, in-process MemoryStore, user- or IP-keyed)  :159
   ├─ CSRF origin guard (cookie-authenticated mutations)              :160
   ├─ express.json 100 KB                                             :165
   ├─ routes: requireAuth → requireRole → [route limiter] → controller → service
   │
   ├─ Similarity read path (student check / lecturer review-time check)
   │     residentCorpus.get()  ─ every ≤5 s ─►  prisma.historicalTopic/currentSessionTopic/
   │                                            underReviewTopic.findMany()   (ALL rows, JSONB vectors)
   │     build(): filter validStoredEmbedding (provider/model/dim/representation/sourceHash)
   │     searchable(): drop UNDER_REVIEW rows older than 48 h
   │     embedQuery(structured-context-v1 text) ──HTTPS──► api.voyageai.com /v1/embeddings (10 s timeout, 1 attempt)
   │     retrieve(): exact cosine over every searchable topic, sort desc, top 5
   │     classify(top): LOW < T1 < MEDIUM < T2 ≤ HIGH
   │     lecturer variant additionally persists SimilarityCheckSnapshot
   │
   ├─ Write path (submit / revise / approve)
   │     embedDocument() with bounded retry (3 attempts; 429 → 61 s sleep)  BEFORE the transaction
   │     $transaction: submissions row + under_review_topics row (or current_session_topics upsert)
   │     refreshResidentCorpusSafely() (best effort), in-app notification rows
   │
   ▼
PostgreSQL 16 (Prisma 5.7.1; JSONB `embedding` + metadata columns on three topic tables)
```

Process-local state: resident corpus snapshot, rate-limiter counters, Voyage provider-status
cache, readiness DB-status memo. None is shared across instances (§6, §16).

---

# 3. End-to-End Topic Trace

Common transport, authentication and authorization (all **VERIFIED FROM CODE**):

| Stage | Evidence |
| --- | --- |
| Cookie/token transport | JWT (`jsonwebtoken`, default HS256) with `sub`, `role`, `cv`; 24 h `expiresIn` (`auth.service.js:105-113`, `env.js:536`); cookie `rtadss_session`, `httpOnly`, `sameSite: 'lax'`, `secure` in production, `maxAge` 24 h (`auth.service.js:80-86`, `env.js:537-538`) |
| Authentication middleware | `authenticateRequest` → `authService.authenticateToken` verifies signature, loads user, requires `ACTIVE`, compares `cv` to `credentialVersion` (`auth.service.js:194-226`); `requireAuth` rejects `mustChangePassword` with 403 (`auth.middleware.js:47-66`) |
| Authorization | `requireRole(...)` 403 on role mismatch (`auth.middleware.js:81-104`); per-route in `server.js` |
| CSRF | origin/referer allow-list for cookie-bearing non-safe methods; `requireOrigin` in production (`csrf.middleware.js:25-56`, `env.js:510-515`) |
| Rate limit | `limiters.similarity` on every embedding-triggering route: 30 per 15 min keyed by authenticated user id (`server.js:197-204,384,390,414`; `env.js:275-276`) |
| Request logging | `requestContext` logs completion at level `http` (suppressed at `info`), failures ≥500 at `error` (`requestContext.middleware.js`) |

## A. Direct "Check My Topic"

1. React: `CheckMyTopicPage` → `runSimilarityCheck(payload, {signal})`; an in-flight request is aborted before a new one starts and the button is disabled while loading (`frontend/src/pages/student/CheckMyTopicPage.jsx:25-59`).
2. Client: `axios.post('/api/similarity/check', payload, {withCredentials:true})` (`frontend/src/api/similarity.js`); 503 `semantic_unavailable` is mapped to `semantic_available:false, risk_level:null`.
3. Route: `POST /api/similarity/check` (alias `/api/v1/check-similarity`) with `requireAuth`, `requireRole('student','lecturer')`, `limiters.similarity` (`server.js:197-204`).
4. Validation: title required, each field ≤ 1000 chars (`similarity.controller.js:5,46-58`).
5. Corpus: `residentCorpus.get()` refreshes if the snapshot is absent or ≥5 s old (`residentCorpus.service.js:30`); refresh is `findMany()` on all three topic tables with no `where` (`:18`), filtered by `validStoredEmbedding` (`:11`); `searchable()` drops UNDER_REVIEW rows older than 48 h (`:9,31`). If refresh throws, `get()` throws → `next(error)` → 500 `DB_CONNECTION_ERROR` (fail closed, no evidence emitted).
6. Empty corpus: returns `corpus_size:0, overall_risk:null, max_similarity:null` and the sentence "This result does not establish that the topic is new or original." (`similarity.controller.js:63`).
7. Representation: `serialize()` emits `Title:` plus non-blank `Population:/Location:/Study focus:` lines (`topicSemanticRepresentation.service.js:9-16`); `sourceHash` = SHA-256 of that text (`:17`).
8. Voyage: one POST to `https://api.voyageai.com/v1/embeddings` with `model:'voyage-4-large'`, `input_type:'query'`, `output_dtype:'float'`, `AbortSignal.timeout(10000)`; no retry on this path (`voyageEmbedding.service.js:23-72`).
9. Response validation: exactly one embedding, length 1024, every element finite, else `VoyageProviderError` (`:12,66-70`).
10. Retrieval: exact cosine against every searchable topic that passes `validStoredEmbedding` again; sort by score descending (`Array.prototype.sort`, ties keep engine order — stable in V8, i.e. corpus load order); `slice(0,5)` (`voyageSemanticSimilarity.service.js:4-6`).
11. Classification: top score only; `score < T1 → LOW`, `< T2 → MEDIUM`, else `HIGH` (`:3,5`).
12. Persistence: none for the student path (no snapshot, no audit event). Audit logging: none.
13. Serializer: allow-listed match fields + `semantic_score` + `similarity_class` (`similarity.controller.js:13-42`); recommendation "Similarity classification is advisory; final academic judgement remains human." (`:70`).
14. Rendering: `ResultsDisplay` groups by `collection`; `risk_level` null is never coerced to LOW (`frontend/src/api/similarity.js`); copy "This does not establish originality or guarantee approval" (`ResultsDisplay.jsx:320,447`).

## B. Initial submission

`POST /api/v1/submissions` (`server.js:384`; student only; `limiters.similarity`) →
`createSubmission` (`submission.service.js:474-541`): validate title/keywords/context
(≤1000 chars each, `:63-90`); build the same structured-context-v1 shape as a check
(`topicCorpusLifecycle.service.js:52-61`); **embed the document before any write** with
`retryVoyageCall` (3 attempts on 429/500/502/503; 61 s sleep on 429, otherwise 1 s·n; no
`Retry-After` parsing; `:5-27`); then one `$transaction` creates the `submissions` row and
its `under_review_topics` row with full embedding metadata (`submission.service.js:496-526`);
best-effort corpus refresh (`:528`); in-app notifications to reviewers (`:530`). Provider
failure → 503 `SEMANTIC_SYNC_UNAVAILABLE` with an honest message (`:462-471,492-494`).
No audit-log event is written for a submission (§13).

## C. Lecturer review-time check

`POST /api/v1/lecturer/submissions/:id/similarity-check` (`server.js:414`) →
`getLecturerSubmission` (any lecturer, `where:{id}` only; `submission.service.js:707-743`)
→ re-runs the direct check with the stored title + stored context (`lecturerSimilarity.controller.js:52-64`) →
the response is intercepted and stored as a `SimilarityCheckSnapshot`
(`similaritySnapshot.service.js:100-130`); storage failure is logged at `warn` and does not
fail the request (`lecturerSimilarity.controller.js:31-45`). **Defect:** the summary builder
reads `data.tier1_historical/tier2_current/tier3_under_review` and per-match
`sbert/tfidf/jaccard` (`similaritySnapshot.service.js:16-61`), none of which the live
controller emits (§9, P1-1).

## D. Revision / resubmission

`POST /api/v1/submissions/:id/revision` (`server.js:390`) → `createRevisionSubmission`
(`submission.service.js:543-651`): ownership by `studentId` (404, not 403, to avoid
existence leaks, `:553-556`); parent must be `AWAITING_REVISION` (`:559-565`); a second
revision is refused in code (`:567-572`) **and** by the unique index on `revision_of_id`
(`schema.prisma:167`; `P2002 → 409`, `:630-638`); document embedding and transaction as in B.
The original row is never overwritten (lineage preserved).

## E. Approval into the searchable corpus

`PATCH /api/v1/lecturer/submissions/:id/status` (`server.js:422`) →
`updateLecturerSubmissionStatus` (`submission.service.js:778-890`): status must be
`PENDING_REVIEW` (checked before the transaction, `:794-800`); rationale rules per outcome
(`:322-345`); for APPROVED the stored under-review embedding is reused when it still passes
`validStoredEmbedding`, otherwise a fresh document embedding is produced (`:755-776`);
one `$transaction` updates the submission, **upserts** `current_session_topics` keyed by the
unique `submissionId` (`:856-871`, `schema.prisma:303`) and deletes the under-review row
(`:873-875`); refresh + student notification follow. Approved topics therefore enter the
CURRENT_SESSION collection, which has no time cutoff; HISTORICAL rows come only from admin
imports (`topicImportPersistence.service.js`).

## Explicit determinations

| Question | Answer | Label |
| --- | --- | --- |
| Where do embeddings live persistently? | JSONB `embedding` columns on `historical_topics`, `current_session_topics`, `under_review_topics`, with `embedding_provider/model/dimension/representation/source_hash` (`schema.prisma:261-266,293-298,330-335`) | VERIFIED FROM CODE |
| Where during computation? | Plain JavaScript arrays inside a frozen in-process snapshot (`residentCorpus.service.js:10-13`) | VERIFIED FROM CODE |
| Does PostgreSQL rank vectors? | No — `findMany()` with no ordering by similarity; ranking is JavaScript cosine | VERIFIED FROM CODE |
| Is pgvector required at runtime? | No — no `vector` type, no `CREATE EXTENSION`, no distance operator anywhere in schema, migrations or code | VERIFIED FROM CODE |
| Exact or approximate? | Exact, exhaustive O(N·d) cosine over all searchable topics, N ≤ corpus, d = 1024 | VERIFIED FROM CODE |
| Is corpus state process-local? | Yes (`residentCorpus` singleton) | VERIFIED FROM CODE |
| How does refresh work? | Lazy, time-based on read (≥5 s) plus best-effort refresh after each write (`topicCorpusLifecycle.service.js:63-71`) | VERIFIED FROM CODE |
| What if refresh fails? | On read: `get()` throws → check fails with 500 (no stale snapshot served); after a write: warning logged, request still succeeds (`:66-69`); first failure/recovery logged once per outage (`residentCorpus.service.js:20-27`) | VERIFIED FROM CODE + tests `residentCorpus.service.test.js:13-16,54-72` |

---

# 4. Authentication / Authorization

| Item | Finding | Evidence |
| --- | --- | --- |
| Hashing | `bcryptjs`, cost **12** on every path (password change `auth.service.js:260`, reset `:366`, provisioning `userProvisioning.service.js:194`, invitations `userInvitation.service.js:75`, bulk import `credentialHashing.service.js:12` via a bounded worker pool sized from cgroup CPU quota, max 8) | VERIFIED FROM CODE |
| Password policy | ≥ 8 characters and ≥ 1 digit (`auth.service.js:235-240`); no breached-password or length-maximum check (bcrypt truncates at 72 bytes) | VERIFIED FROM CODE |
| Temporary password | Generated by provisioning/bulk/reset/bootstrap; hash stored; `mustChangePassword=true`; shown once in the HTTP response/manifest | VERIFIED FROM CODE |
| Forced change | `requireAuth` returns 403 `PASSWORD_CHANGE_REQUIRED` for every route except `/auth/me` and `/auth/change-password` (`auth.middleware.js:57-63,71-79`; `server.js:340-346`); change bumps `credentialVersion` and clears reset tokens (`auth.service.js:264-268`) | VERIFIED FROM CODE |
| Login identifiers | One `identifier` field classified as email or matric (`auth.service.js:127-139`); students by matric (email optional, `schema.prisma:41,49`), lecturers/admins by email (role rule enforced at service boundary per schema comment) | VERIFIED FROM CODE |
| Session invalidation | `cv` claim must equal `credentialVersion` (`auth.service.js:222-225`); bumped on password change, reset (`:373`), invitation acceptance (`userInvitation.service.js:405`) and admin credential reset (`userProvisioning.service.js`) | VERIFIED FROM CODE |
| Logout | Clears the cookie and writes `AUTH_LOGOUT`; does **not** bump `credentialVersion`, so a captured JWT stays valid until expiry (≤ 24 h) (`auth.controller.js:33-41`, `auth.service.js:395-405`) | VERIFIED FROM CODE — P2 |
| Reset / invitation tokens | Random token, SHA-256 hash stored, expiry enforced, single-use (hash nulled on use; `auth.service.js:352-373`, `userInvitation.service.js:404-408`) | VERIFIED FROM CODE |
| Anti-enumeration | Same 401 for unknown/invalid; **but** `bcrypt.compare` runs only when the user exists (`auth.service.js:142-144`) → timing oracle (~250 ms difference at cost 12); mitigated by the per-identifier limiter (8/15 min) | VERIFIED FROM CODE — P2 |

Authorization layers found: `requireAuth`, `requireRole`, service-level `assertStudentUser`/`assertLecturerUser`
(`submission.service.js:179-197`), ownership predicates (`studentId` on list/revise, `userId` on notifications
`notification.service.js:255-262`, `lecturerId` on supervisees, `decidedById` on decision history). There is **no
lecturer-to-student assignment check** on the review surfaces: `listLecturerPendingSubmissions` returns every
`PENDING_REVIEW` submission (`:677-683`) and `getLecturerSubmission` uses `where:{id}` (`:711-712`), i.e. a shared
departmental queue (INFERENCE: intended; the supervisee-assignment model exists but does not gate review).

**A. Student → admin endpoint manually?** No. Every `/api/v1/admin/*` and import route carries
`requireAuth, requireRole('admin')` (`server.js:426-561`); a student cookie gets 403 `FORBIDDEN`.
**B. Lecturer → another lecturer's review data?** Pending submissions and snapshots are shared by design (any
lecturer may review or read any submission's snapshots); decision history is scoped to the deciding lecturer.
**C. Student → another student's submission?** No: list is `where studentId = user.id` (`:658-660`); revision of
another student's submission returns 404 (`:553-556`); there is no `GET /submissions/:id` route.
**D. Frontend-only restrictions:** role redirects and navigation hiding (`frontend/src/auth/ProtectedRoute.jsx:16-26`,
`layouts/navigation.js`); the deferred Research Explorer route is registered (`App.jsx:64`) but hidden from
navigation — reachable by URL as a placeholder with no backend endpoint (P2).
**E. Sensitive routes relying on frontend hiding:** none found; route-by-route review of `server.js:169-561`
shows only `/health`, `/api/v1/health`, `/api/v1/readiness`, login/logout/forgot/reset/invitation as unauthenticated.

RBAC falsification attempt (route table read in full): **not falsified**.

---

# 5. Secrets

| Source | Origin at runtime | Evidence |
| --- | --- | --- |
| Voyage key | `VOYAGE_API_KEY` env; required in production; read per request (`voyageEmbedding.service.js:28,35`) | VERIFIED FROM CODE |
| `DATABASE_URL` | env; validated as a PostgreSQL URL (`env.js:64-77`); Render injects `fromDatabase` (`render.yaml`) | VERIFIED FROM CODE |
| JWT secret | `JWT_SECRET` env; production requires ≥ 32 chars and rejects five known placeholders (`env.js:239-251`); Render `generateValue: true` | VERIFIED FROM CODE |
| SMTP | `SMTP_*` env, `sync: false` in the blueprint | VERIFIED FROM CODE |
| Bootstrap admin | temporary password generated at run time by `scripts/bootstrap-admin.js`, printed once to stdout (`:72`) | VERIFIED FROM CODE |

Scans performed (values never printed):

- Tracked env-like files: `.env.compose.example` (placeholders), `backend/.env.test` (**tracked**; local
  `postgresql://postgres:<pw>@localhost:5432/topic_similarity_test` — a test-only local credential, P2 hygiene).
  `.env` and `backend/.env` exist locally but are ignored (`.gitignore:18-22`) and were **never committed**
  (`git log --all --diff-filter=A -- .env …` is empty).
- Git history (`git log --all -G` for key-shaped strings, private keys, credentialed DB URLs, `JWT_SECRET=`/
  `VOYAGE_API_KEY=`/`SMTP_PASSWORD=`/`POSTGRES_PASSWORD=` assignments): hits are all placeholders or test
  fixtures — `backend/src/utils/backupRestore.test.js` (fixture password), `backend/TESTING-GUIDE.md` and
  `backend/env.example` (documentation examples), `.env.compose.example` (placeholder), and the docs-branch tooling
  file `capture-provider-unavailable.mjs` (deliberate `pa-invalid…` placeholder). **No evidence that a real secret
  ever entered Git history.**
- Frontend: no `import.meta.env` usage at all; `vite.config.js` defines no variables; the production bundle
  (`frontend/dist`, 0.55 MB, built from this tree) contains no `pa-` key shape, `VOYAGE_API_KEY`, `JWT_SECRET`,
  `postgresql://`, `SMTP_` or `api.voyageai.com` string. **Frontend builds cannot contain server secrets** because
  the client never references them.
- Logs: winston redacts keys matching `password|passwd|credential|token|secret|authorization|cookie|jwt|session|
  apikey|api_key|databa…` (`logger.js:37-70`); the error handler never returns stacks in production
  (`errorHandler.middleware.js:192-202`); readiness output is asserted secret-free (`readiness.controller.test.js:80`).

Answers: `.gitignore` only prevents future commits — history was checked separately (clean). Production-required
secrets **are validated at startup** and **startup fails closed** (`env.js:212-221,250-260`; Compose refuses to start
without `POSTGRES_PASSWORD`, `JWT_SECRET`, `TRUST_PROXY`). Residual finding: bootstrap prints the temporary
administrator password to stdout, which a hosted platform's log stream retains (P1-6c).

---

# 6. Rate Limiting / Cost Abuse

All limiters: `express-rate-limit` 7.1.5, fixed window, **default in-process `MemoryStore`** (no `store` option,
`rateLimit.middleware.js:134-160`), 429 JSON with `Retry-After` and `limiter` name; counters reset when the window
elapses or the process restarts.

| Limiter | Routes | Key | Window / limit (defaults, `env.js:272-285`) |
| --- | --- | --- | --- |
| global | all | authenticated user id, else IP (IPv6 /56 subnet) | 15 min / 10 000 |
| login-ip | `/auth/login` | IP | 15 min / 30 |
| login-identifier | `/auth/login` | IP + SHA-256(canonical identifier) | 15 min / 8 |
| forgot-password | `/auth/forgot-password` | IP | 15 min / 15 |
| invitation-validation / -acceptance | invitation routes | IP | 15 min / 30 and 10 |
| reset-password | `/auth/reset-password` | IP | 15 min / 10 |
| **similarity** | direct check, submission create, revision, lecturer check | user id | 15 min / 30 |
| admin-account-action | invite, credential reset | user id | 15 min / 30 |
| admin-bulk-invitation | bulk invitations | user id | 15 min / 10 |
| admin-topic-import | topic import commit | user id | 15 min / 5 |

Analysis:

- **One instance:** limits hold as stated. **Two instances:** every counter is per process; a load balancer
  spreading traffic doubles every allowance and lets a client that alternates instances exceed the intended
  ceiling. The blueprint pins `numInstances: 1` for both services — the protection is a **deployment assumption**,
  not an implemented distributed guarantee.
- **Authenticated Voyage abuse:** bounded to 30 query embeddings per user per 15 min on the read path; the write
  path's document embedding is inside the same bucket but each attempt may retry up to 3× on 429/5xx
  (`topicCorpusLifecycle.service.js:5-27`), so worst case ≈ 90 provider calls per user per window.
- **Unauthenticated Voyage calls:** possible but bounded — the public `/api/v1/readiness` probe embeds the string
  `readiness` when the cached status is older than 5 min (single-flight, stale-while-revalidate 60 s;
  `voyageProviderStatus.service.js`), i.e. ≤ ~1 paid call per 5 min per process regardless of traffic.
- **Duplicate paid calls:** a student pre-check followed by submission embeds twice by design (query vs
  document); a revision embeds again; approval reuses the stored vector unless it fails validation; a topic
  import embeds every new row *before* the transaction — if the transaction then fails, all of that spend is lost
  and a replay re-embeds everything (fingerprint dedupe prevents duplicate rows, not duplicate spend). Corpus
  refresh makes **no** provider calls.
- **Cost surface without a row cap:** user import caps at 2 000 rows (`userBulkImport.service.js:37`); topic import
  has **no row cap** — only the 5 MB upload limit (`IMPORT_UPLOAD_LIMIT_BYTES`) and 5 commits / 15 min per admin.
  A single 5 MB workbook could carry tens of thousands of rows and therefore tens of thousands of sequential
  document embeddings in one request (P2 cost/availability; admin-only).

Implemented protection: per-user similarity bucket, per-identifier login bucket, bounded provider retries,
readiness probe cache. Deployment assumptions: single instance, correct `TRUST_PROXY` hop count (a wrong count
either keys all users on the proxy address or lets clients spoof `X-Forwarded-For`; `env.js:100-127` forbids
`true`/`*` but cannot verify the real chain — UNKNOWN until hosted).

---

# 7. Voyage Failure Behavior

Client: `voyageEmbedding.service.js:23-72`. One HTTPS POST per call, `AbortSignal.timeout(VOYAGE_REQUEST_TIMEOUT_MS)`
(default 10 000 ms, bounds 1–60 s). Read path: **1 attempt**. Write paths (submission, revision, approval,
import, backfill): `retryVoyageCall` — up to **3 attempts**, only for HTTP 429/500/502/503, sleeping 61 s after
a 429 and 1 s·attempt otherwise; `Retry-After` is not read (`topicCorpusLifecycle.service.js:5-27`).

| Stimulus | Client result | Backend HTTP (read path) | Backend HTTP (write path) | Retried? |
| --- | --- | --- | --- | --- |
| Connect/DNS/reset | `VoyageProviderError` (no status) | 503 `semantic_unavailable` | 503 `SEMANTIC_SYNC_UNAVAILABLE` | no (no status) |
| Timeout / slow > 10 s | `VOYAGE_TIMEOUT` | 503 | 503 | no |
| 429 | `VOYAGE_RATE_LIMITED` | 503 | 503 after ≤3 attempts (≤ 2×61 s + 3×10 s ≈ 152 s inside the request) | yes |
| 400 / 401 / 403 / other 4xx | `VOYAGE_PROVIDER_ERROR` with status | 503 | 503 | no |
| 500 / 502 / 503 | provider error | 503 | 503 after ≤3 attempts | yes |
| Malformed JSON | `body=null` → treated as malformed | 503 | 503 | no |
| Missing / empty / wrong-dimension / non-numeric embedding, >1 result | "malformed embedding data" | 503 | 503 | no |

Frontend copy on 503: "Semantic analysis is currently unavailable." (`similarity.js` mapping;
`ResultsDisplay` shows no class); other errors show "Unable to check topic" with the server message
(`CheckMyTopicPage.jsx:9-19,109`). Logs: controller logs `Voyage semantic check failed: …` only for non-provider
errors (`similarity.controller.js:71`); provider outages are visible through the readiness probe state changes
(logged once per transition) and through 503 responses, **not** through a per-failure application log line.

Verified: no fallback embedding (grep: `validVector` is the only vector source; `sbert/tfidf/jaccard` modules are
not required by any runtime module — only by `backend/scripts/run-topic-evaluation.js`); no fabricated LOW
(`risk_level` null on unavailability, `overall_risk: null` on empty corpus); no originality claim. Retry layers:
**provider retry** = the write-path loop above; **browser retry** = none (axios does not retry; the student page
aborts superseded requests); **application retry** = none on the read path.

Provider behaviour was not exercised live in this audit; evidence is code plus unit tests
(`voyageEmbedding.service.test.js`, `topicCorpusLifecycle.service.test.js`, `similarity.controller.test.js`) and
the frozen C5 latency artefact (10/10 successes, p50 942 ms, p95 1 855 ms).

---

# 8. Database Failure Behavior

- **Unavailable at startup:** `database.js` instantiates `PrismaClient` lazily; `server.js:570-638` starts
  listening without a connectivity check. Liveness (`/health`, `/api/v1/health`) stays 200; readiness returns 503
  `not_ready` (`readiness.service.js:68-77`, 2 s query timeout `:5`); every data request fails 500
  `DB_CONNECTION_ERROR` (`errorHandler.middleware.js:139-143`). On Render the `preDeployCommand`
  (`prisma migrate deploy`) fails the deploy first. Fail-safe: yes (no silent success); fail-visible: only via
  readiness/5xx logs (§13).
- **Lost after startup / restart:** same as above per request; corpus `get()` throws on refresh failure so
  similarity checks fail closed; readiness logs "Database connectivity lost/recovered" once per transition
  (`readiness.service.js:11-19`). Prisma reconnects on the next query automatically (Prisma pool behaviour —
  INFERENCE from library defaults, not repository code).
- **Pool exhaustion / slow query / query timeout:** no `connection_limit`, `pool_timeout` or statement timeout is
  configured anywhere (`DATABASE_URL` carries no parameters in Compose or Render); Prisma defaults apply
  (pool = physical CPUs × 2 + 1, 10 s pool timeout). A `P2024` pool timeout is a `PrismaClientKnownRequestError`
  and is mapped to **HTTP 400** (`errorHandler.middleware.js:177-178`) — a server-side capacity failure reported as
  a client error (P2).
- **Transaction failure:** submission/revision/decision/import use `$transaction`; the embedding is generated
  *before* the transaction, so a failed commit wastes the paid call but leaves no partial rows. Import transaction
  timeout is raised to 120 s (`topicImportPersistence.service.js:324`).
- **Deadlock / serialisation:** no explicit isolation level; the concurrent-decision race in §9 is the only
  identified write conflict; revision conflicts are resolved by the unique index.
- **Migration mismatch / failed migration:** migrations are additive SQL under `prisma/migrations` (14); the app
  never runs migrations itself. A schema/client mismatch surfaces as Prisma known errors → 400 (see above), which
  mislabels an operator fault as a client fault (P2).
- **Corrupt embedding metadata:** rows failing `validStoredEmbedding` are excluded silently from the corpus
  (`residentCorpus.service.js:11`); the admin system-status endpoint exposes only counts (`residentCorpus.stats()`,
  `adminSystemStatus.controller.js:38`), so excluded rows are detectable by comparing table counts with
  `topics`, not listed individually.
- **pgvector:** **not used in production ranking** — no extension, type, index or operator exists. The actual
  mechanism (JSONB rows → in-process arrays → exact cosine) is audited in §3 and §16.

---

# 9. Duplicate Execution / Idempotency

| Path | Frontend guard | Backend idempotency | DB constraint | Transaction | Net result of a duplicate |
| --- | --- | --- | --- | --- | --- |
| Check Similarity (student) | abort previous request + disabled button (`CheckMyTopicPage.jsx:34-59`) | none | n/a (no write) | n/a | second Voyage query charge; no data effect |
| Check Similarity (lecturer) | `isCheckingSimilarity` (`SubmissionDetailPage.jsx:104,200-216`) | none | none | none | second snapshot row (each snapshot is an evidence record — acceptable) |
| Submit Topic | `isSubmitting` disables submit (`SubmitTopicPage.jsx:51,131-151,225`) | **none** | **none** — no unique key on (student, title) | yes | **two PENDING_REVIEW submissions + two under-review rows + two document charges** (P2) |
| Revision | same page guard | code check `original.revision` (409) | **unique `revision_of_id`** → P2002 → 409 (`submission.service.js:630-638`) | yes | second attempt refused |
| Lecturer decision | confirm modal + `isUpdating` | status precheck **outside** the transaction (`:794-800`); update `where:{id}` without status predicate (`:849-853`) | none | yes | sequential duplicate: 400 "not pending"; **concurrent duplicate: both succeed, last write wins** (P1-2) |
| Approval → corpus | — | `upsert` keyed by unique `submissionId` (`:856-871`) | unique | yes | idempotent |
| Bulk onboarding commit | UI flow | rows classified `already_exists`/`conflict`/`duplicate_in_file`; in-transaction re-check; `P2002 → BulkImportStateChangedError` (`userBulkImport.service.js:383-397,520-560`) | unique email / matric | yes | second commit creates nothing; **manifest of a lost response is unrecoverable** — accounts exist with unknown temporary passwords; remedy is per-account credential reset (P2 operational) |
| Invitation resend | — | new token replaces the old (`userInvitation.service.js:145-160`), accepted → 409 | — | — | at most one valid token; duplicate e-mails possible if two resends race (bounded by 30/15 min) |
| Password reset | — | new token replaces old; single-use | — | — | duplicate e-mails possible; harmless |
| Topic import replay | — | `source_fingerprint` dedupe before embedding (`topicImportPersistence.service.js:266-282`) + `createMany skipDuplicates` | unique `source_fingerprint` | yes, 120 s | no duplicate rows; **no duplicate spend only if the earlier commit succeeded** |

Scenario answers: **A/B (UI double-submit, network retry)** — only initial submissions can duplicate. **C (two
identical simultaneous requests)** — revisions and imports are constraint-protected; decisions are not; initial
submissions are not. **D (backend commits, client times out)** — the write is durable; a client resend creates a
duplicate submission or a 400/409 elsewhere; for bulk import the one-time manifest is lost. **E (provider succeeds,
persistence fails)** — money spent, nothing stored, honest error (503/500). **F (persistence succeeds, response
lost)** — same as D. Duplicate audit events: possible for the concurrent decision race and duplicate sends;
duplicate Voyage charges: yes in A/B/E and in import replay after a failed commit.

---

# 10. Embedding Compatibility

Current production metadata (`voyageEmbedding.service.js:3,73-75`, `topicSemanticRepresentation.service.js:3`):
provider `voyage`, model `voyage-4-large`, dimension `1024`, representation `structured-context-v1`,
source hash `sha256(serialize(topic))`, direction `input_type: 'query'` for checks and `'document'` for stored
rows, storage JSONB + five metadata columns added by migration `20260813090000_add_voyage_embedding_metadata`.

- **A. Were all vectors regenerated?** The mechanism exists (`backend/scripts/backfill-topic-embeddings.js`
  re-embeds rows failing `validStoredEmbedding` across the three tables) and the C4 fixtures show 100 % valid
  vectors at 1 000 and 5 000 rows on the benchmark database. Whether a *given* production database has been
  backfilled is **UNKNOWN** (operational state). The demo database used for the visual baseline was seeded under
  the current contract (VERIFIED BY RUNTIME).
- **B. Can an old vector remain in persistence?** Yes — SBERT-era rows (`embedding` JSONB from the initial
  migration with null metadata) or rows whose text changed after embedding (stale `source_hash`) can exist.
- **C. Can it enter the active corpus?** **No.** `build()` filters every row by `validStoredEmbedding`
  (`residentCorpus.service.js:11`), which requires provider, model, dimension, representation **and** a hash equal
  to the hash of the row's current title/population/location/study-focus; `retrieve()` applies the same predicate
  again (`voyageSemanticSimilarity.service.js:6`); `cosine()` throws on length mismatch or zero vectors (`:4`).
- **D. Admission checks:** all five metadata fields plus vector shape (VERIFIED FROM CODE); lifecycle: UNDER_REVIEW
  rows only within 48 h of `reviewStartedAt` (`residentCorpus.service.js:9`).
- **E. Zero valid vectors:** `corpus_size: 0`, `overall_risk: null`, explicit "does not establish … original"
  (`similarity.controller.js:63`); the admin status shows `topics: 0` (VERIFIED FROM CODE; screenshot `70` on the
  docs branch shows the rendered state).
- **F. Mixed valid/invalid:** invalid rows are dropped silently; only counts reveal them (P2 observability).

Cross-space comparison classification: **not a P0** — incompatible spaces cannot be compared or silently treated
as valid. Residual P2: silent exclusion with count-only visibility; write paths never store an invalid vector
(`prepareDocumentEmbedding` re-validates before returning, `topicCorpusLifecycle.service.js:32-39`).

---

# 11. Similarity / Thresholds / Originality

- **Computation:** raw cosine (dot / √(‖a‖²‖b‖²)) in JavaScript (`voyageSemanticSimilarity.service.js:4`); no
  database operator; vectors are used as returned by Voyage (no re-normalisation — the formula is scale-invariant);
  candidate set = every searchable topic; top-K = 5; sort descending, ties in load order; no index/ANN.
- **Thresholds:** `T1 = 0.5571529891797358`, `T2 = 0.6450102471881145` (`:3`); classification of the single top
  score (`:5`); pinned by `semanticRepresentationContract.test.js` and documented in
  `docs/product/semantic-representation-contract-closure.md:17-18`.
- **Provenance (VERIFIED BY RUNTIME from Git, not prose):** the artefact
  `backend/evaluation/results/voyage-production-direction-calibration.json` exists only at commit `f925a95`
  ("test(evaluation): freeze Voyage production scoring contract", 2026-08-13) on branch
  `experiment/expanded-semantic-model-evaluation`; it is **not an ancestor of `e5e3fc1` nor of the defence tag**,
  and `backend/evaluation/results/` in the audited tree holds only `topic-similarity-evaluation.json` and
  `topic-data-quality-audit.json`. Its content: experiment `voyage-production-direction-calibration-c1.5`,
  direction `cosine(submitted_query, existing_document)`, model `voyage-4-large`, dimension 1024,
  representation `structured-context-v1`, benchmark 120 pairs / 113 connected components (SHA-256
  `b8e295e5…5ea3c0`), five grouped folds (held-out 25/24/24/24/23), thresholds `{t1: 0.5571…, t2: 0.6450…}`.
  The in-tree QA record (`qa-audit/final-artifact-evidence/FINAL_ARTIFACT_EVIDENCE_AUDIT.md:63-85`) reports grouped
  held-out accuracy 0.7917, macro-F1 0.7921, Spearman 0.889, bootstrap T1 95 % `[0.505, 0.561]`, T2 `[0.630, 0.656]`.
- **Label source:** the 120-pair dataset (`expanded-semantic-benchmark.json`, same experiment branch) declares
  `source_classification: "manually_constructed_expanded_benchmark"`, `validation_status:
  "not_department_expert_validated"`, "technical evaluation data, not lecturer-reviewed or departmental ground
  truth". The earlier 16-case pilot set in the tree is likewise `manually_constructed_pilot`
  (`topic-similarity-evaluation.json → dataset.provenance`). `docs/evaluation/README.md:5-9`,
  `docs/evaluation/lecturer-validation-protocol.md:12` and `docs/validation/lecturer-review-protocol.md:153`
  state that real lecturer-reviewed labels are **still missing**.

**Were thresholds validated against actual supervisor/departmental judgments? No. Labels were
researcher-constructed.** (VERIFIED — artefact provenance fields and in-tree protocol documents.) The calibration
is methodologically careful (grouped folds, bootstrap), but it validates agreement with the researcher's own
labels, not with academic judgment.

Language audit (current source and non-archive docs; "originalit|unique|plagiar|guarantee|automatic approv|AI decision"):

| Hit | Classification |
| --- | --- |
| `ResultsDisplay.jsx:320,447` "This does not establish originality or guarantee approval." | accurate |
| `similarity.controller.js:63,70` recommendation strings | accurate |
| `LandingPage.jsx:258,269` "does not automatically approve or reject", "advisory semantic…" | accurate |
| `docs/ui/REPRESENTATIVE-SCREEN-BRIEFS.md:86` "must prevent … mistaken for an automatic plagiarism or approval engine" | accurate (design instruction) |
| `docs/api/API.md:93-112` jaccard/sbert scored examples | stale (legacy shape), not an overclaim |
| No "plagiarism detection", "duplicate prevention guarantee" or "AI decision" claim found in source or current docs | — |

Semantic similarity remains advisory in code and copy. Residual risks: the 48-hour UNDER_REVIEW cutoff (P1-3) and the
unvalidated label source (P1-4).

---

# 12. Test Inventory

Jest `testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js']` (`backend/jest.config.js`); local run at this
baseline: **75 suites / 1 009 tests passed** (68 under `backend/src`, 2 legacy under `backend/tests/unit`,
1 under `backend/tests/integration`, 4 under `backend/evaluation/**/tests`). Frontend Vitest (happy-dom):
**42 files / 391 tests** (36 files reported by the runner at the last run; `vi.mock` in 32). CI (`.github/workflows/ci.yml`)
runs backend tests against a real PostgreSQL 16 service after `prisma migrate deploy`, frontend build + tests, and a
Python `py_compile` of the legacy SBERT sources; it does **not** run `npm audit`, the deployment-contract check or the
release gate.

| Class | What exists | Dependencies |
| --- | --- | --- |
| UNIT | services/controllers/middleware with `createPrismaMock` (17 files), Voyage via `fetchImpl`/`jest.mock` (6 files), no live provider (`api.voyageai.com` appears in 0 tests) | all mocked |
| INTEGRATION (in-process HTTP) | `supertest` against the Express app in 23 files (`server.test.js`, `server.security.test.js`, controllers) | HTTP real, DB mocked |
| CONTRACT | `semanticRepresentationContract.test.js` (canonical text pinned to a literal; hashes byte-compared), `env.test.js` (fail-closed validation), `verify-deployment-contract.js` (static) | independent expectations |
| DATABASE INTEGRATION | `backend/tests/integration/api.test.js` (real `PrismaClient`, creates a user, exercises `/api/similarity/check` with Voyage mocked) — runs in CI with real Postgres | DB real, Voyage mocked |
| CONTAINER / E2E | `scripts/smoke/fullstack-compose-smoke.test.js` (`node --test`, needs Docker; not in CI); visual-baseline Playwright tooling on the docs branch (manual) | Docker, manual |
| SECURITY | `server.security.test.js`, CSRF, rate-limit, logger redaction, readiness secret-free assertion, auth tests | mocked |
| FAILURE / CHAOS | Voyage timeout/4xx/5xx/malformed cases, `residentCorpus` refresh failure/recovery logging, `serverLifecycle` drain/force paths, `backupRestore` guards, email transient/permanent classification | mocked |
| LOAD / PERFORMANCE | `backend/tests/load/load-test.js` (axios script, **not** in the Jest match, manual); C4 in-memory benchmark harness with frozen results (`qa-audit/c4-production-scale`) | manual |
| DEPLOYMENT / STATIC | `npm run verify:deployment-contract` (PASS at this baseline), `release:check`, Prisma validate in CI | static |
| MANUAL ACCEPTANCE | `docs/deployment/container-runtime-acceptance.md`, smoke checklists under `docs/testing/`, visual baseline (docs branch) | human |

**Circular / mirrored validation identified:**

- `similaritySnapshot.service.test.js:25` and `lecturerSimilarity.controller.test.js:49` feed the **legacy**
  `tier1_historical/…` shape into the snapshot code, so both pass although the live controller has emitted
  `matches[]` since the Voyage migration — the tests encode the same stale assumption as the implementation (P1-1).
- `evaluationMetrics`/`similarityScoring.config` tests exercise the retired tri-algorithm contract; they protect
  research scripts, not production behaviour.

**Missing tests, by risk (not coverage):**

1. Lecturer check → snapshot → listing round-trip asserting non-empty `topMatches` for a non-empty corpus.
2. Concurrent decisions on one submission (two lecturers) — exactly one wins, corpus row consistent.
3. A pending submission older than 48 h is (or is not — per the accepted rule) visible to another student's check.
4. Corpus refresh failure while a valid snapshot exists — asserted behaviour of `get()` (currently throws).
5. Duplicate initial submission from a retried identical request.
6. Multi-instance rate-limit weakening (two app processes, one client) — documents the assumption.
7. Readiness under DB outage returning 503 with liveness 200 (exists partially; add hosted assertion).
8. Voyage 429 storm on the write path: request duration bound and client-visible outcome.
9. CSV export with a cell beginning `=`, `+`, `-`, `@`.

Test-count volume is not treated as production confidence: the suites are strongest on mocked contracts and
weakest on runtime integration (one DB-backed suite, no hosted end-to-end).

---

# 13. Observability

| Capability | Status | Evidence |
| --- | --- | --- |
| Structured logging | LOGGING — winston JSON lines in production with key-based redaction; file transports secondary (`logger.js:6-9,37-80`) | VERIFIED FROM CODE |
| Correlation IDs | LOGGING — `X-Request-Id` accepted (strict shape) or generated; attached to completion and error logs (`requestContext.middleware.js`) | VERIFIED FROM CODE |
| Error taxonomy | LOGGING — `categorizeError` (database/auth/forbidden/rate-limit/client/server) with stack + requestId in operator logs (`errorHandler.middleware.js:44-115`) | VERIFIED FROM CODE |
| Auth/security events | AUDIT — `AUTH_LOGIN`, `AUTH_LOGIN_FAILED` (hashed identifier), `AUTH_LOGOUT`, `PASSWORD_CHANGED`, provisioning/invitation/import/assignment/export/purge events (`auditLog.service.js` emitters, §list in evidence) | VERIFIED FROM CODE |
| Academic events | **not audited** — no audit event for submission created, revision, lecturer decision or similarity check; decisions live only on the mutable `submissions` row + notifications + snapshots (P2) | VERIFIED FROM CODE (grep of `AUDIT_EVENT_TYPES.` emitters) |
| Readiness / liveness | `/api/v1/health` static 200; `/api/v1/readiness` = DB (2 s) + cached Voyage probe + email capability; 503 when DB down or provider unverified (`readiness.service.js:68-110`) | VERIFIED FROM CODE |
| DB / Voyage failures | LOGGING — state-change events once per outage (`readiness.service.js:11-19`, `voyageProviderStatus.service.js`, `residentCorpus.service.js:20-27`) | VERIFIED FROM CODE |
| Latency / duration / 4xx-5xx rates | LOGGING only at level `http` (3), **below the shipped `LOG_LEVEL=info`** (`logger.js:14-20,118`; `render.yaml`): per-request duration and status are **not emitted** in production by default; only ≥500 failures are (`requestContext.middleware.js`). No METRICS (no `prom-client`/OTel/StatsD dependency). | VERIFIED FROM CODE |
| Restart / shutdown visibility | LOGGING — "Server is listening", "Graceful shutdown started/completed", forced-close warnings, fatal policy (`serverLifecycle.js`, `server.js:585-637`) | VERIFIED FROM CODE |
| Bulk operations | LOGGING + AUDIT — import previewed/committed events with counts; hashing pool sizing logged | VERIFIED FROM CODE |
| Client disconnects | LOGGING — one line on socket close without `finish` (`requestContext.middleware.js`, comment block) | VERIFIED FROM CODE |
| SMTP failures | LOGGING + AUDIT (`USER_INVITATION_DELIVERY_FAILED`), truthful API result; one bounded retry (`email.service.js:11-20,226-280`) | VERIFIED FROM CODE |
| Admin diagnostics | LOGGING-adjacent UI — `/api/v1/admin/system-status` exposes provider status, probe timestamps and corpus counts (`adminSystemStatus.controller.js:29-38`); the dashboard itself reports the provider as "unknown … not checked" (`adminDashboard.service.js:230-234`) | VERIFIED FROM CODE |
| MONITORING / ALERTING | **None in the repository.** `docs/deployment/monitoring-and-logging.md:128-155` lists alert conditions as "initial, operator-tunable" with the vendor "deferred"; `production-operations-readiness.md:19` marks monitoring as a future phase; the readiness tracker records "PREPARED, NOT VERIFIED". | DOCUMENTED BUT NOT VERIFIED (absence VERIFIED) |

**What would wake an operator at 03:00 if the system stopped working? Nothing from the application.** The only
automatic reaction is the platform's TCP/HTTP health check restarting a dead process (Render private service: TCP
only; frontend: `GET /`). A database outage, a Voyage outage, an expired API key or a corpus refresh failure produce
503s and log lines that nobody is paged about. Whether the Render account e-mails deploy/health failures is
UNKNOWN (§18).

---

# 14. Deployment / Render

| Item | Finding | Evidence |
| --- | --- | --- |
| Production build | Backend: `node:20-bookworm-slim`, `npm ci` + `prisma generate`, prod-only `node_modules`, non-root `app`, `HEALTHCHECK curl /api/v1/health`, `CMD node src/server.js`, `EXPOSE 3000`. Frontend: Vite build → `nginxinc/nginx-unprivileged:1.27-alpine`, port 8080, `USER nginx`. | `backend/Dockerfile`, `frontend/Dockerfile` — VERIFIED FROM CODE |
| Frontend serving | Nginx static SPA + `/api/` reverse proxy to `BACKEND_UPSTREAM`, 660 s send/read timeouts, 6 MB body, security headers, **no Content-Security-Policy** | `frontend/nginx.conf.template` |
| Migration | Dedicated image stage `migration` (`prisma migrate deploy`); Compose profile `maintenance`; Render `preDeployCommand: npm run prisma:migrate:deploy` | Dockerfile; `docker-compose.yml:121`; `render.yaml` |
| Seed / bootstrap | Never automatic. Bootstrap is a separate image stage/one-off command (`scripts/bootstrap-admin.js`, idempotent) | Dockerfile `bootstrap` stage |
| Users / root | Both containers run unprivileged (`app`, `nginx`) | Dockerfiles |
| Ports / topology | Render: public `web` frontend (healthCheckPath `/`), private `pserv` backend (TCP check only), managed Postgres with empty `ipAllowList`; Compose binds `127.0.0.1` only | `render.yaml`, `docker-compose.yml:166` |
| Env injection | Render env vars (`fromDatabase`, `generateValue`, `sync: false`); Compose `.env` with `:?` guards | `render.yaml`, `docker-compose.yml:8,47,56` |
| State | PostgreSQL only; `/app/logs`, `/app/tmp/imports` are ephemeral container paths (uploads via multer to `tmp/imports` — INFERENCE from `mkdir`); no persistent volume required | Dockerfile |
| Graceful shutdown | SIGTERM/SIGINT → `server.close()` + idle-connection close, grace `SHUTDOWN_GRACE_PERIOD_MS` = 300 000 ms, then forced close and exit; fatal path exits within 10 s | `serverLifecycle.js:1-6,146-210` |
| Render max shutdown | `maxShutdownDelaySeconds: 300` equals the application grace; the blueprint itself notes this is insufficient for a worst-case 650-account bulk commit (~324–389 s measured) and prescribes a deploy lockout | `render.yaml` comments; `render-staging-runbook.md:119-127` |
| Auto-deploy | `autoDeployTrigger: off` on both services | `render.yaml` |
| Restart | Platform restarts on health failure; the app has no self-restart | INFERENCE (platform behaviour UNKNOWN in detail) |
| Single-instance assumptions | `numInstances: 1`; in-process limiter, provider cache, corpus snapshot | VERIFIED FROM CODE |
| SBERT / Python | **Not part of production.** Compose profile `legacy-sbert` only; no Render service; runtime code only carries dead `sbertService` config (`env.js:454-458`) | VERIFIED FROM CODE |
| Cold start / readiness | Backend listens immediately; first similarity request pays the corpus load (1000 topics ≈ 1.1 s p50 measured; 5000 ≈ 3.4 s) and the first readiness hit pays one Voyage probe; readiness is deliberately not wired to a platform probe | code + C4 artefacts |
| Backend request timeout | none (`server.listen` defaults; Node 20 `requestTimeout` default 300 s applies to headers/body receipt, not handler duration — INFERENCE); long imports rely on the 660 s proxy floor | `render-staging-runbook.md:127` |

Real Render edge timeout and forwarding hop count remain UNKNOWN (§18).

---

# 15. Security

| Area | Finding | Evidence / severity |
| --- | --- | --- |
| SQL injection / raw queries | Only `prisma.$queryRaw\`SELECT 1\`` (tagged template, no input) | `readiness.service.js:38` — none |
| XSS / HTML sinks | No `dangerouslySetInnerHTML`, `innerHTML`, `document.write`; only hash anchors on the landing page; React escaping elsewhere | grep — none; no CSP on the SPA (P2) |
| URL injection / open redirect | No `res.redirect`; recovery pages scrub tokens from the URL (`AcceptInvitationPage.jsx:14`, `ResetPasswordPage.jsx:26`) | none |
| CSV formula injection | `csvEscape` quotes `"`,`,`,CR/LF only; cells beginning with `=`, `+`, `-`, `@`, tab are exported verbatim; student-entered titles/rationales reach admin exports | `adminReportExport.service.js:84-95` — **P2** |
| Server-side validation | present on similarity (length caps), submissions (title/word rules, context ≤1000), decisions (status enum, rationale rules), imports (header/row validation, 2 000-row cap for users) | VERIFIED |
| Oversized bodies | JSON 100 KB (`env.js`, `server.js:165`) → 413 `PAYLOAD_TOO_LARGE`; multipart limits via multer (5 MB file, field/parts caps) → 413 | VERIFIED |
| Oversized XLSX | 5 MB cap; users ≤ 2 000 rows; **topics uncapped by rows** (sequential embeddings) | P2 (cost/DoS by an admin) |
| Auth / RBAC bypass / IDOR | not found (§4) | — |
| CSRF | origin guard + SameSite=Lax + JSON content type; `requireOrigin` in production | VERIFIED |
| CORS | explicit allow-list from `FRONTEND_URL`, credentials true, hostile origins get no header; production forbids wildcard and non-https | `server.js:141-152`, `env.js:31-60,254-264` |
| Cookies | httpOnly, SameSite=Lax, Secure in production, 24 h | VERIFIED |
| SSRF | no user-controlled outbound URLs (Voyage URL constant; SMTP host from env) | none |
| Temporary credentials | shown once; bulk manifest download-only; forced change; **bootstrap prints to stdout** | P1-6c |
| Sensitive logs | key-based redaction; login identifiers hashed in audit; stacks only in operator logs | VERIFIED |
| Dependencies | `npm audit --omit=dev`: backend **2 moderate** (`uuid` via `exceljs`, no non-breaking fix), frontend **0**; `@prisma/client` 5.7.1 (old major line), `express` 4.22.2, `helmet` 7.1.0 | VERIFIED BY RUNTIME — P2 |
| Prototype pollution | no deep-merge of untrusted objects found; `express.urlencoded extended:true` accepts nested keys (bounded by 100 KB) | INFERENCE — low |
| Paid-API abuse | bounded per user (§6); topic import row-uncapped | P2 |
| DoS via bcrypt / import / vectors | login limited per IP and identifier; bulk hashing bounded by worker pool; vector ranking is ~36 ms at 5 000 topics; the expensive part is DB retrieval (§16) | VERIFIED |
| Trust proxy | numeric hop count or CIDR only; `true`/`*` rejected; correctness depends on the real chain | UNKNOWN until hosted |
| Login timing oracle | unknown identifier skips bcrypt | P2 |
| Session revocation on logout | cookie cleared, JWT not revoked | P2 |

---

# 16. Scaling

Reference workload (INFERENCE from the pilot documents): one department, ~50–100 concurrent users at peak,
a few hundred submissions per session, corpus of a few hundred to ~2 000 topics. Measured baselines
(VERIFIED BY RUNTIME, frozen `qa-audit/c4-production-scale/results`, laptop i5-10310U, JSON vectors):

| Corpus | DB retrieval p50 / p95 | Ranking p50 / p95 | Total p50 / p95 | RSS after phase |
| --- | --- | --- | --- | --- |
| 1 000 (c1) | 1 124 / 1 952 ms | 13 / 32 ms | 1 143 / 1 970 ms | 292 MB |
| 1 000 (c10) | 3 775 / 6 076 ms | 15 / 38 ms | 3 810 / 6 090 ms | 307 MB |
| 5 000 (c1) | 3 440 / 6 617 ms | 36 / 101 ms | 3 482 / 6 726 ms | **1 221 MB** (peak 1 267 MB) |
| Voyage query (C5, n=10) | — | — | 942 ms p50 / 1 855 ms p95 | — |

Asymptotics of the shipped design: ranking is O(N·d) with d = 1024 (≈ 7 µs per topic measured); memory ≈ N × 1024
× 8 bytes for the arrays plus JSON parsing overhead (measured ≈ 0.24 MB per topic at N = 5 000 including the
benchmark process); refresh cost is the full-table JSONB read, O(N) in bytes (≈ 10 KB per row), repeated at most
every 5 s **per process** while requests arrive.

| Scale | User/request volume | Corpus size | What breaks first |
| --- | --- | --- | --- |
| 10× (≈1 000 users, ~10 checks/s peak, ~5 000 topics) | Voyage p50 ~1 s per check is the visible latency; 30 checks/user/15 min holds; bcrypt cost 12 ≈ 250 ms/login is fine; Node event loop is idle during I/O | **DB retrieval dominates**: every 5 s the process pulls ~50 MB of JSONB (3.4 s p50 on the benchmark machine); RSS ≈ 1.2 GB against a Render `standard` instance (2 GB) | corpus refresh latency and memory; a request that lands on a refresh boundary waits for it |
| 100× (~10 000 users, 50 000 topics) | provider quota/cost (≈ 1 paid query per check, plus 1–3 per write) becomes a budget item; process-local limiter/readiness cache force single instance | full-table refresh ≈ 500 MB per 5 s window is infeasible; RSS > 10 GB; ranking ≈ 0.4 s per check | design change required: incremental/paged corpus, typed arrays or pgvector/ANN, refresh decoupled from request path |
| 1000× | not a single-process architecture | — | everything above plus PostgreSQL connection limits (Prisma default pool, no tuning), log volume, migration/startup time |

Other pressure points at 10×: bulk onboarding of 650 accounts measured ~324–389 s (CPU-bound bcrypt; bounded pool)
against a 660 s proxy floor and an **unknown** Render edge limit; long-running HTTP requests (imports, 429-retry
submissions) with no backend request timeout; PostgreSQL connections untuned; per-process readiness cache and
limiters make horizontal scaling a correctness-neutral but limit-weakening change; log volume is modest because
per-request logs are off by default (which is itself the observability gap).

Production ranking is **in-memory exact cosine**, not pgvector; no index or query plan exists to audit.

---

# 17. Documentation-vs-Reality Mismatches

| Claim | Document source | Actual code/runtime | Status |
| --- | --- | --- | --- |
| Response contains `tier1_historical`, `tier2_current`, `tier3_under_review`, `jaccard/tfidf/sbert` scores on a 0–100 scale | `docs/api/backend-api.md:115-135`, `docs/api/API.md:93-112` | Flat `matches[]` with `collection`, raw cosine `semantic_score`, `similarity_class` (`similarity.controller.js:29-42,70`) | STALE (backend-api.md carries a "historical" notice at :58; the field table below it is not marked) |
| Snapshot summarises matches per tier | implied by `similaritySnapshot.service.js` and its docs/tests | live shape mismatch → empty summaries | DEFECT (P1-1) |
| SBERT/FastAPI is part of the system | `docs/setup/sbert-*.md`, `docs/testing/sbert.md`, `docs/deployment/huggingface-sbert-*.md` (not under `archive/`) | legacy profile only; not in Render blueprint | STALE placement (README/AGENTS/overview correctly say legacy) |
| Tri-algorithm weighted scoring (0.2/0.3/0.5) | `similarityScoring.config.js` (in tree), `docs/backend/admin-governance-api-contract-plan.md`, archive docs | not required by any runtime module; production is single-score cosine | DEAD CODE / STALE |
| pgvector-based retrieval | archive docs only | JSONB + in-memory cosine | STALE, correctly archived |
| Students have university e-mail | `docs/testing/*smoke-checklist.md` (uniosun.edu.ng fixtures) | email optional; matric primary (`schema.prisma:41-49`, `auth-foundation.md:7` correct) | STALE fixtures |
| 48-hour under-review window | `docs/api/backend-api.md:126` (legacy section) only | still active in `residentCorpus.service.js:9` | UNDOCUMENTED IN CURRENT CONTRACT |
| Monitoring and alerting exist | `docs/deployment/monitoring-and-logging.md` alert conditions | no alerting/metrics implementation; vendor deferred | DOCUMENTED BUT NOT VERIFIED (doc itself says so) |
| Backups | `backup-and-restore-runbook.md` (manual `pg_dump` script + provider automated backups) | script exists; provider backups UNKNOWN | PARTIALLY VERIFIED |
| Rate limiting protects the deployment | runbooks | protects a single instance; process-local | ACCURATE with assumption |
| Frozen calibration artefact referenced by path | `docs/product/semantic-representation-contract-closure.md:53-56`, `qa-audit/…AUDIT.md:65` | file absent from the baseline tree; only on an experiment branch | UNREACHABLE EVIDENCE (P1-4b) |
| Production readiness | `docs/release/stable-production-readiness-tracker.md`, `production-operations-readiness.md` | both documents themselves record monitoring/backup/deployment proof as pending | CONSISTENT (docs do not overclaim) |
| Redis | `render-staging-runbook.md:40` "No Redis" | correct | ACCURATE |

---

# 18. Unknowns

| Unknown | Why it cannot be established here | Experiment / evidence that resolves it |
| --- | --- | --- |
| Render edge request timeout and whether a 5–10 minute bulk commit survives | platform behaviour, not in repo | hosted acceptance: run a 650-row commit through the public origin; record status and duration (`render-staging-runbook.md:119-127`) |
| Render forwarding hop count (`TRUST_PROXY`) | platform | inspect `X-Forwarded-For` on a real request; set the exact count; verify limiter keys differ per client |
| Real SMTP deliverability / spam placement | provider | `npm run smoke:smtp` against the chosen relay with an approved recipient |
| Voyage quota, tier, sustained 429 behaviour, cost per month | provider account | provider dashboard + C5 harness with `--execute` under agreed budget |
| Whether the production database has been backfilled (no rows failing `validStoredEmbedding`) | operational state | run `backfill-topic-embeddings.js --dry-run` equivalent / compare table counts with `residentCorpus.stats()` |
| Managed-PostgreSQL automated backup schedule and retention on `basic-256mb` | provider | provider console; perform one restore drill per runbook |
| Render account notifications for deploy/health failures | platform | check account notification settings; trigger a failing health check in staging |
| Actual departmental concurrency and corpus growth | institution | pilot telemetry (requires `LOG_LEVEL=http` or metrics) |
| Distribution of real supervisor judgments vs T1/T2 | not collected | complete the lecturer-reviewed benchmark protocol (`docs/evaluation/lecturer-validation-protocol.md`) |
| Prisma pool vs PostgreSQL `max_connections` on the chosen plan | provider | measure under load; set `connection_limit` explicitly |
| Behaviour of Node's default request timeout for slow uploads through Nginx | runtime configuration interplay | hosted slow-upload test |

---

# 19. P0 Findings

**None verified.** Each P0 criterion was tested against evidence: cross-embedding-space comparison (blocked by
metadata + source-hash admission), unauthorized access (server-side RBAC on every route), secret exposure (tree,
bundle and history clean), false academic result (no fallback/fabrication; classification is advisory and
honest on failure/empty corpus), irreversible data loss (additive migrations, transactional writes, lineage
preserved), unsafe production operation (fail-closed startup validation, non-root containers).

---

# 20. P1 Findings

| ID | Finding | Evidence | Why P1 |
| --- | --- | --- | --- |
| P1-1 | Lecturer similarity snapshots store empty `tierCounts` (0/0/0) and empty `topMatches` because the summary reads legacy keys (`data.tier1_historical…`, `match.sbert/tfidf/jaccard`) that the live controller never emits; `hasSbertScores` is set true. Only `overall_risk`, `max_similarity`, `recommendation` survive. The UI renders the zero counts. | `similaritySnapshot.service.js:16-61,100-130`; producer `similarity.controller.js:70`; consumer UI `SubmissionDetailPage.jsx:411`; tests mirror legacy shape | Persisted academic evidence record is materially incomplete and misleading; reliability of the audit trail lecturers rely on |
| P1-2 | Concurrent lecturer decisions on one pending submission are not serialised: status is checked before the transaction and the update has no status predicate; two decisions both succeed; a `current_session_topics` upsert from an APPROVED can survive a later REJECTED. | `submission.service.js:784-800,849-877` | Data-integrity race producing an inconsistent academic record and stray corpus entry; small window, shared queue makes it plausible |
| P1-3 | UNDER_REVIEW topics are excluded from the searchable corpus 48 h after `reviewStartedAt`; pending-vs-pending collisions become invisible when review lags; not documented in the current contract; inherited from the legacy design (under-review rows are now deleted on decision, removing the original hygiene motive). | `residentCorpus.service.js:9,31`; archive rationale `docs/archive/backend/similarity-endpoint-summary.md:369` | Silent reduction of the evidence the DSS exists to provide |
| P1-4 | T1/T2 were calibrated on 120 researcher-constructed pairs marked not expert-validated; lecturer-reviewed labels do not exist. (4b) The frozen calibration artefact is reachable only on `experiment/expanded-semantic-model-evaluation` (`f925a95`), not from the baseline or the defence tag. | artefact provenance; `docs/evaluation/*`; `git merge-base` | Academic defensibility must be explicitly accepted (advisory use only) and the evidence must be preserved in the production lineage |
| P1-5 | Corpus refresh re-reads every topic row with its JSONB vector up to every 5 s under traffic; measured p50 3.4 s / p95 6.6 s and ~1.2 GB RSS at 5 000 topics; refresh failure fails checks closed (500). | `residentCorpus.service.js:18,30`; C4 artefacts | Availability/latency/memory risk at 10× corpus on the planned instance size |
| P1-6 | Operational visibility: (a) no alerting or metrics; (b) per-request duration/status logs suppressed at the shipped `LOG_LEVEL=info`; (c) bootstrap prints the first administrator's temporary password to stdout, which a hosted log stream retains. | `logger.js:14-20,118`; `render.yaml LOG_LEVEL=info`; `bootstrap-admin.js:72` | Outages are undetected; a retained plaintext administrator credential is an access risk until first login |
| P1-7 | Write-path 429 handling sleeps 61 s per attempt inside the HTTP request (≤ ~152 s); no backend request timeout; Render edge limit unknown. | `topicCorpusLifecycle.service.js:5-27` | Availability under provider throttling; borderline P1/P2 — listed for explicit acceptance |

# 21. P2 Findings

1. No idempotency/uniqueness for initial submissions → duplicate pending submissions on retry (`submission.service.js:474-541`).
2. Logout does not revoke the JWT (`auth.controller.js:33-41`).
3. Login timing oracle for account existence (`auth.service.js:142-144`).
4. CSV formula injection in admin exports (`adminReportExport.service.js:84-95`).
5. No `Content-Security-Policy` on the SPA (`frontend/nginx.conf.template`).
6. Prisma known errors (pool timeout, schema mismatch) mapped to HTTP 400 (`errorHandler.middleware.js:177-186`).
7. `backend/.env.test` tracked with a local test credential; `env.example` history contains example URLs.
8. Audit log lacks academic events (submission, revision, decision, similarity check).
9. Topic import has no row cap; embeddings are generated before persistence, so a failed commit wastes spend.
10. Bulk-onboarding manifest is unrecoverable if the response is lost (operational procedure exists: credential reset).
11. Public readiness can trigger one Voyage probe per 5 min per process.
12. Deferred Research Explorer route reachable by URL (placeholder).
13. Dead legacy code in the runtime tree (`similarityScoring.config.js`, `sbert/tfidf/jaccard/contextSimilarity` services, `sbertService` config) and stale API docs (`docs/api/API.md`, `backend-api.md` field table); SBERT setup docs outside `archive/`.
14. Invalid/stale vectors are excluded silently; only counts are exposed.
15. Dependencies: `exceljs → uuid` moderate advisories; Prisma 5.7.1 lagging.
16. CI does not run `npm audit`, the deployment-contract check or the release gate.
17. No `connection_limit`/statement timeout configuration for PostgreSQL.
18. Password policy minimal (8 chars + digit), no breached-password check.
19. Corpus refresh failure with a valid stale snapshot still fails the request (could serve last-good with an explicit staleness flag — a design choice to record, not a defect).

---

# 22. Tests Needed to Prove Findings

| Finding | Smallest falsifying/proving test | Setup / stimulus / expectation | Deps | Destructive | Where | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| P1-1 | Supertest: lecturer `POST …/similarity-check` with a mocked Voyage vector and a mocked corpus of 2 valid topics; then read the created snapshot | expect `resultSummary.tierCounts.historical ≥ 1` and `topMatches.historical[0].score` finite | DB mocked, Voyage mocked | no | local | none |
| P1-2 | Two concurrent `updateLecturerSubmissionStatus` calls (APPROVED, REJECTED) on one PENDING_REVIEW row against a real PostgreSQL | exactly one succeeds; final status matches the winner; `current_session_topics` row exists iff final status is APPROVED | DB real (CI service), Voyage mocked | no (test DB) | local/CI | none |
| P1-3 | Unit: corpus with an UNDER_REVIEW row `reviewStartedAt = now − 49 h` | document the accepted rule: assert it is (or after remediation, is not) excluded from `searchable()` | none | no | local | none |
| P1-4 | Evidence test: `git cat-file -e e5e3fc1:backend/evaluation/results/voyage-production-direction-calibration.json` | passes only once the artefact is cherry-picked into the baseline; plus a lecturer-benchmark validation run producing a schema-valid reviewed file | Git | no | local | lecturer time |
| P1-5 | Re-run `run-in-memory-benchmark.js --scale 5000` on the target instance class; add a test that `residentCorpus.get()` under 20 parallel calls issues at most one `findMany` per table per 5 s | p95 total and RSS recorded against the instance's memory; single-flight refresh asserted | DB real (fixture), no Voyage | fixture DB only | hosted/staging | provider: none |
| P1-6 | (a/b) Unit: with `LOG_LEVEL=info`, a completed 200 request emits no completion log; with `http` it does — documents the gap. (c) Run bootstrap with stdout captured; assert the credential appears — then re-run after remediation | as stated | none | no | local | none |
| P1-7 | Unit with fake timers: `retryVoyageCall` on three 429s takes ≥ 122 s of simulated sleep; supertest that the request stays open | measure bound; decide acceptable bound | mocked | no | local | none |

---

# 23. Minimal Remediation Plan

Not implemented in this pass. Smallest safe change per finding:

| Finding | Type | Remediation |
| --- | --- | --- |
| P1-1 | CODE FIX (serializer) | In `buildResultSummary`, read `data.matches` grouped by `collection` and use `semantic_score`; drop `hasSbertScores` or rename to `hasSemanticScores`; rewrite the two mirrored tests against the live controller shape; add the round-trip test above. Existing rows remain historically incomplete — note in docs. |
| P1-2 | CODE FIX (one guard) | Perform the status transition with `tx.submission.update({ where: { id, status: 'PENDING_REVIEW' }, … })` (or `updateMany` + count check) inside the transaction and map `P2025`/count 0 to the existing 400 "not pending"; add the concurrency test. |
| P1-3 | CODE FIX (one constant) + DOCUMENTATION FIX | Either remove the 48 h cutoff (under-review rows are deleted on decision, so eligibility = "still pending"), or make it configurable with a documented default and surface it in the checker copy. Record the decision in the semantic contract document. |
| P1-4 | OPERATIONAL PROCEDURE + DOCUMENTATION FIX | Cherry-pick `f925a95`'s frozen artefacts into the production lineage (docs-only commit) so the calibration is reachable from the baseline; record an explicit departmental acceptance that thresholds are advisory pending the lecturer-reviewed benchmark; schedule the benchmark per `docs/evaluation/lecturer-validation-protocol.md`. |
| P1-5 | CODE FIX (small) then CONFIGURATION | Short term: single-flight refresh (share one in-flight promise) and a refresh interval configurable via env (e.g. 30–60 s), select only needed columns; set the instance memory floor in the runbook. Medium term (design, out of scope here): incremental refresh keyed by `updatedAt` or a DB-side vector store. |
| P1-6 | CONFIGURATION FIX + OPERATIONAL PROCEDURE + CODE FIX (bootstrap) | Set `LOG_LEVEL=http` (or promote completion logs to `info`) so latency/status are captured by the platform log stream; wire the platform's log-based alerts on `Request failed`, `Database connectivity lost`, provider `unavailable`, and readiness 503 (owner named in the runbook); change `bootstrap-admin.js` to write the credential to a 0600 file path or print it only with an explicit `--print-credential` flag. |
| P1-7 | CODE FIX (one timeout) | Honour `Retry-After` when present and cap the total write-path wait (e.g. 30 s) — return 503 `SEMANTIC_SYNC_UNAVAILABLE` beyond that; or accept and document the 152 s bound against the hosted edge limit. |
| P2 items | mixed | one-line CSV neutralisation (prefix `'` for `=+-@\t\r`), CSP header in Nginx, map Prisma `P2024`/schema errors to 503/500, bump `credentialVersion` on logout, constant-time dummy `bcrypt.compare` for unknown identifiers, topic-import row cap, remove tracked `.env.test` value, archive SBERT docs, CI `npm audit` + deployment-contract step. |

---

# 24. Final Go/No-Go

| | Question | Answer |
| --- | --- | --- |
| A | Can incompatible embeddings participate in a current comparison? | **No** — VERIFIED FROM CODE (`validStoredEmbedding` at build and retrieval; source-hash recomputation). |
| B | Can a student access admin-only behaviour by bypassing the frontend? | **No** — every admin/import route enforces `requireAuth` + `requireRole('admin')` server-side. |
| C | Can repeated requests create duplicate academic records? | **Yes, for initial submissions** (no idempotency key/constraint); no for revisions (unique index), approvals (upsert), imports (fingerprint); decisions can conflict under concurrency (P1-2). |
| D | Can repeated requests cause avoidable paid Voyage calls? | **Yes, bounded**: 30 per user per 15 min on the read path; duplicate submissions and failed import commits re-spend; public readiness ≤ 1 probe per 5 min per process. |
| E | Does provider failure ever produce fabricated similarity evidence? | **No** — 503 `semantic_unavailable`, null class; empty corpus reported truthfully; no fallback vectors exist in the runtime tree. |
| F | Does database failure fail safely? | **Yes (closed)** — requests fail with 5xx, readiness 503, no partial writes; **not fail-visible** beyond logs (no alerting); some DB errors are mislabelled 400. |
| G | Are production secrets absent from the current tree and history? | **Yes** — tree, bundle and history scans clean; only placeholders/test fixtures and a tracked local test DB URL. |
| H | Are thresholds supported by the frozen evaluation artefact? | **Partially** — the artefact exists and matches the constants, but only on `experiment/expanded-semantic-model-evaluation` (`f925a95`); it is not reachable from `e5e3fc1` or the defence tag. |
| I | Are thresholds based on actual supervisor judgments? | **No** — researcher-constructed labels (120 pairs, "not_department_expert_validated"); lecturer-reviewed labels still missing. |
| J | Is monitoring sufficient to detect/alert on production failure? | **No** — logging and readiness exist; no metrics, no alerting; per-request logs off at the shipped level. |
| K | Can the current single-instance architecture safely serve the intended initial department? | **Yes, with conditions** — at a few hundred to ~2 000 topics and tens of concurrent users the measured costs (≈1 s DB refresh, ≈1 s Voyage, 13–36 ms ranking, < 400 MB RSS) fit a `standard` instance; P1-1/2/3 should be fixed first and P1-4/5/6 explicitly accepted. |
| L | What breaks first at 10×? | Full-corpus JSONB refresh on the request path (latency 3–7 s, RSS ~1.2 GB at 5 000 topics) and the absence of alerting to notice it; then provider cost/quota. |
| M | What remains unproven until hosted staging? | Render edge timeout for long imports, `TRUST_PROXY` hop count, SMTP deliverability, provider quota/429 behaviour, managed backups, platform notifications, real concurrency (§18). |
| N | Is the repository itself sufficient evidence to call this production-ready? | **No.** It is sufficient to show the academic-safety invariants hold and to run a supervised departmental pilot on a single instance; production readiness additionally requires the P1 fixes/acceptances, hosted acceptance evidence and an alerting owner. |

Verdict restated: **CONDITIONALLY READY** — conditions are P1-1, P1-2, P1-3 fixed with the tests in §22;
P1-4, P1-5, P1-6, P1-7 either remediated or explicitly accepted in writing; and the §18 unknowns closed by
hosted acceptance before any real departmental data is loaded.

STOP. No code was modified. Nothing was deployed.
