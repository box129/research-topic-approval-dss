# Lecturer Decision Rationale Smoke Checklist

## Purpose

Use this checklist to verify the lecturer decision rationale workflow added in PR #25.

This smoke test confirms:

- lecturers can provide a rationale when making a decision
- rejection requires a non-blank rationale
- approve and request revision still allow an optional rationale
- the final decision remains human-controlled
- similarity evidence does not approve, reject, request revision, or pre-fill a decision reason

## Prerequisites

- Backend is running on the local backend port, normally `3000`
- Frontend is running on port `5173`
- The development database has committed migrations applied
- Prisma Client has been generated
- Auth demo users are seeded
- At least one `pending_review` submission exists

Recommended setup:

```powershell
cd backend
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed:auth-demo
```

Use a fresh or disposable development database where possible. Do not use `prisma db push`.

If Prisma reports drift, stop and do not reset the database automatically.

## Automated Verification

From `backend/`, check migration state and Prisma:

```powershell
npx prisma migrate status
npx prisma validate
npx prisma generate
```

Run targeted backend tests:

```powershell
npx jest src/services/submission.service.test.js src/controllers/submission.controller.test.js src/server.test.js --runInBand
```

From `frontend/`, run the production build:

```powershell
npm run build
```

Expected result:

- migrations are applied
- Prisma schema validates
- Prisma Client generates
- targeted submission/controller/server tests pass
- frontend build passes

## Manual Browser Smoke

Use the lecturer demo account:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Steps:

1. Start the backend.
2. Start the frontend.
3. Log in as the lecturer demo user.
4. Open `/lecturer/pending-reviews`.
5. Confirm the pending queue does not allow quick `Reject` without opening the detail page.
6. Open a pending submission detail page.
7. Confirm the `Basic Decision` section contains a `Decision rationale / comment` textarea.
8. Click `Reject` without entering a rationale.
9. Confirm the frontend blocks the action and shows a validation message.
10. Enter a rationale, for example:

```text
Topic is too similar to an existing approved topic.
```

11. Click `Reject` again and confirm the action.
12. Confirm the status changes to `rejected`.
13. Confirm the stored lecturer rationale appears on the lecturer detail page.
14. Create or use another `pending_review` submission.
15. Approve it without a rationale.
16. Confirm approval still works.
17. Create or use another `pending_review` submission.
18. Request revision with or without a rationale.
19. Confirm request revision still works.
20. Confirm the similarity pre-check and similarity history sections remain separate from the decision action.

Expected result:

- rejection is blocked until a rationale is provided
- approve works without a rationale
- request revision works without a rationale
- the rationale is lecturer-provided, not generated from similarity results
- similarity risk/history does not force any decision

## Manual API Smoke

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root:

```powershell
$backendUrl = "http://localhost:3000"
$lecturerCookieJar = "C:\tmp\rtadss-lecturer-cookie.txt"
$submissionId = "SUBMISSION_ID"
```

Log in as the lecturer:

```powershell
curl.exe -i -c $lecturerCookieJar -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

Reject without a reason:

```powershell
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"rejected\"}" "$backendUrl/api/v1/lecturer/submissions/$submissionId/status"
```

Expected result:

- request fails
- response explains that decision rationale is required for rejection

Reject with a reason:

```powershell
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"rejected\",\"reason\":\"Topic is too similar to an existing approved topic.\"}" "$backendUrl/api/v1/lecturer/submissions/$submissionId/status"
```

Expected result:

- request succeeds
- response includes `status: "rejected"`
- response includes decision fields:
  - `decision_reason`
  - `decided_by_id`
  - `decided_by_name` if available
  - `decided_at`

For a different pending submission, approve without a reason:

```powershell
$approvedSubmissionId = "ANOTHER_SUBMISSION_ID"
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"approved\"}" "$backendUrl/api/v1/lecturer/submissions/$approvedSubmissionId/status"
```

Expected result:

- request succeeds
- response includes `status: "approved"`
- decision metadata is stored

For another pending submission, request revision without a reason:

```powershell
$revisionSubmissionId = "THIRD_SUBMISSION_ID"
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"awaiting_revision\"}" "$backendUrl/api/v1/lecturer/submissions/$revisionSubmissionId/status"
```

Expected result:

- request succeeds
- response includes `status: "awaiting_revision"`
- decision metadata is stored

Log out:

```powershell
curl.exe -i -b $lecturerCookieJar -c $lecturerCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

## Database Verification

Check the updated submission row:

```sql
SELECT id, status, decision_reason, decided_by_id, decided_at
FROM submissions
WHERE id = SUBMISSION_ID;
```

Expected result:

- `decision_reason` is stored for rejected submissions
- `decided_by_id` is set to the lecturer user id
- `decided_at` is set

Confirm the decision flow did not write to topic repository or lifecycle tables:

```sql
SELECT COUNT(*) FROM historical_topics;
SELECT COUNT(*) FROM current_session_topics;
SELECT COUNT(*) FROM under_review_topics;
```

Use before/after counts if you need strict proof for a smoke run.

Expected result:

- decision actions update only the `submissions` decision/status fields
- no `historical_topics`, `current_session_topics`, or `under_review_topics` row is created by the decision action

## Expected Safety Behavior

- Similarity risk does not auto-approve or auto-reject.
- Similarity history does not mutate `Submission.status`.
- Decision rationale is lecturer-provided, not AI-generated.
- Student-facing UI does not display rationale yet.
- No email, report, audit workflow, or supervisor assignment is triggered.
- No similarity snapshot is created by decision action alone.
- Non-pending submissions reject further status updates.

## Warnings

- Do not use `prisma db push`.
- If Prisma drift appears, stop and do not reset automatically.
- Use `pending_review` submissions for status-change smoke tests.
- Reusing a submission that is already approved, rejected, or awaiting revision should fail by design.

## Research And Defense Note

Decision rationale supports transparency and accountability in the decision-support workflow. Similarity evidence can assist the lecturer, but final approval, rejection, or revision remains a human decision.
