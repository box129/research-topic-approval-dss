# Auth Foundation

This project now uses httpOnly cookie authentication for the v1.0 role-based application foundation.

## Production First-Administrator Bootstrap

Production databases must never be initialized with the demo seed. The first administrator is created with an explicit operator-invoked command from `backend/`:

```powershell
npm run bootstrap:admin -- --email admin@department.example --name "Departmental Administrator"
```

Properties:

- It never runs automatically at application startup.
- It contains no hardcoded or default password. A cryptographically secure temporary password is generated, printed exactly once, and stored only as a bcrypt hash (same hashing contract as normal login).
- It is idempotent: re-running with the same email reports the existing administrator and issues no new credential. Conflicting state (a different administrator already exists, or the email belongs to a non-admin account) is refused with a non-zero exit.
- The created account is marked as requiring a password change, so the temporary credential cannot operate the application. The administrator must sign in and set a private password first.
- Transfer the one-time credential to the administrator over a secure channel and have them change it immediately.

## Initial-Access Lifecycle

- **Admin provisioning**: an authenticated administrator creates individual student or lecturer accounts at `POST /api/v1/admin/users` (also available in the Admin User Management page). The API generates a secure temporary password, stores only its hash, marks the account `mustChangePassword`, and returns the plaintext exactly once in that response. Students may optionally be given a matric number (normalized to uppercase, unique). Additional administrators cannot be created through this endpoint.
- **Forced first password change**: while `mustChangePassword` is set, every authenticated API except `GET /auth/me` and `POST /auth/change-password` returns `403 PASSWORD_CHANGE_REQUIRED`, and the frontend routes the user to the dedicated `/change-password` screen. Changing the password requires the current (temporary) credential and the standard password policy.
- **Authenticated password change**: `POST /api/v1/auth/change-password` is also available to any signed-in user for voluntary changes.
- **Admin credential reset**: `POST /api/v1/admin/users/:id/credential-reset` lets an administrator issue a new one-time temporary password for a student or lecturer who is locked out (operational fallback while email delivery is unavailable). The previous password and all existing sessions stop working, and another forced password change is required. Admin accounts cannot be targeted, and admins cannot reset their own credential through it.
- **Session invalidation**: sessions embed a credential version. Any password change, admin credential reset, or reset-token recovery bumps the version, so all previously issued session tokens become invalid immediately. Suspension takes effect on the next request through per-request revalidation.
- **Email canonicalization**: emails are stored and compared in lower case everywhere (bootstrap, provisioning, login, password reset, duplicate checks). The `20260820090000_add_identity_initial_access` migration lower-cases existing rows and refuses to run if two rows would collide case-insensitively, so accounts are never silently merged.

Plaintext temporary credentials are never written to the database, audit logs, application logs, or analytics.

## Local Demo Users (development only)

Demo users are local-only and unsafe for production. They are intended only for development and manual testing. The seed refuses to run with `NODE_ENV=production`; production initialization always uses `npm run bootstrap:admin`.

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
- `smtp`: sends through the configured SMTP provider using the backend Nodemailer transport.

Production behavior:

- `EMAIL_PROVIDER` must be set explicitly in production.
- `EMAIL_PROVIDER=mock` is rejected in production.
- `EMAIL_PROVIDER=smtp` requires `SMTP_HOST`, `SMTP_PORT`, and `EMAIL_FROM`.
- Provider-level delivery should be smoke-tested with deployment-owned credentials before claiming production email readiness.

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
