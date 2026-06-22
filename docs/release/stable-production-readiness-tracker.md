# Stable Production Readiness Tracker

This tracker follows limitations from `v0.4.0-rc1` toward a stable FYP/public production release.

| Limitation | Status | Required PR or Evidence | Needed for FYP Stable Release | Needed for Public Production | Owner / Action | Current Post-RC Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Pilot evaluation labels manually constructed | PARTIALLY ADDRESSED | Lecturer-reviewed benchmark collection and validated reviewed dataset | Yes | Indirect | Academic reviewer + project maintainer | Framework prepared; final labels not collected. |
| Final lecturer-reviewed benchmark missing | PREPARED, NOT COMPLETED | Completed lecturer review file validated by `validate:lecturer-benchmark` and converted to evaluation dataset | Yes | Indirect | Lecturer/panel review | Protocol, template, schema, fixtures, validator, and workflow added. |
| Departmental-scale data-quality validation unverified | PREPARED, NOT COMPLETED | Safe aggregate audit over approved departmental records | Yes | Yes | Department data owner + project maintainer | Workflow and acceptance thresholds proposed. |
| Real SMTP transport deferred | IMPLEMENTED, PROVIDER-SMOKE NOT VERIFIED | Provider-level SMTP smoke test with deployment-owned secrets | No | Yes | Backend/operations | PR #109 adds Nodemailer SMTP transport and tests with injected transports; real provider delivery has not been smoke-tested. |
| Notification event hooks/frontend UI deferred | DEFERRED | Event hook mapping and frontend notification center | No | Product-dependent | Backend/frontend | No change. |
| Lecturer supervisee workflow deferred | DEFERRED | Assignment model/business rule and endpoints | No | Product-dependent | Product/department | No change. |
| Admin report exports deferred | DEFERRED | Export job/report file workflow and audit event | No | Product-dependent | Backend/admin | No change. |
| Audit export/purge/delete policy deferred | DEFERRED | Retention/export/purge policy and audited implementation | No | Yes | Governance/operations | No change. |
| Monitoring and alerting environment-dependent | NOT VERIFIED | Deployment environment monitoring, alert ownership, runbook drill | No | Yes | Operations | No change. |
| Full-stack Docker/Compose missing | NOT VERIFIED | Production-like compose or deployment manifests verified | No | Yes if container deployment selected | Operations | No change. |
| Public production deployment unproven | NOT VERIFIED | HTTPS deployment, secrets, backup, monitoring, smoke evidence | No | Yes | Operations | No change. |

## Current PR #108 Boundary

PR #108 prepares academically defensible validation infrastructure. It must not be described as final lecturer-reviewed effectiveness evidence or departmental-scale data-quality proof until real approved review/data inputs are present.

## Current PR #109 Boundary

PR #109 implements real SMTP transport support for password reset email using deployment-provided configuration. It does not verify institutional SMTP delivery, add notification event hooks, add notification UI, or commit provider credentials.
