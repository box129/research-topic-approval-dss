# Secrets Management

## Status

This document defines production secrets handling expectations. It does not configure a specific cloud secret manager or prove that secrets are deployed safely.

## Never Commit

Do not commit:

- `.env`
- `.env.local`
- database URLs
- database passwords
- `JWT_SECRET`
- SMTP passwords or app passwords
- provider API keys
- raw backup files
- private TLS keys
- real smoke-test credentials
- student records

## Required Production Secrets

| Secret | Purpose | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Prisma database connection | Store in deployment secret manager. |
| `JWT_SECRET` | Cookie-backed JWT signing | Minimum 32 random characters; avoid reused or placeholder values. |
| `VOYAGE_API_KEY` | Backend-only Voyage semantic provider access | Required and startup-fatal in production; never send to a browser or log it. |
| `SMTP_PASSWORD` | SMTP auth, if provider requires it | Must be paired with `SMTP_USER`; omit both if provider uses network/IP allowlist. |
| `SMOKE_*` credentials | Optional credentialed smoke | Do not store longer than necessary unless policy approves. |
| TLS private key | HTTPS termination, if self-managed | Prefer managed certificate storage where available. |

## Non-Secret But Sensitive Configuration

These are not usually secrets, but should still be reviewed:

- `FRONTEND_URL`
- `CORS_ORIGIN`
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `TRUST_PROXY`
- Voyage request/readiness timeout settings
- audit retention settings
- rate-limit settings

## Environment Hardening Checklist

Production must set:

```text
NODE_ENV=production
DATABASE_URL=<secret>
JWT_SECRET=<secret>
VOYAGE_API_KEY=<secret>
FRONTEND_URL=https://<approved-domain>
EMAIL_PROVIDER=smtp
```

If using SMTP:

```text
SMTP_HOST=<provider-host>
SMTP_PORT=<provider-port>
SMTP_SECURE=true|false
EMAIL_FROM=<approved-sender>
SMTP_USER=<secret-if-needed>
SMTP_PASSWORD=<secret-if-needed>
```

Reject:

- `EMAIL_PROVIDER=mock`
- `CORS_ORIGIN=*`
- placeholder `JWT_SECRET`
- blank `VOYAGE_API_KEY` in production
- local Compose database passwords
- demo credentials in public production
- `EMAIL_PROVIDER=disabled` for a public or departmental launch (it is only
  for deliberately email-disabled synthetic/staging environments)

## Rotation

Define rotation for:

- database credentials
- JWT secret
- SMTP credentials
- smoke-test credentials
- TLS certificates if self-managed

JWT secret rotation can invalidate active sessions. Plan a maintenance window or user re-login notice if required.

### Rotation runbook (Phase 7)

Standing rule: **rotate every production-bound credential before go-live** —
development/rehearsal values and any key that has ever appeared in a
terminal, transcript, or agent session must not reach production. Never
write actual values anywhere during rotation.

**JWT_SECRET**
1. Generate ≥ 32 random characters in the platform secret store.
2. Update the backend secret; restart/redeploy.
3. Effect: **every active session is invalidated immediately** (all users
   sign in again; passwords unaffected). Prefer a low-traffic window and a
   short notice unless rotating during an incident, where immediate global
   sign-out is the point.
4. Verify: old cookies get 401; fresh login works.

**Voyage API key**
1. Create the new key in the Voyage dashboard; update `VOYAGE_API_KEY` in the
   secret store; restart.
2. Verify: readiness shows the provider `available` after its next probe
   (one bounded probe, no traffic impact); then revoke the old key.
3. If rotation was incident-driven, check the provider usage dashboard for
   unexpected spend before revoking (evidence).

**SMTP password**
1. Rotate at the provider; update `SMTP_PASSWORD` (paired with `SMTP_USER`);
   restart.
2. Verify with the operator smoke (`npm run smoke:smtp` to a controlled
   recipient) or one test invitation; failure surfaces as
   `smtp-auth-failed` truthfully, and the manual credential fallback keeps
   onboarding operational during the gap.

**Database credentials**
1. Create the new role/password on the provider **before** removing the old
   one (overlap window).
2. Update `DATABASE_URL` in the secret store (backend and any
   migration/backup job use the same source of truth); restart; confirm
   readiness `database: available`; then revoke the old credential.
3. Coordinate with backups: scheduled `db:backup`/provider backups must pick
   up the new credential at the same time. A missed coordination shows up as
   backup-job auth failures — treat as CRITICAL (missed backup).
4. Note: rotating DB credentials does not sign users out; rotating
   `JWT_SECRET` does.

## Access Control

- Grant production secret access only to deployment operators.
- Use role-based access in the hosting platform.
- Avoid sharing secrets through chat, screenshots, source code, or release notes.
- Remove access when a maintainer no longer needs production operations privileges.

## Evidence

Safe evidence:

- list of required secret names
- confirmation that values are present in the deployment secret store
- rotation date or policy reference
- redacted screenshots where values are fully hidden

Unsafe evidence:

- actual secret values
- partial database URLs containing usernames/passwords
- SMTP passwords
- JWT secrets
- exported `.env` files
