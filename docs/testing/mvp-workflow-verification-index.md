# MVP Workflow Verification Index

## Purpose

This index maps completed MVP workflow areas to the smoke checklists that verify them. Use it as the master starting point before demos, supervisor reviews, defense preparation, or any larger regression pass.

The goal is traceability: each workflow objective should point to a repeatable verification document and a clear safety risk that the checklist controls.

## Workflow Verification Map

| Workflow | Related PR | Verification document | What the checklist proves | Risk controlled |
|---|---:|---|---|---|
| Auth foundation | #3 | `docs/testing/auth-smoke-checklist.md` | Cookie-backed login, logout, `/me`, protected routes, role redirects, forgot/reset password mock flow, and similarity route protection still work locally. | Broken auth/session setup, unsafe token handling, role leakage, or route access regressions. |
| Student submission | #5 | `docs/testing/student-submission-smoke-checklist.md` | Authenticated students can create and list their own submissions; non-students and unauthenticated users are rejected. | Students losing submission access, cross-role access mistakes, or accidental submission endpoint breakage. |
| Lecturer submission queue | #7 | `docs/testing/lecturer-queue-smoke-checklist.md` | Lecturers can view `PENDING_REVIEW` submissions with student/topic metadata, and student/admin users cannot access the queue. | Lecturer queue authorization errors, missing pending submissions, or unintended approve/reject controls. |
| Lecturer decision foundation | #9 | `docs/testing/lecturer-decision-smoke-checklist.md` | Lecturers can approve, reject, or request revision from pending submissions, and non-pending submissions cannot be updated again. | Unauthorized decision actions, repeated status changes, or accidental workflow expansion. |
| Lecturer submission detail page | #11 | `docs/testing/lecturer-detail-smoke-checklist.md` | Lecturers can open one submission detail page, view full read-only details, and use existing decision actions from the detail context. | Detail route regressions, missing submission metadata, or decision actions drifting from the queue behavior. |
| Lecturer similarity pre-check | #13 | `docs/testing/lecturer-similarity-precheck-smoke-checklist.md` | Lecturers can run a similarity pre-check from the detail page, see temporary results, and confirm status remains unchanged. | Similarity evidence accidentally mutating decisions, auto-approval, or auto-rejection. |
| Lecturer similarity wrapper/frontend integration | #16 | `docs/testing/wrapper-similarity-frontend-smoke-checklist.md` | The lecturer detail page calls the protected wrapper endpoint instead of the old public similarity endpoint. | Frontend bypassing lecturer authorization or sending topic text manually instead of relying on server-side submission lookup. |
| Demo comparison topics | #18 | `docs/testing/demo-similarity-cases.md` | Controlled demo/evaluation cases show expected risk and tier patterns using demo comparison topics. | Empty comparison tables causing unconvincing demos, overclaiming exact scores, or confusing demo rows with real institutional records. |
| Similarity snapshot storage | #20 | `docs/testing/similarity-snapshot-storage-smoke-checklist.md` | Lecturer wrapper similarity checks create lightweight stored evidence without changing submission status. | Losing evidence of checks, storing too much raw data, or letting snapshot persistence block the lecturer workflow. |
| Similarity snapshot read endpoint | #22 | `docs/testing/similarity-snapshot-read-smoke-checklist.md` | Lecturers can read stored snapshots for a submission, newest first, without creating new snapshots or changing status. | Read endpoints accidentally rerunning similarity, creating evidence, or exposing snapshot history incorrectly. |
| Similarity snapshot history UI | #24 | `docs/testing/similarity-snapshot-history-ui-smoke-checklist.md` | Lecturer detail UI displays saved snapshot history below the live pre-check and above Basic Decision. | UI mixing evidence with final decision, hiding prior checks, or triggering checks during history reads. |
| Lecturer decision rationale | #26 | `docs/testing/lecturer-decision-rationale-smoke-checklist.md` | Lecturers can store human-provided decision rationale; rejection requires a rationale; similarity evidence does not auto-decide. | Decisions without accountability, auto-generated rationale confusion, or lifecycle/topic table writes from decision actions. |
| Student decision feedback | #28 | `docs/testing/student-decision-feedback-smoke-checklist.md` | Students can see safe lecturer feedback for their own submissions only, without lecturer identity or similarity internals. | Exposing other students' data, lecturer identity, similarity snapshots, or fake feedback on pending submissions. |

## Core Safety Guarantees Covered

- Auth and role protection are verified across browser and API paths.
- Student-owned submission access is limited to the authenticated student.
- Lecturer-only queue, detail, similarity, and decision actions remain protected.
- Similarity evidence remains advisory.
- Similarity checks do not auto-approve or auto-reject submissions.
- Decision rationale is human-provided by the lecturer.
- Student feedback does not expose lecturer identity.
- Student feedback does not expose similarity snapshots or similarity summaries.
- Snapshot history is saved evidence, not a final decision.
- Prisma migration discipline is part of smoke verification.
- Checklists repeatedly warn: do not use `prisma db push`, and do not automatically reset a database if Prisma drift appears.

## Recommended Full MVP Verification Order

1. Run Prisma migration status, validation, and generate checks.
2. Run targeted backend Jest suites for the workflow area being verified.
3. Run the frontend build.
4. Run the auth smoke checklist.
5. Run the student submission smoke checklist.
6. Run lecturer queue and lecturer detail smoke checklists.
7. Run lecturer similarity pre-check smoke checklist.
8. Run snapshot storage, snapshot read, and snapshot history UI smoke checklists.
9. Run lecturer decision rationale smoke checklist.
10. Run student decision feedback smoke checklist.

Recommended command baseline:

```powershell
cd backend
npx prisma migrate status
npx prisma validate
npx prisma generate
npx jest src/services/submission.service.test.js src/controllers/submission.controller.test.js src/controllers/lecturerSimilarity.controller.test.js src/services/similaritySnapshot.service.test.js src/server.test.js --runInBand
```

```powershell
cd frontend
npm run build
```

If Prisma reports drift, stop and do not reset the database automatically.

## Research/Defense Value

This index demonstrates that the artefact is not only implemented but verifiable. It supports Design Science Research evaluation by connecting workflow objectives to repeatable test evidence.

The checklists also show traceability from user workflow to system behavior: authentication, submission, lecturer review, similarity evidence, snapshot evidence, decision rationale, and student feedback each have a documented verification path.

Together, these verification assets reinforce the project as a decision-support system, not an automated approval system. Similarity analysis and stored evidence assist the lecturer, while final approval, rejection, or revision remains a human academic decision.
