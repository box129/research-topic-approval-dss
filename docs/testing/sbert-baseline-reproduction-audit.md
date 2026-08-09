# SBERT Historical Baseline Reproduction Audit

Historical commit: `e756c2e` · Current commit: `83dd3af`

## Result

**HISTORICAL BASELINE INVALIDATED.** The historical stored “SBERT-only” scores are an exact match for the FastAPI service's deterministic SHA-256 hash fallback: 16 of 16 scores reproduce exactly. They are not evidence of the intended `sentence-transformers/all-MiniLM-L6-v2` cosine baseline.

The current service is a valid real-model run for the six traced cases: direct `SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")` cosine values and endpoint-derived values agree to the client’s three-decimal score precision.

## Semantic code comparison

`sbert-service/app.py`, `backend/src/services/sbert.service.js`, and the dataset are unchanged from `e756c2e` to current HEAD. The evaluation runner’s post-historical changes concern production combined/fallback scores; the SBERT-only path is unchanged: raw `submitted.title` and `existing.title` are passed to `calculateSbertSimilarities`.

The historical FastAPI source already had the cause: if `sentence-transformers` cannot import, model loading fails, or encoding fails, it creates deterministic 384-value hash vectors. `/health` can still return HTTP 200 and `all-MiniLM-L6-v2` because it reports the configured name, not runtime mode.

## Six-case trace

All cases use raw titles, `POST /embed`, response `{ "embedding": [...], "dimension": 384 }`, and client cosine `dot/(normA*normB)`, clamped to `[0,1]` and rounded to three decimals. The source does not pass `normalize_embeddings`; direct output vectors were observed L2-normalized.

| Case | Scenario | Historical | Current service | Direct model | Abs. historical difference |
| --- | --- | ---: | ---: | ---: | ---: |
| case-001 | exact duplicate | 1.000 | 1.000 | 1.000 | 0.000 |
| case-002 | near duplicate | 0.000 | 0.971 | 0.971 | 0.971 |
| case-003 | paraphrase | 0.365 | 0.711 | 0.711 | 0.346 |
| case-007 | unrelated | 0.401 | 0.100 | 0.100 | 0.301 |
| case-010 | synonym duplicate | 0.171 | 0.498 | 0.498 | 0.327 |
| case-016 | clearly unrelated | 0.296 | 0.000 | 0.000 | 0.296 |

For case-002, the fallback’s raw cosine is `-0.0813649838`; the Node client clamps that to `0.000`. This exactly explains the otherwise implausible historical near-duplicate score.

The machine-readable report records both raw inputs for every traced case.

## Current fingerprint and direct verification

- Configured model: `sentence-transformers/all-MiniLM-L6-v2`
- Health response: `{ status: "healthy", model: "all-MiniLM-L6-v2" }`
- Embedding dimension: 384
- Direct environment: Python 3.14.0, sentence-transformers 5.2.3, transformers 5.3.0, torch 2.10.0+cpu
- Requirements at both historical and current commits instead pin sentence-transformers 2.2.2 and torch 2.0.1.

The model’s actual source/cache path is not exposed by the service. Fallback exists and can claim healthy status. No service code was changed for this audit.

## Historical environment evidence

Confirmed: identical requirements across commits; unchanged fallback source; and an exact 16/16 historical-score fallback match. Inferred: a historical import, load, or encode failure selected fallback. Unknown: the precise exception, historical installed versions, cache state, and logs.

## Consequence for the input-representation pilot

**VALID AS CURRENT-MODEL PILOT.** The TITLE_ONLY and STRUCTURED_CONTEXT scores were obtained in the same current real-model run, so their relative comparison remains usable for this small pilot. The historical artifact must not be used as the semantic baseline, and the pilot remains non-final because its labels are manually constructed rather than lecturer-reviewed ground truth.

## Checks

- Read-only Git comparison of semantic-scoring code at `e756c2e` and current HEAD.
- Direct deterministic-fallback reproduction: 16/16 historical scores matched.
- Direct SentenceTransformer versus live FastAPI endpoint: six of six rounded scores matched.
- No production-facing file was changed; no files were staged, committed, pushed, tagged, reset, cleaned, or stashed.
