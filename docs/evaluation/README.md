# Lecturer Validation Evidence Pack

## Status

This pack is prepared by PR #117. It does not contain completed lecturer-reviewed validation results and must not be cited as final system effectiveness evidence.

Stable-release blockers still open:

- final lecturer-reviewed LOW/MEDIUM/HIGH labels
- departmental-scale validation over approved safe topic data
- recorded reviewer sign-off or panel resolution for ambiguous cases

## Files

| File | Purpose |
| --- | --- |
| `lecturer-validation-protocol.md` | Step-by-step protocol for collecting lecturer judgments safely. |
| `lecturer-labelling-template.csv` | Synthetic topic-pair labelling sheet for lecturer review. |
| `lecturer-validation-results-template.csv` | Results-recording structure for future completed validation. |

Related framework files from PR #108:

- `docs/validation/lecturer-review-protocol.md`
- `docs/validation/final-effectiveness-evaluation-workflow.md`
- `backend/evaluation/templates/lecturer-review-benchmark-template.csv`
- `backend/evaluation/schemas/lecturer-reviewed-benchmark.schema.json`
- `backend/scripts/validate-lecturer-benchmark.js`

## Privacy Boundary

Do not commit:

- student names
- matric numbers
- email addresses
- phone numbers
- raw departmental files
- supervisor comments that identify a student
- any topic-pair file that was not approved for repository storage

Use anonymous row ids and reviewer codes. Store completed review files outside Git unless they have been explicitly anonymized and approved for inclusion.

## Evidence Boundary

The CSV rows in this pack are sample-only. They are not lecturer-reviewed labels, not departmental data, and not final benchmark evidence.

Final validation evidence should be recorded only after a lecturer or approved panel completes the review process.
