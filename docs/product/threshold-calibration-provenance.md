# Threshold Calibration Provenance

Immutable provenance record for the production semantic-similarity
thresholds. Everything below is verifiable offline from published
repository objects; no Voyage API key or provider call is required.

## A. Production constants

Defined in `backend/src/services/voyageSemanticSimilarity.service.js` and
pinned bit-for-bit by `semanticRepresentationContract.test.js` and
`voyageSemanticProduction.test.js` (exact values plus boundary classes):

```
T1 = 0.5571529891797358
T2 = 0.6450102471881145

LOW      score <  T1
MEDIUM   T1 <= score <  T2
HIGH     score >= T2
```

Raw cosine is classified directly; no rounding or clipping precedes
classification. The constants are compile-time code constants: no
environment variable, admin setting, database setting, or deployment
configuration can change them.

## B. Published immutable-evidence locator

| Ref | Value |
| --- | --- |
| Evidence tag | `evaluation/c1.5-voyage-calibration-evidence` (annotated) |
| Tag peels to (calibration evidence commit) | `f925a951b2a6f43f90f2ec34d83e8128c4592e90` |
| Benchmark freeze commit (ancestor of the tag) | `f7cd90424b1790eaebd8f4daf43474b8d50a4ad8` |
| Production adoption commit (on `main`) | `6e68080` — "feat(similarity): adopt Voyage semantic production scoring" |

The evaluation lineage is deliberately not part of the production branch
history; the published annotated tag makes the evidence durably reachable
from origin. Git itself does not prevent a tag ref from being moved or
deleted — immutability here is project policy: this evidence tag must not
be moved, deleted, or reused.

## C. Benchmark identity

| Property | Value |
| --- | --- |
| Path (at the tag) | `backend/evaluation/datasets/expanded-semantic-benchmark.json` |
| Git blob | `0796ee7e52382135b543a44f5558185d8060946b` |
| SHA-256 (raw bytes, 117,303 bytes) | `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0` |
| Cases | 120 (unique ids; explicit `submitted` / `existing` pair per case) |
| Class distribution (`expected_class`) | LOW 39, MEDIUM 41, HIGH 40 |

The benchmark is **researcher-constructed** technical evaluation data. It
is **not departmental ground truth** and is not lecturer- or
department-expert validated; its own `provenance` block records exactly
that. The file has a single creating commit (`f7cd904`) and was never
edited afterwards; the calibration runner refuses to run unless the file
hashes to the SHA-256 above, and re-verifies it after scoring.

## D. Semantic contract

| Property | Value |
| --- | --- |
| Provider | Voyage |
| Model | `voyage-4-large` |
| Dimension | 1024 |
| Representation | `structured-context-v1` (title + non-blank population / location / study focus) |
| Submitted side | `input_type=query` |
| Stored/existing side | `input_type=document` |
| Score | raw cosine |
| Direction used for the threshold fit | `cosine(submitted_query, existing_document)` only |

The calibration artifact also records the reverse (BA) and pair-mean
directions for robustness comparison; they never contribute to the
production thresholds.

## E. Evidence-chain paths (all at the evidence tag)

| Artifact | Path |
| --- | --- |
| Calibration output (thresholds, grouped CV, bootstrap, sensitivity) | `backend/evaluation/results/voyage-production-direction-calibration.json` |
| Completed raw-score artifact (120 per-case `score_ab` / `score_ba`) | `backend/evaluation/results/production-semantic-retrieval-validation-completed.json` |
| Cached query vectors (229, role-validated) | `backend/evaluation/results/c1.2-voyage-query-embeddings.json` |
| Cached document vectors (229, role-validated) | `backend/evaluation/results/c1.2-voyage-document-embeddings.json` |
| Calibration runner | `backend/scripts/run-voyage-production-direction-calibration.js` |
| Threshold-selection helper | `backend/evaluation/voyageSemanticThresholdCalibration.helpers.js` |

The cached-vector files carry no topic text — only
`{ canonicalTopicId, sourceHash }` plus numeric embeddings — and the
runner validates each file's role, model, dimension, representation and
vector count before use.

## F. Selection algorithm

Implemented in `voyageSemanticThresholdCalibration.helpers.js` (`fit`):

- exhaustive **joint** search over ordered pairs of threshold cut
  positions;
- every candidate threshold is the **midpoint between two adjacent
  observed scores** (which is why the constants have full-precision
  mantissas);
- objective: **macro-F1** over LOW/MEDIUM/HIGH;
- tie-break: (1) higher macro-F1, (2) lower T1, (3) lower T2;
- fitted on the AB (submitted-query → existing-document) scores of all
  120 cases; `predict` uses the same boundary semantics as production
  `classify`.

## G. Performance interpretation

Two numbers exist and must not be conflated:

| Estimate | Accuracy | Macro-F1 |
| --- | --- | --- |
| In-sample "calibration-only" (fit and evaluated on all 120) | 0.858333 | 0.85433 |
| Grouped 5-fold held-out (pooled out-of-fold predictions) | 0.791667 | 0.792062 |

The grouped estimate uses 113 connected components with group-aware folds
(cases sharing a topic are kept in the same fold; the runner asserts no
topic leakage across folds). There is **no separate external or
departmental test set**; the 0.792 figure is a held-out estimate on the
researcher-constructed benchmark, not an untouched independent test-set
result and not a departmental accuracy claim.

## H. Bootstrap stability

Recorded in the calibration artifact
(`productionContract.stability.bootstrap`) and reproduced exactly offline:

| Property | Value |
| --- | --- |
| Seed | 20260810 |
| Replicates | 5000 |
| Resampling unit | connected component |
| T1 median / 95% band | 0.545841 / [0.504517, 0.560869] |
| T2 median / 95% band | 0.644724 / [0.630203, 0.655772] |

## I. Offline reproduction (no provider call)

From a fresh clone:

```
git fetch --tags origin
git rev-parse evaluation/c1.5-voyage-calibration-evidence^{}
#   -> f925a951b2a6f43f90f2ec34d83e8128c4592e90

git show f925a95:backend/evaluation/datasets/expanded-semantic-benchmark.json | sha256sum
#   -> b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0
```

Then, using only files extracted from the tag (`git show f925a95:<path>`):
load the two cached C1.2 vector files, recompute
`cosine(query(submitted), document(existing))` for each benchmark case via
`sha256` of the serialized structured context (the runner's `rowsFor`
logic), and run `fit` from
`voyageSemanticThresholdCalibration.helpers.js` on the 120 AB scores. The
result is exactly `T1 = 0.5571529891797358`, `T2 = 0.6450102471881145`,
and `groupedCrossValidate` / `bootstrap` reproduce the artifact's grouped
held-out metrics and bootstrap summaries bit-for-bit. The recomputed
cosines also match the committed raw-score artifact 120/120 bit-exact.

Do **not** regenerate provider embeddings to verify the constants — the
committed cached vectors are the calibration inputs, and no Voyage key is
needed for any step above.

## J. Evidence limitations

- The cached provider vectors are the immutable evidence for this
  calibration run. Re-requesting the same embeddings from Voyage would be
  a new provider call and is not guaranteed to be bit-identical over
  time.
- Threshold selection and every derived metric in this record (grouped
  CV, bootstrap, in-sample fit) **are** reproducible offline from the
  published evidence alone.
- The benchmark is researcher-constructed technical evaluation data, not
  departmental ground truth; no external validation is claimed, and the
  thresholds are not claimed to be universally optimal.
