# Topic Similarity Evaluation Report

Generated: 2026-06-19T15:57:07.581Z

Commit: `e756c2e`

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
| Jaccard weight | 0.20 | 0.20 used in approved weighted combined score | uses shared production scoring contract | MATCH | `backend/src/config/similarityScoring.config.js` |
| TF-IDF weight | 0.30 | 0.30 used in approved weighted combined score | uses shared production scoring contract | MATCH | `backend/src/config/similarityScoring.config.js` |
| SBERT weight | 0.50 | 0.50 used in approved weighted combined score | uses shared production scoring contract | MATCH | `backend/src/config/similarityScoring.config.js` |
| Fallback Jaccard weight | 0.40 | 0.40 used in approved lexical fallback combined score | uses shared production scoring contract | MATCH | `backend/src/config/similarityScoring.config.js` |
| Fallback TF-IDF weight | 0.60 | 0.60 used in approved lexical fallback combined score | uses shared production scoring contract | MATCH | `backend/src/config/similarityScoring.config.js` |
| LOW/MEDIUM boundary | LOW below 0.40; MEDIUM starts at 0.40 | LOW below 0.40; MEDIUM starts at 0.40 | uses shared production scoring contract | MATCH | `backend/src/config/similarityScoring.config.js` |
| HIGH boundary | HIGH starts at 0.70 | HIGH starts at 0.70 | uses 0.70 | MATCH | `backend/src/config/similarityScoring.config.js` |
| Tier minimum | 0.10 | Tier candidates require combined score >= 0.10 | pairwise runner records the shared contract; controller tests verify tier filtering | MATCH | `backend/src/config/similarityScoring.config.js, backend/src/controllers/similarity.controller.js` |
| Tier 2/3 SBERT requirement | combined >= 0.60 and SBERT >= 0.60 | combined >= 0.60 and SBERT >= 0.60 when SBERT is available | pairwise runner records the shared contract; controller tests verify tier filtering | MATCH | `backend/src/config/similarityScoring.config.js, backend/src/controllers/similarity.controller.js` |
| Overall production risk | highest eligible weighted combined score in normal mode; highest eligible fallback combined score in fallback mode | normal and fallback modes classify risk from the highest returned eligible combined score | final_production_behavior mirrors the corrected production scoring contract | MATCH | `backend/src/controllers/similarity.controller.js, backend/src/config/similarityScoring.config.js` |

Drift status: MATCH

Recommendation: PR #106 corrected production scoring to match the approved FYP methodology. Lecturer-reviewed effectiveness validation remains future work.

## Current Implementation Contract Used For This Evidence

- High threshold: 0.7
- Medium threshold: 0.4
- General tier minimum: 0.1
- Tier 2/3 combined threshold: 0.6
- Tier 2/3 SBERT threshold: 0.6
- Configured weights: Jaccard 0.2, TF-IDF 0.3, SBERT 0.5
- Fallback weights configured: Jaccard 0.4, TF-IDF 0.6

Observed controller behavior mirrored by this report:

- PR #105 measured the previous implementation and identified scoring drift.
- PR #106 corrects production scoring to use the approved weighted combined score, fallback weighted score, 0.40/0.70 risk boundaries, and tier gates.
- This evaluation mirrors the corrected production scoring contract without changing dataset labels.

## Results Summary

| Method | Evaluated / Total | Coverage | Accuracy | Macro F1 | Weighted F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `jaccard_only` | 16 / 16 | 1 | 0.563 | 0.556 | 0.533 |
| `tfidf_only` | 16 / 16 | 1 | 0.5 | 0.472 | 0.443 |
| `sbert_only` | 16 / 16 | 1 | 0.25 | 0.246 | 0.246 |
| `full_tri_algorithm_cases` | 16 / 16 | 1 | 0.375 | 0.365 | 0.348 |
| `fallback_combination_cases` | 0 / 16 | 0 | NOT_EVALUATED | NOT_EVALUATED | NOT_EVALUATED |
| `offlineFallbackPolicyEvaluation` | 16 / 16 | 1 | 0.5 | 0.472 | 0.443 |
| `final_production_behavior` | 16 / 16 | 1 | 0.375 | 0.365 | 0.348 |

## Fallback Evidence Boundary

Operational fallback was triggered in 0 of 16 valid cases.

- Operational fallback metrics status: NOT_EVALUATED
- Operational fallback support: 0
- Operational fallback accuracy/F1: NOT_EVALUATED / NOT_EVALUATED
- Offline fallback-policy evaluation status: COUNTERFACTUAL_EVALUATED
- Offline fallback-policy coverage: 100%

The offline fallback-policy evaluation applies the current production fallback policy to all valid pilot cases without SBERT output. It is counterfactual evidence only; it is not evidence that runtime fallback was triggered.

Final production behavior across all cases:

- Accuracy: 0.375
- Macro precision/recall/F1: 0.591 / 0.431 / 0.365
- Weighted precision/recall/F1: 0.662 / 0.375 / 0.348
- Coverage rate: 1

## Limitations

- The dataset is a manually constructed pilot benchmark and is not final department or lecturer-reviewed ground truth.
- The dataset is insufficient for final effectiveness claims.
- Pairwise title evaluation is not identical to the full API tiered comparison workflow against all database topics.
- SBERT metrics only use cases where the local SBERT service returned a valid numeric embedding-derived score.
- Operational fallback metrics remain separate and are marked NOT_EVALUATED when no runtime fallback cases occur.
- Offline fallback-policy metrics are counterfactual and must not be described as observed runtime fallback.
- PR #106 changes production similarity scoring and thresholds to the approved contract; imports, database schema, API response shape, frontend behavior, and dataset labels are unchanged.

## Reproduction

```powershell
cd backend
npm run evaluate:topics
```

JSON artifact: `backend/evaluation/results/topic-similarity-evaluation.json`
