# Monitoring, Logging, and Operational Diagnosis

Phase-7 contract for how the running system is observed and how failures are
diagnosed. Companion documents: `incident-playbooks.md` (what to do),
`backup-and-restore-runbook.md` (recovery), `data-recovery-classification.md`
(what data matters).

## Logging architecture

- **Production format**: one JSON object per line on stdout/stderr
  (`timestamp`, `level`, `message`, plus safe structured fields). The hosting
  platform's stdout/stderr capture is the **primary durable log record**.
- **Local files** (`backend/logs/error.log`, `combined.log`) are secondary
  convenience copies only. Container/host filesystem logs are **not durable**
  and must never be treated as the system of record or as the audit record.
- **Development format** stays human-friendly (colorized line + JSON metadata
  suffix).
- **Redaction is enforced in the logger itself**: metadata keys matching the
  credential families (password/credential/token/secret/authorization/cookie/
  jwt/session/apikey/database_url/connection string) are replaced with
  `[redacted]` before any transport sees them, and `Error` values are reduced
  to name+message. This is defense in depth on top of call sites that already
  never pass secrets. Verified by tests and by the Phase-7 rehearsal (logs
  contained no temporary credentials, chosen passwords, connection strings,
  or the JWT secret).
- `LOG_LEVEL` default `info`; set `http` to enable per-request completion
  logs (see below).

## Request correlation

- Every request receives a request ID (`crypto.randomUUID()`); an upstream
  `X-Request-Id` from the edge is accepted only if it matches the strict
  opaque shape `[A-Za-z0-9._-]{8,64}` — anything else is replaced, and
  accepted values are treated purely as opaque log data.
- The ID is returned in the `X-Request-Id` response header, attached to
  `req.requestId`, included in every request-completion log line and in the
  central error-handler log entry.
- Diagnosis flow: *"the checker failed"* → user/screenshot supplies the
  response `X-Request-Id` → operator searches platform logs for that ID →
  finds the completion line (route, status, duration, userId) and the error
  line (category, safe message).

## Request-completion logging

- Status ≥ 500 → `error` level, always visible ("Request failed").
- Everything else → `http` level ("Request completed"), enabled by
  `LOG_LEVEL=http` so routine traffic does not spam default operation.
- Fields: `requestId`, `method`, `path` (query string stripped),
  `statusCode`, `durationMs`, `userId` (when authenticated), `ip`.

## Error categories (internal taxonomy)

The central error handler tags every logged error with one category —
`AUTHENTICATION, AUTHORIZATION, VALIDATION, RATE_LIMIT, DATABASE,
VOYAGE_PROVIDER, SMTP_PROVIDER, IMPORT, CORPUS, INTERNAL` — derived from the
error's type/code/status. Categories exist for logs, filtering, and alerting
only; user-facing response contracts from earlier phases are unchanged, and
production 500 responses stay generic (no stack traces, paths, or provider
details — test-enforced).

## Operational events (state changes, not spam)

| Event | Where | Level |
| --- | --- | --- |
| Startup ("Server is listening", with version/buildId/node version) | server lifecycle | info |
| Graceful shutdown started/completed, forced-drain warnings | server lifecycle | info/warn |
| Fatal uncaught failure (see policy below) | server lifecycle | error |
| Database connectivity lost/recovered | readiness checks | error/info (transition only) |
| Voyage provider status changed (available↔unavailable, with failure code) | provider-status probe | info/warn (transition only) |
| Resident corpus refresh failed/recovered | resident corpus | error/info (once per outage) |
| SMTP delivery failure (classified reason code) | email service | error |
| Import preview/commit and bulk-onboarding outcomes | audit events + controllers | audited |
| Login failures/abuse | auth audit events + rate-limit responses | audited |

Provider-readiness state is logged **only on change** — a provider that stays
down produces one warning, not one per poll.

## Fatal failure policy

`uncaughtException` and `unhandledRejection` are handled: one redacted fatal
event is logged (kind, message, stack — to operator logs only), a normal
graceful shutdown is attempted (drain + Prisma disconnect), and a 10-second
failsafe guarantees the process exits even if shutdown hangs. Exit code is
always non-zero, so the platform restarts a clean process rather than leaving
a corrupted one serving traffic. Clients never receive stack traces.

## Health, readiness, and what blocks traffic

- `/health` (and `/api/v1/health`) = **liveness** only: process responds.
  Never calls the database or providers.
- `/api/v1/readiness` = **traffic admission**:
  - database unavailable → `not_ready` (503). The only hard dependency.
  - Voyage `not_configured`/`configured_not_yet_verified`/`stale`/
    `unavailable` → `degraded` (503): the DSS's core purpose is semantic
    checking, so unverified/unavailable Voyage blocks admission. Verification
    uses one bounded minimal probe per cache window (default 5 min), never a
    probe per request.
  - email `disabled` does **not** block readiness: the product contract makes
    email an operational capability (invitations/recovery), not a core-DSS
    dependency. Readiness reports it truthfully (`configured` = EMAIL READY,
    `disabled` = EMAIL CAPABILITY DISABLED) so operators can see the state.
- Raw provider errors never appear in readiness bodies — statuses, safe
  messages, timestamps, and short failure codes only.

## Admin diagnostics

`GET /api/v1/admin/system-status` (admin-only, not a public debug endpoint)
returns: application version/buildId/apiVersion/environment/node version/
uptime, database state, Voyage provider state (status + probe timestamps +
failure code), email capability, and resident-corpus stats (built, topic
count, searchable count, builtAt, lastRefreshError). It contains no secrets,
environment values, connection strings, filesystem paths, or stack traces
(test-enforced). The existing audit-log UI remains the governance surface;
no additional dashboard UI was added.

## Audit log vs application log

- **Audit log (PostgreSQL `audit_logs`, admin UI, retention policy)** = "who
  did what": logins/failures, provisioning, invitations, imports, decisions,
  status changes, purges. It is part of the authoritative data set and is
  backed up. Application stdout is **not** an acceptable substitute for this
  record.
- **Application log (stdout JSON)** = "what happened technically": requests,
  errors with categories, provider transitions, lifecycle. Transient
  technical noise never goes into the audit tables.
- Both redact credential material by construction.

## Platform log requirements (vendor selection deferred)

The chosen hosting/observability platform must provide: stdout/stderr
capture from the container/process; search by request ID and free text;
retention of at least 30 days (90 preferred for security review); access
restricted to authorized operators; alert rules on log/metric conditions
(below); export on demand for incident evidence. Until then, local files are
convenience-only and rotation of them is a non-goal.

## Alert conditions (initial, operator-tunable)

Numeric values are starting points, not policy; tune after observing real
traffic.

**CRITICAL**
- Backend liveness failing (health check down > 2 consecutive minutes) or
  container crash-looping (> 3 restarts / 10 min — watch for the fatal-event
  log line).
- Readiness `not_ready` (database unreachable) > 2 minutes.
- Backup job failure or missed schedule (provider-side alert).

**HIGH**
- Readiness `degraded` (Voyage unavailable/stale) sustained > 15 minutes —
  log line `Voyage provider status changed` with `to: unavailable`.
- 5xx rate above ~2% of requests over 10 minutes (`Request failed` lines).
- Repeated SMTP delivery failures (> 5 in 10 min — `SMTP email delivery
  failed`, or invitation `delivery.status: failed` bursts).
- Disk/storage pressure on the DB (provider metric > 80% capacity).

**SECURITY**
- Login-abuse bursts: high `AUTH_LOGIN_FAILED` audit rate or sustained 429s
  on `/auth/login` (category `RATE_LIMIT`).
- Repeated 401/403 on `/api/v1/admin/*` from the same source.
- Any appearance of `Fatal uncaught failure` (investigate even single
  occurrences).
