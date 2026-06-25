# Monitoring and Logging Plan

## Status

The application exposes health and readiness endpoints and writes application logs. This document prepares an operations monitoring plan, but no production monitoring provider or alert route is configured by this PR.

## Signals To Monitor

| Signal | Source | Expected |
| --- | --- | --- |
| Backend liveness | `GET /api/v1/health` | HTTP 200 and `status: "OK"` |
| Backend readiness | `GET /api/v1/readiness` | HTTP 200 and `status: "ready"` for full readiness |
| Database readiness | `/api/v1/readiness` details | `database: "available"` |
| SBERT readiness | `/api/v1/readiness` details and SBERT `/health` | `sbert: "available"` |
| Frontend availability | Static host root path | HTTP 200 |
| PostgreSQL storage | Database host metrics | Below approved disk threshold |
| Error rate | Backend logs or hosting metrics | Alert on sustained spikes |
| Authentication failures | Backend logs | Watch for abnormal bursts |
| SMTP delivery failures | Backend logs and provider dashboard | Alert when provider rejects mail |
| Audit purge/export activity | Admin audit logs | Review according to governance policy |

## Readiness Interpretation

Backend readiness policy:

- `ready`: API, database, and SBERT are available.
- `degraded`: database is available but SBERT is unavailable; lexical fallback may operate, but semantic readiness is not complete.
- `not_ready`: database check failed; do not route production traffic.

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

- `/api/v1/readiness` returns `not_ready`
- `/api/v1/readiness` returns `degraded` for longer than the approved window
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
- SBERT availability
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
