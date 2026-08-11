# Integrated DSS Current-Contract Baseline

This researcher-controlled evaluation uses title-only lexical inputs and stored structured-context-v1 semantic scores. It preserves the production scoring weights and thresholds, but is not a byte-for-byte reproduction of production request construction or calibrated performance.

- Benchmark SHA-256 before/after: `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0` / `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`
- Current contract: Jaccard .20, TF-IDF .30, semantic .50; fixed thresholds .40/.70.

| Semantic candidate | Fixed-threshold accuracy | Fixed-threshold macro-F1 | Grouped-threshold accuracy | Grouped-threshold macro-F1 |
| --- | ---: | ---: | ---: | ---: |
| sbert | 0.458333 | 0.474315 | 0.541667 | 0.529803 |
| openai | 0.358333 | 0.363234 | 0.491667 | 0.446082 |
| voyage | 0.316667 | 0.322216 | 0.566667 | 0.503108 |
| gemini | 0.225 | 0.183514 | 0.558333 | 0.493146 |

**NO_SINGLE_INTEGRATED_LEADER: SBERT leads fixed-threshold and grouped macro-F1; Voyage leads grouped accuracy.** This is descriptive evidence only, not final production-provider selection.
