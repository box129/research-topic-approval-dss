# Stable Production Readiness Tracker

This tracker follows limitations from `v0.4.0-rc1` toward a stable FYP/public production release.

| Limitation | Status | Required PR or Evidence | Needed for FYP Stable Release | Needed for Public Production | Owner / Action | Current Post-RC Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Pilot evaluation labels manually constructed | PARTIALLY ADDRESSED | Lecturer-reviewed benchmark collection and validated reviewed dataset | Yes | Indirect | Academic reviewer + project maintainer | Framework prepared; final labels not collected. |
| Final lecturer-reviewed benchmark missing | PREPARED, NOT COMPLETED | Completed lecturer review file validated by `validate:lecturer-benchmark` and converted to evaluation dataset | Yes | Indirect | Lecturer/panel review | Protocol, template, schema, fixtures, validator, and workflow added. |
| Departmental-scale data-quality validation unverified | PREPARED, NOT COMPLETED | Safe aggregate audit over approved departmental records | Yes | Yes | Department data owner + project maintainer | Workflow and acceptance thresholds proposed. |
| Real SMTP transport deferred | IMPLEMENTED, PROVIDER-SMOKE NOT VERIFIED | Provider-level SMTP smoke test with deployment-owned secrets | No | Yes | Backend/operations | PR #109 adds Nodemailer SMTP transport and tests with injected transports; real provider delivery has not been smoke-tested. |
| Notification event hooks/frontend UI deferred | IMPLEMENTED, REALTIME/PREFERENCES DEFERRED | Optional notification preferences, realtime push, and future event-specific policy hooks | No | Product-dependent | Backend/frontend | PR #110 adds backend notification hooks. PR #111 adds authenticated frontend notification UI for real notification records. Realtime push and preferences remain deferred. |
| Lecturer supervisee workflow deferred | IMPLEMENTED, POLICY REFINEMENT OPTIONAL | Department-approved allocation policy refinements and future bulk workflow if needed | No | Product-dependent | Product/department | PR #112 adds a real assignment model, admin assignment workflow, lecturer supervisee view, and assignment-aware submission notification routing. |
| Admin report exports deferred | CSV IMPLEMENTED, PDF/RETENTION DEFERRED | Optional PDF export, export retention/purge policy, and any async export job workflow | No | Product-dependent | Backend/admin | PR #113 adds admin-only audited CSV exports for safe report categories. PDF export and export retention/purge policy remain deferred. |
| Audit export/purge/delete policy deferred | IMPLEMENTED, ARCHIVE/LEGAL-HOLD DEFERRED | Optional archive-before-delete, legal hold, and scheduled retention jobs | No | Yes | Governance/operations | PR #113 covers audit CSV export through admin reports. PR #114 adds project retention policy, configurable retention settings, admin purge preview, guarded audited purge, and admin UI controls. |
| Monitoring and alerting environment-dependent | NOT VERIFIED | Deployment environment monitoring, alert ownership, runbook drill | No | Yes | Operations | No change. |
| Full-stack Docker/Compose missing | NOT VERIFIED | Production-like compose or deployment manifests verified | No | Yes if container deployment selected | Operations | No change. |
| Public production deployment unproven | NOT VERIFIED | HTTPS deployment, secrets, backup, monitoring, smoke evidence | No | Yes | Operations | No change. |

## Current PR #108 Boundary

PR #108 prepares academically defensible validation infrastructure. It must not be described as final lecturer-reviewed effectiveness evidence or departmental-scale data-quality proof until real approved review/data inputs are present.

## Current PR #109 Boundary

PR #109 implements real SMTP transport support for password reset email using deployment-provided configuration. It does not verify institutional SMTP delivery, add notification event hooks, add notification UI, or commit provider credentials.

## Current PR #110 Boundary

PR #110 connects existing backend notification records to real backend events. Student submissions notify active lecturer/admin reviewer roles because no individual assignment model exists yet. Lecturer decisions notify the owning student. Admin import preview/commit notifications are created only for the real admin actor context. Password reset requests create a safe account notification only after the existing email flow is invoked, without reset tokens or hashes. Frontend notification UI, notification preferences, richer event policy, and assignment-based supervisee/lecturer routing remain deferred.

## Current PR #111 Boundary

PR #111 connects authenticated frontend shells to the existing notification API. It adds a notification trigger, unread count, real notification list, empty/loading/error states, retry, mark-read, and mark-all-read behavior. It does not add notification preferences, realtime/WebSocket push, backend event changes, fake notifications, or auth-page notification UI.

## Current PR #112 Boundary

PR #112 adds a real lecturer-supervisee assignment workflow. Admins can create and end active lecturer/student assignments using real user records, lecturers can view only their own assigned supervisees, and student submission notifications prefer active assigned lecturers while preserving admin governance notices. The PR does not add fake assignments, bulk allocation, department-approved allocation policy automation, notification preferences, realtime/WebSocket behavior, or raw/private student data exposure.

## Current PR #113 Boundary

PR #113 adds admin-only audited CSV exports for safe report categories: users, submissions, topic repository rows, similarity snapshots, audit logs, and supervisee assignments. Exports use real database rows, cap export size, return header-only CSV for empty datasets, and omit password hashes, reset tokens, embeddings, raw topic records, raw similarity payloads, notification data, SMTP secrets, sessions, and private assignment notes. PDF exports, async export jobs, export retention/purge policy, charts, generated analytics, and fake report rows remain deferred.

## Current PR #114 Boundary

PR #114 adds audit retention and purge governance. Audit CSV export remains provided by PR #113 at `GET /api/v1/admin/reports/export/audit-logs`. This PR adds project-level retention documentation, bounded retention environment settings, admin-only purge preview, exact-phrase guarded purge, purge batch limits, purge audit event creation, and cautious admin UI controls. It does not add archive-before-delete storage, legal hold workflow, scheduled purge jobs, non-admin audit actions, raw metadata export, or official institutional retention approval.
