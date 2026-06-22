# Lecturer Review Benchmark Templates

This directory contains safe templates for collecting lecturer-reviewed topic-pair labels.

PR #108 prepares the framework only. Final lecturer-reviewed labels are still missing, departmental-scale data-quality validation is still unverified, no real student identifiers should be committed, and existing pilot metrics remain pilot-only.

## CSV Template

Use `lecturer-review-benchmark-template.csv` when preparing a review sheet for a lecturer. It is header-only by design:

- no real student names
- no matric numbers
- no email addresses
- no completed reviewer labels
- no fabricated departmental results

## Required Reviewer Fields

The reviewer should fill:

- `reviewer_label`: `LOW`, `MEDIUM`, `HIGH`, or `UNSURE`
- `reviewer_confidence`: `LOW`, `MEDIUM`, `HIGH`, or numeric `1` to `5`
- `reviewer_notes`: short rationale, especially for borderline or `UNSURE` pairs
- `review_date`: date of review
- `reviewer_code`: anonymous reviewer code such as `LREV-001`

## System Fields

System prediction fields should be generated from the current evaluation run or exported pairwise comparison. They are evidence for comparison only; lecturers should not be pressured to agree with them.

## Privacy Rule

Before sharing the template, remove direct identifiers. Do not commit completed review sheets unless they have been anonymized and approved for repository storage.

## JSON Validation

Final machine-readable review files should use the JSON structure documented in `../schemas/lecturer-reviewed-benchmark.schema.json` and can be checked with:

```powershell
npm run validate:lecturer-benchmark -- evaluation/fixtures/lecturer-reviewed-benchmark-unreviewed.fixture.json
```

The invalid fixture is intentionally invalid and should exit non-zero:

```powershell
npm run validate:lecturer-benchmark -- evaluation/fixtures/lecturer-reviewed-benchmark-invalid.fixture.json
```

Treat that failure as validator evidence, not as a broken release gate.
