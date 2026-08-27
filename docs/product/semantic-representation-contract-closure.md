# Submission Representation Contract Closure

**Status: CLOSED — implementation corrected to the frozen contract.**
**Decision: RESTORE STRUCTURED SUBMISSION REPRESENTATION (Decision 2).**

Closes the item recorded in `open-semantic-contract-issue.md`. No threshold,
model, dimension, representation identifier, weight, ranking rule or evaluation
artifact was changed. This was an implementation correction, not a methodology
change.

## 1. Executive finding

**The title-only submission path was not compliant with the frozen contract.**

The frozen `structured-context-v1` contract embeds a submitted topic from its
title plus any supplied population, location and study focus, omitting only
blank values. The thresholds `T1 = 0.5571529891797358` and
`T2 = 0.6450102471881145` were calibrated on a benchmark whose query side
carried that context in every case. Production was embedding actual student
submissions — and lecturer similarity checks on those submissions — from the
title alone, while the student's own pre-check embedded the full structured
context. Two workflow paths therefore produced different evidence for the same
topic, and neither the submission nor the lecturer path was comparing on the
representation the thresholds were derived from.

"Optional" in the contract means a blank value may be omitted. It was being
read as "supplied values may be discarded." That reading was wrong.

## 2. Where the representation was lost

The serializer itself was correct throughout. `serialize()` in
`backend/src/services/topicSemanticRepresentation.service.js` emits exactly
`Title:`, then `Population:`, `Location:`, `Study focus:` for non-blank values,
newline-joined, deterministic, keywords and category ignored. Both `embedQuery`
and `embedDocument` call it. The loss was upstream of it, in three places:

| Location | Behaviour before | Kind |
| --- | --- | --- |
| `topicCorpusLifecycle.service.js` `buildSubmissionTopicShape` | hard-coded `population: null, location: null, studyFocus: null` | implementation omission |
| `lecturerSimilarity.controller.js` | delegated `{ topic: title, keywords }` only to the query path | implementation omission |
| `prisma/schema.prisma` `Submission` + `SubmitTopicPage.jsx` | no columns and no inputs for the three fields | the fields were never collected on submission, so there was nothing to persist |

`buildSubmissionTopicShape` was introduced in a single commit (`ee0de0a`,
"make imports and the submission lifecycle populate the semantic corpus
correctly"). That commit's message is entirely about corpus population,
idempotent imports and lifecycle promotion; it says nothing about representation
and cites no calibration evidence for a title-only submission. The nulls are
historical residue of wiring submissions into the corpus before the submission
model carried context, not a calibrated decision.

## 3. Calibration representation evidence

The frozen calibration artifact
`backend/evaluation/results/voyage-production-direction-calibration.json` at
commit `f925a95` records benchmark SHA-256
`b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`, 120 pairs,
and `"representation": "structured-context-v1"` for **both** the query and
document embedding sources.

`backend/evaluation/datasets/expanded-semantic-benchmark.json`, normalised to
LF line endings, hashes to exactly that value. It is the benchmark that produced
T1/T2. Its query side (`submitted`):

| Measure | Count |
| --- | ---: |
| cases | 120 |
| `submitted` with at least one non-blank context field | **120 / 120** |
| `submitted` with all three (population, location, study focus) | **119 / 120** |
| `submitted` title-only | **0** |
| `submitted` carrying keywords | 0 |

The frozen production contract test
(`voyageSemanticProduction.test.js`) independently asserts that a **query**
payload is `Title: …\nPopulation: …\nStudy focus: …` — structured context, with
location omitted only because the fixture's location is blank.

So: thresholds were calibrated with structured-context-v1 query inputs; the
evaluation query side included non-blank population, location and study focus;
direct checking reproduced that; submission did not.

## 4. Reproduction on the pre-correction code

Exact canonical text captured from the serializer input on each path.

**Case 1 — all four fields supplied**

```
pre-check      | Title: Knowledge of malaria prevention among mothers in Osogbo
               | Population: Mothers of children under five
               | Location: Osogbo
               | Study focus: Malaria prevention knowledge
submission     | Title: Knowledge of malaria prevention among mothers in Osogbo
revision       | Title: Knowledge of malaria prevention among mothers in Osogbo
lecturer check | Title: Knowledge of malaria prevention among mothers in Osogbo
```

**Case 2 — title + population**

```
pre-check      | Title: Knowledge of malaria prevention among mothers in Osogbo
               | Population: Mothers of children under five
submission     | Title: Knowledge of malaria prevention among mothers in Osogbo
revision       | Title: Knowledge of malaria prevention among mothers in Osogbo
lecturer check | Title: Knowledge of malaria prevention among mothers in Osogbo
```

**Case 3 — title only**: identical across all four paths.

Two of three cases diverged. Case 3 proves the serializer itself is correct: the
divergence appears only when context is supplied and then discarded.

## 5. Score-divergence probe (diagnostic only; no thresholds fitted)

Real Voyage provider, four stored documents differing in one contextual
dimension each, four proposals with supplied context. For each proposal the
structured pre-check query (A) and the title-only query (B) were scored against
the **same** stored document vectors under the frozen T1/T2.

| Proposal | Class changes (A→B) | Top-match class A → B | Ranking order |
| --- | ---: | --- | --- |
| same theme, different population | 2 | HIGH → MEDIUM | same |
| same theme, different location | 3 | HIGH → MEDIUM | **changed** |
| same theme, different study focus | 1 | HIGH → HIGH | same |
| paraphrase with aligned context | 1 | MEDIUM → MEDIUM | **changed** |

Seven classification changes and two ranking changes, from nothing other than
one path discarding supplied context. In three of four cases the title-only
path **understated** the risk of the closest genuine match (HIGH → MEDIUM
twice; MEDIUM → LOW for the closest population match). The lecturer's check on a
submission previously ran on path B.

The provider returned HTTP 429 eight times across the probe runs; every
occurrence surfaced as a fail-closed provider error and was retried with
backoff. No fallback vector was used. This is recorded separately as hosted
quota evidence.

## 6. What was changed

All changes make submissions and revisions use the same serializer and the same
topic shape as a direct check. Nothing was added to the representation.

- **Schema / migration** — `20260829090000_add_submission_semantic_context`:
  three nullable `TEXT` columns (`population`, `location`, `study_focus`) on
  `submissions`. Additive; no migration edited. Existing rows keep `NULL` and
  serialise title-only because for them the fields are genuinely absent.
- **`buildSubmissionTopicShape`** now passes supplied values through with the
  same trim-and-blank-to-null rule the direct check uses.
- **`submission.service`** accepts, validates (text only, ≤ 1000 characters —
  the direct check's ceiling, so a pre-checked topic can always be submitted)
  and persists the three fields on creation and on revision; exposes them as
  `population`, `location`, `study_focus` in every submission payload and in
  lineage references.
- **`lecturerSimilarity.controller`** forwards the stored context so the
  lecturer's query embedding is the same representation as the student's
  pre-check.
- **`SubmitTopicPage`** collects the three fields as an optional "Research
  context" group, shows them in the review-before-submit step, pre-fills them
  when revising, and sends them for both first submissions and revisions.
- **Lecturer detail / student history** display the context when present.

Query role remains `input_type=query`; stored topics remain
`input_type=document`; raw cosine, T1/T2, provider, model and dimension are
unchanged; there is no fallback.

## 7. Verification

- Representation-contract suite: canonical text for pre-check and submission is
  byte-for-byte identical (Buffer equality and equal source hash); a revision
  reaches the serializer through the same shape builder and embeds its own
  context; blank-only omission; per-field hash change; no metadata/PII in the
  Voyage text; `query` / `document` roles; frozen constants; boundary
  classification; no reverse embedding; no fallback; corpus lifecycle carries
  the fields.
- Scratch-database lifecycle E2E (real migration, real Prisma, real Voyage):
  under-review source hash equals the pre-check hash; revision request removes
  the stale entry; a revision with changed population and study focus produces a
  new hash and a fresh embedding; approval promotes the revised record with the
  canonical fields; no duplicate corpus entries; a context-free submission still
  serialises title-only. 12/12.

## 8. Integrity of frozen artifacts

`voyageSemanticSimilarity.service.js`, `topicSemanticRepresentation.service.js`
and `voyageEmbedding.service.js` are untouched. The evaluation datasets,
results and `qa-audit/` evidence are untouched; the benchmark hash still matches
the calibration artifact. The defence baseline tag is unchanged.
