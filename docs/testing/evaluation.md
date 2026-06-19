# Topic Similarity Evaluation Harness

This guide describes the reproducible PR #105 evaluation and data-quality evidence tooling.

The tooling is project evidence only. It does not change production scoring, thresholds, API responses, frontend behavior, Prisma schema, embeddings, import parsing, import persistence, or SBERT fallback behavior.

## Dataset

The pilot dataset lives at:

```text
backend/evaluation/datasets/pilot-topic-pairs.json
```

It contains 16 controlled topic pairs with:

- stable case ids
- topic A and topic B fields
- `expected_class`: `LOW`, `MEDIUM`, or `HIGH`
- rationale
- source classification
- scenario tags

Dataset provenance is explicitly marked as `manually_constructed_pilot`. These labels are useful for repeatable FYP evidence, but they are not final department or lecturer-reviewed ground truth.

Current class support:

- `LOW`: 4
- `MEDIUM`: 5
- `HIGH`: 7

## Run Topic Evaluation

From `backend/`:

```powershell
npm run evaluate:topics
```

The command writes:

```text
backend/evaluation/results/topic-similarity-evaluation.json
docs/testing/topic-similarity-evaluation-report.md
```

The report includes total/valid/skipped counts, class support, accuracy, macro/weighted precision/recall/F1, per-class metrics, confusion matrices, SBERT health, SBERT success/failure counts, full tri-algorithm coverage, partial-success counts, operational fallback-used counts, a counterfactual offline fallback-policy evaluation, and a scoring-contract comparison table.

## Production Scoring Contract

The evaluator mirrors the current observed production controller behavior from `backend/src/controllers/similarity.controller.js`:

- High threshold: `>= 0.70`
- Medium threshold: `>= 0.50`
- Low threshold: `< 0.50`
- Tier filter threshold: `0.60`
- Configured weights: Jaccard `0.30`, TF-IDF `0.30`, SBERT `0.40`
- Configured fallback weights: Jaccard `0.50`, TF-IDF `0.50`

Important implementation note:

The production controller currently defines algorithm weights, but `combineAlgorithmResults` ranks normal results with an unweighted `jaccard + tfidf + sbert` `combinedScore`. The final normal-success `overallRisk` is classified from the maximum SBERT score. When SBERT is unavailable, the partial-success fallback risk is classified from the maximum lexical score across Jaccard and TF-IDF.

The evaluation runner records this behavior honestly; it does not change it.

For regression safety, the current-production contract snapshot used by the evaluator is compared in tests with exported constants from the similarity controller. The approved FYP methodology remains a separate documented target and is not silently redefined around the current code.

The approved FYP scoring methodology differs from the current implementation in several places:

- approved weights are Jaccard `0.20`, TF-IDF `0.30`, SBERT `0.50`
- approved fallback weights are Jaccard `0.40`, TF-IDF `0.60`
- approved MEDIUM starts at `0.40`

The current implementation has drift from that approved methodology. PR #105 documents the drift and recommends a separate scoring-contract correction PR. It does not redefine the approved methodology around the current code.

## Current Generated Result

The latest generated report for PR #105 was generated in `sbert_available_full_tri_evaluation` mode with the local SBERT service healthy at `http://localhost:8000`:

- Total cases: 16
- Valid cases: 16
- SBERT attempted cases: 16
- SBERT success cases: 16
- SBERT failed cases: 0
- SBERT unavailable cases: 0
- Full tri-algorithm cases: 16
- Fallback-used cases: 0
- Full tri-algorithm coverage: `100%`
- Operational fallback coverage: `0%`
- Operational fallback metrics: `NOT_EVALUATED` because runtime fallback support is 0
- Offline fallback-policy evaluation: counterfactual pilot evaluation across all 16 valid cases without SBERT output
- Final production behavior accuracy: `0.313`
- Final production behavior macro F1: `0.224`
- Final production behavior weighted F1: `0.215`

These metrics use the current implementation behavior. They are not final effectiveness claims because the dataset is still a small manually constructed pilot.

## Data-Quality Audit

Run the read-only topic data-quality audit from `backend/`:

```powershell
npm run audit:data-quality
```

The command writes:

```text
backend/evaluation/results/topic-data-quality-audit.json
docs/testing/topic-data-quality-report.md
```

The audit inspects only safe fields from:

- `HistoricalTopic`
- `CurrentSessionTopic`
- `UnderReviewTopic`

It reports lifecycle totals, missing/blank field counts, embedding coverage, import warning counts, source/import-batch grouping, and normalized duplicate-title candidate groups. Duplicate title values are hashed in committed artifacts; raw topic titles are not written to the report.

If a safe local database is unavailable, run fixture mode:

```powershell
npm run audit:data-quality -- --fixture evaluation/fixtures/topic-data-quality-fixture.json
```

## Current Data-Quality Result

The latest generated data-quality report for PR #105 was generated in database mode:

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

This is a connected local database snapshot only. It does not represent the complete departmental repository, departmental-scale data quality remains NOT YET VERIFIED, and no broad data-quality conclusion should be drawn from nine inspected records.

## Limitations

- The dataset is a manually constructed pilot benchmark, not final lecturer-reviewed ground truth.
- Pairwise title evaluation is not identical to the full API tiered comparison workflow against all database topics.
- SBERT metrics require the local SBERT service health check to succeed and are reported separately from fallback metrics.
- Data-quality duplicate checks use normalized exact title matching only; semantic duplicate detection remains deferred.
- The data-quality audit is read-only and does not generate embeddings, import rows, recommendations, or similarity scores.
- The latest data-quality audit covers only nine local database records and is not departmental-scale evidence.

## Future Work

- Replace or supplement the pilot labels with lecturer-reviewed validation cases.
- Add a separate scoring-contract correction PR if the approved FYP methodology should become production behavior.
- Add richer duplicate-existing governance only after the import contract supports it.
- Keep any production scoring or threshold change in a separate evaluation-backed PR.
