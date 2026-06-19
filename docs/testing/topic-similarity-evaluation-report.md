# Topic Similarity Evaluation Report

Generated: 2026-06-19T13:31:45.643Z

Commit: `29d4015`

Dataset: `backend/evaluation/datasets/pilot-topic-pairs.json` (pilot-v1)

Mode: sbert_available_full_tri_evaluation

## Dataset Governance

- Source classification: manually_constructed_pilot
- Validation status: not_department_expert_validated
- Total cases: 16
- Valid cases: 16
- Skipped cases: 0

Class support:

- LOW: 4
- MEDIUM: 5
- HIGH: 7

## SBERT Operational Verification

- Service URL: http://localhost:8000
- Health available: true
- Health response status: healthy
- Health response model: all-MiniLM-L6-v2
- SBERT attempted cases: 16
- SBERT success cases: 16
- SBERT failed cases: 0
- SBERT unavailable cases: 0
- SBERT skipped cases: 0
- Full tri-algorithm cases: 16
- Operational fallback-used cases: 0
- Partial-success cases: 0
- Full tri-algorithm coverage: 100%
- Operational fallback coverage: 0%

SBERT failures:

- None

## Scoring Contract Comparison

| Item | Approved FYP Specification | Current Implementation Behavior | Evaluation Runner Behavior | Status | Source |
| --- | --- | --- | --- | --- | --- |
| Jaccard weight | 0.20 | 0.30 configured; not used in current combinedScore calculation | mirrors current implementation, not approved weighted formula | DRIFT | `backend/src/controllers/similarity.controller.js:15-20,569` |
| TF-IDF weight | 0.30 | 0.30 configured; not used in current combinedScore calculation | mirrors current implementation | MATCH | `backend/src/controllers/similarity.controller.js:15-20,569` |
| SBERT weight | 0.50 | 0.40 configured; not used in current combinedScore calculation | mirrors current implementation, not approved weighted formula | DRIFT | `backend/src/controllers/similarity.controller.js:15-20,569` |
| Fallback Jaccard weight | 0.40 | 0.50 configured; fallback final risk uses max lexical score | fallback cases use max lexical score | DRIFT | `backend/src/controllers/similarity.controller.js:15-22,483-492,571` |
| Fallback TF-IDF weight | 0.60 | 0.50 configured; fallback final risk uses max lexical score | fallback cases use max lexical score | DRIFT | `backend/src/controllers/similarity.controller.js:15-22,483-492,571` |
| LOW/MEDIUM boundary | LOW below 0.40; MEDIUM starts at 0.40 | LOW below 0.50; MEDIUM starts at 0.50 | uses current implementation boundary for production-behavior evidence | DRIFT | `backend/src/controllers/similarity.controller.js:9-13,112-120` |
| HIGH boundary | HIGH starts at 0.70 | HIGH starts at 0.70 | uses 0.70 | MATCH | `backend/src/controllers/similarity.controller.js:9-13,112-120` |
| Tier minimum | 0.10 | No separate 0.10 tier minimum verified; Tier 2/3 filter is 0.60 | not evaluated by pairwise runner | NOT VERIFIED | `backend/src/controllers/similarity.controller.js:25,628-633` |
| Tier 2/3 SBERT requirement | combined >= 0.60 and SBERT >= 0.60 | combined >= 0.60 and SBERT >= 0.60 when SBERT is available | not evaluated by pairwise runner | MATCH | `backend/src/controllers/similarity.controller.js:628-633` |
| Overall production risk | weighted tri-algorithm score implied by approved methodology | normal mode uses max SBERT; fallback mode uses max lexical | final_production_behavior mirrors max SBERT / max lexical behavior | DRIFT | `backend/src/controllers/similarity.controller.js:460-492` |

Drift status: DRIFT

Recommendation: Create a separate scoring-contract correction PR before changing production weights, thresholds, tier minima, or overall-risk behavior.

## Current Implementation Contract Used For This Evidence

- High threshold: 0.7
- Medium threshold: 0.5
- Tier filter threshold: 0.6
- Configured weights: Jaccard 0.3, TF-IDF 0.3, SBERT 0.4
- Fallback weights configured: Jaccard 0.5, TF-IDF 0.5

Observed controller behavior mirrored by this report:

- The production controller defines algorithm weights, but combineAlgorithmResults currently ranks normal results with an unweighted jaccard + tfidf + sbert combinedScore.
- When SBERT succeeds, the production response overallRisk is classified from the maximum SBERT score.
- When SBERT is unavailable, the production partial_success response overallRisk is classified from the maximum lexical score across Jaccard and TF-IDF.
- This evaluation mirrors the current implementation behavior and does not modify production scoring, thresholds, SBERT fallback, imports, API responses, or frontend behavior.

## Results Summary

| Method | Evaluated / Total | Coverage | Accuracy | Macro F1 | Weighted F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `jaccard_only` | 16 / 16 | 1 | 0.438 | 0.435 | 0.429 |
| `tfidf_only` | 16 / 16 | 1 | 0.375 | 0.333 | 0.313 |
| `sbert_only` | 16 / 16 | 1 | 0.313 | 0.224 | 0.215 |
| `full_tri_algorithm_cases` | 16 / 16 | 1 | 0.375 | 0.286 | 0.313 |
| `fallback_combination_cases` | 0 / 16 | 0 | NOT_EVALUATED | NOT_EVALUATED | NOT_EVALUATED |
| `offlineFallbackPolicyEvaluation` | 16 / 16 | 1 | 0.438 | 0.435 | 0.429 |
| `final_production_behavior` | 16 / 16 | 1 | 0.313 | 0.224 | 0.215 |

## Fallback Evidence Boundary

Operational fallback was triggered in 0 of 16 valid cases.

- Operational fallback metrics status: NOT_EVALUATED
- Operational fallback support: 0
- Operational fallback accuracy/F1: NOT_EVALUATED / NOT_EVALUATED
- Offline fallback-policy evaluation status: COUNTERFACTUAL_EVALUATED
- Offline fallback-policy coverage: 100%

The offline fallback-policy evaluation applies the current production fallback policy to all valid pilot cases without SBERT output. It is counterfactual evidence only; it is not evidence that runtime fallback was triggered.

Final production behavior across all cases:

- Accuracy: 0.313
- Macro precision/recall/F1: 0.422 / 0.381 / 0.224
- Weighted precision/recall/F1: 0.504 / 0.313 / 0.215
- Coverage rate: 1

## Limitations

- The dataset is a manually constructed pilot benchmark and is not final department or lecturer-reviewed ground truth.
- The dataset is insufficient for final effectiveness claims.
- Pairwise title evaluation is not identical to the full API tiered comparison workflow against all database topics.
- SBERT metrics only use cases where the local SBERT service returned a valid numeric embedding-derived score.
- Operational fallback metrics remain separate and are marked NOT_EVALUATED when no runtime fallback cases occur.
- Offline fallback-policy metrics are counterfactual and must not be described as observed runtime fallback.
- No production similarity scoring, thresholds, imports, database schema, API response shape, or frontend behavior is changed by this evaluation.

## Reproduction

```powershell
cd backend
npm run evaluate:topics
```

JSON artifact: `backend/evaluation/results/topic-similarity-evaluation.json`
