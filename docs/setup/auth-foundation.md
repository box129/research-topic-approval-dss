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

## Password Reset Email

Password reset still uses the existing token-link flow, but email delivery now goes through the backend provider abstraction in `backend/src/services/email.service.js`.

Supported `EMAIL_PROVIDER` values:

- `mock`: local/test-safe mode. It accepts email requests without external delivery and does not return raw reset links or tokens in the service result.
- `disabled`: fail-closed mode. Password reset requests for real users fail clearly when delivery is intentionally unavailable.
- `smtp`: validates SMTP-related environment variables, but SMTP transport is not implemented in this build because no mail transport dependency is installed.

Production behavior:

- `EMAIL_PROVIDER` must be set explicitly in production.
- `EMAIL_PROVIDER=mock` is rejected in production.
- `EMAIL_PROVIDER=smtp` requires `SMTP_HOST`, `SMTP_PORT`, and `EMAIL_FROM`.
- Until a real SMTP/provider transport is implemented, production should use `disabled` or add a scoped provider integration with tests.

Development and test behavior:

- The default provider outside production is `mock`.
- No real external email is sent in development or tests.
- Logs and service results must not expose password hashes, reset token hashes, auth tokens, SMTP passwords, or API keys.
- The database stores only hashed reset tokens, never plaintext reset tokens.

See [`email-notification-foundation.md`](email-notification-foundation.md) for the current provider and notification foundation status.

## Migration Workflow

v1.0 schema changes use committed Prisma migrations.

From `backend/`:

```powershell
npm run prisma:migrate
npm run prisma:generate
```

Use the named migration command only when intentionally changing the Prisma schema and creating a new migration.

The previous MVP used `prisma db push`. If a local database was created with `db push`, Prisma may report migration drift because `_prisma_migrations` is missing. Do not reset a database that contains data you want to preserve. Use a fresh development database for the migration transition or create a separate preserve-data baseline plan.
