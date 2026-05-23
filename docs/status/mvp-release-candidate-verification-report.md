# MVP Release Candidate Verification Report

## Current MVP Scope

The current MVP release candidate includes these implemented workflow areas:

- authentication foundation
- student topic submission
- student my submissions
- lecturer pending review queue
- lecturer submission detail page
- lecturer basic decision actions
- lecturer similarity pre-check
- lecturer similarity wrapper endpoint/frontend integration
- demo comparison topics
- similarity snapshot storage
- similarity snapshot read endpoint
- similarity snapshot history UI
- lecturer decision rationale
- student decision feedback display
- workflow verification index

## Current Safety Guarantees

- Authentication uses httpOnly cookie auth.
- Routes are role-protected for student, lecturer, and admin areas.
- Student submission access is scoped to the authenticated student's own submissions.
- Lecturer review and decision actions are lecturer-only.
- Similarity evidence remains advisory.
- Similarity checks do not auto-approve or auto-reject submissions.
- Lecturer decision rationale is human-provided.
- Student feedback exposes only safe fields.
- Student feedback does not expose lecturer identity.
- Student feedback does not expose similarity snapshots or similarity summaries.
- Snapshot history is stored evidence, not a final decision.
- No email workflow is currently triggered.
- No reporting workflow is currently triggered.
- No audit workflow is currently triggered.
- No lifecycle topic repository writes occur from the decision flow.

## Core Similarity Configuration

The current protected similarity configuration is documented here for release-candidate verification. This report does not change these values.

| Component | Value |
|---|---:|
| Jaccard weight | `0.2` |
| TF-IDF cosine weight | `0.3` |
| SBERT weight | `0.5` |
| LOW risk | `< 0.40` |
| MEDIUM risk | `0.40-0.69` |
| HIGH risk | `>= 0.70` |

## Verification Commands

Backend:

```powershell
cd backend
npx prisma migrate status
npx prisma validate
npx prisma generate
npx jest src/services/submission.service.test.js src/controllers/submission.controller.test.js src/services/similaritySnapshot.service.test.js src/controllers/lecturerSimilarity.controller.test.js src/server.test.js --runInBand
```

Frontend:

```powershell
cd frontend
npm run build
```

Do not use `prisma db push` for release-candidate verification. If Prisma reports drift, stop and do not reset the database automatically.

## Manual Verification Areas

Run the workflow smoke checklists from `docs/testing/mvp-workflow-verification-index.md`, especially:

- auth smoke
- student submission smoke
- lecturer queue/detail smoke
- similarity pre-check smoke
- snapshot storage/read/history smoke
- lecturer decision rationale smoke
- student decision feedback smoke

## Known Limitations / Future Work

- No admin reporting dashboard yet.
- No full audit trail model yet.
- No email notifications yet.
- No student detail page yet.
- No supervisor assignment workflow yet.
- No lifecycle write from approved topics into historical/current repositories yet.
- Similarity scores may vary depending on SBERT service/runtime.
- Synthetic demo data is used for controlled evaluation.

## Research/Defense Value

This MVP supports Design Science Research evaluation because the implemented artefact is paired with repeatable verification evidence.

The documented smoke checklists show that the system is verifiable across authentication, submission, lecturer review, similarity evidence, snapshot evidence, lecturer rationale, and student feedback workflows.

The tool supports lecturer decision-making rather than replacing lecturers. Similarity analysis and stored snapshots provide decision-support evidence; final approval, rejection, or revision remains a human academic decision.

Stored similarity evidence and lecturer rationale improve transparency. Student feedback improves communication after a human decision has been made.

## Release Candidate Statement

This MVP release candidate is ready for full workflow smoke testing, subject to environment setup, database migration status, seeded demo data, and successful backend/frontend verification commands.
