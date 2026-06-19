# FYP Evaluation Benchmark Evidence

Generated for PR #105 from evaluation tooling and safe local database audit output.

## Evidence Sources

- Dataset: `backend/evaluation/datasets/pilot-topic-pairs.json`
- Evaluation runner: `backend/scripts/run-topic-evaluation.js`
- Evaluation JSON: `backend/evaluation/results/topic-similarity-evaluation.json`
- Evaluation report: `docs/testing/topic-similarity-evaluation-report.md`
- Data-quality runner: `backend/scripts/run-topic-data-quality-audit.js`
- Data-quality JSON: `backend/evaluation/results/topic-data-quality-audit.json`
- Data-quality report: `docs/testing/topic-data-quality-report.md`

## Production Scoring Snapshot

Current production thresholds and behavior are mirrored from `backend/src/controllers/similarity.controller.js`:

- `HIGH`: `>= 0.70`
- `MEDIUM`: `>= 0.50`
- `LOW`: `< 0.50`
- Tier filter threshold: `0.60`
- Configured normal weights: Jaccard `0.30`, TF-IDF `0.30`, SBERT `0.40`
- Configured fallback weights: Jaccard `0.50`, TF-IDF `0.50`

The controller currently ranks normal results with an unweighted `jaccard + tfidf + sbert` combined score, classifies normal overall risk from max SBERT score, and classifies fallback overall risk from the max lexical score. PR #105 does not change any of that behavior.

The evaluator mirrors the current-production contract through exported controller constants where available, with a regression test guarding the snapshot. The approved FYP methodology is still documented separately and remains drifted from current production behavior.

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
- Offline fallback-policy evaluation: counterfactual pilot evaluation across all 16 valid cases, using current production fallback logic without SBERT output
- Final production behavior accuracy: `0.313`
- Final production behavior macro F1: `0.224`
- Final production behavior weighted F1: `0.215`

These metrics measure the current implementation behavior. They do not validate the approved FYP weighted methodology because the implementation currently drifts from that contract.

## Scoring-Contract Reconciliation

| Item | Approved FYP Specification | Current Implementation / Evaluation Behavior | Status |
| --- | --- | --- | --- |
| Jaccard weight | `0.20` | `0.30` configured; current combined score is unweighted | DRIFT |
| TF-IDF weight | `0.30` | `0.30` configured; current combined score is unweighted | MATCH for configured value, DRIFT for weighted formula use |
| SBERT weight | `0.50` | `0.40` configured; current combined score is unweighted | DRIFT |
| Fallback weights | Jaccard `0.40`, TF-IDF `0.60` | `0.50 / 0.50` configured; final fallback risk uses max lexical | DRIFT |
| LOW/MEDIUM boundary | MEDIUM starts at `0.40` | MEDIUM starts at `0.50` | DRIFT |
| HIGH boundary | HIGH starts at `0.70` | HIGH starts at `0.70` | MATCH |
| Tier minimum | `0.10` | No separate `0.10` tier minimum verified | NOT VERIFIED |
| Tier 2/3 requirement | combined `>= 0.60` and SBERT `>= 0.60` | implemented for SBERT-available mode | MATCH |
| Overall risk | approved weighted methodology implied | current production uses max SBERT or max lexical fallback | DRIFT |

A separate scoring-contract correction PR is required if the approved FYP methodology should become production behavior.

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
| Production tri-algorithm combined behavior measured | PARTIALLY REACHED | Full tri-algorithm coverage is 100%, but implementation drifts from approved FYP weights | Requires separate scoring-contract correction before claiming approved weighted methodology. |
| LOW/MEDIUM/HIGH class metrics | REACHED | Macro/weighted/per-class metrics and confusion matrices generated | Dataset remains pilot/manual. |
| Dataset provenance documented | REACHED | `schema_version`, `provenance`, source classifications, tags | Marked as manually constructed pilot, not expert ground truth. |
| Final lecturer-reviewed benchmark | NOT REACHED | No expert validation source in repo | Needs department/lecturer-reviewed cases. |
| Topic data-quality audit | REACHED | `topic-data-quality-audit.json` database mode | Read-only safe-field audit generated. |
| Embedding coverage for topic repository | PARTIALLY REACHED | Local audit reports 0 with embeddings, 9 without embeddings | Local snapshot only; departmental-scale coverage remains not yet verified. |
| Semantic duplicate governance | DEFERRED | Audit exact-title duplicate candidates only | Richer duplicate-existing checks remain outside PR #105. |
| Production scoring or threshold update | DEFERRED | PR #105 explicitly does not change scoring | Future scoring changes need separate approval and evaluation. |

## Limitations

- The evaluation dataset is manually constructed and small.
- The latest metrics should not be presented as final departmental accuracy.
- SBERT was available for the latest run, but semantic performance is verified only for the small pilot dataset.
- Current production scoring drifts from the approved FYP weighted methodology.
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
