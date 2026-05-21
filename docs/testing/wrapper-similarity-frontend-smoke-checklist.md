# Wrapper Similarity Frontend Smoke Checklist

Use this checklist to verify that the lecturer submission detail page calls the lecturer-protected similarity wrapper endpoint instead of the older general similarity endpoint.

This smoke run writes student submissions to the configured development database and runs the existing similarity logic through the wrapper endpoint for temporary display only. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

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

## 9. Open Pending Reviews And Detail Page

Open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Click the submission title or `View Details`.

Expected result:

- The browser navigates to `/lecturer/pending-reviews/:id`.
- The detail page loads one submission.
- The `Similarity Pre-check` section is visible.
- No similarity check runs automatically on page load.

## 10. Browser DevTools Wrapper Verification

Open the browser DevTools `Network` tab.

Click:

```text
Run Similarity Check
```

Expected network result:

- A request is sent to:

```text
POST /api/v1/lecturer/submissions/:id/similarity-check
```

- The response is `200 OK`.
- The older endpoint is not called:

```text
POST /api/similarity/check
```

Expected page result:

- A result panel renders.
- `success` or `partial_success` is acceptable.
- A `LOW` or no-match result is acceptable when comparison tables are empty.
- `partial_success` is acceptable when SBERT is unavailable.
- The panel shows risk, maximum similarity, recommendation, and tiered matches when available.

## 11. Confirm Similarity Does Not Decide The Submission

After the result panel renders, confirm:

- The submission status remains unchanged.
- `Approve`, `Request Revision`, and `Reject` remain separate actions.
- Similarity checking does not approve, reject, or request revision.
- No similarity result is stored permanently.
- No `CurrentSessionTopic`, `UnderReviewTopic`, or `HistoricalTopic` write occurs.

## 12. Optional API Confirmation

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root:

```powershell
$backendUrl = "http://localhost:3000"
$lecturerCookieJar = "C:\tmp\rtadss-lecturer-cookie.txt"
$submissionId = 1
```

Log in as the lecturer demo user:

```powershell
curl.exe -i -c $lecturerCookieJar -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

Fetch the lecturer submission detail before running the browser check:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions/$submissionId"
```

Expected result:

- Response status is `200`.
- Record the current `status`, usually `pending_review`.

After running the browser similarity check, fetch the detail again:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions/$submissionId"
```

Expected result:

- Response status is `200`.
- The submission status is unchanged.
- No stored similarity result appears in the submission detail response.

Log out:

```powershell
curl.exe -i -b $lecturerCookieJar -c $lecturerCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Expected result:

- Logout returns `200` and clears the cookie-backed session.

## 13. Scope Guardrails

During this smoke test, confirm no PR #16 work changes or depends on:

- new feature implementation
- backend source changes
- frontend source changes
- test changes
- Prisma schema or migration changes
- package file changes
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
