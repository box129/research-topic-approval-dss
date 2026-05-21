# Lecturer Similarity Pre-check Smoke Checklist

Use this checklist to verify the lecturer similarity pre-check section locally before adding stored similarity results, lifecycle table writes, decision notes, audit trail, supervisor assignment, notifications, reports, or production scoring changes.

This smoke run writes student submissions to the configured development database and runs the existing similarity endpoint for temporary display only. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

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

## 9. Open The Submission Detail Page

Open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Click the submission title or `View Details`.

Expected result:

- The browser navigates to `/lecturer/pending-reviews/:id`.
- The detail page loads one submission.
- The page shows title, student name/email, category, keywords, status, submitted date, and session name if available.
- The `Similarity Pre-check` section is visible.
- No similarity check runs automatically on page load.

## 10. Run Similarity Pre-check

Click:

```text
Run Similarity Check
```

Expected result:

- A loading state appears while the request is running.
- The frontend calls the existing `POST /api/similarity/check` endpoint.
- The request uses the submission title as `topic`.
- The request uses submission keywords as `keywords`, or an empty string when no keywords exist.
- A result panel renders after the response.
- The panel shows overall risk, maximum similarity, recommendation, and tiered matches when available.
- If comparison tables are empty, a `LOW` or no-match result is acceptable.
- If the SBERT service is unavailable, a `partial_success` notice is acceptable.

## 11. Confirm Pre-check Does Not Decide The Submission

After the similarity result renders, confirm:

- The submission status did not change automatically.
- The result is temporary display only.
- No similarity result is stored permanently.
- No `CurrentSessionTopic`, `UnderReviewTopic`, or `HistoricalTopic` write occurs.
- `Approve`, `Request Revision`, and `Reject` remain separate lecturer actions.
- Decision buttons are not disabled because of the similarity result.

## 12. Optional Decision Sanity Check

Use one decision action only if needed to confirm separation:

- `Approve`
- `Request Revision`
- `Reject`

Expected result:

- The decision action still uses the existing lecturer status endpoint.
- The status changes only after the explicit decision action.
- The similarity result does not approve, reject, or request revision on its own.

## 13. Backend API Smoke Setup

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

Log out the student:

```powershell
curl.exe -i -b $studentCookieJar -c $studentCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Log in as the lecturer demo user:

```powershell
curl.exe -i -c $lecturerCookieJar -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

## 14. API Smoke: Queue, Detail, And Similarity

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
- Record the `title`, `keywords`, and `status`.

Run the existing similarity endpoint directly:

```powershell
curl.exe -i -H "Content-Type: application/json" -d "{\"topic\":\"Factors influencing malaria prevention practices among undergraduate students in Osogbo\",\"keywords\":\"malaria, prevention, undergraduate students, Osogbo\"}" "$backendUrl/api/similarity/check"
```

Expected result:

- Response status is `200`.
- Response body has `status: "success"` or `status: "partial_success"`.
- Response body includes `overall_risk`, `max_similarity`, and tier arrays under `data`.
- `LOW` with empty tier arrays is acceptable when comparison tables are empty.
- `partial_success` is acceptable when SBERT is unavailable.

Fetch the lecturer submission detail again:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions/$submissionId"
```

Expected result:

- Response status is `200`.
- Submission `status` is unchanged from before the similarity check.
- No similarity result appears in the submission detail response.

## 15. Logout

Log out the lecturer session:

```powershell
curl.exe -i -b $lecturerCookieJar -c $lecturerCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Expected result:

- Logout returns `200` and clears the cookie-backed session.

## 16. Scope Guardrails

During this smoke test, confirm no PR #13 work changes or depends on:

- new feature implementation
- backend source changes
- frontend source changes
- Prisma schema or migration changes
- similarity scoring or thresholds
- Jaccard, TF-IDF, SBERT, or context scoring changes
- stored similarity results
- submission status mutation from similarity results
- `CurrentSessionTopic`, `UnderReviewTopic`, or `HistoricalTopic` writes
- decision notes
- lecturer audit trail
- supervisor assignment
- admin reports
- email notifications or real email providers
