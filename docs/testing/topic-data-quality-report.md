# Topic Data Quality Report

Generated: 2026-06-19T13:31:44.799Z

Commit: `29d4015`

Mode: database

Fixture path: not used

## Safety

- Read-only: true
- Mutates database: false
- Raw titles included: false
- Duplicate title values hashed: true

## Totals

- Total topic records inspected: 9
- Blank titles: 0
- Missing categories: 0
- Missing session years: 0
- Missing supervisors: 0
- Missing keywords: 0
- Incomplete context records: 0
- With embeddings: 0
- Without embeddings: 9
- With import warnings: 0

Scope note:

- This is a database snapshot of the connected local database or fixture input.
- It does not represent the complete departmental repository.
- Departmental-scale data quality remains NOT YET VERIFIED.
- No broad data-quality conclusion should be drawn from 9 inspected records.

## By Lifecycle

| Lifecycle | Total | Blank Title | Missing Category | Missing Session | Missing Supervisor | Incomplete Context | With Embeddings | Without Embeddings | Import Warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| historical | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 |
| currentSession | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| underReview | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |

## Grouped Counts

Source type:

- demo: 9

Import batch:

- demo-comparison-topics-v1: 9

## Duplicate Title Candidates

- Candidate groups: 0
- Within-lifecycle groups: 0
- Across-lifecycle groups: 0

Candidate details are stored with hashed normalized titles and lifecycle/id references only in the JSON artifact.

## Limitations

- Duplicate candidates are based on normalized exact title matches only.
- No raw titles are written to the committed audit report.
- The audit does not recalculate embeddings or similarity scores.
- Missing-field counts reflect current stored fields only; they do not infer meaning from raw import rows.

## Reproduction

```powershell
cd backend
npm run audit:data-quality
```

If a safe local database is unavailable:

```powershell
cd backend
npm run audit:data-quality -- --fixture evaluation/fixtures/topic-data-quality-fixture.json
```

JSON artifact: `backend/evaluation/results/topic-data-quality-audit.json`
