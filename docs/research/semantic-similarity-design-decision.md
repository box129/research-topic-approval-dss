# Semantic Similarity Design Decision Freeze

## Status and decision

**Status:** Evaluation-driven refinement; proposed final research alignment pending required supervisor and departmental approval where applicable.  
**Date:** 2026-08-11.  
**Decision:** The final intended similarity architecture is **semantic-only similarity scoring plus rule-based decision support**. This decision follows controlled evaluation on a researcher-constructed benchmark; it is not a claim of universal superiority or departmental ground truth.

The initial artefact was a weighted Jaccard (.20), TF-IDF (.30), and semantic (.50) similarity design with rule-based LOW/MEDIUM/HIGH interpretation. That was an approved design configuration, not an empirically calibrated result.

## Governing evidence and chronology

1. **Experiment 0 — input representation:** structured contextual semantic input outperformed title-only semantic input.
2. **Experiment 0B — forensic SBERT audit:** historical SBERT scores were deterministic fallback vectors; 16/16 reproduced, so historical SBERT effectiveness evidence was invalidated.
3. **Experiment 1 — 16-pair pilot:** SBERT led the pilot only.
4. **Experiment 2B — frozen 120-pair comparison:** Voyage was the highest observed semantic candidate, not a final provider choice.
5. **Stage A.1:** connected-component grouping removed topic-identity leakage. Grouped semantic macro-F1 was approximately SBERT .787, OpenAI .785, Voyage .801, Gemini .761; paired classification intervals did not establish decisive Voyage-over-SBERT superiority.
6. **Stage B1:** the current weighted integration was substantially worse than semantic-only scoring.
7. **Stage B2:** unrestricted nested calibration overwhelmingly selected semantic-only; forced strict tri-algorithm configurations remained worse than semantic-only.
8. **Stage B3:** contextual fields improved lexical ordering, but controlled fusion still did not establish semantic-only improvement. Structured lexical scores became strongly correlated with semantic scores. Formal B3 results: classification value **NOT_SUPPORTED**; complementary evidence value **NOT_SUPPORTED**; Path B′ **NOT_SUPPORTED**.

## Alternatives considered and rejected paths

### Path C — weighted tri-algorithm classification

The initial weighted fusion is **not supported** as the final production similarity decision pipeline. B1 showed that the existing contract underperformed semantic-only scoring; B2 showed that calibration did not rescue forced tri-algorithm classification; B3 showed that title-only lexical input asymmetry did not adequately explain the negative fusion finding.

### Path B′ — lexical methods as separate evidence channels

Path B′ is **not supported** on current evidence. Lexical methods remain researched/evaluated methods, but are not currently justified as weighted production components, separate production evidence channels, semantic-service fallback classifiers, or final LOW/MEDIUM/HIGH inputs.

### Jaccard and TF-IDF status

Jaccard and TF-IDF remain valid in the literature review, methodology chronology, experimental scripts, evaluation artifacts, Chapter Four results, and discussion of unsupported alternatives. Their implementation is intentionally retained at this stage; later production refactoring is a separate task.

## Selected design direction

Semantic similarity is the intended final similarity mechanism. Rule-based logic remains a legitimate DSS layer for:

- later calibrated semantic-score interpretation into advisory LOW/MEDIUM/HIGH classes; the historic .40/.70 values are not frozen as final semantic thresholds;
- topic lifecycle/searchability eligibility;
- embedding validity, including provider/model, representation, source text, source hash, and migration identity;
- explicit semantic-unavailable/degraded state, without fake/hash embeddings or lexical equivalence claims; and
- human final decision: similarity is advisory and HIGH similarity is not automatic rejection.

## Proposed research alignment

### Title

**Proposed revised title — pending required supervisor / departmental approval:**

> Development of a Decision Support System for Undergraduate Research Topic Approval Using Rule-Based Logic and Semantic Text Similarity

The historically approved title remains preserved as an initial/historically approved title:

> Development of a Decision Support System for Undergraduate Research Topic Approval Using Rule-Based Logic and Tri-Algorithm Text Similarity

### Aim

> The aim of this study is to develop and evaluate a decision support system that supports undergraduate research topic assessment using semantic similarity and rule-based decision support.

### Objectives and research questions

i. To investigate the existing undergraduate research topic-checking process and derive requirements for a decision support system. **→ RQ1**

ii. To evaluate lexical, semantic, and combined similarity approaches for assessing relationships between undergraduate research topics and determine a suitable similarity approach for the system. **→ RQ2**

iii. To design a rule-based decision support framework using the selected similarity approach and structured research-topic information. **→ RQ3**

iv. To implement the proposed decision support system with persistent semantic representations for retrieving and comparing existing research topics. **→ RQ4**

v. To evaluate the similarity performance and technical suitability of the developed system using controlled benchmark and production-scale testing. **→ RQ5**

RQ1. What limitations and system requirements are identified from the existing undergraduate research topic-checking process?

RQ2. How do lexical, semantic, and combined similarity approaches perform in assessing relationships between research topics, and which approach is most suitable for the proposed system?

RQ3. How can the selected similarity approach be incorporated into a rule-based decision support framework for undergraduate research topic assessment?

RQ4. How can the proposed framework be implemented to support persistent representation and retrieval of existing research topics?

RQ5. What level of similarity performance and technical suitability does the developed system demonstrate under controlled evaluation and production-scale testing?

## Scope, methodology, and reporting implications

The study evaluates lexical, semantic, and combined similarity. The final artefact uses semantic similarity with rule-based decision support. Research-topic information—not complete theses—is compared; the system is not a plagiarism detector; evidence is advisory; human academic judgement remains final. The 120-pair benchmark is researcher-constructed, its classes are not departmental approval policy, and its proportions are not departmental prevalence estimates.

Chapter Three must retain the actual DSR chronology: requirements investigation; initial multi-method artefact; fallback integrity verification; semantic representation/model evaluation; B1 integration evaluation; B2 nested calibration; B3 representation control; evaluation-driven refinement; semantic-primary artefact design; final implementation; production-scale evaluation.

Chapter Four must retain B1, B2, and B3 as valid negative/refinement results. Chapter Five may state that lexical, semantic, and combined methods were evaluated; structured context affected lexical behaviour; weighted fusion was not supported on this controlled benchmark; semantic similarity provided the strongest evaluated basis; and the artefact was refined. It must not claim universal semantic superiority, definitive Voyage superiority, departmental ground truth, tri-algorithm improvement, or lecturer efficiency without later measurement.

The contribution is reframed from a purported superior tri-algorithm model to a domain-specific DSS artefact developed through empirical comparison and refinement of lexical, semantic, and combined approaches.

The final abstract must not claim that .20/.30/.50 fusion improved accuracy, robustness, or superiority. It should eventually describe investigation, initial multi-method design, controlled evaluation, unsupported fusion, semantic refinement, final implementation, and final technical evaluation.

## Semantic provider status and remaining work

Voyage is the **highest observed semantic candidate on the current controlled benchmark**. The final production provider is **not yet selected** because grouped differences are modest, paired classification intervals are not decisive, and operational retrieval configuration, latency, failures/retries, availability, privacy/data handling, cost, dimension/storage, deployment complexity, and persistence architecture remain relevant. Tri-algorithm fusion must not be reopened during provider selection.

- **C1:** final semantic-provider and production retrieval configuration decision.
- **C2:** persistent semantic architecture: embeddings, metadata, representation identity, hashes, re-embedding rules, secure calls, no silent hash fallback, explicit degraded mode.
- **C3:** production retrieval: exact retrieval first; pgvector/ANN only if measurements justify it.
- **C4:** production-scale validation at current/development corpus, 1,000, 5,000, and optionally 10,000 topics; repeated latency, p50/p95, failure handling, retrieval correctness, and practical resource measurements.
- **C5:** final report alignment and final artefact evaluation.

## Evidence traceability

| Decision / claim | Evidence | Artifact / commit | Status | Research implication |
| --- | --- | --- | --- | --- |
| Historical fallback invalidation | 16/16 historical scores reproduced from fallback | forensic SBERT audit; `7158df8` verified pilot baseline | Valid integrity finding | Historical SBERT effectiveness claims excluded |
| Structured context matters | Contextual representation outperformed title-only semantic input | Experiment 0; `c06db5a` tooling | Valid | Structured topic representation retained |
| Four-model semantic evidence | Voyage highest observed candidate | Experiment 2B results `8ae9ec8` | Valid, not final selection | Provider decision remains open |
| Leakage-controlled semantic result | Grouped reanalysis preserves Voyage highest observed result | `6753b3e` | Valid | Use grouped evidence |
| Current fusion rejection | Current .20/.30/.50 integration underperforms semantic-only | `759b3b1` | Valid negative result | Do not retain current fusion |
| Calibration rejection | Strict tri remains below semantic-only | `47b5590` | Valid negative result | Calibration does not rescue Path C |
| Representation control | Structured lexical improvement does not establish fusion value | `eb65931` | Valid refinement result | Path B′ not supported |
| Final direction | Semantic-only plus rules | This decision record | Proposed final alignment | Implementation resumes only after C1 |
| Provider unresolved | Performance/operational evidence incomplete | `8ae9ec8`, `6753b3e` | Open | Do not select Voyage yet |
| Persistent embeddings | Not implemented | C2 planned work | Open | No production claim |
| 5,000-topic validation | Not tested | C4 planned work | Open | No scale claim |

## Evidence limitations and immutability

All conclusions are bounded by a controlled, researcher-constructed 120-pair benchmark and do not constitute departmental ground truth. Administrative amendment approval for the title/research alignment remains required where applicable. Historical experiment artifacts, the frozen benchmark, and prior results remain immutable; this record does not modify or reinterpret their stored data.
