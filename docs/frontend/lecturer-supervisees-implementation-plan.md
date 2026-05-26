# Lecturer Supervisees — Implementation Plan

## Overview

The Lecturer Supervisees page allows lecturers to view, track, and manage the students assigned to them for supervision. The page surfaces each supervisee's topic title, submission and review status, similarity/risk information, and feedback context, while enabling lecturers to quickly filter and drill into supervisee details.

**Route:** `/lecturer/supervisees`

**v1.0 Classification:** Core — required for the lecturer supervision workflow.

---

## Screen / State Summary

States (all v1.0):
- Overview list — default supervisees list showing assigned students, topic status, and action links.
- Filtered pending view — supervisees filtered to pending-review or pending-decision status.
- Supervisee detail expansion — expanded row or panel showing topic details, detection scores, review progress, and feedback context.
- Empty supervisees state — displayed when the lecturer has no assigned supervisees.

The page should present these states on a single route, driven by filter/query state and data returned from the backend.

---

## v1.0 Implementation Priority

| State | Priority | Rationale |
|---|---:|---|
| Overview list | High | Primary entry point for lecturers to see assigned supervisees and status at a glance |
| Filtered pending view | High | Essential for quick triage of supervisees needing immediate attention |
| Supervisee detail expansion | High | Critical for reviewing topic details, similarity/risk scores, and feedback without leaving the list |
| Empty supervisees state | High | Required for graceful handling when no supervisees are assigned |

---

## Component Breakdown

- `LecturerDashboardLayout` — page wrapper with lecturer navigation and upper-level structure.
- `PageHeader` — page title, subtitle, and summary controls.
- `SuperviseeList` — container or section for supervisee rows.
- `SuperviseeTable` — tabular list of supervisees with columns for student metadata, topic, status, and actions.
- `SuperviseeCard` — alternative list row/card representation for supervisee entries.
- `SuperviseeDetailsPanel` — expanded inline panel or side panel for selected supervisee details.
- `StudentTopicSummaryCard` — summary card showing topic title, submission details, and current status.
- `StatusBadge` — badge for submission/review status.
- `RiskBadge` — badge for similarity or risk status.
- `SearchInput` — search field for student name, matric number, or topic title.
- `FilterDropdown` — filters for status, risk, submission stage, or category.
- `ActivityTimeline` — timeline of supervisee progress and review events.
- `LecturerFeedbackPanel` — feedback notes and reviewer comments.
- `EmptyStatePanel` — empty state placeholder when no supervisees exist.
- `InfoCallout` — explanatory or cautionary messages about data state.
- `PrimaryButton` — main actions such as "View Topic" or "Clear Filter".
- `SecondaryButton` — supplementary actions.
- `PaginationControls` — list pagination navigation.

---

## Route / State Mapping

- Route: `/lecturer/supervisees`
- Default route state: Overview list of assigned supervisees.
- Filtered pending view: controlled by query/filter state, e.g. `?status=pending`, not by a separate route.
- Supervisee detail expansion: inline expansion or side panel within the same route; may use local UI state or query state to preserve selection.
- Empty supervisees state: shown when the backend returns zero supervisee records for the current lecturer.

No separate routes are required for each state unless the existing frontend routing pattern already uses individual view routes.

---

## Backend / API Dependency Notes

Required data and endpoints:

1. **Current lecturer profile**
   - Endpoint: `GET /api/lecturers/me`
   - Purpose: identify current lecturer and scope assigned supervisees.

2. **Assigned supervisees list**
   - Endpoint: `GET /api/lecturers/me/supervisees`
   - Query/filter parameters:
     - `status` (e.g. `pending`, `approved`, `revision_required`, `not_submitted`)
     - `risk` (e.g. `low`, `medium`, `high`)
     - `search` (student name, matric number, topic title)
     - `page`, `limit`
   - Response fields:
     - `student_id`, `student_name`, `matric_number`
     - `topic_title`
     - `topic_status`
     - `submission_status`
     - `review_status`
     - `similarity_risk` (if available)
     - `detection_scores` (optional summary)
     - `last_activity`
     - `feedback_summary` (short note or latest comment)
     - `summary_counts` for status chips
     - pagination metadata

3. **Supervisee detail**
   - Endpoint: `GET /api/supervisees/:student_id` or `GET /api/lecturers/me/supervisees/:student_id`
   - Response fields:
     - supervisee student metadata
     - full `topic_title`
     - `topic_description` or full topic text
     - `submission_date`
     - `topic_status`
     - `review_status`
     - `similarity_risk`
     - algorithm-specific detection scores (Jaccard, TF-IDF, SBERT)
     - `feedback_history`
     - `progress_timeline`
     - `assigned_lecturer`

4. **Summary counts**
   - Derived from the supervisee list endpoint or returned separately as part of the list response.
   - Example fields: `total_assigned`, `pending_count`, `approved_count`, `revision_count`, `not_submitted_count`.

Important notes:
- Header/status counts should be driven by backend data, not hardcoded design values.
- Action links such as "View Topic" may open inline detail expansion or navigate to a separate review page depending on route design.
- Search and filters should be server-side where possible to handle large supervisee lists.

---

## Visual Matching Notes

- Keep consistent layout and styling with other lecturer dashboard pages.
- Use summary chips/badges for top-level supervisee counts and active filters.
- Table rows should be concise, with status badges and risk badges clearly visible.
- The expanded detail view should use a two-column layout: left for topic/feedback summary, right for detection scores and review details.
- The empty state should feel calm and actionable, with a large icon, explanatory text, and a CTA if applicable.
- Use the same visual language as `SimilarityResultPanel` and `LecturerFeedbackPanel` from other lecturer screens.

---

## Supervision Workflow Behavior Notes

- The overview list is the primary supervision dashboard and must load quickly.
- The filtered pending view is a triage mode for supervisees requiring immediate lecturer attention.
- The detail expansion view should allow the lecturer to inspect topic details, similarity/risk status, and feedback history without losing list context.
- The page should support clear transitions between filtered and full list views.
- Search and filter state should be preserved when collapsing an expanded supervisee detail view.
- If there are no assigned supervisees, the empty state should be shown immediately, and filters should be disabled or hidden.
- Status counts should update with the currently applied filters if those counts are scope-specific; otherwise show overall assigned supervisee totals.
- Action links should be consistent: open inline details in v1.0 unless the existing codebase prefers navigation to a review/detail page.

---

## Acceptance Checklist

Functional
- [ ] Render `/lecturer/supervisees` route and show overview list on load.
- [ ] Display assigned supervisees with student metadata, topic title, status, and action column.
- [ ] Show status chips or summary counts from backend data.
- [ ] Support filtering by pending status and other supervisee statuses.
- [ ] Support search by student name, matric number, or topic title.
- [ ] Render filtered pending view with active pending filter state.
- [ ] Expand a supervisee row or panel to show detail information.
- [ ] Display detection scores and risk status when available.
- [ ] Show feedback history and progress timeline in the detail view.
- [ ] Render empty supervisees state when the list is empty.
- [ ] Preserve filters and search when moving between list and detail views.

Visual / UX
- [ ] Use `StatusBadge` and `RiskBadge` clearly in list rows.
- [ ] Provide readable, uncluttered row layouts and expansion panels.
- [ ] Show active filter state and count in the UI.
- [ ] Empty state includes icon, guidance text, and optional CTA.
- [ ] Avoid hardcoded status counts; display backend-provided numbers.

Backend / API
- [ ] `GET /api/lecturers/me/supervisees` supports `status`, `risk`, `search`, `page`, and `limit`.
- [ ] List response includes supervisee metadata, topic status, summary counts, and pagination.
- [ ] `GET /api/lecturers/me/supervisees/:student_id` or equivalent returns full detail data.
- [ ] API returns detection scores and feedback history when available.

Testing
- [ ] Unit tests verify list rendering, filter behavior, and empty state.
- [ ] Integration tests verify API response handling and detail expansion.
- [ ] Manual testing confirms the filtered pending view and list-to-detail transition.

---

## Deferred / v2.0

- messaging/chat with supervisees
- export supervisee list
- bulk actions (assign, reassign, message, export)
- advanced supervision analytics
- real-time progress updates

---

## Assumptions

1. The page is a list-based supervision dashboard, not a full messaging center.
2. Action links may open inline details or navigate to a related review page depending on existing route conventions.
3. The supervisee list endpoint will provide summary counts and pagination metadata.
4. Risk/similarity data may be optional for some supervisees; the UI should handle missing values gracefully.
5. No real-time push updates are required for v1.0.
