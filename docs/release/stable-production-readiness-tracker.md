# Stable Production Readiness Tracker

This tracker follows limitations from `v0.4.0-rc1` toward a stable FYP/public production release.

| Limitation | Status | Required PR or Evidence | Needed for FYP Stable Release | Needed for Public Production | Owner / Action | Current Post-RC Impact |
| --- | --- | --- | --- | --- | --- | --- |
| Pilot evaluation labels manually constructed | PARTIALLY ADDRESSED | Lecturer-reviewed benchmark collection and validated reviewed dataset | Yes | Indirect | Academic reviewer + project maintainer | Framework and lecturer evidence pack prepared; final labels not collected. |
| Final lecturer-reviewed benchmark missing | EVIDENCE PACK PREPARED, NOT COMPLETED | Completed lecturer review file validated by `validate:lecturer-benchmark` and converted to evaluation dataset | Yes | Indirect | Lecturer/panel review | PR #108 adds protocol/schema/validator. PR #117 adds lecturer-facing validation protocol and CSV templates. No completed lecturer labels are present. |
| Departmental-scale data-quality validation unverified | PREPARED, NOT COMPLETED | Safe aggregate audit over approved departmental records | Yes | Yes | Department data owner + project maintainer | Workflow and acceptance thresholds proposed. |
| Real SMTP transport deferred | SMOKE WORKFLOW ADDED, PROVIDER-SMOKE RESULT PENDING | Run `npm run smoke:smtp` with deployment-owned SMTP credentials and controlled recipient; record provider result outside Git | No | Yes | Backend/operations | PR #109 adds Nodemailer SMTP transport and tests with injected transports. PR #116 adds a manual one-message SMTP provider smoke workflow, but provider delivery remains unverified until real credentials are supplied and the controlled recipient confirms receipt. |
| Notification event hooks/frontend UI deferred | IMPLEMENTED, REALTIME/PREFERENCES DEFERRED | Optional notification preferences, realtime push, and future event-specific policy hooks | No | Product-dependent | Backend/frontend | PR #110 adds backend notification hooks. PR #111 adds authenticated frontend notification UI for real notification records. Realtime push and preferences remain deferred. |
| Lecturer supervisee workflow deferred | IMPLEMENTED, POLICY REFINEMENT OPTIONAL | Department-approved allocation policy refinements and future bulk workflow if needed | No | Product-dependent | Product/department | PR #112 adds a real assignment model, admin assignment workflow, lecturer supervisee view, and assignment-aware submission notification routing. |
| Admin report exports deferred | CSV IMPLEMENTED, PDF/RETENTION DEFERRED | Optional PDF export, export retention/purge policy, and any async export job workflow | No | Product-dependent | Backend/admin | PR #113 adds admin-only audited CSV exports for safe report categories. PDF export and export retention/purge policy remain deferred. |
| Audit export/purge/delete policy deferred | IMPLEMENTED, ARCHIVE/LEGAL-HOLD DEFERRED | Optional archive-before-delete, legal hold, and scheduled retention jobs | No | Yes | Governance/operations | PR #113 covers audit CSV export through admin reports. PR #114 adds project retention policy, configurable retention settings, admin purge preview, guarded audited purge, and admin UI controls. |
| Monitoring and alerting environment-dependent | OPERATIONS PACK PREPARED, NOT VERIFIED | Deployment environment monitoring, alert ownership, runbook drill | No | Yes | Operations | PR #118 adds monitoring/logging, incident-response, secrets, HTTPS/domain, and backup/restore runbooks. Real monitoring provider setup and alert drills remain unverified. |
| Full-stack Docker/Compose missing | ADDRESSED FOR LOCAL/STAGING-STYLE VERIFICATION, STAGING PROOF PLAN PREPARED | Root Compose config, Dockerfiles, docs, smoke verification, and executed staging evidence | No | Yes if container deployment selected | Operations | PR #115 adds a full-stack Compose topology for PostgreSQL, backend, frontend, and SBERT. PR #119 adds a Docker-first staging proof plan and evidence template. Executed staging proof remains pending. |
| Free demo staging and departmental pilot cost plan missing | PROVIDER-SPECIFIC PREPARED, EXECUTION/PROCUREMENT PENDING | Free managed staging evidence, paid pilot procurement review, and updated provider pricing check | Useful | Yes for funded pilot | Project maintainer + department owner | PR #120 adds a free managed staging plan for FYP/demo use and a paid VPS/Docker departmental pilot cost estimate. PR #121 adds provider-specific prep for Vercel, Render, Neon, and Hugging Face Spaces. No free deployment, paid deployment, provider purchase, or production proof is completed. |
| Public production deployment unproven | READINESS PACK AND STAGING PROOF PLAN PREPARED, DEPLOYMENT PROOF MISSING | HTTPS deployment, secrets, backup, monitoring, smoke evidence, staging proof evidence | No | Yes | Operations | PR #118 prepares the production operations readiness pack. PR #119 prepares staging deployment proof steps. Public deployment, executed staging proof, backup drills, TLS/domain setup, monitoring, and incident-response execution remain unverified. |

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

## Current PR #115 Boundary

PR #115 adds full-stack Docker/Compose readiness for local/staging-style verification. The Compose topology includes PostgreSQL, backend, frontend, and SBERT service; backend and frontend images are added; static frontend hosting proxies `/api` to the backend; and a non-mutating smoke script checks health/readiness surfaces. This PR does not claim public production deployment, add cloud infrastructure, bake secrets into images, run migrations automatically, use `prisma db push`, change similarity/auth/email/notification/audit behavior, or add fake data.

## Current PR #116 Boundary

PR #116 adds a manual SMTP provider smoke workflow at `npm run smoke:smtp`. The script runs only with `EMAIL_PROVIDER=smtp`, requires explicit SMTP configuration and `SMTP_SMOKE_TO`, sends one clearly labelled test email, and avoids printing SMTP secrets or reset-token material. It does not run in normal CI, change auth/password-reset behavior, alter routes, add UI, change similarity scoring, or prove provider delivery without real deployment-owned credentials and recipient confirmation.

## Current PR #117 Boundary

PR #117 adds a lecturer validation evidence pack under `docs/evaluation`. It includes a lecturer-facing protocol, sample-only labelling template, and future results-recording template. It does not add real lecturer-reviewed labels, real student records, departmental-scale validation, scoring changes, threshold changes, backend behavior changes, routes, Prisma schema changes, or UI changes.

## Current PR #118 Boundary

PR #118 adds production operations readiness documentation: backup/restore, secrets management, environment hardening, monitoring/logging, health/readiness operations, HTTPS/domain/TLS checklist, database ownership notes, and incident response/rollback. It is documentation only and does not prove public production deployment, staging deployment, monitoring configuration, backup drills, SMTP provider delivery, or incident-response execution.

## Current PR #119 Boundary

PR #119 adds a Docker-first staging deployment proof plan and evidence template. It explains how to deploy and verify the DSS in a staging-like environment using the Compose stack, migrations, SBERT health, backend readiness, frontend HTTP checks, SMTP smoke when credentials exist, backup/restore proof, rollback checks, and pass/fail criteria. It does not execute staging deployment, prove public production readiness, add real domains/IPs/secrets/data, or change application/Docker runtime behavior.

## Current PR #120 Boundary

PR #120 adds planning documents for two deployment paths: a no-cost managed staging/demo option for FYP demonstration and a paid VPS/Docker departmental pilot cost estimate. It does not execute free staging, procure paid infrastructure, prove SMTP provider delivery, register domains, add real credentials/data, or change application, Docker runtime, auth, similarity, Prisma, route, or UI behavior.

## Current PR #121 Boundary

PR #121 adds provider-specific preparation docs for free managed FYP/demo staging using Vercel, Render Free, Neon PostgreSQL, and Hugging Face Spaces. It documents required environment variables, API routing expectations, migration/readiness checks, `EMAIL_PROVIDER=disabled` as the initial email posture, free-tier limitations, evidence capture, and troubleshooting. It does not execute deployment, add real provider URLs/secrets/data, commit platform config, or change application, Docker runtime, auth, similarity, Prisma, route, backend, frontend, or UI behavior.
