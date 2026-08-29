# Active Corpus Coverage Audit (read-only census)

Baseline: `staging/render-acceptance` = `e5e3fc18555fafde7fa409352b37357c0bb22c43` (the audit branch
`docs/production-readiness-audit` carries this application tree unchanged: `git diff e5e3fc1 -- backend frontend`
is empty). Audit date: 2026-08-29.

Nothing was modified: no application code, rows, embeddings, migrations, branches, deployment configuration or
corpus state; no Voyage call was made. The only state change was starting and re-stopping the preserved
PostgreSQL container so its data could be read; it was stopped before this audit began and is stopped again now.

Method: one census script (job scratch directory, not in the repository) loaded the **baseline's own** modules —
`validStoredEmbedding`, `validVector`, `sourceHash`, `serialize`, `build`, `isEligible`, `ResidentCorpus` — and applied
them to rows fetched exactly as `residentCorpus.refresh()` fetches them (`findMany()` on the three topic tables).
For two legacy-schema databases the Prisma client cannot read, rows were fetched with raw `SELECT`s and fed to the
same gate functions. Per-gate evaluation and the mutually exclusive primary reason follow the code's own
short-circuit order.

---

## 0. Which database / dataset was inspected

| Database | Where | Kind | Historical / current-session / under-review rows | Schema | Baseline `findMany()` |
| --- | --- | --- | --- | --- | --- |
| **`ts_demo`** (PRIMARY) | Docker volume `ts-closure_postgres-data`, container `topic-similarity-postgres`, network `ts-closure_default` | **Preserved synthetic acceptance database** — produced by the accepted container stack itself (topic import through the real API with live Voyage on 2026-08-28; synthetic `.invalid` cohort) | 12 / 10 / 1 | all 14 migrations | works (census ran inside the `ts-closure-backend` image against it) |
| `topic_similarity_v1_dev` (secondary) | host PostgreSQL `localhost:5432` (`backend/.env`) | **Development database** (demo-comparison seed, then backfilled) | 6 / 1 / 2 | all 14 migrations | works |
| `topic_similarity` (context) | host PostgreSQL | **Legacy local database** from the February MVP (seeded rows + one smoke import; no `_prisma_migrations` table) | 204 / 1 / 1 | pre-`20260813` — no embedding metadata columns | **fails** (`P2022`, column missing) |
| `topic_similarity_c4_perf` (context) | host PostgreSQL | **Benchmark fixture** (`c4-cloned-voyage-scale-fixture-v1`, clones of the dev rows) | 4 286 / 714 / 0 | migration 8 of 14 | **fails** (`P2022`) |
| `topic_similarity_test`, `ts_closure_scratch` | host / Docker | empty / scratch | 0 / — / — | — | — |
| Hosted staging database | — | **does not exist** (Blueprint never provisioned) | — | — | — |
| Real departmental database | — | **does not exist** (no real data has ever been loaded) | — | — | — |

All counts below are **synthetic/local** coverage. None of them is departmental coverage (§13-K).

---

## 1. The actual eligibility query (VERIFIED FROM CODE)

| Step | Code |
| --- | --- |
| Tables / collections | `COLLECTIONS = [['HISTORICAL','historicalTopic'], ['CURRENT_SESSION','currentSessionTopic'], ['UNDER_REVIEW','underReviewTopic']]` — `backend/src/services/residentCorpus.service.js:5`. No other collection participates. |
| Database query | `refresh()` runs `this.client[key].findMany()` for each of the three models **with no `where`, `select` or ordering** — `residentCorpus.service.js:18`. Every row of `historical_topics`, `current_session_topics` and `under_review_topics` is read. |
| Row decoration | `decorate()` adds `collection` and `studyFocus: row.studyFocus ?? row.study_focus` — `:8`. |
| Embedding admission | `build()` keeps rows for which `validStoredEmbedding(row)` is true — `:10-13`. |
| `validStoredEmbedding` | `validVector(embedding) && embeddingProvider === 'voyage' && embeddingModel === MODEL && embeddingDimension === DIMENSION && embeddingRepresentation === REPRESENTATION_ID && embeddingSourceHash === sourceHash(topic)` — `backend/src/services/voyageEmbedding.service.js:73`; `validVector` = `Array.isArray(v) && v.length === DIMENSION && v.every(Number.isFinite)` — `:12`. |
| Constants | `MODEL = 'voyage-4-large'`, `DIMENSION = 1024` — `voyageEmbedding.service.js:3`; `REPRESENTATION_ID = 'structured-context-v1'` — `backend/src/services/topicSemanticRepresentation.service.js:3`. |
| Source hash | `sourceHash(topic) = sha256(serialize(topic))`; `serialize` = `Title: …` plus non-blank `Population: …`, `Location: …`, `Study focus: …` lines joined by `\n`; a blank title throws — `topicSemanticRepresentation.service.js:4-17`. |
| Time / lifecycle filter | `isEligible()` applies **only** to `UNDER_REVIEW`: `reviewStartedAt > now − 48 h` — `residentCorpus.service.js:9`; enforced at query time by `searchable()` — `:31`. **No time, status or lifecycle filter exists for HISTORICAL or CURRENT_SESSION rows.** |
| Refresh cadence | snapshot rebuilt when absent or older than `REFRESH_INTERVAL_MS = 5000` — `:6,30`. |
| Storage | `embedding Json?` plus `embedding_provider/model/dimension/representation/source_hash`, `embedded_at` on all three models — `backend/prisma/schema.prisma:245-276, 278-312, 315-350`. |

Consequently, for HISTORICAL rows the only gates are the embedding gates above; the 48-hour rule is **not**
applied to historical rows and is not mixed into the coverage figure.

---

## 2. TOTAL_HISTORICAL_ELIGIBLE

Definition used: every row of `historical_topics` (the query has no lifecycle/status/data precondition, so every
stored historical topic *should* be compared if it carries a valid current embedding).

| Dataset | TOTAL_HISTORICAL_ELIGIBLE | Produced by |
| --- | --- | --- |
| **`ts_demo`** | **12** | `prisma.historicalTopic.findMany()` inside the baseline image (row count confirmed by `SELECT count(*) FROM historical_topics` = 12) |
| `topic_similarity_v1_dev` | 6 | same |
| `topic_similarity` (legacy) | 204 | raw `SELECT` (Prisma client cannot read the schema) |
| `topic_similarity_c4_perf` | 4 286 | raw `SELECT` |

Pre-embedding exclusions: **none exist in code**. No malformed/non-semantic record is filtered before embedding
validation; the only way a row leaves the corpus is `validStoredEmbedding` (or, for UNDER_REVIEW, the 48-hour
rule). Blank-title rows: 0 in every dataset (relevant because a blank title would make `sourceHash` throw inside
`build()` and fail the whole refresh — see §10 note; the import path rejects such rows, `importReport.missingTitleRows`).

---

## 3. Current embedding admission — `ts_demo` (primary)

| Gate (as enforced by code) | Passing / 12 |
| --- | --- |
| embedding present (non-null) | 12 |
| embedding is an array | 12 |
| vector length = 1024 | 12 |
| every element finite (numeric) | 12 |
| `embedding_provider = 'voyage'` | 12 |
| `embedding_model = 'voyage-4-large'` | 12 |
| `embedding_dimension = 1024` | 12 |
| `embedding_representation = 'structured-context-v1'` | 12 |
| `embedding_source_hash = sha256(serialize(row))` (recomputed from the row's current title/population/location/study focus) | 12 |
| title non-blank (hash computable) | 12 |
| lifecycle / source metadata | no gate exists for HISTORICAL (all 12 are `source_type = 'xlsx'`, batch `import-1787937521778`) |
| **`validStoredEmbedding(row)`** | **12** |

**ADMISSIBLE_HISTORICAL = 12.  COVERAGE_PERCENT = 12 / 12 × 100 = 100.00 %.**

Secondary datasets: `topic_similarity_v1_dev` 6 / 6 = 100.00 %; `topic_similarity_c4_perf` 4 286 / 4 286 = 100.00 %;
legacy `topic_similarity` **0 / 204 = 0.00 %**.

---

## 4. Exclusion reasons

### `ts_demo` (primary)

A. Primary (mutually exclusive) reasons — reconciles to 12 − 12 = **0**:

| Reason | Count |
| --- | --- |
| missing embedding | 0 |
| malformed embedding (not array / non-numeric) | 0 |
| wrong dimension (vector length) | 0 |
| wrong provider | 0 |
| wrong model | 0 |
| wrong dimension metadata | 0 |
| representation mismatch | 0 |
| source-hash mismatch / missing | 0 |
| invalid metadata (other) | 0 |
| lifecycle exclusion | 0 (no such gate for HISTORICAL) |
| time-filtered | 0 (not applicable to HISTORICAL) |
| other | 0 |

B. Individual failed-gate counts (overlapping): all 0.

### Legacy `topic_similarity` (context)

A. Primary: **missing embedding — 204** (204 − 0 = 204 ✓).
B. Failed gates: missing embedding 204; wrong provider 204; wrong model 204; wrong dimension metadata 204;
representation mismatch 204; source hash missing 204 (the metadata **columns do not exist** in this schema, so
every metadata gate fails by absence); malformed 0; blank title 0.

`topic_similarity_v1_dev` and `topic_similarity_c4_perf`: no exclusions.

---

## 5. SBERT-era records

Signals searched: provider ≠ `voyage`, model matching `MiniLM|sbert|sentence`, vector length 384, dimension metadata
384, vector present with null provider/model, representation metadata missing.

| Dataset | Found | Admissible now | Excluded | Exact exclusion reason |
| --- | --- | --- | --- | --- |
| `ts_demo` | **0** | — | — | — (12 / 12 rows carry `voyage` / `voyage-4-large` / 1024 / `structured-context-v1` / valid hash) |
| `topic_similarity_v1_dev` | 0 | — | — | — |
| `topic_similarity_c4_perf` | 0 | — | — | — |
| legacy `topic_similarity` | **204 pre-Voyage rows** — but they carry **no vector at all** (`embedding` is NULL on every row; the SBERT-era design computed similarity through the Python service at request time and never persisted vectors) and no metadata columns | 0 | 204 | missing embedding (metadata absent by schema) |

No `all-MiniLM-L6-v2` metadata, 384-dimensional vector or old hash format exists in any inspected database; the
only pre-Voyage evidence is vector-less legacy rows.

---

## 6. Regeneration status (historical rows)

What can prove *actual* generation under the current contract: (i) the write path — every row inserted by topic
import is embedded at commit time and cannot be inserted unless the generated vector passes
`validStoredEmbedding` (`backend/src/services/topicImportPersistence.service.js:291-330, 362-403`); the backfill CLI
does the same per row (`backend/scripts/backfill-topic-embeddings.js`); (ii) `embedded_at`, set only by
`documentMetadata()` when a vector is produced (`voyageEmbedding.service.js:74`); (iii) the `TOPIC_IMPORT_COMMITTED`
audit event whose `persistenceReport` records `embeddingGenerated`; (iv) run logs. No per-row provider receipt is
stored, so (i)–(iii) together are the strongest available evidence.

| Dataset | Classification | Evidence |
| --- | --- | --- |
| **`ts_demo`** — 12 / 12 | **A. VERIFIED REGENERATED (generated under the current contract at import)** | `source_type = 'xlsx'`, `import_batch_id = import-1787937521778`; `embedded_at` spread from `17:18:46.318` to `17:22:01.565` (sequential provider calls) **before** a single shared `created_at = 17:22:01.579` (one transaction), which is exactly the import path's embed-then-commit behaviour; audit event `TOPIC_IMPORT_COMMITTED` at `17:22:02.015` for the same batch with `persistenceReport = { attemptedRecords: 12, embeddingGenerated: 12, insertedRecords: 12, searchableRecords: 12, corpusRefreshed: true }`, `importReport = { totalRows: 12, acceptedRows: 12, missingTitleRows: 0 }`; the capture-run log of that session records `corpus: imported historical topics (HTTP 200)`. Caveat: no provider receipt per row exists; the evidence is the code path plus consistent timestamps and counts. |
| `topic_similarity_v1_dev` — 6 / 6 | **B. COMPATIBILITY ONLY** | Rows were seeded with `embedding: null` (`backend/prisma/seed-demo-comparison-topics.js:22`, batch `demo-comparison-topics-v1`, `source_type = 'demo'`) and later received vectors with `embedded_at` 2026-08-14 03:03–03:04; the backfill CLI writes no audit event, so when/how they were generated cannot be proved from repository or database evidence. |
| `topic_similarity_c4_perf` — 4 286 / 4 286 | **B. COMPATIBILITY ONLY** | Clones of the dev rows: identical `embedded_at` values to the 6 source rows (`prepare-scale-fixture.js` copies source records; `in-memory/README.md` "no topic text is changed"). They pass admission because text and hash were copied together; they were not generated per row. |
| legacy `topic_similarity` — 0 / 204 | **C. INCOMPATIBLE / NOT REGENERATED** | No vector exists; the schema predates the metadata columns; the baseline cannot read the database (`P2022`). |
| Any row without `embedded_at` in a current-schema database | D. CANNOT DETERMINE | none found in the inspected current-schema databases (all admissible rows carry `embedded_at`) |

A was not inferred from B: `ts_demo` is A because of the import evidence chain, not because it is compatible.

---

## 7. Active snapshot vs database admissibility

- In-process, read-only: instantiating the baseline's `ResidentCorpus` against `ts_demo` and calling `refresh()`
  built **23 topics (12 HISTORICAL, 10 CURRENT_SESSION, 1 UNDER_REVIEW)**; `searchable()` returned **23**;
  `stats()` = `{ built: true, topics: 23, searchable: 23, lastRefreshError: null }`. `build()` on the same rows gave
  the same 12 / 10 / 1. **ADMISSIBLE DATABASE HISTORICAL COUNT (12) == BASELINE-BUILT SNAPSHOT HISTORICAL COUNT (12).**
- The acceptance stack's *live* backend process is stopped; its resident snapshot does not exist right now, and
  reading `/api/v1/admin/system-status` would require an administrator login, which writes an `AUTH_LOGIN` audit
  row (a mutation). **Live-process equality: UNKNOWN.** How to prove it: with the stack running, authenticate once as
  the synthetic administrator (accepting one audit row) and compare `residentCorpus.topics` / `searchable` from
  `GET /api/v1/admin/system-status` (`backend/src/controllers/adminSystemStatus.controller.js:38`) with
  `SELECT count(*)` of rows passing this census; they must match after the 5-second refresh window.
- `topic_similarity_v1_dev`: built 9 topics (6 / 1 / 2), searchable **7** — both UNDER_REVIEW rows are admissible by
  embedding but expired under the 48-hour rule (`reviewStartedAt` 2026-08-14).

---

## 8. Partial-corpus user visibility (VERIFIED FROM CODE)

| Information | Backend payload | Frontend rendering |
| --- | --- | --- |
| Total historical topics eligible | not computed anywhere | — |
| Topics actually searched | `data.corpus_size = searchable.length` (all collections, valid rows only) — `backend/src/controllers/similarity.controller.js:70` | mapped (`frontend/src/api/similarity.js:58`) but **rendered only when it is 0** (`ResultsDisplay.jsx:443`); otherwise never shown |
| Topics excluded for invalid embeddings | not computed, not logged (`build()` filters silently — `residentCorpus.service.js:11`) | — |
| Coverage percentage | no | no |
| Corpus snapshot size | `corpus_size` as above; readiness carries no corpus field (`readiness.service.js`) | no |
| Warning when coverage is partial | none | none; copy says "Your topic is being compared against existing records" (`CheckMyTopicPage.jsx:139`) and "Highest semantic similarity returned by the checker" (`ResultsDisplay.jsx:270`) |
| Empty corpus | `corpus_size: 0`, `overall_risk: null`, explicit non-originality sentence (`similarity.controller.js:63`) | "No eligible stored topics are currently available for comparison." (`ResultsDisplay.jsx:443-447`) — **explicit** |
| Operator view | `residentCorpus.stats()` exposes `topics` and `searchable` (valid rows only) on `/api/v1/admin/system-status`; the admin dashboard exposes raw table counts (`adminDashboard.service.js:122-124`). Nothing subtracts them or warns. | — |

Can an ordinary **LOW / MEDIUM / HIGH** be returned while only a subset of otherwise-eligible historical topics was
searched? **Yes.** Classification is `classify(matches[0].score)` over whatever passed admission
(`similarity.controller.js:68-70`); if one valid row exists the response is a normal classification. That
incompleteness is **SILENT**: neither the response nor the UI distinguishes "searched all 12" from "searched 3 of
12"; only the zero case is explicit. ("5 matches returned" is the top-K, not the searched count.)

---

## 9. Current-corpus context (not part of the historical percentage)

| Dataset | CURRENT_SESSION eligible / admissible / excluded | UNDER_REVIEW eligible before time filter / admitted by embedding / expired (> 48 h) / excluded by embedding |
| --- | --- | --- |
| **`ts_demo`** | 10 / 10 / 0 | 1 / 1 / 0 / 0 (searchable now: 1) |
| `topic_similarity_v1_dev` | 1 / 1 / 0 | 2 / 2 / **2** / 0 (searchable now: 0) |
| `topic_similarity_c4_perf` | 714 / 714 / 0 | 0 |
| legacy `topic_similarity` | 1 / 0 / 1 (missing embedding) | 1 / 0 / — / 1 (missing embedding) |

---

## 10. File / function evidence

| Claim | Evidence |
| --- | --- |
| Whole-table reads, no filter | `residentCorpus.service.js:16-19` (`refresh()`, `findMany()` × 3) |
| Admission = `validStoredEmbedding` only | `residentCorpus.service.js:10-13` (`build()`), `voyageEmbedding.service.js:12,73` |
| 48-hour rule limited to UNDER_REVIEW | `residentCorpus.service.js:9,31` |
| Canonical text / hash | `topicSemanticRepresentation.service.js:4-17` |
| Contract constants | `voyageEmbedding.service.js:3`, `topicSemanticRepresentation.service.js:3` |
| Storage columns | `schema.prisma:261-267` (HistoricalTopic), `293-299`, `330-336` |
| `embedded_at` set only on generation | `voyageEmbedding.service.js:74` (`documentMetadata`) |
| Import embeds before commit and validates | `topicImportPersistence.service.js:291-330, 362-403` |
| Response `corpus_size` and classification | `similarity.controller.js:60-70` |
| Frontend use of `corpus_size` | `frontend/src/api/similarity.js:58`, `ResultsDisplay.jsx:443-447` |
| Operator counts | `adminSystemStatus.controller.js:38` (`residentCorpus.stats()`), `adminDashboard.service.js:122-124` |
| Blank title throws in `serialize` | `topicSemanticRepresentation.service.js:4-8` — evaluated only after the metadata gates pass (`&&` short-circuit); a row with a valid current vector and an empty title would make `build()` throw and the refresh fail closed (INFERENCE from code; unreachable through the import path, which counts and skips `missingTitleRows`) |
| Audit redaction artefact | the stored `persistenceReport.insertedByBucket.current_session` is `"[redacted]"` — the audit/log redaction key pattern matches `session` (`backend/src/config/logger.js:37` mirrors the audit contract); harmless count loss, P2 |

---

## 11. Output table — `ts_demo` (preserved synthetic acceptance database)

| | |
| --- | --- |
| Historical topics eligible | **12** |
| Historical topics admissible | **12** |
| Historical topics excluded | **0** |
| Coverage | **100.00 %** |
| Old SBERT-era records | **0** in this dataset (204 vector-less pre-Voyage rows exist only in the separate legacy local database `topic_similarity`, 0 % admissible there) |
| Current-contract records | **12** (`voyage` / `voyage-4-large` / 1024 / `structured-context-v1`, hash valid, `embedded_at` set) |
| Source-hash failures | 0 |
| Other failures | 0 |

Exclusion breakdown: none (primary reasons all 0; failed-gate counts all 0).

---

## 12. Verdict

**FULL COVERAGE** — for the inspected dataset only: all 12 eligible historical topics in the preserved synthetic
acceptance database are admissible under the current production contract, and the baseline's own snapshot build
admits exactly those 12.

Qualifications that the verdict must carry:

- The dataset is 12 synthetic rows imported by the accepted stack itself; the verdict says nothing about any other
  corpus (§13-K).
- The code path is **silent about exclusions** (§8). Had any eligible row failed admission, the correct verdict
  would have been **PARTIAL AND SILENT**, because ordinary LOW/MEDIUM/HIGH results disclose neither the searched
  count nor the excluded count. This is a code property independent of the dataset.
- The legacy local database (`topic_similarity`, 204 historical rows, 0 admissible) illustrates the failure mode: a
  database migrated forward from the SBERT era without a backfill would present **NO HISTORICAL DATASET TO AUDIT**
  in the corpus (`corpus_size: 0`, explicit empty-corpus message) until every row is embedded; a *partial* backfill
  would then be PARTIAL AND SILENT.

---

## 13. Production significance

| | Question | Answer |
| --- | --- | --- |
| A | What exact dataset/database was audited? | Primary: `ts_demo` in Docker volume `ts-closure_postgres-data` — the **preserved synthetic acceptance database** of the accepted container stack (12 fictional historical topics imported on 2026-08-28). Secondary/context: host dev DB `topic_similarity_v1_dev` (6), legacy local `topic_similarity` (204, pre-Voyage schema), benchmark fixture `topic_similarity_c4_perf` (4 286 clones). No hosted or departmental database exists. |
| B | How many historical topics should be searchable? | 12 (`ts_demo`). Context: 6 / 204 / 4 286 in the other local databases. |
| C | How many actually pass current admission? | 12 (`ts_demo`). Context: 6 / **0** / 4 286. |
| D | What percentage is covered? | **100.00 %** (`ts_demo`). Context: 100 % / **0 %** / 100 %. |
| E | Why is each excluded record excluded? | `ts_demo`: no exclusions. Legacy `topic_similarity`: all 204 have **no embedding** (and no metadata columns); the baseline cannot even read that schema (`P2022`). |
| F | Are any SBERT-era vectors still present? | **No SBERT vectors exist anywhere inspected.** The SBERT-era database holds 204 rows with `embedding = NULL` — the old design never persisted vectors. |
| G | Were they regenerated, merely excluded, or cannot this be determined? | `ts_demo`: **verified regenerated** at import under the current contract (embed-then-commit timestamps + audit counts). Dev DB: compatibility only (backfilled; timestamps only). C4 fixture: compatibility only (clones). Legacy DB: **not regenerated** (no vectors). |
| H | Can incompatible embeddings enter similarity comparison? | **No.** Admission requires provider, model, dimension, representation and a recomputed source hash at build time and again at retrieval; every gate was exercised by this census (all 204 legacy rows and none of the current-contract rows were rejected). |
| I | Can a normal similarity classification be returned with incomplete historical coverage? | **Yes** — any subset of ≥ 1 admissible row yields an ordinary LOW/MEDIUM/HIGH from the top score of the rows actually searched. |
| J | Does the student/lecturer know how much corpus was searched? | **No.** `corpus_size` is in the payload but rendered only when it is 0; no eligible total, excluded count, coverage figure or partial-coverage warning exists. Operators can only compare raw table counts with `residentCorpus.stats()` by hand. |
| K | Does this result prove anything about the future real Public Health dataset? | **No.** It proves that the accepted stack's import path produces 100 %-admissible historical rows for a 12-row synthetic file, and that the admission gates reject every vector-less legacy row. The departmental dataset's coverage will depend on its own import/backfill completeness and must be censused the same way (this script's method) after loading; and because the application is silent about partial coverage, that census — or an explicit coverage signal in the product — is the only way anyone will know. |

STOP. No code, data, embeddings, migrations, branches or deployment configuration were modified; nothing was
re-embedded; no Voyage call was made; nothing was deployed.
