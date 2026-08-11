# C1 Semantic Provider and Production Retrieval Configuration Decision

**Status:** Provider selection is evidence-gated and currently **inconclusive**.  
**Date:** 2026-08-11.  
**Governing architecture:** semantic-only similarity scoring plus rule-based decision support. The tri-algorithm question is closed.

## Decision hierarchy

Selection prioritizes group-aware ordering quality, grouped classification, and incomplete-context robustness; then retrieval-mode validity, stable embedding identity/persistence, and failure semantics; then reliability, privacy/security feasibility, cost, dimension/storage, and deployment complexity. Batch runtime is secondary. No weighted business score is used.

## Current controlled evidence

Stage A.1 grouped macro-F1 is SBERT **.787040**, OpenAI **.784747**, Voyage **.800585**, and Gemini **.761312** ([grouped reanalysis](../../backend/evaluation/results/expanded-semantic-grouped-reanalysis.json), `6753b3e`). Voyage is the highest observed candidate, but the grouped paired Voyage-minus-SBERT macro-F1 interval includes zero, so this does not establish decisive classification superiority. B1–B3 are relevant only because they established semantic-only scoring as the selected architecture; they do not select a provider.

Experiment 2B used structured-context-v1 and symmetric pair scoring: OpenAI `text-embedding-3-large` at 3072D, Voyage `voyage-4-large` at 1024D with `input_type: null`, Gemini `gemini-embedding-2` at 3072D with a symmetric sentence-similarity prompt, and verified direct SBERT `sentence-transformers/all-MiniLM-L6-v2` at 384D ([Experiment 2B](../../backend/evaluation/results/expanded-semantic-model-evaluation.json), `8ae9ec8`). The historic fallback defect is a C2 remediation requirement, not evidence for silently retaining fallback vectors.

## Current official documentation review — accessed 2026-08-11

| Candidate | Official model/configuration evidence | Retrieval implication | Current price evidence |
| --- | --- | --- |
| SBERT | [Sentence Transformers documentation](https://sbert.net/examples/sentence_transformer/applications/computing-embeddings/README.html) shows `sentence-transformers/all-MiniLM-L6-v2` and 384D output. | No provider-defined query/document mode documented for this model; use one frozen structured representation on both sides pending C2 implementation. | No external embedding API charge; infrastructure/hosting cost is unmeasured and platform-dependent. |
| OpenAI | [Model documentation](https://developers.openai.com/api/docs/models/text-embedding-3-large) lists `text-embedding-3-large`; [official embedding update](https://openai.com/index/new-embedding-models-and-api-updates/) documents up to 3072 dimensions and shortening. | Current official material reviewed does not prescribe distinct query/document embedding modes for this model. Experiment 2B’s symmetric representation is therefore not shown to be invalid for the planned retrieval orientation. | $0.13 per 1M input tokens ([model documentation](https://developers.openai.com/api/docs/models/text-embedding-3-large)). |
| Voyage | [Embeddings documentation](https://docs.voyageai.com/docs/embeddings) lists `voyage-4-large`, 1024D default, optional 256/512/2048 dimensions, and recommends `input_type: query` for queries and `document` for repository documents. | **Materially differs** from Experiment 2B `input_type: null`; C1 validation is required before use in production selection. | $0.12 per 1M tokens; first 200M tokens free per account ([official pricing](https://docs.voyageai.com/docs/pricing)). |
| Gemini | [Gemini Embedding 2 model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2) lists flexible 128–3072 dimensions. [Embedding guidance](https://ai.google.dev/gemini-api/docs/embeddings) says `task_type` is unavailable for Embedding 2 and recommends documented asymmetric query/document prompt structures for text retrieval. | **Materially differs** from Experiment 2B’s symmetric sentence-similarity prompt; C1 validation is required before use in production selection. | $0.20 per 1M text tokens on paid tier ([official pricing](https://ai.google.dev/gemini-api/docs/pricing)). |

OpenAI API inputs are not used for training by default, but documented abuse-monitoring retention and optional controls still require project privacy review ([official data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)). Equivalent current official retention/region detail was not established here for Voyage or Gemini; this remains unresolved rather than assumed.

## Required C1 configuration validation before final provider selection

Because production retrieval is **new topic query → historical topic document**, the frozen 120-pair benchmark cannot be used to claim quality for a changed asymmetric mode without a new validation.

- Voyage: evaluate `voyage-4-large`, 1024D float, structured-context-v1, A→B and B→A using `input_type: query` / `document`; pair-level mean only as paired-direction evidence.
- Gemini: evaluate `gemini-embedding-2`, 3072D, structured-context-v1, A→B and B→A using the current official query/document prompt structures; pair remains the statistical unit.
- Reuse the 113 connected components, exact Stage A.1 folds, training-only thresholds, and 5,000 component paired bootstrap replicates.
- OpenAI and SBERT do not currently require a new retrieval-configuration validation from the official documentation reviewed above.

No such C1 provider/model request has been made in this decision-freeze record. Therefore no symmetric Experiment 2B ranking is silently transferred to an asymmetric production configuration.

## Privacy, storage, and operational constraints for C2

External embedding requests must contain only title, population, location, and study focus in the frozen semantic representation. They must exclude student identity/contact data, credentials, role/session/JWT data, supervisor information, and unrelated database fields. Credentials must be server-side only.

Raw float32 vector storage only (excluding database row/index overhead):

| Candidate | Dimension | Bytes/vector | 201 | 1,000 | 5,000 | 10,000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SBERT | 384 | 1,536 | 308,736 B | 1,536,000 B | 7,680,000 B | 15,360,000 B |
| OpenAI | 3,072 | 12,288 | 2,469,888 B | 12,288,000 B | 61,440,000 B | 122,880,000 B |
| Voyage | 1,024 | 4,096 | 823,296 B | 4,096,000 B | 20,480,000 B | 40,960,000 B |
| Gemini | 3,072 | 12,288 | 2,469,888 B | 12,288,000 B | 61,440,000 B | 122,880,000 B |

Experiment 2B batch observations are not user-facing latency measurements. Single-query production latency is **NOT MEASURED** for every candidate. Managed-provider request/retry/error counts remain descriptive Experiment 2B observations only; they are not reliability guarantees. Historical embeddings must be persisted and reused; a query must not re-embed the whole repository.

## Qualitative matrix

| Criterion | SBERT | OpenAI | Voyage | Gemini |
| --- | --- | --- | --- | --- |
| Grouped semantic quality | Strong | Strong | Highest observed | Acceptable |
| Retrieval configuration validity | Acceptable | Acceptable | Unresolved pending validation | Unresolved pending validation |
| External data/API key dependency | None | Required | Required | Required |
| Separate service/deployment | Required | None beyond backend integration | None beyond backend integration | None beyond backend integration |
| Raw 5,000-vector storage | 7.68 MB | 61.44 MB | 20.48 MB | 61.44 MB |
| Versioning/persistence feasibility | Acceptable | Acceptable | Acceptable | Acceptable |
| Unresolved risk | Local service startup/maintenance; fallback removal | Operational/privacy configuration | Asymmetric validation | Asymmetric validation and prompt/version behavior |

## C1 outcome and C2 contract status

**FINAL DECISION: PROVIDER_SELECTION_INCONCLUSIVE**

No provider/model/query configuration/document configuration/output dimension is frozen for C2. Semantic LOW/MEDIUM/HIGH thresholds are also **NOT YET FROZEN**; historic `.40/.70` integrated thresholds are not semantic production thresholds.

The decision may be reopened only for the prescribed C1 asymmetric configuration-validation evidence and the stated production-operational criteria—not for lexical/semantic fusion. Previous scientific artifacts and the frozen benchmark remain immutable.
