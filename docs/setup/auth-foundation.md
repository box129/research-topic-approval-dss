# Auth Foundation

This project now uses httpOnly cookie authentication for the v1.0 role-based application foundation.

## Local Demo Users

Demo users are local-only and unsafe for production. They are intended only for development and manual testing.

Run from `backend/` after applying Prisma migrations:

```powershell
npm run prisma:seed:auth-demo
```

The script creates or updates:

- `admin.demo@uniosun.edu.ng`
- `lecturer.demo@uniosun.edu.ng`
- `student.demo@uniosun.edu.ng`

Shared local-only password:

```text
DemoPass123
```

## Cookie Auth

The backend sets the `rtadss_session` cookie after login.

Cookie settings:

- `httpOnly: true`
- `sameSite: lax`
- `secure: false` in local development and test
- `secure: true` in production

The frontend does not store JWTs in `localStorage` or `sessionStorage`. Requests use credentials so the browser can send the cookie automatically.

## Mock Email

Password reset email is mock-only in this PR. No Resend, SMTP, or Nodemailer provider is configured.

In development, reset links may be logged for testing. The database stores only hashed reset tokens, never plaintext reset tokens.

## Migration Workflow

v1.0 schema changes use committed Prisma migrations.

From `backend/`:

```powershell
npm run prisma:migrate
npm run prisma:generate
```

Use the named migration command only when intentionally changing the Prisma schema and creating a new migration.

The previous MVP used `prisma db push`. If a local database was created with `db push`, Prisma may report migration drift because `_prisma_migrations` is missing. Do not reset a database that contains data you want to preserve. Use a fresh development database for the migration transition or create a separate preserve-data baseline plan.
