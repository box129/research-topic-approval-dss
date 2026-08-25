# Production Environment Matrix

> **Authoritative Phase 6 configuration contract.** This matrix applies to the
> standard same-origin, single-backend deployment documented in the
> [production runbook](./deployment-runbook.md). It uses placeholders only;
> never commit real values, copied `.env` files, credentials, or database URLs.
>
> The standard production runtime is Node/Express, Nginx/static SPA,
> PostgreSQL, Voyage, and optional SMTP. SBERT/FastAPI is not a production
> dependency. If retained for research, its variables belong only to the
> explicit `legacy-sbert` profile described at the end of this document.

## Production configuration rules

- Set `NODE_ENV=production` and inject secrets at runtime through the platform
  secret store. The backend trims/case-normalizes the value, then accepts only
  `development`, `test`, or `production`; any other mode fails preflight.
- The public browser origin is one exact `https://` origin. The same-origin
  topology normally sets `FRONTEND_URL` and leaves `CORS_ORIGIN` unset.
- PostgreSQL, the backend, and maintenance jobs are private-network services;
  do not expose their ports as a shortcut around the HTTPS edge.
- `VOYAGE_API_KEY` is required in production and a blank/missing value is
  startup-fatal. Similarity has no SBERT, lexical, or fabricated-vector
  fallback.
- Failure behavior describes the production operational outcome. A value marked
  “startup validation” must prevent the service from starting; a readiness
  failure must prevent traffic admission.

## Backend, browser, and semantic provider

| Variable | Component | Requiredness | Secret | Placeholder only | Production requirement | Failure behavior |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Backend | Required | No | `production` | Must normalize to `production`; enables production cookie/config rules. | Unsupported mode fails startup validation; a non-production mode is not production-ready. |
| `PORT` | Backend | Optional/platform-supplied | No | `3000` | Private backend listener port; publish only through Nginx. | Platform cannot reach backend if mismatched. |
| `API_VERSION` | Backend | Optional | No | `v1` | Keep compatible with deployed API routing. | Health/API version mismatch; no secret exposure. |
| `DATABASE_URL` | Backend and migration job | Required | Yes | `postgresql://<user>:<password>@<private-host>:5432/<database>?schema=public&<provider-tls-options>` | Must target the dedicated staging or production PostgreSQL database and use provider-approved TLS/private networking. | Missing value fails startup validation; unreachable DB yields failed readiness and no traffic. |
| `SHADOW_DATABASE_URL` | Local migration authoring only | Not for production | Yes | `postgresql://<user>:<password>@<dev-host>:5432/<shadow-db>?schema=public` | Do not supply to the release runtime or migration deployment workflow. | Not required by `migrate deploy`; misuse can target the wrong development resource. |
| `JWT_SECRET` | Backend | Required | Yes | `<at-least-32-random-characters>` | Unique environment secret, not a known placeholder or reused development value. | Missing/weak/placeholder value fails production startup validation. |
| `JWT_EXPIRES_IN` | Backend | Optional | No | `24h` | Keep aligned with session policy; changing it changes session lifetime. | Existing/new session behavior changes; requires review. |
| `AUTH_COOKIE_NAME` | Backend/browser | Optional | No | `rtadss_session` | Keep stable across the same-origin frontend and backend. | Users may be logged out or retain an obsolete cookie name. |
| `FRONTEND_URL` | Backend/browser/email | Required | No | `https://<approved-origin>` | One bare HTTPS origin; used for CORS, CSRF, invitation links, and reset links. | Missing/invalid/non-HTTPS production origin fails startup validation. |
| `CORS_ORIGIN` | Backend/browser | Optional compatibility value | No | `https://<approved-origin>` | Normally unset for same-origin deployment; it is a local/non-production fallback only. If supplied in production, it must equal the required `FRONTEND_URL`. Never `*`. | Invalid/wildcard origin fails startup validation; mismatch blocks browser requests/CSRF. |
| `CORS_CREDENTIALS` | Backend/browser | Optional | No | `true` | Keep `true` for the cookie session contract; do not use it to justify wildcard CORS. | `false` prevents credentialed cross-origin use; unexpected value is configuration error. |
| `TRUST_PROXY` | Backend/edge topology | Required for the public proxy topology | No | `<exact-hop-count-or-proxy-cidr>` | Set only to the reviewed edge-to-Nginx-to-backend chain; `true` and `*` are forbidden. | Malformed/unsafe values fail startup validation; wrong topology can misidentify clients/protocol. |
| `VOYAGE_API_KEY` | Backend/Voyage | Required | Yes | `<voyage-secret>` | Backend-only key for `voyage-4-large`; inject at runtime and never send to browser/logs. | Missing/blank value is startup-fatal in production. |
| `VOYAGE_REQUEST_TIMEOUT_MS` | Backend/Voyage | Optional | No | `10000` | Integer 1000–60000; bounded provider request deadline. | Malformed/out-of-range value fails startup validation; provider timeout returns controlled semantic failure. |
| `VOYAGE_READINESS_PROBE_CACHE_MS` | Backend/Voyage | Optional | No | `300000` | Integer 10000–3600000; cache is per backend process. | Malformed/out-of-range value fails startup validation; stale/unavailable provider fails readiness. |
| `VOYAGE_READINESS_STALE_GRACE_MS` | Backend/Voyage | Optional | No | `60000` | Integer 1000–300000. Bounded stale-while-revalidate window: after the probe cache expires, a provider whose last verification **succeeded** keeps reporting `available` (with `revalidating: true`) while its replacement probe runs, so routine refresh cannot flap a healthy instance out of traffic. Maximum tolerated staleness is `VOYAGE_READINESS_PROBE_CACHE_MS + VOYAGE_READINESS_STALE_GRACE_MS`. | Malformed/out-of-range value fails startup validation. A failed probe ends the grace immediately; a provider that has never verified can never use it; beyond cache+grace readiness reports `stale` and fails. Never open-ended. |
| `SHUTDOWN_GRACE_PERIOD_MS` | Backend lifecycle | Optional | No | `300000` | Integer 180000–300000. Keep the reviewed 300000 ms application drain; the fixed 330-second Compose/platform allowance always leaves cleanup time. | Malformed/out-of-range value fails startup validation; too-short outer termination can cut off bounded drain/Prisma cleanup. |

## Email, recovery, and invitation configuration

| Variable | Component | Requiredness | Secret | Placeholder only | Production requirement | Failure behavior |
| --- | --- | --- | --- | --- | --- |
| `EMAIL_PROVIDER` | Backend/email | Required | No | `smtp` or `disabled` | `mock` is forbidden in production. Use `disabled` only for an explicitly email-disabled staging environment; use `smtp` for email-enabled operation. | Missing/invalid/`mock` value fails production validation; `disabled` fails email actions closed. |
| `EMAIL_FROM` | Backend/email | Required when SMTP | No | `no-reply@<approved-domain>` | Approved sender identity. | SMTP configuration validation fails when absent. |
| `SMTP_HOST` | Backend/email | Required when SMTP | No | `smtp.<provider.example>` | Provider hostname reachable through permitted egress. | SMTP configuration validation fails when absent; sending fails closed when unreachable. |
| `SMTP_PORT` | Backend/email | Required when SMTP | No | `587` | Valid provider TCP port. | Invalid/missing value fails SMTP configuration validation. |
| `SMTP_SECURE` | Backend/email | Required when SMTP | No | `false` | Literal boolean matching provider TLS mode. | Invalid value fails SMTP configuration validation. |
| `SMTP_USER` | Backend/email | Conditional | Yes | `<smtp-user>` | Supply only with `SMTP_PASSWORD` when provider requires authentication. | Unpaired credentials fail configuration validation. |
| `SMTP_PASSWORD` | Backend/email | Conditional | Yes | `<smtp-password-or-app-secret>` | Supply only with `SMTP_USER`; never log or commit. | Unpaired credentials fail configuration validation; rejected mail remains a provider failure. |
| `SMTP_TIMEOUT_MS` | Backend/email | Optional | No | `10000` | Bounded connection/greeting/socket timeout. | Invalid value must fail preflight; delivery returns controlled failure. |
| `SMTP_SMOKE_TO` | Manual SMTP smoke | Required only for smoke | No | `<controlled-test-recipient>` | Safe approved recipient only; do not persist in Git/evidence. | Smoke cannot run without it; this is not a runtime dependency. |
| `INVITATION_EXPIRES_HOURS` | Backend/auth | Optional | No | `168` | Integer 1–720. | Invalid/out-of-range value fails startup validation. |
| `RESET_TOKEN_EXPIRES_MINUTES` | Backend/auth | Optional | No | `30` | Positive session/recovery policy value. | Invalid value changes recovery behavior; validate in release preflight. |

## Phase 5 rate-limit configuration

All limits below are process-local in the chosen single backend instance. They
must not be represented as cluster-wide enforcement. Invalid numeric values
fail configuration validation; deliberate changes require security review.

| Variable | Component | Requiredness | Secret | Placeholder only | Production requirement | Failure behavior |
| --- | --- | --- | --- | --- | --- |
| `RATE_LIMIT_WINDOW_MS` | Backend/global limiter | Optional | No | `900000` | Integer 1000–86400000. | Invalid value fails startup validation. |
| `RATE_LIMIT_MAX` | Backend/global limiter | Optional | No | `10000` | Broad low-cost quota; authenticated sessions are user-keyed. | Invalid value fails startup validation; low value can deny normal traffic. |
| `RATE_LIMIT_IPV6_SUBNET_PREFIX` | Backend/IP limiter | Optional | No | `56` | Integer `/32`–`/64` for IPv6 IP-keyed buckets. | Invalid value fails startup validation. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Backend/auth limiter | Optional | No | `900000` | Shared auth/recovery/invitation/admin-action window. | Invalid value fails startup validation. |
| `LOGIN_RATE_LIMIT_MAX` | Backend/login | Optional | No | `30` | IP-keyed login quota. | Invalid value fails startup validation. |
| `LOGIN_IDENTIFIER_RATE_LIMIT_MAX` | Backend/login | Optional | No | `8` | IP plus hashed normalized identifier quota. | Invalid value fails startup validation. |
| `FORGOT_PASSWORD_RATE_LIMIT_MAX` | Backend/recovery | Optional | No | `15` | IP-keyed forgotten-password quota. | Invalid value fails startup validation. |
| `INVITATION_VALIDATION_RATE_LIMIT_MAX` | Backend/invitation | Optional | No | `30` | IP-keyed invitation-validation quota. | Invalid value fails startup validation. |
| `INVITATION_ACCEPTANCE_RATE_LIMIT_MAX` | Backend/invitation | Optional | No | `10` | IP-keyed invitation-acceptance quota. | Invalid value fails startup validation. |
| `RESET_PASSWORD_RATE_LIMIT_MAX` | Backend/recovery | Optional | No | `10` | IP-keyed password-reset quota. | Invalid value fails startup validation. |
| `ADMIN_ACCOUNT_ACTION_RATE_LIMIT_MAX` | Backend/admin | Optional | No | `30` | Authenticated-admin invitation/reset action quota. | Invalid value fails startup validation. |
| `ADMIN_BULK_INVITATION_RATE_LIMIT_MAX` | Backend/admin | Optional | No | `10` | Authenticated-admin bulk invitation quota. | Invalid value fails startup validation. |
| `ADMIN_TOPIC_IMPORT_RATE_LIMIT_MAX` | Backend/admin import | Optional | No | `5` | Authenticated-admin paid Voyage import-commit quota. | Invalid value fails startup validation. |
| `BULK_HASH_CONCURRENCY` | Backend/admin user import | Optional | No | _unset_ | Explicit bcrypt worker-pool size 1–8. Unset uses the measured default: one worker per **physical** core (from `/proc/cpuinfo` topology), never above the container's cgroup CPU quota, never above 8. bcrypt is CPU- and memory-hard, so sizing from logical/hyperthreaded processors oversubscribes and *reduces* throughput — measured on a 4-core/8-thread host, throughput fell about 24% at 6 workers and 30% at 8 versus 4. Set explicitly only after measuring the target host. | Malformed/out-of-range value fails startup validation. Setting it above the container's real CPU allowance slows bulk onboarding rather than speeding it up. |
| `SIMILARITY_RATE_LIMIT_WINDOW_MS` | Backend/semantic work | Optional | No | `900000` | Integer 1000–86400000. | Invalid value fails startup validation. |
| `SIMILARITY_RATE_LIMIT_MAX` | Backend/semantic work | Optional | No | `30` | User-keyed expensive semantic quota; protects direct and submission paths. | Invalid value fails startup validation. |

## Request, upload, audit, logging, and compatibility settings

| Variable | Component | Requiredness | Secret | Placeholder only | Production requirement | Failure behavior |
| --- | --- | --- | --- | --- | --- |
| `JSON_BODY_LIMIT_BYTES` | Backend/parser | Optional | No | `102400` | Integer 1024–5242880. | Invalid value fails startup validation; oversize request receives 413. |
| `IMPORT_UPLOAD_LIMIT_BYTES` | Backend/import | Optional | No | `5242880` | Integer 1024–5242880 (5 MiB file). The standard Nginx ingress has a 6 MiB multipart envelope so a maximum-size file reaches the backend. | Invalid value fails startup validation; oversize upload receives 413. |
| `IMPORT_UPLOAD_MAX_FIELDS` | Backend/import | Optional | No | `10` | Integer 1–10. Together with the 16 KiB field cap and 5 MiB file cap, this fits the standard ingress envelope. | Invalid value fails startup validation. |
| `IMPORT_UPLOAD_MAX_PARTS` | Backend/import | Optional | No | `12` | Integer 2–12 and at least fields plus one file. | Invalid/inconsistent value fails startup validation. |
| `IMPORT_UPLOAD_FIELD_SIZE_BYTES` | Backend/import | Optional | No | `16384` | Integer 1024–16384. Together with the field/file caps, this fits the 6 MiB ingress envelope. | Invalid value fails startup validation; excess field receives 413. |
| `AUDIT_LOG_RETENTION_DAYS` | Backend/audit governance | Optional | No | `365` | Positive value at least purge minimum age. | Invalid relationship/value fails startup validation. |
| `AUDIT_LOG_PURGE_MIN_AGE_DAYS` | Backend/audit governance | Optional | No | `90` | Positive controlled retention floor. | Invalid value fails startup validation. |
| `AUDIT_LOG_PURGE_MAX_BATCH` | Backend/audit governance | Optional | No | `1000` | Bounded administrative purge size. | Invalid value fails startup validation. |
| `LOG_LEVEL` | Backend/logging | Optional | No | `info` | Use a reviewed verbosity; preserve redaction and stdout/stderr output. | Invalid/unhelpful level impairs operations; no secret should be emitted. |
| `LOG_FILE` | Legacy compatibility setting | Not supported by the active logger | No | _none_ | Do not set or rely on this variable. The logger writes Console plus fixed `logs/error.log` and `logs/combined.log`; stdout/stderr is the operational sink and those local files are nondurable. | Setting it has no effect on the active logger; local files can disappear on replacement and are not a readiness signal. |
| `SIMILARITY_TIER2_THRESHOLD` | Historical compatibility/scoring config | Optional | No | `0.60` | Do not change in deployment work. | Any change is a methodology change and out of scope. |
| `SIMILARITY_TIER3_TIME_WINDOW_HOURS` | Historical compatibility/scoring config | Optional | No | `48` | Do not change in deployment work. | Any change is a lifecycle/scoring change and out of scope. |
| `REQUIRE_PGVECTOR` | Test/deployment validation option | Test-only | No | `true` | Do not use as a production runtime setting unless a separate database change is approved. | Validation may fail when extension is absent. |

## Compose, maintenance, and smoke variables

These variables are for the repository Compose deployment path. The target
platform may inject equivalent values through its own configuration system.

| Variable | Component | Requiredness | Secret | Placeholder only | Production requirement | Failure behavior |
| --- | --- | --- | --- | --- | --- |
| `POSTGRES_DB` | Local Compose PostgreSQL | Optional | No | `topic_similarity` | Use a dedicated non-defence database name. | Wrong value points application/migration at the wrong database. |
| `POSTGRES_USER` | Local Compose PostgreSQL | Optional | No | `topic_similarity` | Use a least-privilege non-superuser where practical. | Authentication fails if it differs from the connection URL. |
| `POSTGRES_PASSWORD` | Local Compose PostgreSQL | Required for local Compose DB | Yes | `<compose-postgres-password>` | Unique environment secret; never use example text in shared staging. | Compose refuses to start or database authentication fails. |
| `COMPOSE_BIND_HOST` | Compose port publishing | Optional | No | `127.0.0.1` | Keep local-only unless a reviewed HTTPS edge/private network requires another binding. | Unsafe broad binding can expose services; bad binding prevents reachability. |
| `FRONTEND_PORT` | Compose Nginx | Optional | No | `8080` | The HTTPS edge routes to this service; do not expose backend instead. | Browser/edge cannot reach SPA. |
| `FULLSTACK_FRONTEND_URL` | Deployment smoke override | Optional | No | `http://127.0.0.1:8080/` | Bare HTTP(S) frontend origin only; no credentials, path, query, or fragment. Verify the same-origin frontend entry point. | Invalid or credential-bearing values fail before output; smoke fails if SPA host/routing is wrong. |
| `FULLSTACK_SMOKE_TIMEOUT_MS` | Deployment smoke | Optional | No | `30000` | Integer 1000–300000. Per-check deadline, including readiness polling while the first Voyage probe converges; keep it independent of the 300-second reverse-proxy request budget. | Invalid value makes smoke fail before requests are run; too-short value can create false failures. |
| `RELEASE_CHECK_ALLOW_DIRTY` | Release tooling | Optional | No | `1` | Local PR validation only; leave unset for a clean release gate. | Gate correctly rejects unexpected dirty worktree. |
| `RELEASE_CHECK_SMOKE` | Release tooling | Optional | No | `1` | Enables credentialed smoke only with approved synthetic credentials. | Gate skips smoke or fails when required credentials are absent. |
| `RELEASE_CHECK_LEGACY_SBERT` | Legacy research tooling | Optional, legacy-only | No | `1` | Opt-in only to run the historical Python/SBERT evaluation checks; never set for the current Voyage deployment gate. `SBERT_PYTHON`, if used, is legacy-only too. | Unset skips the legacy checks; an enabled legacy environment may fail independently without blocking the current Voyage release contract. |
| `SMOKE_STUDENT_EMAIL`, `SMOKE_STUDENT_PASSWORD`, `SMOKE_LECTURER_EMAIL`, `SMOKE_LECTURER_PASSWORD`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD` | Credentialed smoke | Conditional | Yes | `<synthetic-smoke-credential>` | Synthetic staging accounts only; inject briefly and never commit. | Credentialed smoke cannot run. |

`backend-bootstrap` is an explicit `maintenance` profile operator target, not
an environment variable or startup service. After migrations and backend
readiness, an approved synthetic administrator may be created once with:

```powershell
docker compose --profile maintenance run --rm backend-bootstrap --email <admin-email> --name "<administrator name>"
```

It requires the reviewed target `DATABASE_URL`, `JWT_SECRET`, HTTPS
`FRONTEND_URL`, `TRUST_PROXY`, `EMAIL_PROVIDER`, and `VOYAGE_API_KEY` (plus SMTP settings when
SMTP is selected). It never runs a seed or starts automatically.

## Explicitly non-production legacy profile

`SBERT_SERVICE_URL`, `SBERT_TIMEOUT`, `SBERT_RETRY_ATTEMPTS`, `SBERT_PORT`,
`SBERT_LOG_LEVEL`, `SBERT_PYTHON`, and any Hugging Face model/cache setting are
**not part of the production environment matrix**. If the repository retains
them for historical research/evaluation, they may be used only with an explicit
`legacy-sbert` profile. Their absence must not affect the standard Compose
topology, backend startup, liveness, readiness, migration job, or browser flow.

## Configuration review checklist

Before release, verify without printing values:

1. Required secrets are present in the target secret store and no placeholder
   remains.
2. `VOYAGE_API_KEY` is present; a blank key must fail production startup.
3. `DATABASE_URL` identifies the correct isolated environment and approved TLS
   path.
4. `FRONTEND_URL`, `TRUST_PROXY`, and HTTPS edge topology match the deployed
   request path exactly.
5. SMTP is either deliberately disabled in staging or fully configured with
   controlled smoke evidence.
6. Request/proxy timeouts meet the 180-second minimum and 300-second configured
   target for the demonstrated 142-second bulk operation; outer container or
   platform termination grace is at least 330 seconds so the backend's
   300-second drain can finish.
7. No SBERT variable/profile is enabled in standard production startup.
