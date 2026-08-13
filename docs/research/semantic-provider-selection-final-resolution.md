# C1.3 Final Provider-Selection Resolution

## Decision

`SELECT_VOYAGE_FOR_PRODUCTION`

Gemini is an unresolved candidate, not negative evidence. Its asymmetric
production validation was blocked by account request quota before a valid
embedding batch was returned. That does not prevent a decision among SBERT,
OpenAI, and Voyage because Voyage has complete production-retrieval evidence
and materially stronger ordering evidence than both alternatives.

## Evidence integrity

- Benchmark SHA-256 before and after review:
  `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`.
- C1.2 Voyage artifact: 120/120 pair scores, 229/229 query vectors, and
  229/229 document vectors.
- Grouping: the frozen 113 connected components and Stage A.1 five grouped
  folds; no topic identity crosses folds.
- Bootstrap: component-level paired resampling, seed `20260810`, 5,000
  replicates.
- This is a local, stored-artifact analysis. No provider or model was called.

## Validated production-relevant comparison

| Candidate | Accuracy | Grouped macro-F1 | Spearman | Overall concordance | HIGH-MEDIUM | MEDIUM-LOW | HIGH-LOW | Dimension |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SBERT | 0.791667 | 0.787040 | 0.841858 | 0.929360 | 0.127830 | 0.314347 | 0.442177 | 384 |
| OpenAI | 0.783333 | 0.784747 | 0.832642 | 0.923942 | 0.066587 | 0.182907 | 0.249494 | 3072 |
| Voyage production retrieval | 0.858333 | 0.858084 | 0.900285 | 0.970202 | 0.080824 | 0.170933 | 0.251757 | 1024 |
| Gemini production retrieval | — | — | — | — | — | — | — | 3072 |

Gemini production validation is `INCOMPLETE`; its prior symmetric score is not
used as production evidence.

Voyage improves grouped classification broadly: its confusion matrix has 36/39
LOW, 31/41 MEDIUM, and 36/40 HIGH correct. SBERT has 33, 24, and 38;
OpenAI has 33, 27, and 34. The advantage is principally the materially better
MEDIUM separation, while retaining strong LOW and HIGH performance.

| Actual class | SBERT: LOW/MEDIUM/HIGH | OpenAI: LOW/MEDIUM/HIGH | Voyage: LOW/MEDIUM/HIGH |
| --- | --- | --- | --- |
| LOW | 33 / 6 / 0 | 33 / 6 / 0 | 36 / 3 / 0 |
| MEDIUM | 4 / 24 / 13 | 2 / 27 / 12 | 4 / 31 / 6 |
| HIGH | 0 / 2 / 38 | 1 / 5 / 34 | 0 / 4 / 36 |

## Paired component bootstrap

All values are Voyage-production minus comparator, 95% paired intervals.

| Comparison | Spearman | Concordance | Grouped macro-F1 |
| --- | --- | --- | --- |
| Voyage − SBERT | 0.019558 to 0.109813 | 0.014204 to 0.073749 | 0.002678 to 0.142899 |
| Voyage − OpenAI | 0.024295 to 0.122163 | 0.017391 to 0.080747 | -0.000426 to 0.148446 |

Thus Voyage has stronger production-relevant ordering evidence against both
alternatives. Its macro-F1 improvement over SBERT is positive throughout the
interval; the improvement over OpenAI is favorable by point estimate but not
conclusive by this interval alone.

## Exact Voyage new-versus-old configuration evidence

The old Voyage configuration is the frozen Experiment 2B `input_type=null`
result. Point differences are new C1.2 retrieval minus old configuration.

| Metric | Point difference | 95% paired interval |
| --- | ---: | --- |
| Spearman | 0.016382 | -0.010448 to 0.049461 |
| Overall concordance | 0.011461 | -0.007324 to 0.033767 |
| Grouped macro-F1 | 0.057499 | -0.007951 to 0.125351 |

The prior abbreviated zero interval was not used: it resulted from an
incompatible score-key path in the generic stored bootstrap. These C1.3
intervals were reconstructed directly from the stored pair scores with the
frozen component bootstrap philosophy.

## Incomplete-context evidence

The benchmark has 15 deliberately incomplete-context pairs (six LOW, four
MEDIUM, five HIGH), a stress subset rather than an estimate of historical data
quality. Stored score means retain class ordering for all validated candidates:

| Candidate | LOW | MEDIUM | HIGH |
| --- | ---: | ---: | ---: |
| SBERT | 0.488029 | 0.776080 | 0.864434 |
| OpenAI | 0.667230 | 0.815366 | 0.863055 |
| Voyage production retrieval | 0.412320 | 0.574098 | 0.653428 |

This small subset supports no definitive robustness ranking by itself. It is
consistent with Voyage preserving ordered classes despite omitted context and
does not overturn its full-benchmark ordering and grouped-classification lead.

## Operational comparison

- **SBERT:** local 384D service; no external API charge or text transmission;
  requires a Python/FastAPI deployment and removal of the historical fallback
  defect before production use.
- **OpenAI:** managed 3072D API; server-side credential and external topic-text
  transmission; evaluated configuration carries the C1 documented API cost.
- **Voyage:** managed 1024D API; server-side credential and external topic-text
  transmission; C1.2 production retrieval completed 4/4 requests with zero
  429s and zero retries for 11,954 input tokens. The deliberate 61-second
  evaluation pacing is not provider latency or a production-throughput claim.

Privacy is feasible for all managed choices only when credentials remain
server-side and no student identity, account, or session information is sent.

## Frozen production contract

- Provider/model: Voyage `voyage-4-large`
- Query: `input_type=query`
- Historical document: `input_type=document`
- Dimension/dtype: 1024 / `float`
- Representation: `structured-context-v1`
- Semantic fields: Title, Population, Location, Study focus
- Similarity: cosine
- Credentials: server-side only
- Historical topics: generate the document embedding once; persist and reuse
  until invalidated.
- New-topic query: generate one query embedding per similarity check.
- No student identity, account, or session information is transmitted.

Final LOW/MEDIUM/HIGH production thresholds are **not yet frozen**. The prior
`.40/.70` thresholds must not be reused; threshold calibration is the next
gate.
