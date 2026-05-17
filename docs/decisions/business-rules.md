# Business Rules

Source of truth for this document: `FYP_Selected/` only. If later implementation docs disagree, they do not redefine these rules.

## Current Implementation Note

This is an intended-rule document. For the current implemented backend API contract, use [Backend API](../api/backend-api.md). Production similarity scoring is still title-based, while Phase 4 context-aware scoring is evaluation-only.

## 1. Purpose

The system helps Public Health lecturers screen proposed research topics for duplicate or highly similar topics by checking historical topics, current-session approved topics, and topics currently under review.

## 2. Algorithm roles

- `Jaccard`: baseline lexical overlap check for exact/shared words
- `TF-IDF`: weighted term matching for important domain-specific words
- `SBERT`: primary semantic similarity signal for paraphrased or meaning-level matches

The MVP documentation says the system should show all three scores separately. The current public production API does not expose a combined score. Evaluation-only tooling may calculate `weighted_combined` for measurement, but that is not a production response field.

## 3. Tier rules

- `Tier 1 - Historical`: show the top 5 most similar topics from the historical repository
- `Tier 2 - Current Session`: show all current-session approved topics with `SBERT >= 60%`
- `Tier 3 - Under Review`: show under-review topics with `SBERT >= 60%` and `review_started_at < 48 hours`
- Ranking within tiers is by SBERT score descending

If SBERT is unavailable:

- `Tier 1`: show top 5 using lexical results
- `Tier 2` and `Tier 3`: fallback rule is `Jaccard >= 60%` or `TF-IDF >= 60%`

## 4. Risk rules

- Overall risk is based on the maximum SBERT score across all tiers
- `LOW`: `< 50%`
- `MEDIUM`: `50% - 69%`
- `HIGH`: `>= 70%`

If SBERT is unavailable, overall risk falls back to `max(Jaccard, TF-IDF)`.

## 5. Score scale

- Documented exposed similarity scores are percentages on a `0-100` scale
- API examples show one decimal precision
- Evaluation helper scores are normalized to `0-1` inside the evaluation harness, but public API scores remain percentage-style values.

## 6. Category and keywords

- `category` is documented as topic metadata, not as an MVP retrieval or scoring rule
- Filtering by category or year is out of scope for MVP
- `keywords` is an optional comma-separated input/storage field
- `matched_keywords` should be exposed in results where documented
- Whether user-supplied keywords directly change retrieval or scoring is `needs verification`

## 7. Out of scope for MVP

- Custom production algorithm weighting
- Public production combined/merged similarity score
- Customizable thresholds
- Filtering by category or year
- Alternate sorting options beyond fixed SBERT-descending ranking
- Category-level historical risk analysis
