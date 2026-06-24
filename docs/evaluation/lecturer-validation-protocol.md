# Lecturer Validation Protocol

## Purpose

This protocol explains how to collect lecturer-reviewed similarity labels for the Research Topic Approval DSS. It is designed to support a future validation exercise without exposing sensitive student data.

This document does not claim validation has been completed.

## PR #117 Boundary

- The evidence pack is prepared.
- Real lecturer-reviewed labels are still missing.
- Departmental-scale validation is still unverified.
- Sample CSV rows are synthetic examples only.
- No algorithm, threshold, route, Prisma schema, backend behavior, or UI behavior is changed.

## Review Question

For each topic pair, the reviewer answers:

> How similar are these two research topic proposals for the purpose of topic approval?

The reviewer should judge research meaning, not only exact wording.

## Required Inputs

Each review row should include:

- anonymous `pair_id`
- `query_topic`
- `candidate_topic`
- optional safe context such as `query_category`, `candidate_category`, `query_keywords`, and `candidate_keywords`
- optional system output fields, if the study design permits reviewer blinding to be skipped

Direct student identifiers must be removed before lecturer review.

## Label Definitions

Use only these labels for primary judgment:

| Label | Definition | Approval interpretation |
| --- | --- | --- |
| `LOW` | The topics are meaningfully different. Shared broad domain words alone do not make them similar. | Similarity does not appear to block approval. |
| `MEDIUM` | The topics share an important concept, disease area, intervention, population, setting, or phrasing, but still differ in at least one meaningful academic axis. | Lecturer discussion, revision, or closer inspection may be needed. |
| `HIGH` | The topics are duplicates, near duplicates, or substantially the same research question in different wording. | Topic should usually be rejected, revised, or escalated on similarity grounds. |
| `UNSURE` | The reviewer cannot confidently assign LOW/MEDIUM/HIGH because context is missing or the pair is borderline. | Resolve through panel discussion before final metric computation. |

`UNSURE` is allowed during collection. Do not force unsure rows into LOW/MEDIUM/HIGH without documented resolution.

## Review Guidance

Consider:

- research question meaning
- population or study group
- location or setting
- intervention, exposure, or outcome
- disease or public health domain
- keywords and context
- paraphrases, synonyms, or reordered wording
- whether one topic is a narrower version of the other

Do not over-weight:

- punctuation
- capitalization
- harmless word order differences
- singular/plural differences
- spreadsheet formatting artifacts
- generic terms such as `knowledge`, `practice`, `awareness`, or `students` by themselves

## Suggested Review Workflow

1. Prepare candidate pairs from a safe export or pilot dataset.
2. Remove direct identifiers and raw confidential metadata.
3. Assign anonymous pair ids, for example `LV-0001`.
4. Populate `lecturer-labelling-template.csv`.
5. Give the sheet to one or more lecturers or approved academic reviewers.
6. Reviewers assign `LOW`, `MEDIUM`, `HIGH`, or `UNSURE`.
7. Reviewers add brief notes explaining difficult cases.
8. Preserve original reviewer labels.
9. Resolve `UNSURE` or disagreement rows through documented discussion.
10. Record final resolved labels in `lecturer-validation-results-template.csv`.
11. Convert the completed review into the backend benchmark schema if final metric computation is required.

## Reviewer Blinding

Preferred: hide system predicted labels and scores during first-pass lecturer review to reduce anchoring bias.

If system predictions are included for workflow reasons, record that reviewer blinding was not used and treat it as a limitation.

## Multiple Reviewers

If more than one lecturer reviews the same pair:

- use anonymous reviewer codes, such as `LREV-001`
- preserve individual labels
- record agreement or disagreement
- document any final resolved label separately

Do not overwrite a dissenting label silently.

## Privacy Rules

Do not include:

- student names
- matric numbers
- email addresses
- phone numbers
- raw submissions with identifying notes
- supervisor comments that identify a student
- department files not approved for validation storage

Use sanitized titles and anonymous ids. Store completed review files outside Git unless formally approved.

## Final Evidence Requirements

A completed lecturer validation evidence package should include:

- number of reviewed pairs
- reviewer role or panel description, without personal sensitive data
- label distribution
- unresolved `UNSURE` count
- disagreement count, if multiple reviewers are used
- final resolved labels
- metrics comparing system predictions with lecturer labels
- limitations and examples of disagreement

Until those items exist, the repository has a prepared validation pack only.
