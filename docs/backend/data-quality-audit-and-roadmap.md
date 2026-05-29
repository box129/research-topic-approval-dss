# Backend/Data-Quality Audit and Roadmap

## Current backend/data model snapshot

- Implemented behavior: topic comparison records are split across three Prisma lifecycle models: `HistoricalTopic`, `CurrentSessionTopic`, and `UnderReviewTopic`.
- Implemented behavior: each lifecycle topic model stores `title`, optional `keywords`, `category`, optional context fields (`population`, `location`, `studyFocus`), `rawRecord`, `importWarnings`, source metadata, `importBatchId`, and nullable `embedding`.
- Implemented behavior: student proposals live in `Submission`, with required `title`, optional free-text `category` and `keywords`, status, decision reason, decision actor, and timestamp fields.
- Implemented behavior: lecturer-run similarity evidence is stored in `SimilarityCheckSnapshot` and is tied to a submission and checking lecturer.
- Implemented behavior: `.xlsx` import preview and commit endpoints parse worksheet rows, normalize records, preserve raw rows, produce reports, and persist accepted records by lifecycle bucket.
- Implemented behavior: the public similarity flow queries all historical topics, all current-session topics, and under-review topics from the last 48 hours, then runs Jaccard, TF-IDF, and SBERT when available.
- Implemented behavior: if SBERT is unavailable, similarity returns `partial_success` and uses lexical results rather than faking semantic scores.
- Implemented behavior: the lecturer submission similarity flow delegates to the public similarity controller using the stored submission title and keywords, then stores a snapshot of the similarity response.
- Implemented behavior: lecturer decisions update only submission status, decision reason, decision actor, and decision timestamp.

## Current data-quality risks

- Missing titles are skipped during `.xlsx` import normalization, but other required-looking departmental metadata can still be persisted as empty strings.
- Incomplete historical records can be accepted with warnings when `population`, `location`, or `study_focus` are missing.
- Category values are free text in imports and submissions, so inconsistent category names can fragment filtering, reporting, and future analytics.
- Duplicate import detection is currently case-insensitive and in-batch only; it does not detect duplicates already stored in the database.
- Paraphrased or synonym-heavy near-duplicates are not caught by import validation before persistence.
- Weak metadata such as missing population, location, or study focus limits future context-aware scoring and lecturer interpretation.
- Newly approved submissions are not automatically promoted into current-session topic records in the inspected flow.
- CSV seeding and `.xlsx` import are separate workflows and may apply different data-quality behavior.
- Synthetic/demo/evaluation data exists and should remain clearly marked by `sourceType`, `sourceFilename`, or `importBatchId` so it is not mistaken for departmental production data.
- Import endpoints are documented as not yet protected by admin authorization, which is a data-governance risk for future operational use.
- Production similarity currently compares title plus keywords and does not use `population`, `location`, or `studyFocus` context fields for scoring.
- Embeddings are nullable and imported records do not currently generate embeddings during import, so SBERT coverage depends on later embedding work.

## Required data-quality rules

- Required for import acceptance: a non-empty normalized title.
- Required before high-confidence operational use: a trusted lifecycle bucket, session year, source metadata, and enough provenance to trace the row back to the uploaded file or seed source.
- Optional but warning-worthy: keywords, category, population, location, study focus, supervisor name, approved date, reviewing lecturer, and student identifier.
- Reject records with missing or blank titles.
- Reject exact duplicate titles within the same import batch, as implemented today.
- Recommended future work: warn or block exact duplicate titles that already exist in the target lifecycle table before commit.
- Recommended future work: warn on near-duplicate or paraphrased titles during preview, but do not silently reject them until lecturer-reviewed thresholds are validated.
- Normalize whitespace, casing for comparisons, keyword arrays/strings, lifecycle bucket names, date fields, and source metadata.
- Normalize category names only through a reviewed mapping table or controlled vocabulary; never guess a category from title text.
- Never guess or fake population, location, study focus, supervisor, student identity, approval date, similarity score, embedding, or lifecycle status.
- Accept incomplete historical records only with explicit warnings and operator-visible import reporting.
- Keep synthetic, demo, fixture, and evaluation records labeled and separable from real departmental data.

## Recommended backend implementation roadmap

1. PR #76: `test/backend: add shared topic normalization and import data-quality fixtures`
   - Add pure normalization and validation helpers plus representative fixtures and tests.
   - Do not change import commit behavior, API contracts, Prisma schema, or similarity scoring yet.
2. PR #77: expand import preview validation reports
   - Add operator-facing warnings for missing session year, supervisor, category, context fields, invalid dates, and unsupported lifecycle values.
   - Keep commit behavior unchanged until preview output is reviewed.
3. PR #78: harden dry-run import reporting
   - Add a dry-run style report that separates accepted, warning, duplicate, rejected, and needs-review rows.
   - Include source row numbers where available.
4. PR #79: add duplicate/exact-match checks across stored records
   - Compare normalized titles against existing lifecycle tables during preview.
   - Report collisions without silently deleting or overwriting records.
5. PR #80: add historical topic metadata completeness checks
   - Report missing category, population, location, study focus, session year, and supervisor by batch/source.
   - Keep incomplete records honest instead of fabricating missing values.
6. PR #81: expand the evaluation harness
   - Add cases for incomplete imports, fragmented titles, paraphrases, category inconsistencies, and context mismatch.
   - Validate behavior against lecturer-reviewed expectations before changing production scoring.
7. PR #82: harden API access and import governance
   - Add admin protection to import endpoints in a scoped backend PR.
   - Review file-size, content-type, error, and rate-limit behavior.
8. PR #83: plan admin data-quality reporting
   - Design backend endpoints and frontend/admin surfaces for import quality, duplicate risk, metadata completeness, and source provenance.

## Guardrails

- Do not add fake similarity results.
- Do not add fake historical records.
- Do not auto-approve student submissions.
- Do not silently import bad records.
- Do not silently overwrite existing topic records.
- Do not infer missing metadata from title text without a reviewed rule and visible warning.
- Do not generate or store fake embeddings.
- Do not change similarity scoring, thresholds, ranking, or SBERT fallback behavior without a scoped evaluation-backed PR.
- Do not change current frontend/API contracts unless a future PR explicitly scopes and documents that change.
- Do not add a schema migration unless a later PR proves the migration is required and includes compatibility notes.
- Keep lecturer decisions lecturer-controlled and similarity advisory.
- Keep synthetic/evaluation/demo data boundaries explicit.

## Suggested PR #76

Recommended next PR:

```text
test/backend: add shared topic normalization and import data-quality fixtures
```

Suggested scope:

- Add a pure backend normalization/data-quality helper for title keys, keyword normalization, category comparison keys, lifecycle bucket normalization, context completeness, and duplicate comparison keys.
- Add fixture rows covering complete records, missing titles, incomplete context, inconsistent categories, exact duplicates, paraphrased near-duplicates, invalid dates, synthetic/demo rows, and unsupported lifecycle values.
- Add focused Jest tests for helper behavior only.
- Do not wire the helper into import commit behavior yet.
- Do not change Prisma schema, import endpoints, similarity scoring, or API contracts.

Rationale:

- This creates a safe, tested foundation before changing import behavior.
- It lets future PRs reuse one normalization policy instead of spreading ad hoc string logic across import, duplicate checks, evaluation, and admin reporting.
- It keeps the first backend/data-quality implementation PR low-risk and reversible.
