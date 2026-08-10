# Expanded Semantic Model Evaluation

Evaluation-only comparison on a frozen manually constructed 120-pair benchmark.

- Benchmark SHA-256 before/after: `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0` / `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`
- Support: 39 LOW, 41 MEDIUM, 40 HIGH; 15 deliberate missing-context pairs.

| Model | Dimension | Spearman | Overall concordance | HIGH-LOW margin | Exploratory CV macro F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| sbert | 384 | 0.841858 | 0.92936 | 0.442177 | 0.779049 |
| openai | 3072 | 0.832642 | 0.923942 | 0.249494 | 0.751424 |
| voyage | 1024 | 0.883903 | 0.958741 | 0.255935 | 0.80801 |
| gemini | 3072 | 0.851309 | 0.936028 | 0.084729 | 0.753311 |

**VOYAGE_LEADS_EXPANDED_BENCHMARK** — leading candidate on the manually constructed 120-pair expanded benchmark; this is not a final production model selection.
