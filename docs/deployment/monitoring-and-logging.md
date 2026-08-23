# Monitoring and Logging Plan

## Status

> **Deferred observability reference.** The application exposes health and
> readiness endpoints and writes logs, but Phase 6 does not configure a
> centralized monitoring provider, alert route, dashboard, or retention system.
> The active operational sink is redacted stdout/stderr; use this document only
> to plan a later approved observability phase.

## Signals To Monitor

| Signal | Source | Expected |
| --- | --- | --- |
| Backend liveness | `GET /api/v1/health` | HTTP 200 and `status: "OK"` |
| Backend readiness | `GET /api/v1/readiness` | HTTP 200 and `status: "ready"` for full readiness |
| Database readiness | `/api/v1/readiness` details | `database: "available"` |
| Voyage readiness | `/api/v1/readiness` safe details | Provider state available and overall `status: "ready"` |
| Frontend availability | Static host root path | HTTP 200 |
| PostgreSQL storage | Database host metrics | Below approved disk threshold |
| Error rate | Backend logs or hosting metrics | Alert on sustained spikes |
| Authentication failures | Backend logs | Watch for abnormal bursts |
| SMTP delivery failures | Backend logs and provider dashboard | Alert when provider rejects mail |
| Audit purge/export activity | Admin audit logs | Review according to governance policy |

## Readiness Interpretation

Backend readiness policy:

- `ready`: API, database, and required Voyage provider state are available.
- any non-ready result: do not route real traffic. There is no SBERT, lexical,
  or fabricated-vector fallback in the Phase 6 runtime.

Do not hide `degraded` as healthy in production dashboards.

## Logging Rules

Logs must not include:

- passwords
- `JWT_SECRET`
- reset tokens or reset token hashes
- SMTP passwords
- database URLs with credentials
- raw student records
- full embedding vectors
- raw backup contents

Acceptable logs:

- request path and status
- non-secret event type
- safe user id or role where already used by the app
- safe audit event summary
- readiness status
- provider error code without provider password

## Alert Examples

Create alerts for:

- `/api/v1/readiness` is not HTTP 200 / `ready`
- backend 5xx rate exceeds threshold
- database disk usage exceeds threshold
- failed login spikes
- SMTP send failures
- backup job failure
- certificate expiry approaching

Exact thresholds are environment-owned and must be set by the operations owner.

## Operational Dashboards

Recommended dashboard sections:

- API health/readiness
- database connectivity/storage
- Voyage availability
- request volume and error rate
- auth failures
- email provider health
- backup job status
- deployment version

## Evidence

Before production, record outside Git:

- monitoring tool used
- alert recipients or team alias, not private contact details
- screenshots with no secrets or student data
- test alert result
- readiness check result
- known gaps

## Open Gap

Monitoring remains not verified until a real provider/dashboard is configured and an alert drill is completed in the target environment.
