# Student Figma Flow Smoke Checklist

Use this checklist to verify the completed student-facing Figma flow after PR #40. This is a manual smoke checklist for the frontend presentation work only.

## Purpose and scope

This smoke run verifies:

- AUTH-01 login presentation and role redirect behavior
- STUD-01 Student Dashboard
- STUD-02 Submit Topic
- STUD-03 My Submissions
- STUD-04 Check My Topic
- STUD-05 Research Explorer

This checklist does not require backend, Prisma, migration, API, similarity, snapshot, or decision workflow changes.

## Preconditions

- The frontend is running locally.
- The backend is running if you are verifying real login, submission, or similarity API behavior.
- Test users for student, lecturer, and admin roles exist if role redirects are being checked manually.
- Use a disposable development environment for any manual action that creates submissions.
- Confirm the current branch includes PR #34 through PR #40 student Figma UI work.

## Manual browser smoke checklist

### A. Login / AUTH-01

- [ ] AUTH-01 split login renders.
- [ ] Forgot-password link exists.
- [ ] Login redirects correctly by role.
- [ ] Student lands in the student area after login.

### B. Student Dashboard / STUD-01

- [ ] `/student/dashboard` renders.
- [ ] Loading state is handled.
- [ ] Empty/no-submission state is safe.
- [ ] Submission status state is safe.
- [ ] Unavailable data is not presented as real.
- [ ] Placeholders are clearly marked as unavailable or not connected.

### C. Submit Topic / STUD-02

- [ ] `/student/submit-topic` renders.
- [ ] Title required validation works.
- [ ] 7-24 word validation works.
- [ ] Successful submission resets the form.
- [ ] Success link to `/student/my-submissions` exists.
- [ ] No similarity preview appears.
- [ ] No risk panel appears.
- [ ] No confirmation, supervisor, declaration, or draft-save behavior appears.

### D. My Submissions / STUD-03

- [ ] `/student/my-submissions` renders.
- [ ] Card/history layout appears.
- [ ] Pending review shows no fake feedback.
- [ ] Awaiting revision, rejected, and approved states show safe feedback when available.
- [ ] Lecturer identity is not exposed.
- [ ] `decided_by_id` is not exposed.
- [ ] `decided_by_name` is not exposed.
- [ ] Similarity snapshots are not exposed.
- [ ] Similarity summaries are not exposed.
- [ ] Risk score/badge is not exposed.

### E. Check My Topic / STUD-04

- [ ] `/student/check-my-topic` renders.
- [ ] Advisory pre-check language appears.
- [ ] General similarity check behavior is used.
- [ ] Results render through existing result display behavior.
- [ ] Check does not save results.
- [ ] Check does not create snapshots.
- [ ] Check does not mutate submissions.
- [ ] Check does not approve, reject, or block a topic.

### F. Research Explorer / STUD-05

- [ ] `/student/research-explorer` renders.
- [ ] Explorer shell is honest.
- [ ] Search control is disabled.
- [ ] Filter control is disabled.
- [ ] No fake approved topics appear.
- [ ] Empty state says approved topic explorer data is not available yet.
- [ ] CTA to `/student/check-my-topic` works.
- [ ] CTA to `/student/submit-topic` works.

## Verification commands

```bash
cd frontend
npm run build
```

Run the targeted student/frontend tests:

```bash
cd frontend
npm test -- --run tests/LoginPage.test.jsx tests/StudentDashboardPage.test.jsx tests/SubmitTopicPage.test.jsx tests/MySubmissionsPage.test.jsx tests/CheckMyTopicPage.test.jsx tests/ResearchExplorerPage.test.jsx tests/FoundationPrimitives.test.jsx tests/TopicForm.test.jsx tests/ResultsDisplay.test.jsx
```

## Known caveat

- The full frontend suite may still have the stale `tests/e2e/userFlow.test.jsx` Router-context issue unless fixed separately.

## Safety expectations

- No backend/API behavior changed by the student Figma UI work.
- No lecturer/admin data is exposed.
- No similarity internals are exposed on the student submissions page.
- No snapshots are exposed to students.
- Similarity pre-check remains advisory.
- Decisions remain lecturer-controlled.
- Research Explorer is an honest shell, not a fake repository browser.
- Submit Topic remains submission-only, not similarity-checking.
- Check My Topic remains pre-check-only, not a submission flow.
