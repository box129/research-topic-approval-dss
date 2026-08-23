# Security Readiness Checklist

This checklist is scoped to current Phase 5/6 repository evidence. It is not a
penetration test, compliance audit, external security review, or proof of a
public deployment.

| Area | Status | Evidence / Required Follow-up |
| --- | --- | --- |
| Secrets not committed | VERIFIED | `.env` files and credentials are not required in committed docs or workflows. Continue checking `git status --ignored` before commits. |
| Production JWT/session secret | VERIFIED | Production config rejects missing, short, and placeholder `JWT_SECRET` values. |
| HTTPS requirement | NOT VERIFIED | Backend secure cookies enable in `NODE_ENV=production`, but TLS termination is environment-owned. |
| Secure cookies | PARTIALLY VERIFIED | Cookie is `httpOnly`, `sameSite: lax`, and `secure` in production. Cookie domain/path and reverse proxy behavior are not configured. |
| Same-origin CORS/CSRF policy | VERIFIED | Production uses exact HTTPS `FRONTEND_URL`; `CORS_ORIGIN` is normally unset for same-origin and any supplied value rejects `*`. |
| Rate limiting | PARTIALLY VERIFIED | Process-local limits are configured for the deliberately single backend instance; proxy-aware IP behavior still depends on exact `TRUST_PROXY` deployment topology. |
| Request body and upload limits | PARTIALLY VERIFIED | JSON body parser is standard; import uploads are limited to 5 MB by Multer. |
| Admin-only import controls | VERIFIED | Import preview/commit routes use `requireAuth` and `requireRole('admin')`; admin-prefixed v1 routes are preferred. |
| Audit logging | PARTIALLY VERIFIED | AuditLog foundation, selected event hooks, admin CSV export, retention policy, and guarded admin purge exist. Formal institutional retention approval and archive/legal-hold workflow remain future work. |
| Password reset token hashing/expiry | VERIFIED | Reset token hash/expiry fields exist and expiry is configurable. Real delivery depends on provider mode. |
| Email provider fail-closed behavior | PARTIALLY VERIFIED | Production rejects `EMAIL_PROVIDER=mock`; `disabled` is allowed only for deliberately email-disabled synthetic/staging environments. Public/departmental launch requires SMTP transport and a verified controlled provider smoke through `npm run smoke:smtp`. |
| Database least privilege | NOT VERIFIED | Least-privilege user creation is documented, but target database grants are environment-owned. |
| PostgreSQL/backend network exposure | VERIFIED in Compose contract | Standard Compose publishes only frontend Nginx; PostgreSQL and backend remain private. Public edge/network policy remains deployment-owned. |
| Voyage/SBERT runtime boundary | VERIFIED in Compose contract | Voyage is required and its blank production key is startup-fatal; SBERT is `legacy-sbert` research-only and has no standard runtime path. |
| Dependency review | PARTIALLY VERIFIED | Lockfile installs and CI are configured. No third-party vulnerability audit is performed in this PR. |
| Log redaction | PARTIALLY VERIFIED | Docs prohibit secrets in evidence. Broader structured redaction policy is not independently audited. |
| Backup/restore | DEFERRED | No live backup/restore drill has been started in Phase 6. |
| Monitoring | DEFERRED | Liveness/readiness and stdout/stderr logs exist; no centralized monitoring or alerting phase is configured. |
| Incident response ownership | NOT VERIFIED | Deployment owner/contact must be assigned outside this repository. |
| Demo accounts disabled or rotated | NOT VERIFIED | Demo seed scripts exist. Public deployment must avoid or rotate demo credentials. |

## Minimum Public-Production Preconditions

Before any public production deployment, verify:

1. HTTPS is enforced at the edge.
2. `NODE_ENV=production`.
3. `JWT_SECRET` is generated and stored in a secret manager.
4. `FRONTEND_URL` is the exact trusted public HTTPS origin; any `CORS_ORIGIN`
   is exact and never `*`.
5. `EMAIL_PROVIDER=smtp` and a controlled provider-delivery smoke has passed;
   `disabled` is reserved for synthetic/email-disabled staging, never public
   or departmental launch.
6. PostgreSQL and the backend are not publicly exposed; SBERT remains disabled
   unless a research-only `legacy-sbert` profile is intentionally run.
7. Backups are configured and restore-tested in a separately approved future
   phase.
8. Monitoring and incident ownership are in place before a later public launch.
9. Demo credentials are removed, disabled, or rotated.
10. Audit retention settings are reviewed for the deployment and exported audit evidence is stored outside the repository.
11. Container deployments replace local Compose placeholder secrets and retain
    the private database/backend topology.
