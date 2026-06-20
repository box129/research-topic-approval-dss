# FYP Evaluation Benchmark Evidence

Generated from PR #105 evaluation/data-quality tooling, updated after PR #106 corrected the production scoring contract, and preserved unchanged by PR #107 deployment-readiness work.

## Evidence Sources

- Dataset: `backend/evaluation/datasets/pilot-topic-pairs.json`
- Evaluation runner: `backend/scripts/run-topic-evaluation.js`
- Evaluation JSON: `backend/evaluation/results/topic-similarity-evaluation.json`
- Evaluation report: `docs/testing/topic-similarity-evaluation-report.md`
- Data-quality runner: `backend/scripts/run-topic-data-quality-audit.js`
- Data-quality JSON: `backend/evaluation/results/topic-data-quality-audit.json`
- Data-quality report: `docs/testing/topic-data-quality-report.md`

## Production Scoring Snapshot

Current production thresholds and behavior are shared by the controller and evaluator from `backend/src/config/similarityScoring.config.js`:

- `HIGH`: `>= 0.70`
- `MEDIUM`: `>= 0.40`
- `LOW`: `< 0.40`
- General tier minimum: `0.10`
- Tier 2/3 requirement: combined `>= 0.60` and SBERT `>= 0.60`
- Normal weights: Jaccard `0.20`, TF-IDF `0.30`, SBERT `0.50`
- Fallback weights: Jaccard `0.40`, TF-IDF `0.60`

Normal successful mode ranks by the approved weighted combined score and classifies overall risk from the highest eligible weighted combined score. Fallback mode ranks by the approved lexical fallback combined score and classifies overall risk from the highest eligible fallback combined score. Tier 2/3 rows require real SBERT evidence; lexical fallback does not fabricate SBERT eligibility.

Historical note: PR #105 measured the previous implementation and identified scoring drift. PR #106 corrected production scoring to match the approved FYP methodology and added regression evidence.

PR #107 does not regenerate metrics, relabel the dataset, change scoring, or add benchmark claims. It adds deployment-readiness documentation and release-gate automation around the existing evidence.

## Latest Evaluation Result

The generated evaluation ran in `sbert_available_full_tri_evaluation` mode against the local SBERT service at `http://localhost:8000`:

- Total cases: 16
- Valid cases: 16
- Skipped cases: 0
- Dataset class support: LOW 4, MEDIUM 5, HIGH 7
- SBERT attempted cases: 16
- SBERT success cases: 16
- SBERT failed cases: 0
- SBERT unavailable cases: 0
- Full tri-algorithm cases: 16
- Fallback-used cases: 0
- Full tri-algorithm coverage: `100%`
- Operational fallback coverage: `0%`
- Operational fallback metrics: `NOT_EVALUATED` because runtime fallback support is 0
- Offline fallback-policy evaluation: counterfactual pilot evaluation across all 16 valid cases, using corrected fallback logic without SBERT output
- Final production behavior accuracy: `0.375`
- Final production behavior macro F1: `0.365`
- Final production behavior weighted F1: `0.348`

The PR #105 baseline for the previous drifted implementation was accuracy `0.313`, macro F1 `0.224`, and weighted F1 `0.215`. The current metrics measure the corrected PR #106 production contract. They remain pilot-only and do not prove final real-world effectiveness.

## Scoring-Contract Reconciliation

| Item | Approved FYP Specification | Current Implementation / Evaluation Behavior | Status |
| --- | --- | --- | --- |
| Jaccard weight | `0.20` | `0.20` used in approved weighted combined score | MATCH |
| TF-IDF weight | `0.30` | `0.30` used in approved weighted combined score | MATCH |
| SBERT weight | `0.50` | `0.50` used in approved weighted combined score | MATCH |
| Fallback weights | Jaccard `0.40`, TF-IDF `0.60` | `0.40 / 0.60` used in approved fallback combined score | MATCH |
| LOW/MEDIUM boundary | MEDIUM starts at `0.40` | MEDIUM starts at `0.40` | MATCH |
| HIGH boundary | HIGH starts at `0.70` | HIGH starts at `0.70` | MATCH |
| Tier minimum | `0.10` | Tier candidates require combined `>= 0.10` | MATCH |
| Tier 2/3 requirement | combined `>= 0.60` and SBERT `>= 0.60` | implemented for SBERT-available mode; fallback returns no fake semantic rows | MATCH |
| Overall risk | highest eligible weighted/fallback combined score | implemented for normal and fallback paths | MATCH |

Scoring drift is resolved by PR #106. Lecturer-reviewed, departmental-scale effectiveness validation remains future work.

## Latest Data-Quality Result

The generated data-quality audit ran in database mode:

- Topic records inspected: 9
- Historical records: 6
- Current-session records: 1
- Under-review records: 2
- Blank titles: 0
- Missing category/session/supervisor/keywords/context fields: 0
- With embeddings: 0
- Without embeddings: 9
- With import warnings: 0
- Normalized duplicate-title candidate groups: 0

Raw titles are not written to the committed report. Duplicate-title candidates, when present, use hashed normalized titles plus lifecycle/id references.

This is only a connected local database snapshot. It does not represent the complete departmental repository, departmental-scale data quality remains NOT YET VERIFIED, and no broad data-quality conclusion should be drawn from nine inspected records.

## Benchmark Mapping

| Benchmark | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Role-based DSS workflow exists | REACHED | Student submission, lecturer review, admin governance docs/tests | Existing app behavior; not changed by PR #105. |
| Jaccard similarity evidence | REACHED | `topic-similarity-evaluation.json` method `jaccard` | Runs on all 16 valid pilot cases. |
| TF-IDF similarity evidence | REACHED | `topic-similarity-evaluation.json` method `tfidf` | Runs on all 16 valid pilot cases. |
| SBERT execution/coverage | REACHED FOR PILOT ONLY | `sbert.available: true`, `successCases: 16` | Local SBERT availability and execution were demonstrated for all 16 pilot cases. |
| SBERT semantic effectiveness evidence | PARTIALLY REACHED | SBERT-only metrics generated for 16/16 pilot cases | Pilot labels are manually constructed, not lecturer-reviewed or departmental ground truth. |
| Final SBERT effectiveness validation | NOT REACHED | No lecturer-reviewed dataset in repo | Requires departmental/lecturer-reviewed validation labels. |
| Runtime fallback performance | NOT EVALUATED | `productionFallback.fallbackUsedCases: 0` | No runtime fallback cases occurred while SBERT was active, so accuracy/F1 are null rather than zero. |
| Offline fallback-policy evaluation | REACHED FOR PILOT ONLY | `offlineFallbackPolicyEvaluation` applies current fallback policy across 16 valid cases | Counterfactual only; not evidence that runtime fallback was triggered and does not include SBERT output. |
| Production tri-algorithm combined behavior measured | REACHED FOR PILOT ONLY | Full tri-algorithm coverage is 100% and scoring contract now matches approved weights | Pilot labels are manually constructed. |
| LOW/MEDIUM/HIGH class metrics | REACHED | Macro/weighted/per-class metrics and confusion matrices generated | Dataset remains pilot/manual. |
| Dataset provenance documented | REACHED | `schema_version`, `provenance`, source classifications, tags | Marked as manually constructed pilot, not expert ground truth. |
| Final lecturer-reviewed benchmark | NOT REACHED | No expert validation source in repo | Needs department/lecturer-reviewed cases. |
| Topic data-quality audit | REACHED | `topic-data-quality-audit.json` database mode | Read-only safe-field audit generated. |
| Embedding coverage for topic repository | PARTIALLY REACHED | Local audit reports 0 with embeddings, 9 without embeddings | Local snapshot only; departmental-scale coverage remains not yet verified. |
| Semantic duplicate governance | DEFERRED | Audit exact-title duplicate candidates only | Richer duplicate-existing checks remain outside PR #105. |
| Production scoring or threshold update | REACHED FOR PR #106 CONTRACT | Shared config, controller behavior, evaluator, and regression tests now align | Future scoring changes still need separate approval and evaluation. |

## Limitations

- The evaluation dataset is manually constructed and small.
- The latest metrics should not be presented as final departmental accuracy.
- SBERT was available for the latest run, but semantic performance is verified only for the small pilot dataset.
- PR #105 documented previous scoring drift; PR #106 corrected production scoring to the approved weighted methodology.
- Data-quality duplicate detection uses normalized exact titles only.
- The data-quality audit describes the current local database state at generation time and covers only nine records.

## Reproduction

```powershell
cd backend
npm run evaluate:topics
npm run audit:data-quality
```

If no safe local database is available:

```powershell
cd backend
npm run audit:data-quality -- --fixture evaluation/fixtures/topic-data-quality-fixture.json
```
