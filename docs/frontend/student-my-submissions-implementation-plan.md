# Student My Submissions Implementation Plan

## 1. Student My Submissions screen/state summary
The Student My Submissions page is the student-facing view for tracking submitted research topics and their review lifecycle. It surfaces the student’s submission history, highlights current status, shows feedback and similarity risk, and provides actions for revision or follow-up.

The page includes five essential states:
- **Awaiting revision**
- **Approved**
- **Pending review**
- **No submissions**
- **Notification opened**

## 2. v1.0 implementation priority
All five states are treated as v1.0 because they are important to demonstrating the student submission tracking workflow and reflecting real submission outcomes:
- viewing awaiting revision items
- viewing approved submissions
- viewing pending review status
- seeing the empty state when there are no submissions
- opening a submission via notification context

## 3. Component breakdown
Suggested reusable components:
- `StudentDashboardLayout`
- `PageHeader`
- `SubmissionCard`
- `SubmissionDetailsPanel`
- `StatusBadge`
- `RiskBadge`
- `LecturerFeedbackPanel`
- `ActivityTimeline`
- `EmptyStatePanel`
- `NotificationDropdown`
- `PrimaryButton`
- `SecondaryButton`
- `InfoCallout`

These components should support a list/history-oriented page with both summary and expanded detail views, an empty state, and notification overlay behavior.

## 4. Route/state mapping
- `/student/submissions` — primary route for the My Submissions page
- Page state should be controlled by the student’s submission history and the selected submission status
- **Notification opened** should be treated as an overlay or dropdown state on the same page, not a separate route unless the existing codebase already uses a dedicated notification route
- No separate route is required for each state unless the current codebase already uses that pattern

## 5. Backend/API dependency notes
The page depends on backend data for:
- current student profile
- list of submitted topics
- submission status for each topic
- similarity/risk score if available
- lecturer/admin feedback
- approval or revision decision details
- submission activity timeline
- notifications if available

## 6. Visual matching notes
- Use a page layout that feels like a student dashboard with status summary and content areas
- Distinguish states with colored status badges, risk badges, and feedback panels
- Preserve a clean list or card-based submission history experience
- Use a strong empty state design with prominent CTA when there are no submissions
- Render notification banners or dropdowns as contextual overlays that do not require a full page transition

## 7. Acceptance checklist
- [ ] `/student/submissions` renders the student submissions page
- [ ] Awaiting revision state shows a submission requiring changes, feedback, and relevant actions
- [ ] Approved state shows a finalized submission with approval details and summary actions
- [ ] Pending review state shows waiting status and expected decision information
- [ ] No submissions state shows an empty history with CTA guidance
- [ ] Notification opened state appears as an overlay/dropdown, not a separate page
- [ ] Submission cards and detail panels use consistent reusable components
- [ ] Backend dependency notes cover profile, submissions list, status, similarity/risk, feedback, decisions, activity timeline, and notifications
