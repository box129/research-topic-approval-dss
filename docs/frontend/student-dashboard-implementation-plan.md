# Student Dashboard Implementation Plan

## 1. Student Dashboard screen/state summary
The Student Dashboard is the student-facing landing page for the UNIOSUN Research Topic Similarity Detection System. It summarizes the current topic submission status, displays lecturer/admin feedback, shows similarity and review progress, and guides the student to the next action.

The dashboard has four essential states:
- **Awaiting revision**: student has a submission that requires changes before resubmission
- **Pending review**: student submission is under review and awaiting a decision
- **Approved**: submission has been accepted and the student can proceed
- **No submission**: student has not submitted a topic yet and needs onboarding guidance

## 2. v1.0 implementation priority
All four dashboard states are considered v1.0 because they represent critical student workflow moments:
- viewing dashboard summary
- seeing topic submission status
- seeing review progress
- seeing lecturer/admin feedback
- seeing similarity/result status

## 3. Component breakdown
Suggested reusable components:
- `StudentDashboardLayout`
- `DashboardStatusCard`
- `StatusBadge`
- `TopicSummaryCard`
- `LecturerFeedbackPanel`
- `ActivityFeed`
- `QuickActionsPanel`
- `EmptyStatePanel`
- `InfoCallout`

These components should support flexible content for the four dashboard states while preserving a consistent student experience.

## 4. Route/state mapping
- `/student/dashboard` — primary route for the student dashboard
- Dashboard state should be controlled by the student's current topic/submission status rather than by separate routes for each state
- If the codebase already uses route query/state patterns, the state can be reflected in client-side state (for example, `status=awaiting-revision`) but separate URL routes are not required for this implementation plan

## 5. Backend/API dependency notes
The dashboard depends on backend data for:
- current student profile
- latest topic submission
- submission status
- lecturer/admin feedback
- similarity/risk status if available
- recent activity/history

This data will drive which dashboard state is shown and the content within the status card, feedback panel, and activity feed.

## 6. Visual matching notes
- Preserve a clean and approachable dashboard layout with a prominent status summary at the top
- Use clear status badges and card styling to distinguish states like Awaiting revision, Pending review, and Approved
- Keep the empty state visually distinct with prominent CTAs and onboarding hints for new users
- Maintain consistent spacing and typography for dashboard sections, action buttons, and feedback text
- Ensure the activity feed and quick actions appear as secondary content that supports the main status card

## 7. Acceptance checklist
- [ ] Student dashboard renders at `/student/dashboard`
- [ ] Dashboard state is determined by the current submission status
- [ ] Awaiting revision state shows feedback and action guidance
- [ ] Pending review state shows review progress and expected next steps
- [ ] Approved state shows confirmation and follow-up actions
- [ ] No submission state shows empty state guidance with strong CTAs
- [ ] Status badge styling is clear and consistent across states
- [ ] Activity feed and quick actions are present where appropriate
- [ ] Backend dependency notes cover profile, submission, status, feedback, similarity/risk, and activity data
