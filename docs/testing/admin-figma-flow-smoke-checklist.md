# Admin Figma Flow Smoke Checklist

Use this checklist to verify the ADMIN-01 Admin Dashboard shell after PR #47. This is a manual smoke checklist for the frontend presentation work only.

## Purpose and scope

This smoke run verifies:

- ADMIN-01 Admin Dashboard
- Admin dashboard safety expectations
- Deferred admin areas

This checklist does not require backend, Prisma, migration, API, similarity, snapshot, or decision workflow changes.

## Preconditions

- The frontend is running locally.
- An admin test user exists if admin route protection is being checked manually.
- Confirm the current branch includes PR #34 through PR #47 admin dashboard UI work.
- Use a disposable development environment for any manual admin navigation checks.

## Manual browser smoke checklist

### A. Admin Dashboard / ADMIN-01

- [ ] `/admin/dashboard` renders.
- [ ] Page is protected for admin role.
- [ ] Dashboard uses the Figma-aligned admin shell.
- [ ] API health card appears.
- [ ] Database health card appears.
- [ ] SBERT health card appears.
- [ ] Service health cards say "Not connected yet" or equivalent.
- [ ] Dashboard does not claim fake live healthy, degraded, or critical status.
- [ ] Users metric is marked Not available yet or not connected.
- [ ] Topics metric is marked Not available yet or not connected.
- [ ] Pending reviews metric is marked Not available yet or not connected.
- [ ] High-risk topics metric is marked Not available yet or not connected.
- [ ] Recent activity is deferred or not available.
- [ ] Reports are deferred or not available.
- [ ] Audit events are deferred or not available.
- [ ] Analytics are deferred or not available.

### B. Admin Safety Checks

- [ ] No fake user counts appear.
- [ ] No fake topic counts appear.
- [ ] No fake pending-review counts appear.
- [ ] No fake high-risk counts appear.
- [ ] No fake activity feed appears.
- [ ] No fake reports appear.
- [ ] No fake audit events appear.
- [ ] No fake similarity analytics appear.
- [ ] No fake system health status appears.
- [ ] No restricted student/lecturer data is exposed.
- [ ] No backend/admin endpoint is called from the dashboard.
- [ ] No network request is introduced by the dashboard shell.

### C. Deferred Admin Areas

- [ ] User Management remains out of scope unless already implemented elsewhere.
- [ ] Topic Repository remains out of scope unless already implemented elsewhere.
- [ ] System Settings remains out of scope unless already implemented elsewhere.
- [ ] Audit Log remains out of scope unless already implemented elsewhere.
- [ ] Reports remain out of scope.
- [ ] Import/export remains out of scope.
- [ ] Advanced analytics remains out of scope.

## Verification commands

```bash
cd frontend
npm run build
```

Run the targeted admin/frontend tests:

```bash
cd frontend
npm test -- --run tests/AdminDashboardPage.test.jsx tests/FoundationPrimitives.test.jsx
```

Optional confidence run:

```bash
cd frontend
npm test -- --run tests/LoginPage.test.jsx tests/LecturerDashboardPage.test.jsx tests/LecturerPendingReviewsPage.test.jsx tests/LecturerSubmissionDetailPage.test.jsx tests/LecturerCheckSimilarityPage.test.jsx tests/StudentDashboardPage.test.jsx tests/SubmitTopicPage.test.jsx tests/MySubmissionsPage.test.jsx tests/CheckMyTopicPage.test.jsx tests/ResearchExplorerPage.test.jsx tests/TopicForm.test.jsx tests/ResultsDisplay.test.jsx
```

## Known caveat

- The full frontend suite may still have the stale `tests/e2e/userFlow.test.jsx` Router-context issue unless fixed separately.

## Safety expectations

- No backend/API behavior changed by Admin Dashboard Figma UI work.
- No admin dashboard API invented.
- No live system-health status is claimed without data.
- No fake counts/metrics are presented as real.
- No reports, audit, import, or export behavior introduced.
- No similarity thresholds/scoring/ranking changed.
- No snapshot behavior changed.
- No decision/student feedback behavior changed.
- Admin Dashboard remains an honest shell until safe backend support exists.
