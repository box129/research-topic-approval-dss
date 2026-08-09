# SBERT Input Representation Pilot

Generated: 2026-08-09T15:04:27.296Z

Commit: `83dd3af`

## Scope and governance

This is a pilot comparison of SBERT input representations only. It does not change production scoring, thresholds, APIs, data, or UI. The 16 labels are manually constructed pilot labels, not lecturer-reviewed department-expert ground truth; no final model-effectiveness claim is warranted.

- Dataset: `backend/evaluation/datasets/pilot-topic-pairs.json` (pilot-v1); unchanged, 16 cases
- Model verification: PASS — all-MiniLM-L6-v2 via GET /health; exact model-name match
- Reused integration: `backend/src/services/sbert.service.js`

## Representations

TITLE_ONLY:

`<title>`

STRUCTURED_CONTEXT (optional blank fields omitted):

`Title: <title>`
`Population: <population>`
`Location: <location>`
`Study focus: <study_focus>`

Keywords and benchmark metadata (including expected class/risk, labels, rationales, category, tags, notes, and provenance) are excluded.

## Baseline reproduction

Historical SBERT-only title scores: `backend/evaluation/results/topic-similarity-evaluation.json`. Mean absolute difference: 0.35975; maximum: 0.971; outside 0.005: 15/16.

**FAILED_REPRODUCTION**. Existing evaluation preprocessing was inspected: the historical runner passes submitted and existing titles directly to the shared SBERT client, with no evaluation-side preprocessing. The material mismatch therefore indicates changed service/model state or historical run conditions, not a formatter difference. Interpret this pilot only as a same-run representation comparison.

## Class statistics

### TITLE_ONLY

| Expected class | Support | Mean | Median | Min | Max | SD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| LOW | 4 | 0.33575 | 0.36 | 0 | 0.623 | 0.287931 |
| MEDIUM | 5 | 0.6428 | 0.579 | 0.529 | 0.842 | 0.11347 |
| HIGH | 7 | 0.785286 | 0.848 | 0.498 | 1 | 0.179968 |

### STRUCTURED_CONTEXT

| Expected class | Support | Mean | Median | Min | Max | SD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| LOW | 4 | 0.39675 | 0.4175 | 0.092 | 0.66 | 0.253795 |
| MEDIUM | 5 | 0.6896 | 0.671 | 0.575 | 0.818 | 0.079157 |
| HIGH | 7 | 0.915143 | 0.968 | 0.77 | 1 | 0.080409 |

## Ranking and separation

| Metric | TITLE_ONLY | STRUCTURED_CONTEXT |
| --- | ---: | ---: |
| Spearman (expected LOW=0, MEDIUM=1, HIGH=2) | 0.54756 | 0.887425 |
| HIGH > MEDIUM | 0.742857 | 0.971429 |
| HIGH > LOW | 0.857143 | 1 |
| MEDIUM > LOW | 0.7 | 0.9 |
| Overall cross-class concordance | 0.771084 | 0.963855 |
| Mean HIGH − MEDIUM | 0.142486 | 0.225543 |
| Mean MEDIUM − LOW | 0.30705 | 0.29285 |
| Mean HIGH − LOW | 0.449536 | 0.518393 |

No production risk thresholds are used as a primary result.

## Scenario review

The case-level table covers exact duplicate, near duplicate, paraphrased duplicate, synonym duplicate, same disease with a different population or location, same population/location with a different focus, high lexical overlap with different focus, fragmented title, similar intervention with different population/location, and clearly unrelated scenarios. Positive deltas are desirable for appropriate HIGH matches but potentially harmful for LOW cases; MEDIUM cases are inspected for useful contextual separation rather than score increase alone.

| Case | Category | Expected | Title | Structured | Delta |
| --- | --- | --- | ---: | ---: | ---: |
| case-001 | exact_duplicate | HIGH | 1 | 1 | 0 |
| case-002 | near_duplicate | HIGH | 0.971 | 0.983 | 0.012 |
| case-003 | paraphrased_duplicate | HIGH | 0.711 | 0.867 | 0.156 |
| case-004 | same_disease_different_population | MEDIUM | 0.579 | 0.671 | 0.092 |
| case-005 | same_disease_different_location | MEDIUM | 0.842 | 0.818 | -0.024 |
| case-006 | same_population_different_focus | LOW | 0.62 | 0.635 | 0.015 |
| case-007 | unrelated_public_health | LOW | 0.1 | 0.2 | 0.1 |
| case-008 | high_lexical_overlap_different_focus | MEDIUM | 0.571 | 0.575 | 0.004 |
| case-009 | fragmented_title | HIGH | 0.848 | 0.969 | 0.121 |
| case-010 | synonym_duplicate | HIGH | 0.498 | 0.77 | 0.272 |
| case-011 | same_population_location_different_topic | LOW | 0.623 | 0.66 | 0.037 |
| case-012 | similar_intervention_different_context | MEDIUM | 0.693 | 0.718 | 0.025 |
| case-013 | documentation_gap_paraphrase | HIGH | 0.578 | 0.849 | 0.271 |
| case-014 | under_review_paraphrase | HIGH | 0.891 | 0.968 | 0.077 |
| case-015 | high_lexical_overlap_different_object | MEDIUM | 0.529 | 0.666 | 0.137 |
| case-016 | clearly_unrelated | LOW | 0 | 0.092 | 0.092 |

## Recommendation

**STRUCTURED_CONTEXT** — Structured context improved ordinal association, cross-class ordering, and HIGH-versus-LOW class separation without relying on production thresholds.

## Limitations

- This is a 16-case manually constructed pilot, not lecturer-reviewed department-expert ground truth.
- The historical title-only SBERT artifact did not reproduce; the report is only a within-run representation comparison.
- The score function is the existing shared SBERT service client, which rounds cosine scores to three decimal places.
- Health reports the configured model name; the current FastAPI health response does not expose whether its internal fallback mode was used.
- Results compare raw semantic score behaviour and do not calibrate semantic-only production thresholds.

## Reproduction

```powershell
cd backend
npm run evaluate:sbert-input-representations
```
