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
| Free demo staging and departmental pilot cost plan missing | VERCEL PROXY CONFIG ADDED, VERCEL/FULL STAGING PROOF PENDING | Free managed staging evidence, paid pilot procurement review, and updated provider pricing check | Useful | Yes for funded pilot | Project maintainer + department owner | PR #120 adds a free managed staging plan for FYP/demo use and a paid VPS/Docker departmental pilot cost estimate. PR #121 adds provider-specific prep for Vercel, Render, Neon, and Hugging Face Spaces. PR #122 adds a concrete free staging execution checklist and evidence log template. PR #123 records safe Neon project/database setup evidence. PR #124 records safe Hugging Face Space setup evidence with Docker SDK selected. PR #125 prepares a deployable Hugging Face Docker Space package. PR #126 records online SBERT `/health` and `/embed` proof and confirms `SBERT_SERVICE_URL`. PR #127 reviews exact Render backend settings. PR #128 corrects the Render build command, records Render backend online `/api/v1/health` proof, and records successful Neon migration deploy evidence with `migrate status` still pending after `P1001`. PR #129 adds Vercel rewrite config so existing relative `/api/*` frontend calls proxy to the Render backend while non-API paths fall back to the SPA. Vercel deployment proof, Render readiness proof, free deployment proof completion, paid deployment, provider purchase, and production proof remain pending. |
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

## Current PR #122 Boundary

PR #122 adds a concrete execution checklist and evidence log template for the free managed staging path: Neon PostgreSQL, Hugging Face Spaces SBERT, Render backend, Vercel frontend, and `EMAIL_PROVIDER=disabled` initially. It documents setup order, migration checks, API routing proof, pass/fail criteria, and safe evidence capture. It does not execute deployment, add provider configuration, commit real URLs/secrets/data, or change application, Docker runtime, auth, similarity, Prisma, route, backend, frontend, or UI behavior.

## Current PR #123 Boundary

PR #123 records safe documentation evidence that the Neon PostgreSQL staging project/database has been created and that the connection string was copied privately. It does not include the real `DATABASE_URL`, Neon hostnames, credentials, tokens, private URLs, screenshots, SMTP credentials, student records, or dumps. It does not claim Prisma migrations, Render backend deployment, Hugging Face Spaces SBERT deployment, Vercel frontend deployment, or full free staging proof are complete.

## Current PR #124 Boundary

PR #124 records safe documentation evidence that the Hugging Face Space for the SBERT staging service has been created manually and configured with Docker SDK. It does not include private Hugging Face tokens, private Space URLs, provider auth tokens, service URLs, screenshots containing secrets, database URLs, SMTP credentials, student data, raw embeddings, or dumps. It does not claim SBERT service deployment, `SBERT_SERVICE_URL` confirmation, `/health`, `/embed`, Render, Vercel, Prisma migrations against Neon, or full free staging deployment are complete.

## Current PR #125 Boundary

PR #125 prepares a deployable Hugging Face Spaces Docker package under `deploy/huggingface-sbert-space/`. The package implements the existing backend SBERT contract with FastAPI `/health` and `/embed`, uses `sentence-transformers/all-MiniLM-L6-v2`, and documents safe smoke commands and free-tier cold-start limits. It does not deploy the online Space, confirm `SBERT_SERVICE_URL`, prove online `/health` or `/embed`, change backend/frontend behavior, alter Docker Compose, change auth, Prisma, routes, similarity scoring, or commit real Hugging Face tokens, service URLs, credentials, database URLs, SMTP secrets, student records, or raw embeddings.

## Current PR #126 Boundary

PR #126 records safe online proof that the Hugging Face SBERT staging Space built and responded at `https://seun10v3-research-topic-sbert-staging.hf.space`. Online `GET /health` returned `status: "healthy"` with model `all-MiniLM-L6-v2`, and online `POST /embed` returned `dimension: 384`. Raw embeddings, Hugging Face tokens, database URLs, SMTP credentials, screenshots with secrets, student records, and dumps are not included. This PR confirms `SBERT_SERVICE_URL` for later Render configuration, but does not claim Prisma migrations against Neon, Render backend deployment, Vercel frontend deployment, full free staging deployment, public production readiness, or application behavior changes are complete.

## Current PR #127 Boundary

PR #127 documents the exact Render backend deployment configuration after inspecting backend package scripts, entrypoints, environment validation, Prisma schema usage, and health/readiness routes. It confirms Render Web Service settings, `backend` root directory, `npm start` start command, `/api/v1/health` health path, required environment variable names, `EMAIL_PROVIDER=disabled`, and the confirmed SBERT staging URL for later `SBERT_SERVICE_URL`. PR #128 supersedes the original PR #127 build command recommendation with the Render-tested command `npm install && npx prisma generate`. PR #127 does not commit `DATABASE_URL`, Render URLs, provider tokens, SMTP credentials, screenshots with secrets, student records, or any app/runtime changes, and it does not claim Render deployment, Prisma migrations against Neon, Vercel deployment, or full free staging proof are complete.

## Current PR #128 Boundary

PR #128 records safe Render backend online proof at `https://research-topic-approval-dss-backend.onrender.com`, corrects the Render build command to `npm install && npx prisma generate`, records successful `/api/v1/health` output, and documents that seven Prisma migrations were applied to Neon with a private `DATABASE_URL` that was not printed or committed. A follow-up `npx prisma migrate status` attempt returned `P1001`, so final migration status connectivity confirmation remains pending. This PR does not commit the real `DATABASE_URL`, JWT secrets, Render secrets, provider tokens, SMTP credentials, screenshots with secrets, database dumps, or student records, and it does not claim Vercel frontend deployment, Render readiness proof, full free staging deployment, or public production readiness are complete.

## Current PR #129 Boundary

PR #129 adds `frontend/vercel.json` deploy configuration so Vercel serves the React SPA and proxies existing relative `/api/*` frontend calls to `https://research-topic-approval-dss-backend.onrender.com/api/:path*`. It preserves SPA fallback routing by rewriting non-API paths to `/index.html`. This PR does not change frontend API client behavior, add `VITE_API_*` configuration, change React UI/routes/auth/similarity/backend/Prisma behavior, commit secrets, or claim Vercel deployment, Vercel-to-Render proof, full free staging proof, or public production readiness are complete.
