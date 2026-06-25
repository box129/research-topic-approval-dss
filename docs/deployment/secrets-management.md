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
- `SBERT_SERVICE_URL`
- audit retention settings
- rate-limit settings

## Environment Hardening Checklist

Production must set:

```text
NODE_ENV=production
DATABASE_URL=<secret>
JWT_SECRET=<secret>
FRONTEND_URL=https://<approved-domain>
EMAIL_PROVIDER=disabled|smtp
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
- local Compose database passwords
- demo credentials in public production

## Rotation

Define rotation for:

- database credentials
- JWT secret
- SMTP credentials
- smoke-test credentials
- TLS certificates if self-managed

JWT secret rotation can invalidate active sessions. Plan a maintenance window or user re-login notice if required.

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
