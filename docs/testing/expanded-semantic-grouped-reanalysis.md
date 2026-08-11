# Expanded Semantic Grouped Reanalysis

This is a **CONNECTED-COMPONENT GROUP-AWARE REANALYSIS** of the stored Experiment 2B scores. It does not replace the earlier **CASE-STRATIFIED EXPLORATORY CV**.

- Frozen benchmark SHA-256 before/after: `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0` / `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`
- Components: 113 ({"1":106,"2":7})
- Leakage assertion: PASS

| Model | Grouped accuracy | Grouped macro-F1 | Earlier accuracy | Earlier macro-F1 | Delta macro-F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| sbert | 0.791667 | 0.78704 | 0.783333 | 0.779049 | 0.007991 |
| openai | 0.783333 | 0.784747 | 0.75 | 0.751424 | 0.033323 |
| voyage | 0.8 | 0.800585 | 0.808333 | 0.80801 | -0.007425 |
| gemini | 0.758333 | 0.761312 | 0.75 | 0.753311 | 0.008001 |

**VOYAGE_REMAINS_HIGHEST_OBSERVED_UNDER_GROUPED_REANALYSIS** — highest observed performance under grouped reanalysis; not final production-provider selection.
