# Student Submission Smoke Checklist

Use this checklist to verify the student submission foundation locally before starting lecturer review, similarity pre-check, supervisor assignment, notifications, or reporting work.

This smoke run writes student submissions to the configured development database. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

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

## 7. Student Login

Log in with:

```text
student.demo@uniosun.edu.ng
DemoPass123
```

Expected result:

- Login succeeds.
- The backend sets the `rtadss_session` httpOnly cookie.
- The UI routes to `/student/dashboard`.

## 8. Submit Topic Page

Open:

```text
http://localhost:5173/student/submit-topic
```

Expected result:

- The student submission form loads.
- The form allows a topic title, optional category, and optional keywords.

## 9. Valid Student Submission

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
- The UI shows clear success feedback.
- The submitted topic is saved with `PENDING_REVIEW` status.
- The page offers a path to `/student/my-submissions`.

## 10. My Submissions Page

Open:

```text
http://localhost:5173/student/my-submissions
```

Expected result:

- The submitted topic appears in the list.
- The list shows status, category if provided, keywords if provided, and submission date.
- Only the authenticated student's submissions are shown.

## 11. Protected Route Redirect

Log out and open:

```text
http://localhost:5173/student/submit-topic
```

Expected result:

- The UI redirects to `/login`.

Repeat with:

```text
http://localhost:5173/student/my-submissions
```

Expected result:

- The UI redirects to `/login`.

## 12. Cross-Role Redirect

Log in as the lecturer demo user and open:

```text
http://localhost:5173/student/submit-topic
```

Expected result:

- The UI redirects back to the lecturer area.
- The lecturer cannot access the student submission form.

Log out, log in as the admin demo user, and open:

```text
http://localhost:5173/student/my-submissions
```

Expected result:

- The UI redirects back to the admin area.
- The admin cannot access the student submissions list through the student route.

## 13. Backend API Smoke Test

These commands use `curl.exe` directly so PowerShell does not alias `curl` to `Invoke-WebRequest`.

From the repository root, log in as the student demo user and save the session cookie:

```powershell
$backendUrl = "http://localhost:3000"
$cookieJar = "C:\tmp\rtadss-student-cookie.txt"
curl.exe -i -c $cookieJar -H "Content-Type: application/json" -d "{\"email\":\"student.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" "$backendUrl/api/v1/auth/login"
```

Create a submission using the saved cookie:

```powershell
curl.exe -i -b $cookieJar -H "Content-Type: application/json" -d "{\"title\":\"Factors influencing malaria prevention practices among undergraduate students in Osogbo\",\"category\":\"Public Health\",\"keywords\":\"malaria, prevention, undergraduate students, Osogbo\"}" "$backendUrl/api/v1/submissions"
```

List the authenticated student's submissions:

```powershell
curl.exe -i -b $cookieJar "$backendUrl/api/v1/submissions"
```

Log out and clear the session:

```powershell
curl.exe -i -b $cookieJar -c $cookieJar -X POST "$backendUrl/api/v1/auth/logout"
```

Expected result:

- `POST /api/v1/submissions` succeeds only while authenticated as a student.
- `GET /api/v1/submissions` returns only the authenticated student's submissions.
- Logging out clears the cookie-backed session.

## 14. Non-Student API Access

Repeat the API login step with:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Then call:

```powershell
curl.exe -i -b $cookieJar "$backendUrl/api/v1/submissions"
```

Expected result:

- The request is rejected because lecturer users do not have the student role.

Repeat with:

```text
admin.demo@uniosun.edu.ng
DemoPass123
```

Expected result:

- The request is rejected because admin users do not have the student role.

## 15. Scope Guardrails

During this smoke test, confirm no PR #5 work changes or depends on:

- lecturer review workflow
- similarity pre-check integration
- similarity scoring or thresholds
- Jaccard, TF-IDF, SBERT, or context scoring
- admin reports
- supervisor assignment
- email notifications or real email providers
- Prisma schema changes beyond already committed migrations
