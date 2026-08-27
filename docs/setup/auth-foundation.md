# Auth Foundation

This project now uses httpOnly cookie authentication for the v1.0 role-based application foundation.

## Identity Contract

Students at the target institution are not issued university email addresses.
This is the operational reality the DSS is designed for; it is a design decision
taken for the known environment, not a policy attributed to the university.
Possession of a unique personal email address is therefore **not** a
prerequisite for creating a student account, and no email domain is ever
required of anyone.

| Role | Primary identifier | Email | Matric number | Sign in with |
| --- | --- | --- | --- | --- |
| **Student** | matric number | **optional**, unique when supplied | **required**, unique | matric number, or email if one is on record |
| **Lecturer** | email | **required**, unique | not accepted | email |
| **Administrator** | email | **required**, unique | not accepted | email |

Login takes a single field that accepts either an email address or a matric
number. The application decides how to resolve it and never reveals which
lookup was used: an unknown account, a wrong password, and an identifier that
matches neither shape all produce exactly the same generic failure.

At the database level both `email` and `matric_number` are nullable and unique.
PostgreSQL treats NULLs as distinct in a unique index, so any number of students
may have no email while any supplied address stays unique. The role-specific
rules above cannot be expressed by nullable columns alone — the database would
accept a student with neither identifier — so they are enforced at the service
boundary and covered by tests.

### What an optional email costs

A student with no email address is fully usable: an administrator provisions the
account, hands over the one-time temporary credential, and the student signs in
with their matric number and completes the forced password change.

Two things genuinely depend on having an address, and both degrade honestly
rather than silently:

- **Invitations** are emails. An account with no address cannot be invited; the
  action reports that plainly and bulk invitation reports it as skipped. No
  placeholder address is ever fabricated.
- **Self-service password reset** delivers a link by email, so it is unavailable
  to an account with no address. **Admin credential reset is the documented
  recovery path** for those accounts, and it works regardless of email.

Recommend a personal email address where a student has one, because it unlocks
self-service recovery. Never require one.

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

- **Admin provisioning**: an authenticated administrator creates individual student or lecturer accounts at `POST /api/v1/admin/users` (also available in the Admin User Management page). The API generates a secure temporary password, stores only its hash, marks the account `mustChangePassword`, and returns the plaintext exactly once in that response. A student row requires a matric number (normalized to uppercase, unique) and may omit an email address entirely; a lecturer row requires an email address and takes no matric number. Additional administrators cannot be created through this endpoint.
- **Forced first password change**: while `mustChangePassword` is set, every authenticated API except `GET /auth/me` and `POST /auth/change-password` returns `403 PASSWORD_CHANGE_REQUIRED`, and the frontend routes the user to the dedicated `/change-password` screen. Changing the password requires the current (temporary) credential and the standard password policy.
- **Authenticated password change**: `POST /api/v1/auth/change-password` is also available to any signed-in user for voluntary changes.
- **Admin credential reset**: `POST /api/v1/admin/users/:id/credential-reset` lets an administrator issue a new one-time temporary password for a student or lecturer who is locked out (operational fallback while email delivery is unavailable). The previous password and all existing sessions stop working, and another forced password change is required. Admin accounts cannot be targeted, and admins cannot reset their own credential through it.
- **Session invalidation**: sessions embed a credential version. Any password change, admin credential reset, or reset-token recovery bumps the version, so all previously issued session tokens become invalid immediately. Suspension takes effect on the next request through per-request revalidation.
- **Email canonicalization**: emails are stored and compared in lower case everywhere (bootstrap, provisioning, login, password reset, duplicate checks). The `20260820090000_add_identity_initial_access` migration lower-cases existing rows and refuses to run if two rows would collide case-insensitively, so accounts are never silently merged.

Plaintext temporary credentials are never written to the database, audit logs, application logs, or analytics.

## Bulk Departmental Onboarding

Bulk onboarding applies the exact individual-provisioning contract to a departmental `.xlsx` spreadsheet. The `name` and `role` columns are always required; `matric_number` is required on student rows and `email` is required on lecturer rows but optional on student rows. A downloadable template is available at `GET /api/v1/admin/users/import/template`. The flow is strictly upload → preview → commit, admin-only on every step:

- **Preview** (`POST /api/v1/admin/users/import/preview`) classifies every row against the live directory without creating anything: `valid_new`, `already_exists` (safe replay, no new credential), `duplicate_in_file`, `conflict` (any material disagreement with an existing account or inside the file — never repaired silently), or `invalid` (failed field validation; `admin` is never an accepted role).
- **Commit** (`POST /api/v1/admin/users/import/commit`) takes the same file again and re-validates everything server-side — client-side preview state is never trusted. Temporary credentials are generated and bcrypt-hashed (cost 12, bounded worker-thread pool, `BULK_HASH_CONCURRENCY` override) before a single database transaction re-checks conflicts and inserts the accepted cohort atomically. Any identity that appeared concurrently aborts the whole batch with `409 BULK_IMPORT_STATE_CHANGED`; nothing is partially created.
- **One-time credential manifest**: the commit response (served with `Cache-Control: no-store`) embeds an `.xlsx` manifest of the newly created accounts and their temporary passwords, generated in memory only — it is not stored server-side and cannot be re-downloaded. All manifest cells are literal strings, so formula-looking names stay inert. If the manifest is lost, the per-user admin credential reset is the recovery path.
- **Existing accounts are never modified by an import**: exact matches are skipped, disagreements are reported as conflicts, and passwords of existing users are never reset by re-importing a spreadsheet.
- Audit events `BULK_USER_IMPORT_PREVIEWED` / `BULK_USER_IMPORT_COMMITTED` record counts, batch id and source filename (never credentials), plus one `USER_PROVISIONED` event per created account tagged `source: bulk-import`.
- File safety: `.xlsx` only, 5 MB upload limit, at most 2000 data rows per import, malformed/empty workbooks rejected, temporary upload files removed after each request.

## Email Invitations

Invitations attach email delivery to the existing provisioning contract without creating a second identity system. An administrator can email any provisioned student/lecturer account that is ACTIVE and still awaiting its first private password a one-time activation link (individually via `POST /api/v1/admin/users/:id/invite`, or as a bounded-concurrency batch via `POST /api/v1/admin/users/invitations/bulk`, including directly after a Phase-3 bulk import — the UI asks deliberately; nothing is emailed automatically).

- **Token security**: 32 random bytes (256-bit) base64url token; only its SHA-256 hash is stored (`invitation_token_hash`) with an explicit expiry (`INVITATION_EXPIRES_HOURS`, default 168 h = 7 days). Issuing a new invitation invalidates the previous link immediately; acceptance consumes the token atomically (single use); suspended or already-completed accounts cannot accept; expired links are refused with a neutral message.
- **Acceptance** (`POST /api/v1/auth/invitation/validate` + `/accept`, both public in the no-session sense): the token holder chooses a private password under the standard policy. Acceptance replaces the bcrypt hash, clears `mustChangePassword`, increments `credentialVersion` (invalidating prior sessions and the temporary credential), clears any pending reset token, records `invitation_accepted_at`, and signs the user in through the normal cookie session. Nothing else — not email, role, status, or account creation — can be changed through an invitation. This is not public registration.
- **Delivery honesty**: a failed send leaves the account fully provisioned, records a short reason code for the admin (`invitation.lastError`), is audited (`USER_INVITATION_DELIVERY_FAILED`), and can be retried; the Phase-2/3 manual temporary-credential paths remain the fallback. Bulk sends report per-account sent/failed/skipped truthfully. Audit events never contain tokens.
- **Anti-enumeration for password recovery**: `POST /auth/forgot-password` returns the same generic 200 response whether the account exists, is suspended, or the email provider fails; provider failures are logged internally with a classified reason code instead of surfacing a different status to the requester.
- The frontend captures invitation/reset tokens from the emailed link into memory only, immediately scrubs them from the address bar and history, and never writes them to localStorage/sessionStorage.

## Admin Identity Correction

`PATCH /api/v1/admin/users/:id/identity` lets an administrator correct the stored `name`, `email`, and (students only) `matricNumber` of provisioned student/lecturer accounts, using the same canonicalization and uniqueness rules as provisioning. A student's email may be **added, changed or removed** because it is contact/recovery information; a lecturer's email may be corrected but never removed, and a student's matric number may be corrected but never removed, because in each case it is that account's login identity. Role and status are explicitly rejected here (status stays with suspend/reactivate), administrator accounts cannot be targeted, and passwords are untouched. Changing or removing the email bumps `credentialVersion` (invalidating existing sessions) and clears any pending reset or invitation token, so a link sent to a former address cannot still be used. Changes are audited as `USER_IDENTITY_CORRECTED` with before/after values of the changed fields.

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
