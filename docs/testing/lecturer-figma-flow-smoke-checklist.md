# Lecturer Figma Flow Smoke Checklist

Use this checklist to verify the completed lecturer-facing Figma flow after PR #45. This is a manual smoke checklist for the frontend presentation work only.

## Purpose and scope

This smoke run verifies:

- LECT-01 Lecturer Dashboard
- LECT-02 Pending Reviews
- LECT-03 Submission Detail
- Lecturer standalone Check Similarity

This checklist does not require backend, Prisma, migration, API, similarity, snapshot, or decision workflow changes.

## Preconditions

- The frontend is running locally.
- The backend is running if you are verifying real lecturer login, pending reviews, decisions, or similarity API behavior.
- A lecturer test user exists.
- Pending-review submissions exist if queue and detail states are being checked manually.
- Use a disposable development environment for any manual action that records lecturer decisions.
- Confirm the current branch includes PR #34 through PR #45 lecturer Figma UI work.

## Manual browser smoke checklist

### A. Lecturer Dashboard / LECT-01

- [ ] `/lecturer/dashboard` renders.
- [ ] Pending-review data loads from the existing API.
- [ ] Unavailable analytics, risk, and workload metrics are clearly marked as not available.
- [ ] No fake high-risk counts appear.
- [ ] No fake activity appears.
- [ ] No fake workload or trend analytics appear.

### B. Pending Reviews / LECT-02

- [ ] `/lecturer/pending-reviews` renders.
- [ ] Existing pending-review queue loads.
- [ ] Search works client-side only.
- [ ] Category filter works client-side only.
- [ ] Oldest/newest sort works client-side only.
- [ ] Detail links go to `/lecturer/pending-reviews/:id`.
- [ ] Queue is read-only.
- [ ] No approve, reject, or request-revision actions appear in the queue.
- [ ] No fake risk scores appear.
- [ ] No fake assignment appears.
- [ ] No fake pagination appears.
- [ ] No fake activity appears.

### C. Submission Detail / LECT-03

- [ ] `/lecturer/pending-reviews/:topicId` renders.
- [ ] Back link to `/lecturer/pending-reviews` works.
- [ ] Submission metadata displays.
- [ ] Similarity check remains advisory.
- [ ] Snapshot history loading state works.
- [ ] Snapshot history empty state works.
- [ ] Snapshot history error state works.
- [ ] Snapshot history populated state works.
- [ ] Lecturer rationale behavior works.
- [ ] ConfirmActionModal appears before approve, request revision, and reject.
- [ ] Decisions remain lecturer-controlled.
- [ ] No lifecycle topic repository write is triggered.
- [ ] No email workflow is triggered.
- [ ] No audit/report workflow is triggered.

### D. Check Similarity

- [ ] `/lecturer/check-similarity` renders.
- [ ] Standalone advisory checker language appears.
- [ ] `POST /api/similarity/check` behavior is used.
- [ ] Payload remains `{ topic, keywords, category }`.
- [ ] Results render through `ResultsDisplay`.
- [ ] No snapshots are created.
- [ ] No submissions are mutated.
- [ ] No approval/rejection UI appears.
- [ ] No risk-based blocking appears.

## Verification commands

```bash
cd frontend
npm run build
```

Run the targeted lecturer/frontend tests:

```bash
cd frontend
npm test -- --run tests/LecturerDashboardPage.test.jsx tests/LecturerPendingReviewsPage.test.jsx tests/LecturerSubmissionDetailPage.test.jsx tests/LecturerCheckSimilarityPage.test.jsx tests/FoundationPrimitives.test.jsx tests/TopicForm.test.jsx tests/ResultsDisplay.test.jsx
```

Optional confidence run:

```bash
cd frontend
npm test -- --run tests/LoginPage.test.jsx tests/StudentDashboardPage.test.jsx tests/SubmitTopicPage.test.jsx tests/MySubmissionsPage.test.jsx tests/CheckMyTopicPage.test.jsx tests/ResearchExplorerPage.test.jsx
```

## Known caveat

- The full frontend suite may still have the stale `tests/e2e/userFlow.test.jsx` Router-context issue unless fixed separately.

## Safety expectations

- No backend/API behavior changed by the lecturer Figma UI work.
- No similarity thresholds changed.
- No similarity scoring changed.
- No ranking changed.
- No queue-level decisions.
- Decisions remain on the detail page.
- Similarity evidence remains advisory.
- Snapshots are only created by existing detail-page similarity-check behavior.
- No fake analytics, risk, or activity data is presented as real.
- No student/admin data exposure is introduced.
