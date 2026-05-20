# Lecturer Queue Smoke Checklist

Use this checklist to verify the lecturer pending reviews queue locally before adding approve/reject decisions, similarity review, supervisor assignment, notifications, or reporting work.

This smoke run writes a student submission to the configured development database so the lecturer queue has a pending topic to display. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

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

## 7. Create A Pending Submission As Student

Log in with:

```text
student.demo@uniosun.edu.ng
DemoPass123
```

Open:

```text
http://localhost:5173/student/submit-topic
```

Submit a valid topic title with 7 to 24 words.

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

## 9. Pending Reviews Page

Open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The pending reviews queue loads.
- The pending student submission appears.
- The row shows title, category, keywords, student name/email, status, and submitted date.
- No approve, reject, request-changes, or decision controls are present.

## 10. Empty/Loading/Error States

Refresh the page and observe the loading state.

Expected result:

- Loading state appears while the queue request is in flight.
- If the backend is stopped, the page shows an error state with retry.
- If there are no pending submissions, the page shows a clear empty state.

## 11. Protected Route Redirect

Log out and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The UI redirects to `/login`.

## 12. Cross-Role Redirect

Log in as the student demo user and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The UI redirects back to the student area.
- The student cannot access the lecturer pending reviews page.

Log out, log in as the admin demo user, and open:

```text
http://localhost:5173/lecturer/pending-reviews
```

Expected result:

- The UI redirects back to the admin area.
- The admin cannot access the lecturer pending reviews page.

## 13. Backend API Smoke Test

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root, log in as the student demo user and save the student session cookie:

```powershell
$backendUrl = "http://localhost:3000"
$studentCookieJar = "C:\tmp\rtadss-student-cookie.txt"
$lecturerCookieJar = "C:\tmp\rtadss-lecturer-cookie.txt"
curl.exe -i -c $studentCookieJar -H "Content-Type: application/json" -d "{\"email\":\"student.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

Create a pending submission:

```powershell
curl.exe -i -b $studentCookieJar -H "Content-Type: application/json" -d "{\"title\":\"Factors influencing malaria prevention practices among undergraduate students in Osogbo\",\"category\":\"Public Health\",\"keywords\":\"malaria, prevention, undergraduate students, Osogbo\"}" "$backendUrl/api/v1/submissions"
```

Log out as student:

```powershell
curl.exe -i -b $studentCookieJar -c $studentCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Log in as the lecturer demo user:

```powershell
curl.exe -i -c $lecturerCookieJar -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

List pending review submissions:

```powershell
curl.exe -i -b $lecturerCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

Log out as lecturer:

```powershell
curl.exe -i -b $lecturerCookieJar -c $lecturerCookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Expected result:

- Lecturer login returns `200`.
- `GET /api/v1/lecturer/submissions` returns `200`.
- The response includes the pending submission.
- The response includes student name/email.
- Lecturer logout returns `200` and clears the cookie-backed session.

## 14. API Access Rejection Checks

Without a cookie:

```powershell
curl.exe -i "$backendUrl/api/v1/lecturer/submissions"
```

Expected result:

- The request is rejected as unauthenticated.

With a student cookie:

```powershell
curl.exe -i -c $studentCookieJar -H "Content-Type: application/json" -d "{\"email\":\"student.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
curl.exe -i -b $studentCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

Expected result:

- The request is rejected because student users do not have the lecturer role.

With an admin cookie:

```powershell
$adminCookieJar = "C:\tmp\rtadss-admin-cookie.txt"
curl.exe -i -c $adminCookieJar -H "Content-Type: application/json" -d "{\"email\":\"admin.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
curl.exe -i -b $adminCookieJar "$backendUrl/api/v1/lecturer/submissions"
```

Expected result:

- The request is rejected because admin users do not have the lecturer role for this queue.

## 15. Scope Guardrails

During this smoke test, confirm no PR #7 work changes or depends on:

- approve/reject workflow
- request-changes workflow
- lecturer decision detail page
- similarity check integration
- similarity scoring or thresholds
- Jaccard, TF-IDF, SBERT, or context scoring
- supervisor assignment
- admin reports
- email notifications or real email providers
- Prisma schema or migration changes
