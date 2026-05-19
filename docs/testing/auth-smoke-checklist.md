# Auth Smoke Checklist

Use this checklist to verify the v1 auth foundation locally before starting student submission workflow work.

This smoke run writes demo auth users to the configured development database. Use a fresh or disposable development database where possible. Do not reset an existing local database if Prisma reports drift without confirming that its data can be discarded.

## 1. Environment Variables

From `backend/`, confirm `.env` includes local development values:

```text
DATABASE_URL=...
JWT_SECRET=local-development-secret
FRONTEND_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
```

`JWT_SECRET` must be a real secret outside local development.

Use the backend port shown in the backend console as the source of truth. The repo default and frontend proxy currently use `3000`, but some local environments may start the backend on another port such as `8080`. If the console shows a different port, use that port for direct backend checks and align the frontend proxy before browser-based smoke testing.

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

If the backend console shows a different port, update `$backendUrl` before running the check.

## 6. Frontend Startup

From `frontend/`:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

## 7. Admin Login

Log in with:

```text
admin.demo@uniosun.edu.ng
DemoPass123
```

Expected result:

- Login succeeds.
- The backend sets the `rtadss_session` httpOnly cookie.
- The UI routes to `/admin/dashboard`.

## 8. Lecturer Login

Log out, then log in with:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Expected result:

- Login succeeds.
- The UI routes to `/lecturer/dashboard`.

## 9. Student Login

Log out, then log in with:

```text
student.demo@uniosun.edu.ng
DemoPass123
```

Expected result:

- Login succeeds.
- The UI routes to `/student/dashboard`.

## 10. Protected Route Redirect

Log out and open:

```text
http://localhost:5173/lecturer/dashboard
```

Expected result:

- The UI redirects to `/login`.
- No role selector is shown.

## 11. Cross-Role Redirect

Log in as the student demo user and open:

```text
http://localhost:5173/admin/dashboard
```

Expected result:

- The UI redirects back to `/student/dashboard`.

Repeat with the lecturer demo user opening:

```text
http://localhost:5173/student/dashboard
```

Expected result:

- The UI redirects back to `/lecturer/dashboard`.

## 12. Logout

Click logout from an authenticated session.

Expected result:

- The backend clears the `rtadss_session` cookie.
- The UI returns to `/login`.
- Reloading a protected route redirects to `/login`.

## 13. Forgot-Password Mock Reset Link

Open:

```text
http://localhost:5173/forgot-password
```

Submit one of the demo emails.

Expected result:

- The UI shows a generic success message.
- No real email is sent.
- The backend console logs a `[mock-email]` payload with a local reset URL.
- The database stores only a hashed reset token.

## 14. Reset-Password Flow

Copy the reset URL from the backend console and open it in the browser.

Set a new password that satisfies the PR #2 rule:

- at least 8 characters
- at least one number

Expected result:

- Reset succeeds.
- The reset token is single-use.
- Login works with the new password.
- Login no longer works with the old password for that user.

To restore demo credentials after testing:

```powershell
cd backend
npm run prisma:seed:auth-demo
```

## 15. Lecturer Check-Similarity Route

Before login, open:

```text
http://localhost:5173/lecturer/check-similarity
```

Expected result:

- The UI redirects to `/login`.

Log in as:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

Open:

```text
http://localhost:5173/lecturer/check-similarity
```

Expected result:

- The route loads.
- Submitting a valid topic still calls the existing similarity API.
- Existing similarity scoring, thresholds, and endpoint behavior are unchanged.
