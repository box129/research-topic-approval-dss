# Lecturer Review Protocol for Topic Similarity Validation

## Purpose

This protocol prepares the final lecturer-reviewed benchmark for the Topic Similarity MVP. It explains how a qualified lecturer should judge whether two research topic proposals are meaningfully similar.

This document does not claim that lecturer review has been completed. It defines the method to collect review evidence safely and reproducibly.

## PR #108 Boundary

- PR #108 prepares the framework only.
- Final lecturer-reviewed labels are still missing.
- Departmental-scale data-quality validation is still unverified.
- No real student identifiers should be committed.
- Existing pilot metrics remain pilot-only and must not be presented as final effectiveness proof.

## Reviewer Profile

The reviewer should be a lecturer, supervisor, panel member, or department-approved academic reviewer familiar with Public Health undergraduate research topic approval.

If more than one lecturer reviews the same pair, disagreements should be preserved and resolved through discussion rather than overwritten silently.

## Review Unit

Each review unit is one pair of topics:

- query topic: the submitted or proposed topic
- candidate topic: an existing, current-session, or under-review topic

The lecturer judges the pair, not the full system ranking screen.

## Labels

Use these labels:

| Label | Meaning |
| --- | --- |
| `LOW` | The topics are meaningfully different. Approval may proceed on similarity grounds, subject to normal academic review. |
| `MEDIUM` | The topics share important concepts, population, setting, intervention, or wording. Lecturer discussion or revision may be needed. |
| `HIGH` | The topics are duplicate, near-duplicate, or substantially the same research idea. |
| `UNSURE` | The reviewer cannot confidently assign LOW/MEDIUM/HIGH without more context or panel discussion. |

`UNSURE` rows should not be forced into LOW/MEDIUM/HIGH during data entry. They should be documented and resolved later if final metric computation requires a three-class benchmark.

## What To Consider

Reviewers should consider:

- title meaning, not only exact words
- population or study group
- location or setting
- study focus or outcome
- keywords
- public health domain/context
- synonym and paraphrase similarity
- whether one topic is merely a rewording of another
- whether the same question is being asked in a different way

## What To Ignore

Reviewers should not over-weight:

- punctuation differences
- word order changes alone
- singular/plural differences
- spelling variation where meaning is unchanged
- harmless formatting differences from import files

## Decision Rubric

### LOW

Use `LOW` when the topic pair has different research meaning. Shared broad domain terms are not enough if the population, focus, or research question is different.

Example, synthetic:

- Query: `Use of telemedicine services among rural patients`
- Candidate: `Waste disposal practices among food vendors in urban markets`

Suggested label: `LOW`.

### MEDIUM

Use `MEDIUM` when the pair shares an important concept but differs in a meaningful axis such as population, location, focus, or intervention.

Example, synthetic:

- Query: `Awareness of hypertension screening among market traders in Osogbo`
- Candidate: `Awareness of hypertension screening among secondary school teachers in Osogbo`

Suggested label: `MEDIUM` because disease and focus match, but population differs.

### HIGH

Use `HIGH` when the pair is effectively the same research question or a close paraphrase.

Example, synthetic:

- Query: `Factors affecting exclusive breastfeeding among nursing mothers in Ede`
- Candidate: `Influencing factors of exclusive breastfeeding practice among nursing mothers in Ede`

Suggested label: `HIGH`.

### UNSURE

Use `UNSURE` when the title/context is incomplete, the pair is borderline, or a departmental policy decision is required.

Reviewer notes should explain what information is missing.

## Ambiguous Cases

For ambiguous pairs:

1. Assign `UNSURE`.
2. Add reviewer notes explaining the uncertainty.
3. If a panel is available, discuss and record the final agreed label separately.
4. Preserve the original reviewer label and notes if possible.

## Reviewer Notes

Notes should be short and academic. Good notes mention the deciding factor:

- same population and same focus
- same disease but different population
- same wording but different object of study
- incomplete title/context
- paraphrase or synonym match

## Ethics and Privacy

Benchmark files must not include:

- student names
- matric numbers
- email addresses
- phone numbers
- raw confidential departmental files
- identifiable student/project metadata not approved for research storage

Use anonymous reviewer codes such as `LREV-001`.

## Use In Chapter 4 / Evaluation

Completed lecturer labels will be compared against system predictions using:

- accuracy
- macro F1
- weighted F1
- per-class precision/recall/F1
- confusion matrix
- coverage, skipped, and failed cases

Until completed review data exists, the current evidence remains a pilot evaluation with manually constructed labels.
