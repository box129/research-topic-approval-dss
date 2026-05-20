# Lecturer Decision Smoke Checklist

Use this checklist to verify the lecturer decision foundation locally before adding similarity integration, decision notes, lifecycle table writes, detail pages, supervisor assignment, notifications, or reporting work.

This smoke run writes student submissions and updates their statuses in the configured development database. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

## 1. Environment Variables

From `backend/`, confirm `.env` includes local development values:

```text
DATABASE_URL=...
JWT_SECRET=local-development-secret
FRONTEND_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
```

Use the backend port shown in the backend console as the source of truth. The expected local setup uses backend port `3000` and frontend port `5173`.

## 2. Migration Application

From `backend/`, apply the already committed Prisma migrations:

```powershell
npm run prisma:migrate
```

Do not use `prisma db push` for v1 schema work. If Prisma reports drift because the database was previously created with `db push`, stop. Use a fresh development database or ask before resetting.

## 3. Prisma Generate

From `backend/`:

```powershell
npm run prisma:generate
```

## 4. Auth Demo Seed

From `backend/`:

```powershell
npm run prisma:seed:auth-demo
```

This creates local-only demo users:

- `admin.demo@uniosun.edu.ng`
- `lecturer.demo@uniosun.edu.ng`
- `student.demo@uniosun.edu.ng`

Shared local-only password:

```text
DemoPass123
```

These accounts are unsafe for production.

## 5. Backend Startup

From `backend/`:

```powershell
npm run dev
```

Confirm the backend is available:

```powershell
$backendUrl = "http://localhost:3000"
Invoke-RestMethod "$backendUrl/health"
```

## 6. Frontend Startup

From `frontend/`:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

## 7. Browser Smoke: Approve A Submission

Log in with:

```text
student.demo@uniosun.edu.ng
DemoPass123
```

Open:

```text
http://localhost:5173/student/submit-topic
```

Create a valid pending submission.

Example:

```text
Factors influencing malaria prevention practices among undergraduate students in Osogbo
```

Log out, then log in with:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Click `Approve` on the pending row and confirm.

Expected result:

- The update succeeds.
- The approved row disappears from the pending queue.
- No similarity check runs.
- No decision notes, audit trail, email, or lifecycle topic write is created.

Log out, log back in as the student, and open:

```text
http://localhost:5173/student/my-submissions
```

Expected result:

- The submission shows `approved` status.

## 8. Browser Smoke: Reject A Submission

Create another pending submission as the student.

Log in as the lecturer and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Click `Reject` on the pending row and confirm.

Expected result:

- The update succeeds.
- The rejected row disappears from the pending queue.
- The student sees `rejected` status in `/student/my-submissions`.

## 9. Browser Smoke: Request Revision

Create another pending submission as the student.

Log in as the lecturer and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Click `Request Revision` on the pending row and confirm.

Expected result:

- The update succeeds.
- The row disappears from the pending queue.
- The student sees `awaiting revision` status in `/student/my-submissions`.

## 10. Protected And Cross-Role Route Checks

Log out and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The UI redirects to `/login`.

Log in as the student demo user and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The UI redirects back to the student area.

Log in as the admin demo user and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The UI redirects back to the admin area.

## 11. Backend API Smoke Setup

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root:

```powershell
$backendUrl = "http://localhost:3000"
$studentCookieJar = "C:\tmp\rtadss-student-cookie.txt"
$lecturerCookieJar = "C:\tmp\rtadss-lecturer-cookie.txt"
$adminCookieJar = "C:\tmp\rtadss-admin-cookie.txt"
```

Log in as the student demo user:

```powershell
curl.exe -i -c $studentCookieJar -H "Content-Type: application/json" -d "{\"email\":\"student.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

Create a pending submission:

```powershell
curl.exe -i -b $studentCookieJar -H "Content-Type: application/json" -d "{\"title\":\"Factors influencing malaria prevention practices among undergraduate students in Osogbo\",\"category\":\"Public Health\",\"keywords\":\"malaria, prevention, undergraduate students, Osogbo\"}" "$backendUrl/api/v1/submissions"
```

Record the returned submission `id`:

```powershell
$submissionId = 1
```

Log in as the lecturer demo user:

```powershell
curl.exe -i -c $lecturerCookieJar -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

List the lecturer queue:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

## 12. API Smoke: Approve

Approve the pending submission:

```powershell
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"approved\"}" "$backendUrl/api/v1/lecturer/submissions/$submissionId/status"
```

Expected result:

- Response status is `200`.
- Response body contains the updated submission with `status: "approved"`.

List the lecturer queue again:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

Expected result:

- The approved submission no longer appears because the queue shows only pending review submissions.

List the student's submissions:

```powershell
curl.exe -i -b $studentCookieJar "$backendUrl/api/v1/submissions"
```

Expected result:

- The student's submission appears with `status: "approved"`.

## 13. API Smoke: Reject And Awaiting Revision

Create a second pending submission as the student, record its id, then reject it:

```powershell
$rejectedSubmissionId = 2
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"rejected\"}" "$backendUrl/api/v1/lecturer/submissions/$rejectedSubmissionId/status"
```

Expected result:

- Response status is `200`.
- Response body contains `status: "rejected"`.

Create a third pending submission as the student, record its id, then request revision:

```powershell
$revisionSubmissionId = 3
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"awaiting_revision\"}" "$backendUrl/api/v1/lecturer/submissions/$revisionSubmissionId/status"
```

Expected result:

- Response status is `200`.
- Response body contains `status: "awaiting_revision"`.

## 14. API Rejection Checks

Try to update the approved submission again:

```powershell
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"rejected\"}" "$backendUrl/api/v1/lecturer/submissions/$submissionId/status"
```

Expected result:

- The request is rejected because non-pending submissions cannot be updated again.

Try an invalid status on a new pending submission:

```powershell
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"pending_review\"}" "$backendUrl/api/v1/lecturer/submissions/$revisionSubmissionId/status"
```

Expected result:

- The request is rejected with an invalid status error.

Try without a cookie:

```powershell
curl.exe -i -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"approved\"}" "$backendUrl/api/v1/lecturer/submissions/$revisionSubmissionId/status"
```

Expected result:

- The request is rejected as unauthenticated.

Try with a student cookie:

```powershell
curl.exe -i -b $studentCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"approved\"}" "$backendUrl/api/v1/lecturer/submissions/$revisionSubmissionId/status"
```

Expected result:

- The request is rejected because student users do not have the lecturer role.

Try with an admin cookie:

```powershell
curl.exe -i -c $adminCookieJar -H "Content-Type: application/json" -d "{\"email\":\"admin.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
curl.exe -i -b $adminCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"approved\"}" "$backendUrl/api/v1/lecturer/submissions/$revisionSubmissionId/status"
```

Expected result:

- The request is rejected because admin users do not have the lecturer role for this endpoint.

## 15. Logout

Log out student, lecturer, and admin sessions:

```powershell
curl.exe -i -b $studentCookieJar -c $studentCookieJar -X POST "$backendUrl/api/v1/auth/logout"
curl.exe -i -b $lecturerCookieJar -c $lecturerCookieJar -X POST "$backendUrl/api/v1/auth/logout"
curl.exe -i -b $adminCookieJar -c $adminCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Expected result:

- Each logout returns `200` and clears its cookie-backed session.

## 16. Scope Guardrails

During this smoke test, confirm no PR #9 work changes or depends on:

- similarity integration
- similarity scoring or thresholds
- Jaccard, TF-IDF, SBERT, or context scoring
- `CurrentSessionTopic`, `UnderReviewTopic`, or `HistoricalTopic` writes
- decision notes
- lecturer audit trail
- supervisor assignment
- admin reports
- email notifications or real email providers
- Prisma schema or migration changes
