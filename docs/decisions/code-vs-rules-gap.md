# Code vs Rules Gap Analysis

This document records the current living interpretation of earlier rule/code gaps. Older gap notes about public `combinedScore`, old response fields, and old score scale mismatches are historical; use [Backend API](../api/backend-api.md) as the current implemented API reference.

## Current Alignment

- Backend similarity checks still cover historical, current-session, and under-review topic sources.
- The current public API exposes separate `jaccard`, `tfidf`, and `sbert` percentage-style scores.
- Normal production responses do not expose a public combined score.
- SBERT-unavailable behavior degrades to lexical similarity rather than failing the whole request.
- Import preview and commit endpoints are documented separately and use `multipart/form-data`.
- Phase 4 context-aware scoring remains evaluation-only and does not change production API behavior.

## Current Residual Gaps

- Production similarity scoring is still title-based and does not yet use `population`, `location`, or `study_focus`.
- The evaluation harness includes `weighted_combined` and `context_adjusted_combined`, but those scorers are not production response fields.
- Same-lecturer Tier 3 suppression still needs trusted lecturer identity in request/auth context before it can be implemented safely.
- Lecturer-reviewed evaluation data is still needed before production threshold changes.

## Historical Gap Items

Earlier versions of this document described public `combinedScore` behavior, normalized `0-1` public scores, and migration-oriented database workflow as active gaps. Those notes are no longer current living guidance.

## Recommended Next Reconciliation Work

1. Keep production behavior stable while planning context-aware scoring behind a feature flag.
2. Add context explanation metadata before allowing context to change final production risk decisions.
3. Validate future threshold changes against lecturer-reviewed cases, not only the pilot synthetic dataset.
4. Update this document whenever production scoring behavior intentionally changes.

