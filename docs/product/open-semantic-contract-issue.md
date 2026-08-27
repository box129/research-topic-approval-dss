# Semantic Contract Issue — Submission Representation

**Status: CLOSED.** Resolved by
[`semantic-representation-contract-closure.md`](./semantic-representation-contract-closure.md).

## What was found

Student submissions (and lecturer similarity checks on them) were embedded from
the title alone, while a direct pre-check of the same topic embedded the full
`structured-context-v1` text: title plus supplied population, location and
study focus. The serializer was correct; the context was discarded before it
reached the serializer (`buildSubmissionTopicShape` hard-coded the three fields
to `null`, the lecturer check forwarded only the title, and the submission form
and model never carried the fields).

## Why it mattered

The frozen thresholds were calibrated on a benchmark whose query side carried
structured context in 120/120 cases (LF-normalised SHA-256 of
`expanded-semantic-benchmark.json` matches the calibration artifact at commit
`f925a95`). Title-only submission therefore compared on a representation the
thresholds were never derived from, and a diagnostic probe showed seven
classification changes and two ranking changes attributable solely to the
discarded context.

## Resolution

**Decision 2 — restore the structured submission representation.** This was an
implementation correction: submissions and revisions now persist and embed the
supplied context through the same serializer as a direct check, and the
lecturer check forwards it. No threshold, model, dimension, representation,
weight, ranking rule or evaluation artifact was changed.

The earlier working assumption recorded here — that the asymmetry was "not a
defect" because the fields are optional — was incorrect. Optional means a blank
value may be omitted, not that a supplied value may be dropped.
