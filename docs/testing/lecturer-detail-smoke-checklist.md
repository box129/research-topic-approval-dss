# Lecturer Detail Smoke Checklist

Use this checklist to verify the lecturer submission detail page and detail endpoint locally before adding similarity integration, decision notes, lifecycle table writes, supervisor assignment, notifications, reports, or richer review screens.

This smoke run reads student submissions and may update their statuses in the configured development database. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

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

## 7. Prepare A Pending Submission

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

Optional category:

```text
Public Health
```

Optional keywords:

```text
malaria, prevention, undergraduate students, Osogbo
```

Expected result:

- Submission succeeds.
- The topic is saved with `PENDING_REVIEW` status.
- The topic appears on `/student/my-submissions`.

Log out before testing lecturer access.

## 8. Lecturer Login

Log in with:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Expected result:

- Login succeeds.
- The backend sets the `rtadss_session` httpOnly cookie.
- The UI routes to `/lecturer/dashboard`.

## 9. Open Detail Page From Queue

Open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Click the submission title or `View Details`.

Expected result:

- The browser navigates to `/lecturer/pending-reviews/:id`.
- The detail page loads one submission.
- The page shows:
  - title
  - student name
  - student email
  - category
  - keywords
  - status
  - submitted date
  - session name if available
- A `Back to Pending Reviews` link is available.
- No similarity result appears.

## 10. Make A Decision From Detail Page

On the detail page, click one action:

- `Approve`
- `Request Revision`
- `Reject`

Confirm the browser prompt.

Expected result:

- The update succeeds.
- The detail page refreshes the displayed status.
- Action buttons become disabled because the submission is no longer `pending_review`.
- No notes, reasons, email, audit trail, similarity result, or lifecycle table write is created.

Return to:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The updated submission no longer appears in the pending queue.

Log out and log back in as the student.

Open:

```text
http://localhost:5173/student/my-submissions
```

Expected result:

- The student sees the updated status.

## 11. Backend API Smoke Setup

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root:

```powershell
$backendUrl = "http://localhost:3000"
$studentCookieJar = "C:\tmp\rtadss-student-cookie.txt"
$lecturerCookieJar = "C:\tmp\rtadss-lecturer-cookie.txt"
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

## 12. API Smoke: Lecturer Queue And Detail

List the lecturer queue:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

Expected result:

- Response status is `200`.
- The pending submission appears in the queue.

Fetch one lecturer submission detail:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions/$submissionId"
```

Expected result:

- Response status is `200`.
- Response body contains one submission.
- Response body includes title, student name/email, category, keywords, status, submitted date, and session name if available.

## 13. API Smoke: Decision From Detail Context

Approve, reject, or request revision using the existing status endpoint.

Approve example:

```powershell
curl.exe -i -b $lecturerCookieJar -H "Content-Type: application/json" -X PATCH -d "{\"status\":\"approved\"}" "$backendUrl/api/v1/lecturer/submissions/$submissionId/status"
```

Other accepted statuses:

```text
rejected
awaiting_revision
```

Expected result:

- Response status is `200`.
- Response body contains the updated submission status.

Fetch the detail again:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions/$submissionId"
```

Expected result:

- Response status is `200`.
- The updated status is visible.

List the lecturer queue again:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

Expected result:

- The updated submission no longer appears because the queue shows only pending review submissions.

List the student's submissions:

```powershell
curl.exe -i -b $studentCookieJar "$backendUrl/api/v1/submissions"
```

Expected result:

- The student sees the updated status.

## 14. Logout

Log out student and lecturer sessions:

```powershell
curl.exe -i -b $studentCookieJar -c $studentCookieJar -X POST "$backendUrl/api/v1/auth/logout"
curl.exe -i -b $lecturerCookieJar -c $lecturerCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Expected result:

- Each logout returns `200` and clears its cookie-backed session.

## 15. Scope Guardrails

During this smoke test, confirm no PR #11 work changes or depends on:

- new feature implementation
- similarity integration
- similarity scoring or thresholds
- Jaccard, TF-IDF, SBERT, or context scoring
- `CurrentSessionTopic`, `UnderReviewTopic`, or `HistoricalTopic` writes
- decision notes or reasons
- lecturer audit trail
- supervisor assignment
- admin reports
- email notifications or real email providers
- Prisma schema or migration changes
