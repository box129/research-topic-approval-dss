# Lecturer Check Similarity — Implementation Plan

## Overview

The Lecturer Check Similarity page lets lecturers manually enter or paste a proposed research topic and run a similarity analysis against the UNIOSUN topic repository. The feature supports quick manual checks for supervision or exceptional reviews and surfaces a combined similarity score with breakdown by algorithm (Jaccard, TF‑IDF, SBERT) and top matches.

**Route:** `/lecturer/check-similarity`

**v1.0 Classification:** Core — required to demonstrate manual lecturer checks and decision support.

---

## Screen / State Summary

States (all v1.0):
- Default manual topic check form — initial state where a lecturer inputs/pastes the topic and selects category (if present).
- Analysis in progress — transient loading state while the backend runs similarity checks.
- Low similarity result — low-risk outcome with limited or single historical match.
- High similarity warning — high-risk outcome with multiple historical matches and strong warning messaging.
- Medium similarity partial analysis — cautionary state when SBERT/semantic analysis is unavailable; results are based on lexical matching.

Each state is controlled by the similarity-check API response and rendered inline on the same route.

---

## v1.0 Implementation Priority

| State | Priority | Rationale |
|---|---:|---|
| Default manual topic check form | High | Entry point for all manual checks; required for user input and validation |
| Analysis in progress | High | Prevents duplicate runs and communicates system status |
| Low similarity result | High | Demonstrates successful checks and supports approval decisions |
| High similarity warning | High | Essential for risk signaling and reviewer caution |
| Medium similarity partial analysis | High | Handles degraded semantic analysis gracefully and prevents false confidence |

---

## Component Breakdown

- `LecturerDashboardLayout` — page wrapper with header/nav
- `PageHeader` — title, breadcrumbs, short description
- `TopicCheckForm` — main form container
- `TextAreaInput` — large topic entry field
- `SelectInput` — optional category/study-focus selector
- `PrimaryButton` — `Check Similarity` action
- `SecondaryButton` — auxiliary actions (Clear, Load Example)
- `ValidationMessage` — word count and min/max hints
- `LoadingStatePanel` — skeletons and spinners during analysis
- `SimilarityResultPanel` — result container that toggles content by risk level
- `SimilarityScoreBreakdown` — cards for Jaccard, TF‑IDF, SBERT scores
- `SimilarTopicCard` — top match card with link/reference, percent, and source
- `RiskBadge`, `StatusBadge` — visual indicators for risk and outcome
- `InfoCallout` — messages explaining partial analysis or historical snapshot
- `EmptyStatePanel` — used when no matches or no previous manual checks (v2.0 historical)

---

## Route & State Mapping

- Route: `/lecturer/check-similarity`
- Default: render `TopicCheckForm` (empty or with last unsent draft)
- On `Check Similarity` click: trigger API call and show `LoadingStatePanel`
- On success: render `SimilarityResultPanel` with content chosen by `risk_level` returned by API (`low`, `medium`, `high`)
  - `low` → Low similarity layout
  - `medium` → Medium partial analysis layout (may show SBERT N/A)
  - `high` → High similarity warning layout
- No separate routes are required for result states; use query params for pagination or prefilled content only (optional)
- Recommended query params: `?page`, `?limit`, `?search` (if history is implemented in v2.0)

---

## Backend / API Dependency Notes

Required API endpoints and data shapes:

1. `GET /api/lecturers/me` — current lecturer profile (id, name, department) — optional but useful for personalization and auditing.

2. `POST /api/similarity/check` — run similarity analysis for a provided topic payload.
- Request:
```json
{
  "topic_text": "...",
  "category": "...",          // optional
  "source": "manual-check",  // optional tag
}
```
- Response (example):
```json
{
  "combined_score": 0.42,
  "risk_level": "low",            // "low" | "medium" | "high"
  "jaccard_score": 0.35,
  "tfidf_score": 0.45,
  "sbert_score": 0.42,             // may be null if unavailable
  "top_matches": [
    { "match_id": "m-123", "title": "Existing Topic A", "percent": 0.42, "source": "historical_topics" }
  ],
  "algorithm_status": {
    "sbert": "ok" | "unavailable"
  },
  "recommendation": "low_risk"   // optional human-readable code
}
```

Notes:
- `sbert_score` may be `null` or missing; frontend must handle null gracefully and show an explanatory `InfoCallout`.
- Preserve historical match references (ids) for linkout or review traceability.
- Ensure the API returns clear error codes for timeouts or analysis failures; frontend shows an error and retry option.

Optional endpoints (v2.0):
- `GET /api/similarity/report/:id` — download full PDF/JSON report
- `GET /api/similarity/history` — list of past manual checks (if saved)

---

## Visual Matching Notes

- Use the same visual language as the pending-review similarity panels: score cards, coloured risk banners, and match cards.
- Primary colors for risk: green (Low), amber/orange (Medium), red (High).
- Score breakdown cards should be visually consistent with `SimilarityScoreBreakdown` used elsewhere.
- Provide prominent, readable percentage numbers and short explanatory labels for each algorithm.
- For `medium` state show a prominent `InfoCallout` noting SBERT/semantic analysis is unavailable and results are lexical-only.
- Loading state uses skeletons matching the score card and match-card sizes to avoid layout shift.

---

## Similarity-result Behavior Notes

- The frontend should treat `risk_level` as authoritative for UI decisions (which panel to show).
- If `sbert_score` is `null`, show a clear explanation and an estimated confidence label derived from available algorithms.
- Show top matches grouped by source (historical_topics, current_session, under_review) if provided in the response.
- Recommendations (approve/proceed/revise) should be advisory only and not submit decisions on behalf of the lecturer.
- Maintain a read-only historical snapshot of the returned scores; do not re-run analysis automatically for historical results.

---

## Acceptance Checklist

Functional
- [ ] Render `/lecturer/check-similarity` route and show `TopicCheckForm`
- [ ] Validate topic text length (min/max) and show `ValidationMessage`
- [ ] Trigger `POST /api/similarity/check` with form payload
- [ ] Show `LoadingStatePanel` while waiting for response
- [ ] Render `SimilarityResultPanel` matching `risk_level` returned by API
- [ ] Display `SimilarityScoreBreakdown` with Jaccard, TF‑IDF, and SBERT (or N/A)
- [ ] Display `SimilarTopicCard` entries for `top_matches`
- [ ] Show `InfoCallout` when `sbert_score` is unavailable
- [ ] Handle API error and timeout with retry action and clear user message
- [ ] Prevent duplicate submissions while analysis is running

UX / Visual
- [ ] Risk banners use correct color coding and accessible text
- [ ] Score cards, badges, and match cards follow existing styles
- [ ] Layout is responsive (desktop/tablet; mobile deferred to v2.0)
- [ ] Loading skeletons prevent layout shifts

Backend / API
- [ ] `POST /api/similarity/check` returns the fields listed under backend notes
- [ ] API gracefully returns `sbert` availability in `algorithm_status`

Testing
- [ ] Unit tests for result rendering logic based on `risk_level` and missing `sbert_score`
- [ ] Integration tests for `POST /api/similarity/check` handling, including timeout paths

Documentation
- [ ] Document route and API contract in frontend API docs
- [ ] Add visual examples and state descriptions to `docs/frontend/` for handoff

---

## Deferred / v2.0

- Export report (CSV/PDF)
- Batch similarity checking for multiple topics
- Persisted history of manual checks and user-owned check reports
- Advanced analytics and charts
- Edit/save manual-check notes and annotations

---

## Assumptions

1. The similarity API is synchronous for the UI (short-running) — otherwise the UI may need a polled job model for async analysis.
2. SBERT may be intermittently unavailable; frontend must show fallback UI and not fail silently.
3. The manual check feature does not create decision records; it is advisory unless the lecturer takes a separate action on another page.
4. No export or history persistence is required in v1.0 unless explicitly requested.

---

## Summary

This plan captures the five v1.0 states required to implement a robust manual similarity-check experience for lecturers on `/lecturer/check-similarity`. It focuses on read-only advisory results, clear handling of degraded algorithm availability, and parity with existing similarity result visuals used elsewhere in the product.
