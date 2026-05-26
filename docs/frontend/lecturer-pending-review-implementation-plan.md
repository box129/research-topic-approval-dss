# Lecturer Pending Review Implementation Plan

## 1. Lecturer Pending Review screen/state summary
The Lecturer Pending Review workflow is the instructor-facing process for triaging and deciding on student topic submissions. It includes list/table views for assigned and department submissions, detailed submission inspection with multi-algorithm similarity results, and decision actions (approve, request revision, reject) captured via a confirmation modal.

Core v1.0 states (all required):
- Empty assigned queue — when the lecturer has no assigned pending reviews.
- Department review list — a broader department-scoped pending reviews list with filters and bulk actions (export treated as v2.0 optional).
- Assigned queue (filtered) — the lecturer's assigned submission list, filterable and paginated.
- Submission detail — High risk analysis — detailed similarity breakdown and repository matches; actionable triage.
- Submission detail — Low risk analysis — detailed view showing low scores and readiness to approve.
- Submission detail — Medium risk / partial analysis — semantic analysis unavailable or partial; cautionary messaging.
- Decision confirmation modal — popup to confirm approve/request-revision/reject actions including feedback capture.

Role: Lecturer
Purpose: Enable fast, informed decisions on submitted research topics with visibility into similarity analysis and supporting evidence.

## 2. v1.0 implementation priority
All listed states are v1.0 because they form the end-to-end reviewer experience.
Suggested order:
1. Department review list (show list/table, filters, and search)
2. Assigned queue (filtered) with pagination and quick open to detail
3. Submission detail screens (reuse the same detail panel for low/medium/high variants)
4. Decision confirmation modal (capture feedback/reason before committing)
5. Empty states, info callouts, and activity timeline

Export/bulk actions: treat as v2.0 unless already available in the codebase.
Concurrent review locking: treat as informational in v1.0 unless explicit locking APIs exist.

## 3. Component breakdown
Suggested reusable components:
- `LecturerDashboardLayout`
- `PageHeader`
- `PendingReviewList`
- `ReviewQueueTable`
- `PendingReviewCard` / `PendingReviewRow`
- `StudentTopicDetailsPanel`
- `SimilarityResultPanel`
- `SimilarityScoreBreakdown`
- `SimilarTopicCard`
- `RiskBadge`
- `StatusBadge`
- `DecisionActionPanel` (Approve/Request/Reject CTA row)
- `LecturerFeedbackForm` (used inside decision modal)
- `ConfirmationModal`
- `EmptyStatePanel`
- `InfoCallout`
- `ActivityTimeline`
- `PaginationControls`
- `PrimaryButton`, `SecondaryButton`

Component notes:
- `StudentTopicDetailsPanel` should be data-driven and render risk-specific content (colors, copy, match tiers) without duplicating layout.
- `SimilarityResultPanel` receives the `Jaccard`, `TF-IDF`, `SBERT` scores and renders `SimilarityScoreBreakdown` and `SimilarTopicCard` lists.
- `DecisionActionPanel` triggers the `ConfirmationModal` which contains the `LecturerFeedbackForm` for request/reject flows.

## 4. Route/state mapping
- Primary route: `/lecturer/pending-reviews`
- List/table states:
  - `/lecturer/pending-reviews` → department review list (default), with query params for filtering: `?tab=assigned|department&risk=high|medium|low&category=...&page=1`
  - Assigned queue view: `/lecturer/pending-reviews?tab=assigned`
- Submission detail: can be inline panel or route:
  - Inline: open `StudentTopicDetailsPanel` on the same route
  - Optional deep link: `/lecturer/pending-reviews/:submissionId`
- Risk analysis variants: controlled by the selected submission's similarity/risk payload — no separate routes required
- Decision confirmation modal: local UI state controlled modal (no separate route)

## 5. Backend/API dependency notes
Required endpoints and data shapes:
- Current lecturer profile: `GET /api/users/me` (for permissions/context)
- Pending lists:
  - `GET /api/submissions?scope=department|assigned&filters...` → returns list of submissions with summary fields and pagination
- Submission detail:
  - `GET /api/submissions/:id` → returns: `id`, `title`, `description`, `studentName`, `studentId`, `submittedAt`, `supervisor`, `department`, `status`
  - similarity payload: `combinedScore`, `jaccardScore`, `tfidfScore`, `sbertScore` (may be `null`), `highestMatchPercent`, `tieredMatches` (repository/current-session/concurrent)
  - concurrent review info: `isBeingReviewed`, `currentReviewer`, `similarityOverlapPercent` (optional)
- Action endpoints:
  - `POST /api/submissions/:id/approve` (body: optional note)
  - `POST /api/submissions/:id/request-revision` (body: `message`)
  - `POST /api/submissions/:id/reject` (body: `reason`, `message`)
- List endpoints should return pagination metadata: `total`, `page`, `perPage`, `totalPages`
- Optional aggregation endpoints for summary cards: `GET /api/lecturer/dashboard` (pending counts, high-risk count, recent activity)

API behaviour expectations:
- SBERT score may be absent; backend should indicate degraded semantic analysis via a flag or `sbertScore: null` and a `semanticStatus` field.
- Approve/reject endpoints should return updated counts or the updated submission object for UI refresh.

## 6. Visual matching notes
- Use consistent risk color system: green (low), amber/orange (medium/caution), red (high) applied to banners, progress bars, and `RiskBadge` components.
- Detail panel layout: researcher profile header, risk banner with progress bar, three score cards for Jaccard/TF‑IDF/SBERT, then tiered match panels (Tier 1 repository, Tier 2 current session, Tier 3 concurrent reviews).
- Table/list rows: compact with columns `Topic Title & Student`, `Student ID`, `Submitted`, `Similarity Risk`, `Wait Time` and checkbox selection for bulk actions.
- Empty assigned queue: large centered panel with success icon and guidance copy.
- Confirmation modal: three distinct action cards (Approve—green, Request Revision—amber, Reject—red) with required inputs for revision/rejection flows.

## 7. Decision/action behavior notes
- Decision actions must be confirmed via `ConfirmationModal` to prevent accidental approvals/rejections.
- Approve flow: minimal input; optional note; call `POST /api/submissions/:id/approve`.
- Request revision flow: require a message (feedback) to the student; call `POST /api/submissions/:id/request-revision` with message body.
- Reject flow: require a reason (selectable) and optional message; call `POST /api/submissions/:id/reject`.
- After successful action, update UI optimistically and refresh pending counts and lists.
- Concurrent review alerts: display informational banner and `Message Reviewer` quick action; do not block decisions in v1.0 unless backend locking exists.
- Validation: ensure required fields for request/reject flows are filled before submitting.

## 8. Acceptance checklist
- [ ] Route `/lecturer/pending-reviews` exists and renders lists for department and assigned submissions.
- [ ] List/table supports filters (sort, risk, category), search, selection, and pagination.
- [ ] Assigned queue view shows lecturer-scoped submissions and quick open to detail.
- [ ] Submission detail panel renders risk banner, score cards, and tiered match lists for high/medium/low variants.
- [ ] Decision confirmation modal captures required inputs and calls action endpoints.
- [ ] Backend endpoints provide submission detail with `jaccardScore`, `tfidfScore`, `sbertScore` (nullable), `tieredMatches`, and concurrency info.
- [ ] UI shows clear visual differentiation for low/medium/high risk states and displays semantic offline warnings when applicable.
- [ ] Empty assigned queue state displays friendly guidance and next-step CTAs.
- [ ] Bulk/export features are optional (v2.0) unless already implemented in the codebase.

---

Notes / assumptions:
- Export and bulk workflows are deferred to v2.0 unless required.
- Concurrent review locking is informational in v1.0 and does not prevent actions unless backend locking APIs are provided.
- The detail view is a single component that renders different risk variants based on returned similarity data.

