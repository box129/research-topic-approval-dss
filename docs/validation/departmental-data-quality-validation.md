# Departmental Data-Quality Validation Workflow

## Purpose

This workflow defines how to validate real Public Health departmental topic records at scale without committing raw confidential data.

PR #108 prepares the workflow. It does not claim departmental-scale validation has already happened.

## PR #108 Boundary

- PR #108 prepares the framework only.
- Final lecturer-reviewed labels are still missing.
- Departmental-scale data-quality validation is still unverified.
- No real student identifiers should be committed.
- Existing pilot metrics remain pilot-only and must not be presented as departmental proof.

## Accepted Source Formats

Departmental records may arrive as:

- Excel `.xlsx`
- CSV `.csv`

Use the admin import preview workflow or offline fixture checks before committing records.

## Minimum Field

The minimum required field is:

- title

Records without titles should be rejected or excluded from similarity evidence.

## Recommended Fields

Recommended fields:

- category
- session/year
- supervisor
- population
- location
- study focus
- keywords
- lifecycle bucket

## Quality Checks

Check for:

- blank titles
- duplicate or near-duplicate titles
- missing year/session
- missing supervisor
- missing population/location/study focus
- missing or inconsistent keywords
- inconsistent category values
- malformed dates
- lifecycle mismatch
- topic count by year/session
- embedding coverage
- import warnings

## Privacy Rules

- Do not commit raw departmental files.
- Do not commit student names, matric numbers, emails, or other identifiers.
- Store only safe summaries and anonymized aggregate evidence.
- Hash duplicate-title candidates if detailed references are needed.
- Keep raw review sheets and departmental extracts outside the repository unless formally approved.

## Proposed Acceptance Thresholds

These thresholds are proposed, not department-approved:

| Check | Proposed threshold |
| --- | --- |
| Blank titles | 0 accepted records |
| Duplicate exact normalized titles | Review all candidate groups |
| Missing session/year | Less than 5% or documented reason |
| Missing supervisor | Less than 5% or documented reason |
| Missing context fields | Less than 20% before claiming context-aware quality |
| Malformed dates | 0 accepted records where dates are required |
| Lifecycle mismatch | Review all mismatches |

Do not present these thresholds as official departmental policy until approved.

## Existing Tools

Import preview:

```powershell
POST /api/v1/admin/import/topics/preview
```

Import commit:

```powershell
POST /api/v1/admin/import/topics/commit
```

Data-quality audit:

```powershell
cd backend
npm run audit:data-quality
```

Safe fixture mode:

```powershell
cd backend
npm run audit:data-quality -- --fixture evaluation/fixtures/topic-data-quality-fixture.json
```

## Final Evidence Output

Final departmental-scale evidence should include:

- total records inspected
- counts by lifecycle
- counts by session/year
- missing-field counts
- duplicate candidate group counts
- import warning counts
- embedding coverage
- limitations and unresolved issues

It should not include raw titles or private student records unless explicitly approved and anonymized.
