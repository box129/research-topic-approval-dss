# Figma UI Release Candidate Verification Report

## Verification context

- Branch expected for verification: `main`
- Latest expected completed PR: PR #48
- Purpose: verify the UI modernization pass across auth, student, lecturer, and admin dashboard shell
- This report is docs-only and does not change runtime behavior.
- This report records expected verification commands, not verification results.

## Implemented Figma UI scope

Auth:

- AUTH-01 Login screen

Student:

- STUD-01 Student Dashboard
- STUD-02 Submit Topic
- STUD-03 My Submissions
- STUD-04 Check My Topic
- STUD-05 Research Explorer
- Student Figma flow smoke checklist

Lecturer:

- LECT-01 Lecturer Dashboard
- LECT-02 Pending Reviews
- LECT-03 Submission Detail
- Lecturer standalone Check Similarity
- Lecturer Figma flow smoke checklist

Admin:

- ADMIN-01 Admin Dashboard shell
- Admin Figma flow smoke checklist

Foundation:

- Shared frontend foundation components
- Dashboard layouts
- Form/input/button/callout/table/state primitives
- Tokenized styling in `frontend/src/index.css`

## Safety guarantees preserved

- No backend behavior changed by the Figma UI pass.
- No Prisma schema or migrations added by the Figma UI pass.
- No API behavior changed by the Figma UI pass.
- No auth/protected route behavior changed.
- Student visibility remains student-owned.
- Lecturer decisions remain lecturer-controlled.
- Similarity evidence remains advisory.
- Similarity thresholds/scoring/ranking unchanged.
- Snapshots remain existing evidence behavior only.
- No fake metrics are presented as real.
- No fake admin health/reporting/audit data is presented as live.
- Research Explorer remains an honest shell until a safe topic repository endpoint exists.
- Admin Dashboard remains an honest shell until a safe admin metrics endpoint exists.

## Verification documents created

- `docs/testing/student-figma-flow-smoke-checklist.md`
- `docs/testing/lecturer-figma-flow-smoke-checklist.md`
- `docs/testing/admin-figma-flow-smoke-checklist.md`

## Required automated verification commands

Frontend build:

```powershell
cd frontend
npm run build
```

Targeted Figma UI tests:

```powershell
cd frontend
npm test -- --run tests/FoundationPrimitives.test.jsx tests/LoginPage.test.jsx tests/StudentDashboardPage.test.jsx tests/SubmitTopicPage.test.jsx tests/MySubmissionsPage.test.jsx tests/CheckMyTopicPage.test.jsx tests/ResearchExplorerPage.test.jsx tests/LecturerDashboardPage.test.jsx tests/LecturerPendingReviewsPage.test.jsx tests/LecturerSubmissionDetailPage.test.jsx tests/LecturerCheckSimilarityPage.test.jsx tests/AdminDashboardPage.test.jsx tests/TopicForm.test.jsx tests/ResultsDisplay.test.jsx
```

## Optional backend sanity verification

This verification is optional because this PR is docs-only and the Figma UI pass should not have changed backend behavior.

```powershell
cd backend
npx prisma validate
npx prisma generate
npx jest src/services/submission.service.test.js src/controllers/submission.controller.test.js src/services/similaritySnapshot.service.test.js src/controllers/lecturerSimilarity.controller.test.js src/server.test.js --runInBand
```

## Manual browser smoke areas

Manual browser smoke testing should cover:

- Login
- Student flow
- Lecturer flow
- Admin dashboard shell

Use these smoke checklists:

- `docs/testing/student-figma-flow-smoke-checklist.md`
- `docs/testing/lecturer-figma-flow-smoke-checklist.md`
- `docs/testing/admin-figma-flow-smoke-checklist.md`

## Known caveat

- The full frontend suite may still have the stale `tests/e2e/userFlow.test.jsx` Router-context issue unless fixed separately.
- This caveat should not block targeted Figma UI release-candidate verification unless a touched page causes a new failure.

## Known limitations / deferred work

- Admin user management not implemented.
- Admin reports not implemented.
- Admin audit logs not implemented.
- Admin import/export not implemented.
- Admin live health metrics not implemented.
- Student Research Explorer has no real repository browsing yet.
- No topic repository lifecycle write from approved topics yet.
- No email workflow.
- No full audit trail.
- No advanced analytics/recommendations.
- No fake data should be introduced to simulate these.

## Release-candidate statement

The Figma UI release candidate is ready for targeted automated verification and manual browser smoke testing, subject to successful frontend build, targeted frontend tests, and manual checklist execution.
