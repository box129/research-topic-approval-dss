# Managed Embedding Provider Pilot

This is 16-case pilot screening only. No provider has been selected for production. The unchanged labels are manually constructed and are not lecturer-reviewed ground truth.

- Structured representation: Title, Population, Location, Study focus; blank fields omitted; metadata excluded.
- Historical SBERT artifact: invalidated because it was deterministic hash fallback output.
- Baseline: verified current real-model SBERT structured-context scores from checkpoint `7158df8`.

## Semantic comparison

| Model | Dimension | Spearman | Overall concordance | HIGH - LOW margin | Mean latency ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| sbert | 384 | 0.887425 | 0.963855 | 0.518393 | not_measured_in_this_run |
| openai | 3072 | 0.849662 | 0.939759 | 0.333205 | 624.53915 |
| voyage | 1024 | 0.873263 | 0.951807 | 0.283675 | 652.8182 |
| gemini | 3072 | 0.82134 | 0.903614 | 0.106129 | 770.89431 |

## Class statistics

| Model | Expected class | Support | Mean | Median | Min | Max | SD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| sbert | LOW | 4 | 0.39675 | 0.4175 | 0.092 | 0.66 | 0.253795 |
| sbert | MEDIUM | 5 | 0.6896 | 0.671 | 0.575 | 0.818 | 0.079157 |
| sbert | HIGH | 7 | 0.915143 | 0.968 | 0.77 | 1 | 0.080409 |
| openai | LOW | 4 | 0.603368 | 0.609596 | 0.386527 | 0.807754 | 0.204418 |
| openai | MEDIUM | 5 | 0.857369 | 0.850987 | 0.783386 | 0.937413 | 0.049286 |
| openai | HIGH | 7 | 0.936573 | 0.943343 | 0.88223 | 1 | 0.038015 |
| voyage | LOW | 4 | 0.696751 | 0.693588 | 0.520908 | 0.878918 | 0.169479 |
| voyage | MEDIUM | 5 | 0.890517 | 0.889434 | 0.810341 | 0.969235 | 0.054149 |
| voyage | HIGH | 7 | 0.980426 | 0.980418 | 0.965145 | 1 | 0.011206 |
| gemini | LOW | 4 | 0.876105 | 0.883616 | 0.793297 | 0.943889 | 0.067921 |
| gemini | MEDIUM | 5 | 0.939234 | 0.937225 | 0.919448 | 0.962658 | 0.013844 |
| gemini | HIGH | 7 | 0.982234 | 0.979771 | 0.969894 | 1 | 0.011194 |

## Recommendation

**SBERT_LEADS_PILOT** — SBERT leads this 16-case pilot on the predeclared threshold-independent semantic ordering metrics. This is not a production selection.

## Operational notes

Managed providers require server-side keys and create a managed-service dependency; SBERT requires a local model service. Float32 storage is dimension x 4 bytes and excludes database/index/metadata/replication/page overhead. API errors and token metadata are preserved in the JSON artifact; unavailable usage is reported as null, not estimated. Pricing is the dated snapshot supplied in the experiment brief.

## Limitations

- Sixteen cases are manually constructed pilot data, not final lecturer-reviewed ground truth.
- The latency sample is 10 measured requests and is only observed pilot latency.
- Provider response dimensions, token metadata, availability, and pricing can vary by account, region, and time.
- No arbitrary shared semantic thresholds, precision, recall, or F1 were used.
