# Security Readiness Checklist

This checklist is scoped to repository evidence available through PR #115. It is not a penetration test, compliance audit, or external security review.

| Area | Status | Evidence / Required Follow-up |
| --- | --- | --- |
| Secrets not committed | VERIFIED | `.env` files and credentials are not required in committed docs or workflows. Continue checking `git status --ignored` before commits. |
| Production JWT/session secret | VERIFIED | Production config rejects missing, short, and placeholder `JWT_SECRET` values. |
| HTTPS requirement | NOT VERIFIED | Backend secure cookies enable in `NODE_ENV=production`, but TLS termination is environment-owned. |
| Secure cookies | PARTIALLY VERIFIED | Cookie is `httpOnly`, `sameSite: lax`, and `secure` in production. Cookie domain/path and reverse proxy behavior are not configured. |
| CORS allowlist | VERIFIED | Production requires an explicit trusted origin and rejects `*`. |
| Rate limiting | PARTIALLY VERIFIED | `express-rate-limit` is configured with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`; proxy-aware IP behavior is deployment-owned. |
| Request body and upload limits | PARTIALLY VERIFIED | JSON body parser is standard; import uploads are limited to 5 MB by Multer. |
| Admin-only import controls | VERIFIED | Import preview/commit routes use `requireAuth` and `requireRole('admin')`; admin-prefixed v1 routes are preferred. |
| Audit logging | PARTIALLY VERIFIED | AuditLog foundation, selected event hooks, admin CSV export, retention policy, and guarded admin purge exist. Formal institutional retention approval and archive/legal-hold workflow remain future work. |
| Password reset token hashing/expiry | VERIFIED | Reset token hash/expiry fields exist and expiry is configurable. Real delivery depends on provider mode. |
| Email provider fail-closed behavior | PARTIALLY VERIFIED | Production rejects `EMAIL_PROVIDER=mock`; `disabled` is allowed. SMTP transport delivery remains deferred. |
| Database least privilege | NOT VERIFIED | Least-privilege user creation is documented, but target database grants are environment-owned. |
| PostgreSQL network exposure | PARTIALLY VERIFIED | Root Compose exposes PostgreSQL on a configurable local host port for verification. Public production must keep PostgreSQL private. |
| SBERT service network exposure | PARTIALLY VERIFIED | Root Compose exposes SBERT on a configurable local host port for verification. Public exposure and network ACLs remain environment-owned. |
| Dependency review | PARTIALLY VERIFIED | Lockfile installs and CI are configured. No third-party vulnerability audit is performed in this PR. |
| Log redaction | PARTIALLY VERIFIED | Docs prohibit secrets in evidence. Broader structured redaction policy is not independently audited. |
| Backup/restore | CONDITIONALLY VERIFIED | Backup/restore commands are documented with placeholders; no live restore drill evidence exists. |
| Monitoring | NOT VERIFIED | Liveness/readiness endpoints exist. No monitoring or alerting provider is configured. |
| Incident response ownership | NOT VERIFIED | Deployment owner/contact must be assigned outside this repository. |
| Demo accounts disabled or rotated | NOT VERIFIED | Demo seed scripts exist. Public deployment must avoid or rotate demo credentials. |

## Minimum Public-Production Preconditions

Before any public production deployment, verify:

1. HTTPS is enforced at the edge.
2. `NODE_ENV=production`.
3. `JWT_SECRET` is generated and stored in a secret manager.
4. `FRONTEND_URL` or `CORS_ORIGIN` is the exact trusted public origin.
5. `EMAIL_PROVIDER` is `disabled` or `smtp`, never `mock`.
6. PostgreSQL and SBERT are not publicly exposed.
7. Backups are configured and restore-tested.
8. Monitoring and incident ownership are in place.
9. Demo credentials are removed, disabled, or rotated.
10. Audit retention settings are reviewed for the deployment and exported audit evidence is stored outside the repository.
11. Container deployments replace local Compose placeholder secrets and restrict database/SBERT network exposure.
