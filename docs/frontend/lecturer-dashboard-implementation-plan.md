# Lecturer Dashboard Implementation Plan

## 1. Lecturer Dashboard screen/state summary
The Lecturer Dashboard is the primary instructor-facing workspace for triaging, reviewing, and managing student topic submissions. It surfaces workload summary cards, pending review queues, recent student submissions, high-risk alerts (similarity flags), and quick actions for efficient review workflows.

Core v1.0 states:
- **Overview summary** — default dashboard showing review statistics, pending reviews, recent submissions, and quick actions.
- **High-risk alerts & review queue** — highlighted dashboard section focused on submissions flagged as high similarity/risk, with actionable review cards for triage.

Role: Lecturer
Purpose: Provide a concise workload view and fast actions to review, assign, escalate, or resolve flagged student submissions.

## 2. v1.0 implementation priority
Both states are v1.0 and should be implemented together to enable end‑to‑end lecturer workflows:
1. Overview summary (dashboard header, summary cards, recent submissions)
2. Pending review queue (compact list with quick actions)
3. High-risk alerts & review queue (triage view for flagged submissions)
4. Activity feed and quick actions (supporting elements)

## 3. Component breakdown
Suggested reusable components:
- `LecturerDashboardLayout`
- `PageHeader`
- `DashboardStatusCard`
- `ReviewQueuePreview`
- `PendingReviewCard`
- `HighRiskAlertCard`
- `ActivityFeed`
- `QuickActionsPanel`
- `StatusBadge`
- `RiskBadge`
- `PrimaryButton`
- `SecondaryButton`
- `InfoCallout`
- `EmptyStatePanel`

Responsibilities:
- `DashboardStatusCard` shows quick metrics (pending count, high-risk count, approved/rejected counts).
- `ReviewQueuePreview` renders a compact list of `PendingReviewCard` items with inline actions (assign, escalate, open details).
- `HighRiskAlertCard` surfaces flagged submissions with priority actions.
- `ActivityFeed` records recent reviewer actions and submission events.

## 4. Route/state mapping
- Route: `/lecturer/dashboard`
- Default route state: Overview summary (dashboard metrics + pending queue)
- High-risk alerts & review queue: displayed as a highlighted section or filter within the same route (e.g., `?filter=high-risk`), not a separate route by default
- Topic review details may open inline (panel/modal) or via a separate route if deep-linking is required (opt-in)

## 5. Backend/API dependency notes
Required backend data and endpoints:
- Current lecturer profile (for permissions and personalization)
- Endpoint: `GET /api/lecturer/dashboard` (or segmented endpoints) returning:
  - `pendingReviewCount`
  - `highRiskCount`
  - recent submissions list (paginated)
  - summary metrics (approved/rejected/revision counts)
  - list of assigned student submissions with brief metadata
- Endpoint: `GET /api/submissions?assignedTo=me&status=pending` for the review queue
- Endpoint: `GET /api/submissions?risk=high` for flagged submissions (or server-side filter param)
- Submission fields expected: `id`, `title`, `studentName`, `submittedAt`, `similarityScore`, `riskLevel`, `status`, `assignedReviewer`, `reference`
- Action endpoints: assign reviewer, escalate, mark reviewed, open detailed review (e.g., `POST /api/submissions/:id/assign`)
- Pagination metadata for large queues: `total`, `page`, `perPage`

API behaviour expectations:
- Dashboard endpoint should be fast and cache-friendly for summary cards.
- Review queue endpoints should support filtering by risk, status, and assignment.
- Actions (assign/escalate/resolve) should return updated counts for UI refresh.

## 6. Visual matching notes
- Use a prominent header with lecturer identity and quick metrics across the top.
- Summary cards should be visually distinct and clickable (open corresponding filtered queues).
- Pending review list items should be compact with clear status and risk badges and inline action buttons.
- High-risk area should use strong color contrast (e.g., red accents) and larger cards for urgent items.
- Use `InfoCallout` components to explain triage guidance or review policies.
- Use `EmptyStatePanel` when there are no pending reviews, with a CTA to view archived or all submissions.

## 7. Acceptance checklist
- [ ] Route `/lecturer/dashboard` exists and renders the `LecturerDashboardLayout`.
- [ ] Overview summary renders dashboard metrics (pending, high-risk, approved, revisions) and recent submissions.
- [ ] Pending review queue shows a compact list of `PendingReviewCard` items with inline actions (assign, escalate, open).
- [ ] High-risk alerts & review queue renders flagged submissions prominently with triage actions.
- [ ] Action endpoints (assign/escalate/mark as reviewed) update dashboard counts and queue state.
- [ ] Backend endpoints provide required submission metadata and pagination.
- [ ] Visual differentiation exists between normal pending items and high-risk flagged items.
- [ ] Empty state handled gracefully with `EmptyStatePanel` and relevant CTAs.

---

Assumptions:
- Both states are v1.0 and presented within the same route as sections/filters.
- Detailed per-submission review screens can be implemented as inline panels or separate routes later if deep-linking is needed.
- Action endpoints exist or will be created to mutate review assignment and state; optimistic UI updates are acceptable if API latency is low.
