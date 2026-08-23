# Environment and Configuration Matrix

This matrix documents the environment variables currently used by the repository. Do not add secrets to this file, `.env` files, release notes, smoke evidence, or generated reports.

## Release Target Classification

| Mode | Status | Notes |
| --- | --- | --- |
| Local native development | SUPPORTED | PostgreSQL, SBERT, backend, and frontend are started directly on the host. |
| Local integrated demo | SUPPORTED | Requires local database migrations, SBERT service health, backend readiness, and frontend dev/preview host. |
| Controlled release candidate deployment | CONDITIONALLY SUPPORTED | Supported only when the release gate passes in the target environment and operations are documented. |
| Public HTTPS production deployment | NOT VERIFIED | Requires HTTPS, secrets, backup ownership, monitoring, SMTP transport, and incident response proof. |
| Containerized deployment | SUPPORTED FOR LOCAL/STAGING-STYLE VERIFICATION | Root Compose includes PostgreSQL, backend, frontend, SBERT, and a profile-only migration target. Public production container deployment remains unverified. |
| Single-host deployment | CONDITIONALLY SUPPORTED | Native process deployment is documented; process manager/reverse proxy setup remains environment-owned. |
| Horizontal scaling | NOT VERIFIED | Session cookies are JWT-backed, but the current rate-limit and Voyage readiness-probe caches are process-local. A shared rate-limit store or gateway policy, provider-cost review, uploads, and operational topology must be validated before scale-out. |
| Database backup/restore | CONDITIONALLY SUPPORTED | Commands are documented with placeholders; real backup drills are not verified. |
| Real email delivery | SMTP SMOKE WORKFLOW ADDED, PROVIDER-SMOKE RESULT ENVIRONMENT-OWNED | SMTP transport support exists and `npm run smoke:smtp` can send one controlled provider-smoke email when deployment-owned SMTP credentials are supplied. Provider proof is still pending until the smoke is run against the chosen provider. |
| Voyage semantic provider availability | CONDITIONALLY SUPPORTED AFTER LIVE VERIFICATION | Full readiness requires a recently verified Voyage credential/provider result; configured, stale, unavailable, or absent provider status is degraded. |
| SBERT service availability | NOT A CURRENT READINESS GATE | Legacy SBERT configuration remains in the repository, but the current semantic similarity route and readiness gate use Voyage. |
| Monitoring/alerting | NOT VERIFIED | Health/readiness endpoints are available; monitoring system selection is not implemented here. |
| Zero-downtime deployment | NOT VERIFIED | No load balancer, rolling deploy, or blue/green workflow is included. |

## Backend Variables

| Variable | Classification | Secret | Default | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Optional | No | `development` | Set `production` for controlled deployments. |
| `PORT` | Optional | No | `3000` | Backend listens on `0.0.0.0:<PORT>`. |
| `API_VERSION` | Optional | No | `v1` | Returned by health endpoints. |
| `DATABASE_URL` | Required in all environments | Yes | None | PostgreSQL connection string used by Prisma. |
| `SHADOW_DATABASE_URL` | Development/test only | Yes | None | Used by Prisma development migrations when needed. |
| `JWT_SECRET` | Required in production and Compose | Yes | Local fallback outside production; no Compose fallback | Production rejects weak, short, and placeholder values. Use at least 32 random characters; Compose requires an explicitly supplied value. |
| `JWT_EXPIRES_IN` | Optional | No | `24h` | JWT session lifetime. |
| `AUTH_COOKIE_NAME` | Optional | No | `rtadss_session` | Session cookie name. |
| `RESET_TOKEN_EXPIRES_MINUTES` | Optional | No | `30` | Password reset token expiry. |
| `FRONTEND_URL` | Required in production | No | `http://localhost:5173` outside production | Preferred effective browser origin for CORS and emailed invitation/password-reset links. It must be one bare `http(s)` origin (no path, query, fragment, or credentials) and must be `https://` in production. |
| `CORS_ORIGIN` | Required in production if `FRONTEND_URL` unset | No | `FRONTEND_URL` fallback | Single-origin fallback only; it is not a comma-separated allowlist. A missing effective origin is rejected in production and `*` is rejected in every mode. |
| `CORS_CREDENTIALS` | Optional | No | `true` | Enables credentialed CORS. Keep `true` when browser cookie authentication crosses origins; setting `false` prevents credentialed browser requests. |
| `TRUST_PROXY` | Deployment topology setting | No | `false` | Safe values: `false`, `0`-`10` hops, `loopback`, `linklocal`, `uniquelocal`, or a comma-separated exact IP/CIDR list. `true` and `*` are rejected; select only the known proxy path. |
| `VOYAGE_API_KEY` | Required for semantic similarity/full readiness | Yes | None | Backend-only Voyage credential. It must be held in a secret store, never logged, committed, or sent to the frontend. A missing key yields degraded readiness and semantic requests fail closed. |
| `VOYAGE_REQUEST_TIMEOUT_MS` | Optional | No | `10000` | Per-embedding request deadline in milliseconds (1000-60000). A timeout is reported as semantic-provider failure; no fallback provider is used. |
| `VOYAGE_READINESS_PROBE_CACHE_MS` | Optional | No | `300000` | Per-process cache duration for the bounded, low-cost Voyage readiness probe (10000-3600000 ms). |
| `SBERT_SERVICE_URL` | Legacy/compatibility | No | `http://localhost:8000` | Retained service configuration; it is not the current semantic route/readiness provider. |
| `SBERT_TIMEOUT` | Legacy/compatibility | No | `30000` in config, `5000` in SBERT service module fallback | Legacy request timeout in milliseconds. |
| `SBERT_RETRY_ATTEMPTS` | Legacy/compatibility | No | `3` | Retained for service clients that use retry policy. |
| `RATE_LIMIT_WINDOW_MS` | Optional | No | `900000` | Broad limiter window in milliseconds. |
| `RATE_LIMIT_MAX` | Optional | No | `10000` | Broad low-cost quota. Valid sessions are keyed by user ID; public traffic falls back to client IP so a shared departmental NAT does not collapse ordinary authenticated traffic. |
| `RATE_LIMIT_IPV6_SUBNET_PREFIX` | Optional | No | `56` | Prefix used to group IPv6 addresses for IP-keyed limits (allowed `/32`-`/64`). This prevents a caller from rotating IPv6 host bits to obtain fresh buckets. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Optional | No | `900000` | Shared window in milliseconds for dedicated authentication, recovery, invitation, and admin-action limits. |
| `LOGIN_RATE_LIMIT_MAX` | Optional | No | `30` | Login IP-keyed limit per auth window. |
| `LOGIN_IDENTIFIER_RATE_LIMIT_MAX` | Optional | No | `8` | Login limit keyed by client IP plus a hashed normalized email identifier; the raw email is not used as the limit key. |
| `FORGOT_PASSWORD_RATE_LIMIT_MAX` | Optional | No | `15` | Forgot-password IP-keyed limit per auth window. |
| `INVITATION_VALIDATION_RATE_LIMIT_MAX` | Optional | No | `30` | Invitation-token validation IP-keyed limit per auth window. |
| `INVITATION_ACCEPTANCE_RATE_LIMIT_MAX` | Optional | No | `10` | Invitation acceptance IP-keyed limit per auth window. |
| `RESET_PASSWORD_RATE_LIMIT_MAX` | Optional | No | `10` | Password-reset IP-keyed limit per auth window. |
| `ADMIN_ACCOUNT_ACTION_RATE_LIMIT_MAX` | Optional | No | `30` | Dedicated authenticated-administrator limit for invitation and credential-reset actions. |
| `ADMIN_BULK_INVITATION_RATE_LIMIT_MAX` | Optional | No | `10` | Dedicated authenticated-administrator limit for bulk-invitation actions. |
| `ADMIN_TOPIC_IMPORT_RATE_LIMIT_MAX` | Optional | No | `5` | Dedicated authenticated-administrator limit for topic-import commit requests, which generate paid Voyage document embeddings. Preview requests do not use this limiter. |
| `SIMILARITY_RATE_LIMIT_WINDOW_MS` | Optional | No | `900000` | Window in milliseconds for expensive semantic similarity checks. |
| `SIMILARITY_RATE_LIMIT_MAX` | Optional | No | `30` | Semantic-check quota per window, keyed by authenticated user after authentication (IP fallback only before it). |
| `JSON_BODY_LIMIT_BYTES` | Optional | No | `102400` | JSON and URL-encoded request-body maximum (1024-5242880 bytes). Requests beyond it receive a 413 response. |
| `IMPORT_UPLOAD_LIMIT_BYTES` | Optional | No | `5242880` | Multipart topic-import file maximum (1024-52428800 bytes). Oversized import files receive a 413 response. |
| `IMPORT_UPLOAD_MAX_FIELDS` | Optional | No | `10` | Maximum multipart text fields accepted with a topic-import workbook (1-100). |
| `IMPORT_UPLOAD_MAX_PARTS` | Optional | No | `12` | Maximum multipart parts accepted with a topic-import workbook (2-200); it must allow the configured fields plus one file. |
| `IMPORT_UPLOAD_FIELD_SIZE_BYTES` | Optional | No | `16384` | Maximum size of one multipart text field (1024-1048576 bytes). |
| `EMAIL_PROVIDER` | Required in production | No | `mock` outside production | Allowed values: `mock`, `disabled`, `smtp`. Production rejects `mock`. |
| `EMAIL_FROM` | Required for `smtp` | No | `no-reply@localhost` | Sender address for SMTP password reset email. |
| `SMTP_HOST` | Required for `smtp` | No | None | SMTP provider host placeholder. |
| `SMTP_PORT` | Required for `smtp` | No | None | SMTP provider port. Must be a valid TCP port. |
| `SMTP_SECURE` | Optional | No | `false` | TLS mode flag for SMTP configuration. Must be `true` or `false`. |
| `SMTP_USER` | Optional | Yes | None | SMTP username if provider requires authentication. Must be paired with `SMTP_PASSWORD`. |
| `SMTP_PASSWORD` | Optional | Yes | None | SMTP password if provider requires authentication. Must be paired with `SMTP_USER`; never log or commit it. |
| `SMTP_TIMEOUT_MS` | Optional | No | `10000` | SMTP connection/greeting/socket timeout in milliseconds. |
| `SMTP_SMOKE_TO` | Manual smoke only | No | None | Controlled recipient for `npm run smoke:smtp`. Required only for provider smoke verification. |
| `INVITATION_EXPIRES_HOURS` | Optional | No | `168` (7 days) | Account-invitation link lifetime in hours (1–720). Reset links keep their own `RESET_TOKEN_EXPIRES_MINUTES` policy. |
| `AUDIT_LOG_RETENTION_DAYS` | Optional governance setting | No | `365` | Default audit retention period used when purge requests do not provide a cutoff. Must be a positive integer and at least the purge minimum age. |
| `AUDIT_LOG_PURGE_MIN_AGE_DAYS` | Optional governance setting | No | `90` | Minimum age for audit purge eligibility. Zero is rejected. |
| `AUDIT_LOG_PURGE_MAX_BATCH` | Optional governance setting | No | `1000` | Maximum audit rows deleted by one purge request. Bounded by backend validation. |
| `LOG_LEVEL` | Optional | No | `info` | Logging verbosity. |
| `LOG_FILE` | Optional | No | `logs/app.log` | Log file path. |
| `SIMILARITY_TIER2_THRESHOLD` | Optional compatibility setting | No | `0.60` | Present in config; PR #107 does not change the approved scoring contract. |
| `SIMILARITY_TIER3_TIME_WINDOW_HOURS` | Optional compatibility setting | No | `48` | Present in config; PR #107 does not change the approved scoring contract. |
| `REQUIRE_PGVECTOR` | Test/deployment validation option | No | unset | When `true`, database tests require the pgvector extension. |

## Frontend Variables

| Variable | Classification | Secret | Default | Notes |
| --- | --- | --- | --- | --- |
| `PLAYWRIGHT_BASE_URL` | Test only | No | `http://127.0.0.1:5173` | Smoke-test target. |
| `PLAYWRIGHT_CAPTURE_SMOKE` | Test only | No | unset | Enables smoke artifacts when supported by tests. |
| `VITE_API_URL` | Historical/stale docs reference | No | Not used by `src/api/client.js` | Current API client uses relative `/api/v1`, so production static hosting must proxy `/api` to the backend or serve frontend behind the same origin. |

## Release Gate Variables

| Variable | Classification | Secret | Default | Notes |
| --- | --- | --- | --- | --- |
| `RELEASE_CHECK_ALLOW_DIRTY` | Release tooling | No | unset | Set to `1` while validating an uncommitted PR. Leave unset for final clean-main gate. |
| `RELEASE_CHECK_SMOKE` | Release tooling | No | unset | Set to `1` to include credentialed frontend smoke. |
| `SBERT_PYTHON` | Release tooling | No | auto-detected | Optional path to the Python executable for SBERT tests. |
| `SMOKE_STUDENT_EMAIL` / `SMOKE_STUDENT_PASSWORD` | Smoke only | Yes | None | Do not commit. |
| `SMOKE_LECTURER_EMAIL` / `SMOKE_LECTURER_PASSWORD` | Smoke only | Yes | None | Do not commit. |
| `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` | Smoke only | Yes | None | Do not commit. |

## Docker Compose Variables

| Variable | Classification | Secret | Default | Notes |
| --- | --- | --- | --- | --- |
| `POSTGRES_DB` | Compose only | No | `topic_similarity` | Local database name. |
| `POSTGRES_USER` | Compose only | No | `topic_similarity` | Local database user. |
| `POSTGRES_PASSWORD` | Compose/local secret | Yes | None in Compose | Required explicitly before Compose starts. Never commit it; use a unique local value and replace it for shared/staging use. |
| `COMPOSE_BIND_HOST` | Compose only | No | `127.0.0.1` | Host address for published Compose ports. Localhost is the safe default; do not expose it publicly as a substitute for a reviewed private network/HTTPS edge. |
| `POSTGRES_PORT` | Compose only | No | `5432` | Host port for local PostgreSQL. |
| `BACKEND_PORT` | Compose only | No | `3000` | Host port for backend API. |
| `FRONTEND_PORT` | Compose only | No | `8080` | Host port for Nginx static frontend. |
| `SBERT_PORT` | Compose only | No | `8000` | Host port for SBERT service. |
| `SBERT_LOG_LEVEL` | Compose only | No | `INFO` | SBERT container log level. |
| `VOYAGE_API_KEY` | Compose/backend secret | Yes | Empty for degraded local verification | Passed explicitly to the backend; a real deployment-owned key is required for semantic similarity and full readiness. Never commit it or bake it into an image. |
| `VOYAGE_REQUEST_TIMEOUT_MS` | Compose/backend configuration | No | `10000` | Passed explicitly to the backend; bounded per-embedding Voyage request deadline. |
| `VOYAGE_READINESS_PROBE_CACHE_MS` | Compose/backend configuration | No | `300000` | Passed explicitly to the backend; per-process cache interval for the low-cost Voyage readiness probe. |
| `FULLSTACK_BACKEND_HEALTH_URL` | Smoke only | No | `http://127.0.0.1:3000/api/v1/health` | Override for `npm run docker:smoke`. |
| `FULLSTACK_BACKEND_READINESS_URL` | Smoke only | No | `http://127.0.0.1:3000/api/v1/readiness` | Override for `npm run docker:smoke`. |
| `FULLSTACK_SBERT_HEALTH_URL` | Smoke only | No | `http://127.0.0.1:8000/health` | Override for `npm run docker:smoke`. |
| `FULLSTACK_FRONTEND_URL` | Smoke only | No | `http://127.0.0.1:8080/` | Override for `npm run docker:smoke`. |

## Cookie, CORS, and Proxy Notes

- Session cookies are `httpOnly`.
- `secure` is enabled automatically when `NODE_ENV=production`.
- `sameSite` is `lax`.
- No cookie domain/path override is currently configured.
- The server permits credentialed CORS only for the one normalized effective browser origin (`FRONTEND_URL`, otherwise `CORS_ORIGIN`); it does not reflect untrusted origins. Non-browser requests without an `Origin` header remain possible for operational endpoints.
- Production requires an explicit `https://` effective origin. Wildcard `*` is rejected in every mode. The origin must contain only scheme, host, and optional port; it cannot include a path, query, fragment, or credentials.
- State-changing requests carrying the configured session cookie are CSRF-sensitive. In production, the request must include an `Origin` or `Referer` resolving to the configured browser origin; missing or untrusted values receive `403 CSRF_ORIGIN_REJECTED`. Public reset/invitation flows do not use the session cookie and retain their narrow one-time-token authorization model.
- `TRUST_PROXY` is disabled by default. When TLS terminates at a reverse proxy, set it to the exact known hop count, named subnet, or IP/CIDR range only after verifying that direct clients cannot inject trusted forwarding headers. `true` and `*` are intentionally rejected.

## Rate-limit deployment boundary

The application uses `express-rate-limit` with its process-local memory store. The quotas above therefore apply independently to each backend process and reset when that process restarts. The per-user keys protect ordinary authenticated users sharing a NAT on one process, while IP-keyed limits group IPv6 clients by the configured subnet prefix; neither creates a cluster-wide quota.

Before a horizontally scaled or multi-instance deployment relies on these controls for abuse prevention, deploy a shared rate-limit store or enforce equivalent coordinated limits at a managed gateway. That infrastructure is not configured by this repository and needs deployment-specific verification.

## Voyage provider readiness behavior

`GET /api/v1/readiness` exposes the semantic provider as `checks.semanticProvider` and `details.semanticProvider`; it does not return the Voyage key or raw provider failures. Its possible provider statuses are:

| Provider status | Meaning | Readiness result |
| --- | --- | --- |
| `not_configured` | `VOYAGE_API_KEY` is absent. | `503`, overall `degraded` when the database is available. |
| `configured_not_yet_verified` | A key exists but the bounded live probe has not completed successfully. | `503`, overall `degraded`. |
| `available` | A bounded minimal Voyage query probe has succeeded within the configured cache window. | Eligible for `200`, overall `ready` when the database is also available. |
| `unavailable` | The latest bounded probe failed. | `503`, overall `degraded`. |
| `stale` | The cached probe result expired while a background refresh is started. | `503`, overall `degraded` until a current verification succeeds. |

The probe uses a minimal fixed readiness input, not departmental topic data. It is cached for `VOYAGE_READINESS_PROBE_CACHE_MS`, so readiness does not make a provider request on every hit. The cache is per process, so multiple backend instances may each make one probe per cache window. Database failure remains `503 not_ready` regardless of provider status.
