# Final Effectiveness Evaluation Workflow

## Status

This workflow is prepared by PR #108. It does not complete the final lecturer-reviewed benchmark. Final effectiveness claims require real completed lecturer review data.

Boundary:

- PR #108 prepares the framework only.
- Final lecturer-reviewed labels are still missing.
- Departmental-scale data-quality validation is still unverified.
- No real student identifiers should be committed.
- Existing pilot metrics remain pilot-only and must not be presented as final effectiveness proof.

## Process

1. Export candidate topic pairs from the system, pilot dataset, or a safe departmental extract.
2. Remove direct identifiers such as names, matric numbers, emails, and phone numbers.
3. Populate `backend/evaluation/templates/lecturer-review-benchmark-template.csv` or the JSON schema format.
4. Give the review sheet to the lecturer or approved reviewer.
5. Lecturer assigns `LOW`, `MEDIUM`, `HIGH`, or `UNSURE` labels.
6. Lecturer records confidence and notes.
7. Convert completed review output into the JSON benchmark format.
8. Validate the review file:

   ```powershell
   cd backend
   npm run validate:lecturer-benchmark -- evaluation/fixtures/lecturer-reviewed-benchmark-unreviewed.fixture.json
   ```

9. Resolve `UNSURE` cases through documented discussion if final three-class metrics require it.
10. Convert the reviewed labels into an evaluation dataset.
11. Run topic evaluation:

    ```powershell
    cd backend
    npm run evaluate:topics
    ```

12. Compare system predictions against lecturer judgment.
13. Document disagreements and possible causes.
14. Include final results in Chapter 4 with limitations.

## Required Metrics

Report:

- accuracy
- macro F1
- weighted F1
- per-class precision/recall/F1
- confusion matrix
- coverage
- skipped cases
- failed cases

## Disagreement Handling

Do not hide disagreement between the system and lecturer labels. A disagreement may reflect:

- weak title/context data
- paraphrase not captured by lexical similarity
- over-sensitive semantic match
- departmental policy preference
- ambiguous review case

`UNSURE` rows should be reported separately unless resolved by a documented panel decision.

## Current Boundary

The current repository contains pilot labels only. PR #108 prepares the protocol, schema, templates, validator, and documentation needed to collect final labels later.
