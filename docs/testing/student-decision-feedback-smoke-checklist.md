# Student Decision Feedback Smoke Checklist

## Purpose

Use this checklist to verify the student decision feedback display added in PR #27.

This smoke test confirms:

- students can see lecturer decision feedback for their own submissions
- students see only safe feedback fields
- lecturer identity is not exposed to students in this PR
- similarity snapshots, history, and result internals are not exposed to students
- the DSS remains decision-support; the lecturer still makes the final decision

## Prerequisites

- Backend is running on the local backend port, normally `3000`
- Frontend is running on port `5173`
- The development database has committed migrations applied
- Prisma Client has been generated
- Demo student and lecturer accounts are available
- At least one student submission has a lecturer decision

Recommended setup:

```powershell
cd backend
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed:auth-demo
```

Demo users:

```text
student.demo@uniosun.edu.ng
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Do not run `prisma db push`.

If Prisma reports drift, stop and do not reset the database automatically.

## Automated Verification

From `backend/`, run:

```powershell
npx prisma validate
npx prisma generate
npx jest src/services/submission.service.test.js src/controllers/submission.controller.test.js src/server.test.js --runInBand
```

From `frontend/`, run:

```powershell
npm run build
```

Expected result:

- Prisma schema validates
- Prisma Client generates
- targeted submission/controller/server tests pass
- frontend build passes

## Manual Browser Smoke

Use the student demo account:

```text
student.demo@uniosun.edu.ng
DemoPass123
```

Steps:

1. Start the backend.
2. Start the frontend.
3. Log in as the student demo user.
4. Open `/student/my-submissions`.
5. Confirm submission status badges still display.
6. Confirm a rejected submission shows a `Lecturer feedback` panel.
7. Confirm an `awaiting_revision` submission shows `Lecturer feedback` if a rationale was provided.
8. Confirm an approved submission with no rationale shows:

```text
No additional comment was provided.
```

9. Confirm a `pending_review` submission does not show fake decision feedback.
10. Confirm a decision date appears if `decided_at` is available.
11. Confirm no lecturer id appears.
12. Confirm no lecturer name appears.
13. Confirm no similarity snapshot, similarity history, similarity tier details, or similarity result summary appears.

Expected result:

- feedback is visible only where a lecturer decision exists
- pending submissions remain clearly awaiting lecturer review
- the UI does not imply that AI or the system made the decision

## Manual API Smoke

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root:

```powershell
$backendUrl = "http://localhost:3000"
$studentCookieJar = "C:\tmp\rtadss-student-cookie.txt"
```

Log in as the student:

```powershell
curl.exe -i -c $studentCookieJar -H "Content-Type: application/json" -d "{\"email\":\"student.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

List the authenticated student's submissions:

```powershell
curl.exe -i -b $studentCookieJar "$backendUrl/api/v1/submissions"
```

Expected result:

- response status is `200`
- response returns only the authenticated student's submissions
- decided submissions may include:
  - `decision_reason`
  - `decided_at`
- response does not include:
  - `decided_by_id`
  - `decided_by_name`
  - `similarity_snapshots`
  - `similarityCheckSnapshots`
  - `result_summary`
  - similarity tier arrays or top matches

Log out:

```powershell
curl.exe -i -b $studentCookieJar -c $studentCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

## Access-Control Checks

Unauthenticated request:

```powershell
curl.exe -i "$backendUrl/api/v1/submissions"
```

Expected result:

- request is rejected as unauthenticated

Lecturer/admin route misuse:

- Log in as `lecturer.demo@uniosun.edu.ng`
- Call `GET /api/v1/submissions`
- Expected result: request is rejected because the route is student-only

- Log in as `admin.demo@uniosun.edu.ng`
- Call `GET /api/v1/submissions`
- Expected result: request is rejected because the route is student-only

Student data boundary:

- If multiple student accounts exist, create submissions for both.
- Log in as one student.
- Call `GET /api/v1/submissions`.
- Confirm only that student's submissions and feedback are returned.

## Safety Expectations

- Feedback is lecturer-provided.
- The system does not claim AI made the decision.
- Similarity evidence remains separate from student feedback display.
- Decision feedback display does not mutate `Submission.status`.
- No email workflow is triggered.
- No report workflow is triggered.
- No audit workflow is triggered.
- No lifecycle/topic repository write is triggered.
- No similarity snapshot record is created by viewing student feedback.

## Warnings

- Do not use `prisma db push`.
- If Prisma drift appears, stop and do not reset automatically.
- Do not expose similarity snapshot internals in the student UI.
- Do not expose lecturer id/name to students in this PR.

## Research And Defense Note

Student feedback improves transparency after a human lecturer decision. The DSS supports decision-making by organizing evidence and workflow state, but it does not replace the lecturer's academic judgment.
