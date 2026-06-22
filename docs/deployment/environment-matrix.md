# Environment and Configuration Matrix

This matrix documents the environment variables actually used by the repository as of PR #115. Do not add secrets to this file, `.env` files, release notes, smoke evidence, or generated reports.

## Release Target Classification

| Mode | Status | Notes |
| --- | --- | --- |
| Local native development | SUPPORTED | PostgreSQL, SBERT, backend, and frontend are started directly on the host. |
| Local integrated demo | SUPPORTED | Requires local database migrations, SBERT service health, backend readiness, and frontend dev/preview host. |
| Controlled release candidate deployment | CONDITIONALLY SUPPORTED | Supported only when the release gate passes in the target environment and operations are documented. |
| Public HTTPS production deployment | NOT VERIFIED | Requires HTTPS, secrets, backup ownership, monitoring, SMTP transport, and incident response proof. |
| Containerized deployment | SUPPORTED FOR LOCAL/STAGING-STYLE VERIFICATION | Root Compose includes PostgreSQL, backend, frontend, and SBERT. Public production container deployment remains unverified. |
| Single-host deployment | CONDITIONALLY SUPPORTED | Native process deployment is documented; process manager/reverse proxy setup remains environment-owned. |
| Horizontal scaling | NOT VERIFIED | Session cookies are JWT-backed, but SBERT, uploads, rate limits, and operational topology are not validated for scale-out. |
| Database backup/restore | CONDITIONALLY SUPPORTED | Commands are documented with placeholders; real backup drills are not verified. |
| Real email delivery | IMPLEMENTED, PROVIDER-SMOKE NOT VERIFIED | SMTP transport support exists for password reset delivery. Real provider smoke testing remains environment-owned. |
| SBERT availability | SUPPORTED AFTER VALIDATION | Local SBERT-active pilot evidence exists; release readiness still requires health checks in the target environment. |
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
| `JWT_SECRET` | Required in production | Yes | Local fallback outside production | Production rejects weak, short, and placeholder values. Use at least 32 random characters. |
| `JWT_EXPIRES_IN` | Optional | No | `24h` | JWT session lifetime. |
| `AUTH_COOKIE_NAME` | Optional | No | `rtadss_session` | Session cookie name. |
| `RESET_TOKEN_EXPIRES_MINUTES` | Optional | No | `30` | Password reset token expiry. |
| `FRONTEND_URL` | Required in production | No | `http://localhost:5173` outside production | Used for CORS and password-reset links. Preferred over `CORS_ORIGIN` when both are set. |
| `CORS_ORIGIN` | Required in production if `FRONTEND_URL` unset | No | `FRONTEND_URL` fallback | Fallback origin when `FRONTEND_URL` is unset. Production rejects missing effective origin and effective `*`. |
| `CORS_CREDENTIALS` | Optional | No | `true` | Must remain compatible with cookie auth. |
| `SBERT_SERVICE_URL` | Optional | No | `http://localhost:8000` | Backend URL for SBERT `/health` and `/embed`. |
| `SBERT_TIMEOUT` | Optional | No | `30000` in config, `5000` in SBERT service module fallback | Request timeout in milliseconds. |
| `SBERT_RETRY_ATTEMPTS` | Optional | No | `3` | Configured for service clients that use retry policy. |
| `RATE_LIMIT_WINDOW_MS` | Optional | No | `900000` | Express rate-limit window. |
| `RATE_LIMIT_MAX` | Optional | No | `100` | Maximum requests per window per IP. |
| `EMAIL_PROVIDER` | Required in production | No | `mock` outside production | Allowed values: `mock`, `disabled`, `smtp`. Production rejects `mock`. |
| `EMAIL_FROM` | Required for `smtp` | No | `no-reply@localhost` | Sender address for SMTP password reset email. |
| `SMTP_HOST` | Required for `smtp` | No | None | SMTP provider host placeholder. |
| `SMTP_PORT` | Required for `smtp` | No | None | SMTP provider port. Must be a valid TCP port. |
| `SMTP_SECURE` | Optional | No | `false` | TLS mode flag for SMTP configuration. Must be `true` or `false`. |
| `SMTP_USER` | Optional | Yes | None | SMTP username if provider requires authentication. Must be paired with `SMTP_PASSWORD`. |
| `SMTP_PASSWORD` | Optional | Yes | None | SMTP password if provider requires authentication. Must be paired with `SMTP_USER`; never log or commit it. |
| `SMTP_TIMEOUT_MS` | Optional | No | `10000` | SMTP connection/greeting/socket timeout in milliseconds. |
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
| `POSTGRES_PASSWORD` | Compose/local secret | Yes | Local placeholder | Replace for shared/staging use; never commit real values. |
| `POSTGRES_PORT` | Compose only | No | `5432` | Host port for local PostgreSQL. |
| `BACKEND_PORT` | Compose only | No | `3000` | Host port for backend API. |
| `FRONTEND_PORT` | Compose only | No | `8080` | Host port for Nginx static frontend. |
| `SBERT_PORT` | Compose only | No | `8000` | Host port for SBERT service. |
| `SBERT_LOG_LEVEL` | Compose only | No | `INFO` | SBERT container log level. |
| `FULLSTACK_BACKEND_HEALTH_URL` | Smoke only | No | `http://127.0.0.1:3000/api/v1/health` | Override for `npm run docker:smoke`. |
| `FULLSTACK_BACKEND_READINESS_URL` | Smoke only | No | `http://127.0.0.1:3000/api/v1/readiness` | Override for `npm run docker:smoke`. |
| `FULLSTACK_SBERT_HEALTH_URL` | Smoke only | No | `http://127.0.0.1:8000/health` | Override for `npm run docker:smoke`. |
| `FULLSTACK_FRONTEND_URL` | Smoke only | No | `http://127.0.0.1:8080/` | Override for `npm run docker:smoke`. |

## Cookie, CORS, and Proxy Notes

- Session cookies are `httpOnly`.
- `secure` is enabled automatically when `NODE_ENV=production`.
- `sameSite` is `lax`.
- No cookie domain/path override is currently configured.
- No Express `trust proxy` configuration is currently implemented. If deployed behind a TLS-terminating reverse proxy, document and test the proxy behavior before public production use.
- Production CORS must use an explicit trusted origin and must not be `*`.
