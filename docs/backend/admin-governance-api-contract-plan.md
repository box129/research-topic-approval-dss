# Admin and Governance API Contract Plan

> **Historical planning and evidence record.** This document contains
> pre-Phase-6 SBERT, lexical-fallback, and release-candidate material. It is
> not the current production architecture or direct-similarity contract. Use
> the [deployment runbook](../deployment/deployment-runbook.md),
> [environment matrix](../deployment/environment-matrix.md), and
> [direct-similarity security contract](../api/direct-similarity-security-contract.md)
> for current operational guidance.

## 1. Metadata

| Field | Value |
| --- | --- |
| Branch | `release/deployment-readiness-rc` |
| Current commit hash | `732f6b3` |
| Date/time | `2026-06-19 17:30:00 +01:00` |
| Scope | Deployment readiness, release-candidate runbooks, readiness endpoint, release gate automation, CI, security checklist, and documentation |
| Change type | Backend operational readiness, configuration validation, release tooling, CI, and documentation |
| Implementation status | PR #107 prepares the controlled `v0.4.0-rc1` release candidate by documenting honest deployment support, adding fail-fast production configuration validation, adding `GET /api/v1/readiness`, adding repository-level release-gate automation, and adding a focused CI workflow. It does not create a tag or GitHub release, does not add product features, does not change similarity scoring, does not relabel evaluation data, does not add Prisma migrations, and does not claim public production readiness. |

Latest relevant PRs:

| PR | Summary | Relevance |
| --- | --- | --- |
| #107 | release: add deployment readiness and RC gate | Adds release-candidate runbooks, readiness endpoint, production config validation, CI, and release-gate automation. |
| #106 | fix: align similarity scoring contract | Corrects production scoring to the approved weighted methodology and regenerates regression/evaluation evidence. |
| #105 | feat: add evaluation and data-quality FYP evidence | Added governed pilot evaluation reports and read-only topic data-quality audit evidence without changing production scoring. |
| #104 | feat: add production email and notification foundation | Added explicit safe email provider modes and authenticated own-user notification backend foundation. |
| #103 | feat: add admin import governance UI | Connected admin Topic Repository import preview/commit UI to existing audited backend endpoints without fake import results. |
| #102 | feat: add lecturer research trends governance | Added a safe read-only lecturer research trends endpoint and connected Research Trends to real aggregate data while keeping generated insights deferred. |
| #101 | feat: add lecturer decision history governance | Added read-only lecturer decision history and kept supervisees honestly deferred. |
| #100 | feat: add admin audit log and reports governance | Connected admin Audit Log and Reports to real read-only governance data while keeping exports deferred. |
| #99 | feat: add admin users and settings APIs | Added admin user list/detail APIs, the audited user status mutation, the read-only settings API, and frontend User Management/System Settings connections. |
| #98 | feat: add admin topic repository API | Added read-only admin topic repository endpoints and connected the admin Topic Repository page to real lifecycle topic data. |
| #97 | feat: add admin dashboard summary API | Added the read-only admin dashboard summary endpoint and connected the admin dashboard to real safe counts. |
| #96 | feat: add audit log and admin import governance foundation | Added audit log model/service/read endpoints, hardened import routes, and established admin governance foundation. |
| #94 | docs: add full worktree gap and benchmark audit | Identified unfinished admin/governance/backend areas and recommended contract-led backend work. |
| #93 | polish: refine admin secondary placeholder pages | Confirmed admin secondary pages are protected, polished, and presentation-only. |
| #92 | polish: refine admin dashboard visuals | Confirmed admin dashboard is an honest shell with no live metrics/API connection. |
| #91 | polish: refine lecturer secondary placeholder pages | Confirmed lecturer decisions, supervisees, and trends are placeholder/deferred pages. |
| #90 | polish: refine lecturer similarity checker visuals | Confirmed manual lecturer checker is advisory and must not write decisions or snapshots. |

### Implementation Status After PR #96

PR #96 implements the first backend governance slice from this plan:

- `AuditLog` Prisma model and migration are added.
- `backend/src/services/auditLog.service.js` provides audit creation, safe non-blocking audit creation, metadata redaction, request context extraction, list pagination/filtering, and detail lookup.
- Admin-only read endpoints are added:
  - `GET /api/v1/admin/audit-logs`
  - `GET /api/v1/admin/audit-logs/:id`
- Existing import preview/commit routes are hardened with `requireAuth` and `requireRole('admin')`.
- Admin-prefixed import aliases are added:
  - `POST /api/v1/admin/import/topics/preview`
  - `POST /api/v1/admin/import/topics/commit`
- Current emitted audit events:
  - `TOPIC_IMPORT_PREVIEWED`
  - `TOPIC_IMPORT_COMMITTED`
- Import audit metadata stores safe summary fields only, such as filename, sheet name, row counts, report counts, import batch id, and lifecycle insert summary. It does not store uploaded file contents or raw imported rows.

Still deferred after PR #96:

- Admin dashboard summary API.
- Admin users API and user mutations.
- Admin topic repository API.
- Admin system settings API and settings mutations.
- Admin reports/export generation.
- Lecturer decision history, supervisees, and research trends APIs.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #97

PR #97 implements the admin read-only console slice from this plan:

- `GET /api/v1/admin/dashboard/summary` is added and protected by `requireAuth` plus `requireRole('admin')`.
- `backend/src/services/adminDashboard.service.js` aggregates real read-only counts from existing tables:
  - `User`
  - `Submission`
  - `HistoricalTopic`
  - `CurrentSessionTopic`
  - `UnderReviewTopic`
  - `SimilarityCheckSnapshot`
- `backend/src/controllers/adminDashboard.controller.js` returns the shared success envelope:
  - `success`
  - `data`
  - `meta`
- Section-level database read failures do not fabricate replacement counts. A failed section returns `status: "unavailable"`, nullable count fields, and a warning entry.
- The dashboard service health section reports:
  - API as available when the endpoint responds.
  - Database as available only when dashboard count sections are read successfully.
  - SBERT as `unknown` because this endpoint does not perform SBERT health checks.
- The admin dashboard frontend now calls the read-only summary endpoint and renders loading, error, available, and partial-coverage states without fake fallback values.
- No audit event is emitted for this read-only dashboard request.
- No admin users, topic repository, settings, reports, export, import UI, notification, lecturer, or mutation endpoint is added.

Still deferred after PR #97:

- Admin users API and user mutations.
- Admin topic repository API.
- Admin system settings API and settings mutations.
- Admin reports/export generation.
- Audit log frontend connection.
- Lecturer decision history, supervisees, and research trends APIs.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #98

PR #98 implements the admin topic repository read-only slice from this plan:

- `GET /api/v1/admin/topics` is added and protected by `requireAuth` plus `requireRole('admin')`.
- `GET /api/v1/admin/topics/:lifecycle/:id` is added for read-only detail lookup by explicit lifecycle table and numeric id.
- `GET /api/v1/admin/topics/summary` is added for read-only lifecycle totals, category/session summaries, and data-quality counts.
- `backend/src/services/adminTopicRepository.service.js` reads only existing lifecycle topic tables:
  - `HistoricalTopic`
  - `CurrentSessionTopic`
  - `UnderReviewTopic`
- List filtering supports lifecycle, search, category, session year, supervisor name, source type, import batch id, pagination, and constrained sorting.
- Topic responses include lifecycle and available provenance fields, but do not expose raw embedding vectors or fabricate risk scores.
- Empty repository responses return `items: []` plus valid pagination metadata.
- `frontend/src/pages/admin/TopicRepositoryPage.jsx` connects `/admin/topic-repository` to the read-only endpoints and renders real rows, honest empty states, and unavailable states.
- The Topic Repository page does not expose import UI, export controls, edit/delete actions, migration controls, duplicate-resolution actions, or privileged mutations.
- Import preview/commit behavior remains unchanged by PR #98. Import endpoints remain admin-protected and audited from PR #96, while richer duplicate-existing detection and row-level governance reports remain deferred.

Still deferred after PR #98:

- Admin users API and user mutations.
- Admin system settings API and settings mutations.
- Admin reports/export generation.
- Audit log frontend connection.
- Import UI and duplicate-resolution workflow.
- Richer import duplicate-existing checks and operator-facing row-level report shape.
- Lecturer decision history, supervisees, and research trends APIs.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #99

PR #99 implements the admin users and system settings governance slice from this plan:

- `GET /api/v1/admin/users` is added and protected by `requireAuth` plus `requireRole('admin')`.
- `GET /api/v1/admin/users/:id` is added for safe read-only user detail lookup.
- User list filtering supports role, status, name/email search, pagination, and constrained sorting.
- User responses expose only safe account fields:
  - `id`
  - `name`
  - `email`
  - `role`
  - `status`
  - `createdAt`
  - `updatedAt`
- User responses do not expose password hashes, reset token hashes, reset token expiry fields, or internal secrets.
- `PATCH /api/v1/admin/users/:id/status` is added as the only user mutation in this PR.
- The status update endpoint accepts only the existing `ACTIVE` and `SUSPENDED` states, rejects admin self-suspension, and emits `USER_STATUS_CHANGED` through the audit service.
- No create-user, delete-user, role-change, password-reset, invitation, bulk action, or profile-edit endpoint is added.
- `GET /api/v1/admin/settings` is added and protected by `requireAuth` plus `requireRole('admin')`.
- Settings responses read only existing `SystemSetting` rows and optional updater metadata.
- `PATCH /api/v1/admin/settings/:key` remains deferred because settings need key-specific validation, confirmation rules, and scoring/auth/email safety contracts before writes are safe.
- `frontend/src/pages/admin/UserManagementPage.jsx` connects `/admin/user-management` to the admin users endpoint and renders real rows, honest empty/error states, filters, and the narrow audited status action.
- `frontend/src/pages/admin/SystemSettingsPage.jsx` connects `/admin/system-settings` to the read-only settings endpoint and renders real settings, honest empty/error states, and explicit deferred-write messaging.
- No fake users, fake settings, fake last-active values, fake supervisor assignments, fake metrics, fake reports, exports, imports, role controls, password controls, or setting controls are introduced.

Still deferred after PR #99:

- Admin user mutations beyond status updates.
- Admin system settings mutations.
- Admin reports/export generation.
- Audit log frontend connection.
- Import UI and duplicate-resolution workflow.
- Richer import duplicate-existing checks and operator-facing row-level report shape.
- Lecturer decision history, supervisees, and research trends APIs.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #100

PR #100 implements the admin audit-log and reports governance slice from this plan:

- `/admin/audit-log` now renders a connected read-only audit page instead of the generic placeholder.
- The Audit Log page calls existing admin audit endpoints:
  - `GET /api/v1/admin/audit-logs`
  - `GET /api/v1/admin/audit-logs/:id`
- Audit list filters support search, actor role, and event type without creating, deleting, exporting, purging, or fabricating audit records.
- Audit detail displays only the safe serialized audit-log shape returned by the existing audit service.
- `GET /api/v1/admin/reports/summary` is added and protected by `requireAuth` plus `requireRole('admin')`.
- `backend/src/services/adminReports.service.js` aggregates read-only counts from existing tables:
  - `User`
  - `Submission`
  - `HistoricalTopic`
  - `CurrentSessionTopic`
  - `UnderReviewTopic`
  - `SimilarityCheckSnapshot`
  - `AuditLog`
- The reports summary response includes honest metadata such as `generatedAt`, `dataCoverage`, `sourceTables`, and `exportStatus: "deferred"`.
- `/admin/reports` now renders a connected read-only reports summary page instead of the generic placeholder.
- The Reports page displays aggregate values only when returned by the reports endpoint, shows honest zero-data/error states, and keeps CSV/PDF/download workflows disabled and deferred.
- No report files, export jobs, fake charts, fake audit activity, fake analytics, report mutations, audit mutations, settings mutations, user mutations, or import UI are added by PR #100.

Still deferred after PR #100:

- Admin report export generation.
- Audit log export/purge/delete workflows.
- Admin user mutations beyond status updates.
- Admin system settings mutations.
- Import UI and duplicate-resolution workflow.
- Richer import duplicate-existing checks and operator-facing row-level report shape.
- Lecturer decision history, supervisees, and research trends APIs.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #101

PR #101 implements the lecturer decision-history slice from this plan and keeps supervisees honest:

- `GET /api/v1/lecturer/decisions` is added and protected by `requireAuth` plus `requireRole('lecturer')`.
- The endpoint reads only existing `Submission` records where:
  - `decidedById` equals the authenticated lecturer id.
  - `decidedAt` is not null.
  - `status` is one of `AWAITING_REVISION`, `APPROVED`, or `REJECTED`.
- Decision history filtering supports status, decided-date range, category, search, pagination, constrained sorting, and direction where backed by existing submission fields.
- The response returns safe decision fields only, including title, safe student name/email, category, status, submitted/decided timestamps, stored decision feedback, and the latest related similarity snapshot id when present.
- The decision-history read does not emit audit events and does not create, update, delete, export, or mutate records.
- `frontend/src/pages/lecturer/MyDecisionsPage.jsx` now connects `/lecturer/my-decisions` to the real endpoint and renders loading, real-row, empty, error, filter, and pagination states.
- My Decisions does not expose approval/rejection/revision actions, fake decisions, fake students, fake dates, fake risk scores, exports, reports, or activity rows.
- `frontend/src/pages/lecturer/SuperviseesPage.jsx` remains an honest deferred page.
- No `GET /api/v1/lecturer/supervisees` endpoint is added because the current Prisma schema has no explicit supervisee assignment model and no documented business rule that reviewed or decided submissions equal supervision.
- The Supervisees page now states that reviewed submissions are not treated as supervisees and that no real assignment source/endpoint exists yet.

Still deferred after PR #101:

- Lecturer supervisee assignment model and endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.
- Admin user mutations beyond status updates.
- Admin system settings mutations.
- Import UI and duplicate-resolution workflow.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #102

PR #102 implements the lecturer research-trends governance slice from this plan:

- `GET /api/v1/lecturer/research-trends` is added and protected by `requireAuth` plus `requireRole('lecturer')`.
- The endpoint is read-only and aggregates only existing records from:
  - `HistoricalTopic`
  - `CurrentSessionTopic`
  - `UnderReviewTopic`
  - `Submission`
  - `SimilarityCheckSnapshot`
- Returned trend data is limited to aggregate counts and grouped distributions:
  - topic totals by lifecycle
  - topic distribution by stored category
  - topic distribution by stored session year
  - submission totals by stored status
  - submission distribution by stored category
  - stored similarity snapshot counts by risk and response status
- Keyword trend extraction, keyword clustering, semantic recommendations, generated insights, charts, and exports remain explicitly deferred.
- The endpoint does not emit audit events and does not create, update, delete, export, recalculate similarity, or mutate records.
- `frontend/src/pages/lecturer/ResearchTrendsPage.jsx` now connects `/lecturer/research-trends` to the real endpoint and renders loading, aggregate, zero-data, error, and deferred-keyword/recommendation states.
- Research Trends does not expose mutation controls, export buttons, fake chart data, fake keyword rows, fake recommendations, fake research insights, threshold controls, or similarity recalculation actions.

Still deferred after PR #102:

- Lecturer supervisee assignment model and endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.
- Admin user mutations beyond status updates.
- Admin system settings mutations.
- Import UI and duplicate-resolution workflow.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #103

PR #103 implements the admin import governance frontend connection:

- `/admin/topic-repository` now includes an admin import panel for `.xlsx` topic files.
- `frontend/src/api/admin.js` adds import helpers that call the existing admin-protected endpoints:
  - `POST /api/v1/admin/import/topics/preview`
  - `POST /api/v1/admin/import/topics/commit`
- The preview workflow sends the selected file to the real preview endpoint and renders only the backend response, including accepted-record count and `import_report` values.
- The commit workflow remains disabled until preview succeeds, then sends the same selected file to the real commit endpoint and renders only the backend `import_report` and `persistence_report` values.
- Loading, success, backend-error, and deferred-capability states are explicit.
- The page states that import preview and commit are admin-only and audited by the backend.
- Duplicate-existing checks, richer row-level operator reports, embedding generation, similarity integration, CSV import, export/download, edit/delete, and migration workflows remain visibly deferred.
- No fake import rows, fake preview report, fake persistence report, fake duplicate-existing counts, fake row-level details, fake exports, or fake topic mutations are introduced.
- No backend file, Prisma schema, import parser, normalization, persistence, auth/session behavior, similarity scoring, threshold, or package file is changed by PR #103.

Still deferred after PR #103:

- Richer import duplicate-existing checks and operator-facing row-level report shape.
- Embedding generation for imported records.
- Similarity integration for imported topic context fields.
- CSV import workflow.
- Export/download, migration, topic edit/delete, and duplicate-resolution workflows.
- Lecturer supervisee assignment model and endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.
- Admin user mutations beyond status updates.
- Admin system settings mutations.
- Production email and notifications.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #104

PR #104 implements the production email and notification backend foundation:

- `backend/src/services/email.service.js` now exposes a provider-based email service instead of a mock-only payload generator.
- Supported email modes are explicit:
  - `mock`: local/test-safe mode, no external delivery, rejected in production.
  - `disabled`: fail-closed mode with a clear provider error.
  - `smtp`: validates SMTP env configuration, but transport sending remains deferred because no mail dependency is installed.
- `backend/src/config/env.js` validates email provider mode and production email requirements.
- `backend/env.example` documents email mode and SMTP placeholder variables without real credentials.
- Forgot-password and reset-password flow remains the existing token-link flow. The database still stores only reset token hashes and expiry values.
- Email service results and logs do not expose reset token hashes, password hashes, auth tokens, SMTP passwords, API keys, or secrets.
- `Notification` Prisma model and migration are added.
- `backend/src/services/notification.service.js` provides:
  - `createNotification`
  - `listNotificationsForUser`
  - `markNotificationRead`
  - `markAllNotificationsRead`
- Authenticated notification endpoints are added:
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/:id/read`
  - `PATCH /api/v1/notifications/read-all`
- Notification endpoints require `requireAuth`; users can only list or update their own notifications.
- Notification metadata is redacted for sensitive keys such as password hashes, reset token hashes, auth tokens, API keys, and secrets.
- Empty notification lists return `items: []` with pagination metadata.
- No fake notifications, fake notification feed, fake email history, frontend notification UI, marketing/bulk email, report export email, admin notification broadcast, or user preference UI is added.
- Notification event hooks for student submissions, lecturer decisions/status changes, password reset requests, and admin broadcasts remain deferred until each event contract is reviewed.

Still deferred after PR #104:

- Real SMTP/provider transport implementation.
- Production email credentials and deployment setup.
- Notification event hooks.
- Frontend notification bell/feed.
- Admin notification broadcast.
- User notification preference UI.
- Report export emailing.
- Richer import duplicate-existing checks and operator-facing row-level report shape.
- Lecturer supervisee assignment model and endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.
- Admin user mutations beyond status updates.
- Admin system settings mutations.
- Any similarity scoring or threshold changes.

### Implementation Status After PR #105

PR #105 implements the evaluation, data-quality, and FYP evidence slice from this plan:

- `backend/evaluation/datasets/pilot-topic-pairs.json` now includes governed pilot metadata:
  - schema version
  - provenance
  - LOW/MEDIUM/HIGH class labels
  - per-case expected class
  - rationale
  - source classification
  - tags
- The dataset remains explicitly marked as a manually constructed pilot dataset, not final department or lecturer-reviewed ground truth.
- `backend/src/services/evaluationMetrics.service.js` now supports production-threshold LOW/MEDIUM/HIGH multiclass evaluation metrics:
  - class support
  - accuracy
  - macro precision/recall/F1
  - weighted precision/recall/F1
  - per-class metrics
  - confusion matrices
  - method coverage/skipped counts
- `backend/scripts/run-topic-evaluation.js` writes reproducible artifacts:
  - `backend/evaluation/results/topic-similarity-evaluation.json`
  - `docs/testing/topic-similarity-evaluation-report.md`
- The latest generated evaluation ran in `sbert_available_full_tri_evaluation` mode with the local SBERT service healthy at `http://localhost:8000`:
  - total cases: 16
  - valid cases: 16
  - SBERT attempted cases: 16
  - SBERT success cases: 16
  - SBERT failed cases: 0
  - SBERT unavailable cases: 0
  - full tri-algorithm cases: 16
  - fallback-used cases: 0
  - full tri-algorithm coverage: `100%`
  - operational fallback coverage: `0%`
  - operational fallback metrics: `NOT_EVALUATED` because runtime fallback support is zero
  - offline fallback-policy evaluation: counterfactual pilot evidence across all 16 valid cases without SBERT output
  - final production behavior accuracy: `0.313`
  - final production behavior macro F1: `0.224`
  - final production behavior weighted F1: `0.215`
- The evaluation documents the observed production scoring contract from `similarity.controller.js` without changing it:
  - high threshold `0.70`
  - medium threshold `0.50`
  - tier filter threshold `0.60`
  - configured normal weights `0.30 / 0.30 / 0.40`
  - configured fallback weights `0.50 / 0.50`
  - normal ranking currently uses an unweighted `jaccard + tfidf + sbert` combined score
  - normal overall risk uses max SBERT score
  - fallback overall risk uses max lexical score
- PR #105 also documents scoring-contract drift from the approved FYP methodology:
  - approved weights are Jaccard `0.20`, TF-IDF `0.30`, SBERT `0.50`
  - current configured weights are Jaccard `0.30`, TF-IDF `0.30`, SBERT `0.40`
  - approved fallback weights are Jaccard `0.40`, TF-IDF `0.60`
  - current configured fallback weights are `0.50 / 0.50`
  - approved MEDIUM starts at `0.40`, while current production MEDIUM starts at `0.50`
  - current production overall risk uses max SBERT or max lexical fallback instead of the approved weighted methodology
  - a separate scoring-contract correction PR is required if the approved FYP method should become production behavior
- `backend/src/services/topicDataQualityAudit.service.js` adds a read-only safe-field topic data-quality audit for:
  - `HistoricalTopic`
  - `CurrentSessionTopic`
  - `UnderReviewTopic`
- `backend/scripts/run-topic-data-quality-audit.js` writes reproducible artifacts:
  - `backend/evaluation/results/topic-data-quality-audit.json`
  - `docs/testing/topic-data-quality-report.md`
- The latest generated data-quality audit ran in database mode and inspected 9 topic records in the connected local database:
  - historical: 6
  - current session: 1
  - under review: 2
  - blank titles: 0
  - missing category/session/supervisor/keywords/context fields: 0
  - with embeddings: 0
  - without embeddings: 9
  - duplicate-title candidate groups: 0
- This audit is a local database snapshot only. It does not represent the complete departmental repository, departmental-scale data quality remains NOT YET VERIFIED, and no broad data-quality conclusion should be drawn from nine inspected records.
- Duplicate-title candidates are reported with hashed normalized titles and lifecycle/id references only. Raw titles are not written to the committed audit report.
- `docs/project/fyp-evaluation-benchmark-evidence.md` maps FYP benchmark status as reached, partially reached, not reached, deferred, or not yet verified.
- No production similarity scoring, threshold, SBERT fallback, import parsing, import persistence, auth/session behavior, Prisma migration, frontend behavior, fake result, fake data-quality finding, or fake benchmark claim is introduced.

Still deferred after PR #105:

- Lecturer-reviewed final evaluation dataset.
- Departmental-scale effectiveness evidence.
- Final benchmark using lecturer-reviewed labels.
- Scoring-contract correction for approved FYP weights/thresholds/tier minima/overall-risk behavior.
- Production scoring or threshold changes, if ever approved by a separate scoped evaluation-backed PR.
- Semantic duplicate-existing governance for imported/stored topics.
- Embedding generation for imported records.
- Real SMTP/provider transport implementation.
- Notification event hooks and frontend notification UI.
- Lecturer supervisee assignment model and endpoint.
- Admin research trends analytics endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.

### Implementation Status After PR #106

PR #106 implements the similarity scoring contract correction slice from this plan:

- `backend/src/config/similarityScoring.config.js` centralizes the approved scoring contract for production and evaluation use.
- Normal tri-algorithm scoring now uses the approved weighted combined score:
  - Jaccard `0.20`
  - TF-IDF `0.30`
  - SBERT `0.50`
- Fallback lexical scoring now uses the approved fallback combined score:
  - Jaccard `0.40`
  - TF-IDF `0.60`
- Risk classification now uses the approved boundaries:
  - `LOW`: score `< 0.40`
  - `MEDIUM`: score `>= 0.40` and `< 0.70`
  - `HIGH`: score `>= 0.70`
- Normal successful mode ranks candidates by weighted combined score instead of unweighted sum or max SBERT.
- Normal overall risk is classified from the highest eligible weighted combined score across returned tiers.
- Fallback mode ranks candidates by weighted lexical fallback combined score instead of max lexical component.
- Fallback overall risk is classified from the highest eligible fallback combined score.
- Tier 1 applies the general `0.10` combined-score minimum.
- Tier 2 and Tier 3 require both combined score `>= 0.60` and real SBERT score `>= 0.60`.
- When SBERT is unavailable, partial-success fallback remains honest and does not fabricate SBERT values or semantic Tier 2/3 eligibility.
- Regression tests cover approved weights, fallback weights, weight totals, weighted/fallback score calculations, risk boundaries, ranking, overall-risk behavior, tier minimum, Tier 2/3 dual thresholds, no-fake-SBERT fallback, and evaluator/controller shared-contract alignment.
- The latest generated evaluation ran in `sbert_available_full_tri_evaluation` mode with local SBERT healthy:
  - total cases: 16
  - valid cases: 16
  - SBERT success cases: 16
  - full tri-algorithm coverage: `100%`
  - fallback-used cases: 0
  - operational fallback metrics: `NOT_EVALUATED`
  - final production behavior accuracy: `0.375`
  - final production behavior macro F1: `0.365`
  - final production behavior weighted F1: `0.348`
- PR #105 remains the historical baseline for the previous drifted implementation:
  - accuracy: `0.313`
  - macro F1: `0.224`
  - weighted F1: `0.215`
- The dataset labels are not tuned or relabeled by PR #106.
- No Prisma migration, import parsing/persistence change, auth/session change, frontend feature, topic record change, model training, embedding generation, fake SBERT value, fake evaluation result, or fake benchmark claim is introduced.

Still deferred after PR #106:

- Lecturer-reviewed final evaluation dataset.
- Departmental-scale effectiveness evidence.
- Final benchmark using lecturer-reviewed labels.
- Semantic duplicate-existing governance for imported/stored topics.
- Embedding generation for imported records.
- Real SMTP/provider transport implementation.
- Notification event hooks and frontend notification UI.
- Lecturer supervisee assignment model and endpoint.
- Admin research trends analytics endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.

### Historical Implementation Status After PR #107

This subsection records the PR #107 state. Its SBERT readiness and lexical-fallback statements are historical; the current protected Voyage direct-route and readiness contract is documented in `docs/api/direct-similarity-security-contract.md`.

PR #107 implements the deployment-readiness and release-candidate slice from this plan:

- `GET /api/v1/readiness` is added as an unauthenticated operational readiness endpoint.
- Backend liveness remains available at:
  - `GET /health`
  - `GET /api/v1/health`
- Readiness reports API, database, and SBERT availability without exposing database contents, credentials, or sensitive configuration.
- Readiness returns full `ready` only when database and SBERT checks are available.
- SBERT unavailability is reported as `degraded` with HTTP `503`, because lexical fallback is not full semantic readiness.
- Production configuration validation now rejects weak or placeholder `JWT_SECRET` values.
- Production configuration now requires an explicit trusted frontend/CORS origin and rejects `*`.
- Existing production email validation remains in place: `EMAIL_PROVIDER` is required and `EMAIL_PROVIDER=mock` is rejected.
- Repository-level release gate automation is added through `npm run release:check`.
- A focused GitHub Actions CI workflow is added for backend/frontend checks with PostgreSQL and Python source compilation for SBERT.
- Deployment runbooks, environment matrix, database migration/rollback docs, security checklist, release notes, and release-readiness reporting are added.
- The recommended post-merge RC tag is `v0.4.0-rc1`.
- No tag, GitHub release, deployment, Prisma migration, product feature, similarity scoring change, evaluation relabeling, SMTP delivery claim, notification UI/event hook, or fake production-readiness evidence is introduced.

Still deferred after PR #107:

- Public HTTPS production deployment proof.
- Infrastructure-owned reverse proxy, TLS, monitoring, alerting, backup automation, and incident ownership.
- Real SMTP/provider transport delivery.
- Notification event hooks and frontend notification UI.
- Lecturer supervisee assignment model and endpoint.
- Admin report export generation.
- Audit log export/purge/delete workflows.
- Lecturer-reviewed final evaluation dataset and departmental-scale effectiveness evidence.

## 2. Current Reality From Repository

### Existing Backend Behavior

| Area | Existing behavior | Evidence |
| --- | --- | --- |
| Auth/session | Login, logout, current-user, forgot-password, and reset-password endpoints exist. Auth uses an httpOnly cookie-backed JWT session. | `backend/src/server.js`, `backend/src/controllers/auth.controller.js`, `backend/src/services/auth.service.js` |
| Role protection | `requireAuth` validates the session cookie; `requireRole` enforces client roles such as `student`, `lecturer`, and `admin`. | `backend/src/middleware/auth.middleware.js` |
| Student submissions | Student can create and list submissions through authenticated student endpoints. | `GET /api/v1/submissions`, `POST /api/v1/submissions`, `submission.controller.js`, `submission.service.js` |
| Lecturer review workflow | Lecturer can list pending submissions, open detail, run submission similarity checks, read snapshots, and update status. | `/api/v1/lecturer/submissions...` routes |
| Direct similarity checker | Protected student/lecturer semantic endpoint exists at legacy and v1 paths. | `POST /api/similarity/check`, `POST /api/v1/check-similarity`; see `docs/api/direct-similarity-security-contract.md` |
| Similarity stack | Historical PR #106 evaluation/scoring material covers Jaccard, TF-IDF, and SBERT fallback behavior. It is not the contract of the current protected Voyage direct checker. | `backend/src/config/similarityScoring.config.js`, `jaccard.service.js`, `tfidf.service.js`, `sbert.service.js`, `docs/api/direct-similarity-security-contract.md` |
| Topic import | Spreadsheet preview/commit endpoints exist and call import file, normalization, and persistence services. | `/api/import/topics/*`, `/api/v1/import/topics/*`, `topicImport*.service.js` |
| Health/readiness | Basic liveness endpoints exist and a dependency readiness endpoint reports API, database, and safe Voyage provider status without sensitive details. | `/health`, `/api/v1/health`, `/api/v1/readiness`, `docs/api/direct-similarity-security-contract.md` |
| Email | Password reset email uses explicit provider modes: local/test-safe `mock`, fail-closed `disabled`, and provider-ready `smtp` with SMTP transport deferred. Production rejects missing provider configuration and `mock`. | `backend/src/services/email.service.js`, `backend/src/config/env.js`, `docs/setup/auth-foundation.md`, `docs/setup/email-notification-foundation.md` |
| Notifications | Authenticated own-user notification backend foundation exists with list, mark-read, and mark-all-read endpoints. Event hooks and frontend UI remain deferred. | `backend/prisma/schema.prisma`, `backend/src/services/notification.service.js`, `backend/src/controllers/notification.controller.js`, `backend/src/server.js` |
| Evaluation evidence | Reproducible pilot LOW/MEDIUM/HIGH evaluation reports exist, including SBERT health, full tri-algorithm coverage, operational fallback coverage, counterfactual offline fallback-policy evaluation, scoring-contract comparison, and per-method metrics. The latest generated report used a healthy local SBERT service with 16/16 SBERT-success cases, 100% full tri-algorithm coverage, and the corrected PR #106 scoring contract. | `backend/scripts/run-topic-evaluation.js`, `backend/evaluation/results/topic-similarity-evaluation.json`, `docs/testing/topic-similarity-evaluation-report.md` |
| Topic data-quality audit | Read-only safe-field lifecycle topic audit exists with missing-field counts, embedding coverage, import warning counts, source/import-batch grouping, and hashed duplicate-title candidates. | `backend/src/services/topicDataQualityAudit.service.js`, `backend/scripts/run-topic-data-quality-audit.js`, `backend/evaluation/results/topic-data-quality-audit.json`, `docs/testing/topic-data-quality-report.md` |

### Existing Frontend Behavior

| Area | Existing behavior | Evidence |
| --- | --- | --- |
| Admin dashboard | Protected page connected to `GET /api/v1/admin/dashboard/summary`. It renders real read-only counts and honest unavailable/partial states. Unsupported recent activity and operational metrics remain deferred. | `frontend/src/pages/admin/DashboardPage.jsx` |
| Admin topic repository | Protected page connected to lifecycle topic repository endpoints and existing admin import preview/commit endpoints. It shows real rows, safe empty states, an audited `.xlsx` import preview/commit panel, and no export/edit/delete/migration/duplicate-resolution actions. | `frontend/src/pages/admin/TopicRepositoryPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin user management | Protected page connected to admin user read endpoints. It shows real user rows, safe filters, empty/error states, and a narrow audited status action. It does not expose create, delete, role-change, invitation, or password-reset workflows. | `frontend/src/pages/admin/UserManagementPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin system settings | Protected read-only page connected to existing `SystemSetting` records. It does not expose save controls, threshold sliders, feature toggles, or arbitrary settings writes. | `frontend/src/pages/admin/SystemSettingsPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin audit log | Protected read-only page connected to existing audit-log list/detail endpoints. It shows stored audit events, honest empty/error states, and no export/delete/purge actions. | `frontend/src/pages/admin/AuditLogPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin reports | Protected read-only page connected to the admin reports summary endpoint. It shows real aggregates, honest zero-data/error states, and disabled/deferred export messaging. | `frontend/src/pages/admin/ReportsPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Lecturer decisions | Protected read-only page connected to the lecturer decision-history endpoint. It shows real decided submissions, safe filters, empty/error states, and no decision/export/report actions. | `frontend/src/pages/lecturer/MyDecisionsPage.jsx` |
| Lecturer supervisees | Protected deferred page. It does not derive supervisees from reviewed submissions because no explicit assignment model/business rule exists yet. | `frontend/src/pages/lecturer/SuperviseesPage.jsx` |
| Lecturer trends | Protected read-only page connected to lecturer research-trends aggregates. It shows real topic/submission/snapshot counts, honest zero/error states, and no fake charts, keyword clusters, recommendations, exports, or mutations. | `frontend/src/pages/lecturer/ResearchTrendsPage.jsx` |

### Existing Prisma Models

The current schema includes:

- `User`
- `AcademicSession`
- `Category`
- `SystemSetting`
- `Submission`
- `SimilarityCheckSnapshot`
- `AuditLog`
- `Notification`
- `HistoricalTopic`
- `CurrentSessionTopic`
- `UnderReviewTopic`

Enums include:

- `Role`: `STUDENT`, `LECTURER`, `ADMIN`
- `UserStatus`: `ACTIVE`, `SUSPENDED`
- `SubmissionStatus`: `PENDING_REVIEW`, `AWAITING_REVISION`, `APPROVED`, `REJECTED`

### Missing Backend/Governance Areas

These do not currently exist as implemented APIs/models/services in the inspected repository after PR #107:

- Admin user mutations beyond audited status updates.
- Admin system settings mutations.
- Admin reports export workflow.
- Audit log export, purge, and delete workflows.
- Lecturer supervisee assignment endpoint.
- Admin research trends analytics endpoint.
- Real SMTP/provider transport implementation.
- Notification event hooks and frontend notification UI.
- Lecturer-reviewed final evaluation dataset.
- Lecturer-reviewed final semantic-effectiveness evidence.
- Semantic duplicate-existing governance.

Import-specific gap:

- Import preview/commit endpoints are present and admin-protected after PR #96. PR #103 connects a scoped frontend import panel to those endpoints, while richer duplicate governance, row-level operator reports, embedding generation, similarity integration, CSV import, export/download, migration, and topic edit/delete workflows remain deferred.

## 3. Design Principles For The Next Backend Phase

1. Read-only before mutation.
2. Audit logging before privileged admin actions.
3. RBAC enforcement before every admin API.
4. No fake metrics, fake rows, fake health states, fake reports, fake notifications, fake exports, or fake analytics.
5. No unsupported frontend behavior.
6. Explicit error contracts and stable response envelopes.
7. Pagination, filtering, and sorting for list endpoints from the first implementation PR.
8. Safe empty-state responses instead of placeholder data.
9. Backwards compatibility with current UI routes and existing APIs.
10. Test-first or test-backed implementation for each endpoint group.
11. Preserve the approved PR #106 similarity thresholds and scoring behavior unless a future scoped evaluation-backed PR changes them.
12. Keep lecturer decisions lecturer-controlled; similarity remains advisory.

## 4. Shared API Conventions

### Base Paths

Proposed admin paths:

```text
/api/v1/admin/...
```

Proposed lecturer paths:

```text
/api/v1/lecturer/...
```

Existing lecturer paths under `/api/v1/lecturer/submissions...` should remain stable.

### Success Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

Existing endpoints currently use mixed envelopes such as `status`, `message`, and `details`. New admin/governance endpoints should use the envelope above, while legacy endpoints should not be broken casually.

### Pagination Shape

```json
{
  "page": 1,
  "limit": 25,
  "total": 0,
  "totalPages": 0,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

Default list behavior:

- `page`: default `1`
- `limit`: default `25`
- maximum `limit`: `100`
- empty lists return `items: []` and valid pagination metadata

### Filtering Shape

Filters should be explicit query parameters:

```text
?role=student&status=active&search=malaria&page=1&limit=25
```

Filter metadata should echo normalized filters:

```json
{
  "meta": {
    "filters": {
      "role": "student",
      "status": "active",
      "search": "malaria"
    }
  }
}
```

### Sorting Shape

Use constrained fields:

```text
?sort=submittedAt&direction=desc
```

Invalid sort fields should return a validation error, not fall through to raw SQL behavior.

### Timestamp Format

All timestamps should be ISO 8601 strings:

```text
2026-06-05T15:37:00.000Z
```

### Auth and Role Requirements

- All admin endpoints require `requireAuth` and `requireRole('admin')`.
- All lecturer endpoints require `requireAuth` and `requireRole('lecturer')`.
- Import governance endpoints are protected with `requireAuth` and `requireRole('admin')`; operational frontend use should continue to prefer the admin-prefixed v1 routes.

### Audit Metadata Fields

Every audited event should be able to store:

- `actorId`
- `actorRole`
- `actorEmail`
- `eventType`
- `targetType`
- `targetId`
- `requestId`
- `ipAddress`
- `userAgent`
- `metadata`
- `createdAt`

### Safe Empty-State Responses

Do this:

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 0,
      "totalPages": 0,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "dataCoverage": "No matching records found."
  }
}
```

Do not return fake placeholder rows, fake counts, fake status values, or fake charts.

## 5. Contract Plan: AuditLog Foundation

Audit logging should exist before privileged admin mutations. This foundation was implemented in PR #96.

### Implemented Prisma Model Fields

The following historical contract model was implemented by PR #96:

```prisma
model AuditLog {
  id           Int      @id @default(autoincrement())
  eventType    String   @map("event_type") @db.VarChar(100)
  actorId      Int?     @map("actor_id")
  actorRole    String?  @map("actor_role") @db.VarChar(50)
  actorEmail   String?  @map("actor_email") @db.VarChar(200)
  targetType   String?  @map("target_type") @db.VarChar(100)
  targetId     String?  @map("target_id") @db.VarChar(100)
  requestId    String?  @map("request_id") @db.VarChar(100)
  ipAddress    String?  @map("ip_address") @db.VarChar(100)
  userAgent    String?  @map("user_agent") @db.Text
  metadata     Json?
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([eventType])
  @@index([actorId])
  @@index([actorRole])
  @@index([targetType, targetId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### Candidate Event Types

| Event type | Timing | Notes |
| --- | --- | --- |
| `AUTH_LOGIN` | Future hook | Existing auth behavior can log successful login if policy chooses. |
| `AUTH_LOGOUT` | Future hook | Existing logout can log session end if actor is known and policy chooses. |
| `SUBMISSION_CREATED` | Immediate | Existing student submission creation is an important workflow event. |
| `SUBMISSION_REVIEWED` | Immediate | Existing lecturer approval/revision/rejection should be audited. |
| `SIMILARITY_CHECK_RUN` | Immediate | Lecturer submission similarity checks and manual checks should distinguish persisted vs advisory checks. |
| `TOPIC_IMPORT_PREVIEWED` | Implemented | Admin import preview emits this event. |
| `TOPIC_IMPORT_COMMITTED` | Implemented | Admin import commit emits this event. |
| `ADMIN_SETTING_UPDATED` | Future | Only after settings writes are implemented with key-specific validation. |
| `USER_STATUS_CHANGED` | Implemented | The constrained admin user status mutation emits this event. |
| `REPORT_EXPORTED` | Future | Only after report export generation exists. |

### Security Concerns

- Do not store raw passwords, reset tokens, session tokens, or complete sensitive payloads.
- Redact large import row content unless explicitly needed for data-quality traceability.
- Store enough request context for accountability without turning audit logs into a sensitive-data dump.
- Audit log read endpoints must be admin-only.

### Implemented Read Endpoints

- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/audit-logs/:id`

Future work concerns additional event hooks and audit export/purge/delete policy, not creation of the AuditLog foundation.

## 6. Contract Plan: Admin Dashboard Read-Only API

Proposed endpoint:

```text
GET /api/v1/admin/dashboard/summary
```

Implementation status after PR #97:

- Implemented as a read-only admin endpoint.
- Protected by `requireAuth` and `requireRole('admin')`.
- No request body is accepted or required.
- No records are created, updated, deleted, imported, exported, or audited by this endpoint.
- Counts are read only from existing Prisma models and returned with honest availability metadata.

### Response Fields

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 0,
      "students": 0,
      "lecturers": 0,
      "admins": 0,
      "active": 0,
      "suspended": 0,
      "status": "available"
    },
    "submissions": {
      "total": 0,
      "pendingReview": 0,
      "awaitingRevision": 0,
      "approved": 0,
      "rejected": 0,
      "status": "available"
    },
    "topics": {
      "historical": 0,
      "currentSession": 0,
      "underReview": 0,
      "status": "available"
    },
    "similarityChecks": {
      "snapshots": 0,
      "highRisk": null,
      "mediumRisk": null,
      "lowRisk": null,
      "status": "partial",
      "notes": ["Risk distribution only includes stored lecturer snapshots when available."]
    },
    "serviceHealth": {
      "api": { "status": "available" },
      "database": { "status": "available" },
      "sbert": { "status": "unknown", "message": "SBERT health is not checked by this endpoint yet." }
    },
    "warnings": []
  },
  "meta": {
    "generatedAt": "2026-06-05T15:37:00.000Z",
    "dataCoverage": "Read-only counts from existing tables."
  }
}
```

### Rules

- Use only real counts from existing tables.
- If a data source cannot be checked safely, return `status: "unknown"` or `status: "unavailable"` with a message.
- Do not invent uptime, service latency, SBERT outage/degraded state, active user count, or report totals.
- No mutations.

### Frontend Integration Notes

Target page:

```text
frontend/src/pages/admin/DashboardPage.jsx
```

The existing dashboard shell already presents unavailable metrics honestly. Future frontend integration should:

- Replace only the honest placeholder cards with returned real counts.
- Keep unavailable cards visible if the endpoint marks a section unknown/unavailable.
- Preserve current admin route and top navigation.
- Add loading/error/empty states without fake fallback numbers.

Frontend implementation status after PR #97:

- `frontend/src/pages/admin/DashboardPage.jsx` now renders returned read-only counts.
- Loading and request-error states remain explicit.
- Partial coverage warnings are shown when the endpoint marks a section unavailable.
- Recent activity, reports, exports, import controls, settings changes, and audit-log UI remain deferred.

## 7. Contract Plan: Admin User Management Read-Only API

Proposed endpoints:

```text
GET /api/v1/admin/users
GET /api/v1/admin/users/:id
```

Implementation status after PR #99:

- Implemented as admin-only read endpoints.
- Protected by `requireAuth` and `requireRole('admin')`.
- Responses serialize role/status values in lowercase client-facing form.
- Safe user serialization excludes password hashes, reset tokens, reset token expiry values, and internal secrets.
- Empty list responses return `items: []` with valid pagination metadata.

### Filters

```text
role=student|lecturer|admin
status=active|suspended
search=<name-or-email>
page=1
limit=25
sort=name|email|role|status|createdAt|updatedAt
direction=asc|desc
```

### List Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Real User",
        "email": "real.user@example.edu",
        "role": "student",
        "status": "active",
        "createdAt": "2026-06-05T15:37:00.000Z",
        "updatedAt": "2026-06-05T15:37:00.000Z"
      }
    ]
  },
  "meta": {
    "pagination": {},
    "filters": {}
  }
}
```

### Deferred Mutations

Audit logging exists after PR #96. PR #99 implements only this constrained mutation:

```text
PATCH /api/v1/admin/users/:id/status
```

Rules for the implemented status mutation:

- Admin-only.
- Accepts only `active` or `suspended`.
- Updates only the `User.status` field.
- Rejects self-suspension.
- Emits `USER_STATUS_CHANGED`.
- Returns the safe serialized user.

Still deferred:

- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id/role`
- `POST /api/v1/admin/users/:id/reset-password`
- `DELETE /api/v1/admin/users/:id`
- invitation and bulk account workflows

### Security/RBAC Requirements

- Admin-only.
- Never return `passwordHash`, reset token fields, or internal secrets.
- Audit access to sensitive detail endpoints if policy requires it.
- Audit all future user mutations.

### Frontend Integration Notes

Target page:

```text
frontend/src/pages/admin/UserManagementPage.jsx
```

Frontend implementation status after PR #99:

- `/admin/user-management` now renders a connected admin user page instead of the generic placeholder.
- The page calls the read-only list endpoint with search, role, and status filters.
- Empty and error states do not substitute fake users.
- The only enabled account action is the constrained active/suspended status update for non-admin accounts.
- Create-user, delete-user, role-change, invitation, password-reset, fake last-active, and fake assignment surfaces remain unavailable.

## 8. Contract Plan: Admin Topic Repository API

Proposed read-only endpoints:

```text
GET /api/v1/admin/topics
GET /api/v1/admin/topics/:lifecycle/:id
GET /api/v1/admin/topics/summary
```

Implementation status after PR #98:

- Implemented as read-only admin endpoints.
- Protected by `requireAuth` and `requireRole('admin')`.
- No request body is accepted or required.
- No topics are created, updated, deleted, imported, exported, migrated, or audited by these repository read endpoints.
- Detail reads require an explicit lifecycle value so numeric ids from different lifecycle tables are not conflated.

### Lifecycle Tables

The endpoint should support existing lifecycle tables:

- `HistoricalTopic`
- `CurrentSessionTopic`
- `UnderReviewTopic`

### Filters

```text
lifecycle=historical|current_session|under_review
category=<category>
sessionYear=<year>
search=<title-or-keyword>
supervisorName=<name>
sourceType=<source>
importBatchId=<batch>
page=1
limit=25
sort=createdAt|updatedAt|sessionYear|title|category|supervisorName
direction=asc|desc
```

Risk/similarity filters should be deferred unless real risk metadata exists on the queried records. The current lifecycle topic tables do not store a normalized risk field.

### Response Notes

- Include `lifecycle` in each item.
- Include available fields exactly as stored.
- Include `importWarnings` and provenance fields for data-quality review.
- Return empty arrays when no topics match.
- Do not fabricate supervisor names, student identifiers, risk scores, lifecycle status, or embeddings.

### Frontend Integration Notes

Target page:

```text
frontend/src/pages/admin/TopicRepositoryPage.jsx
```

Frontend implementation status after PR #98:

- `/admin/topic-repository` now renders a real read-only repository page instead of the generic placeholder.
- Summary cards use returned lifecycle totals and data-quality counts.
- The list/search surface uses the read-only topic list endpoint.
- Empty and error states do not substitute fake topic rows.
- Import, migration, duplicate actions, edit/delete actions, and export buttons remain unavailable until separate governance PRs implement them.

## 9. Contract Plan: Import Governance Hardening

Existing endpoints:

```text
POST /api/import/topics/preview
POST /api/import/topics/commit
POST /api/v1/import/topics/preview
POST /api/v1/import/topics/commit
```

Implementation status after PR #96:

- Existing import preview/commit endpoints require authenticated admin access.
- Admin-prefixed aliases exist:
  - `POST /api/v1/admin/import/topics/preview`
  - `POST /api/v1/admin/import/topics/commit`
- Preview and commit emit safe audit metadata without storing uploaded file contents or raw imported rows.
- PR #98 does not change import parser, normalization, persistence, or commit behavior.

Frontend implementation status after PR #103:

- `/admin/topic-repository` exposes a scoped `.xlsx` import panel.
- The panel uses the admin-prefixed v1 endpoints for operational preview and commit.
- Preview renders the backend `import_report` and accepted-record count only.
- Commit is disabled until preview succeeds.
- Commit renders the backend `import_report` and `persistence_report` only.
- Preview/commit loading, success, and backend-error states are explicit.
- Duplicate-existing counts, richer row-level warnings/errors, embeddings, similarity integration, CSV import, export/download, migration, and topic edit/delete controls remain deferred unless the backend later supports them.
- The frontend does not fabricate import rows, duplicate-existing results, row-level details, persistence counts, or export artifacts.

### Planned Changes

1. Continue to prefer admin v1 paths for operational use:

```text
POST /api/v1/admin/import/topics/preview
POST /api/v1/admin/import/topics/commit
```

2. Keep legacy routes only if compatibility requires it; otherwise document deprecation.
3. Add duplicate detection across stored records before commit.
4. Preserve raw row data and source metadata.
5. Produce operator-facing row-level warnings/errors.

### Preview Report Structure

```json
{
  "success": true,
  "data": {
    "records": [],
    "report": {
      "totalRows": 0,
      "acceptedRows": 0,
      "warningRows": 0,
      "skippedRows": 0,
      "duplicateInBatchRows": 0,
      "duplicateExistingRows": 0,
      "missingTitleRows": 0,
      "incompleteContextRows": 0,
      "rows": []
    }
  },
  "meta": {
    "previewOnly": true
  }
}
```

### Row-Level Warning/Error Format

```json
{
  "rowNumber": 12,
  "status": "warning",
  "normalizedTitle": "malaria prevention among children",
  "warnings": [
    {
      "code": "MISSING_CONTEXT_FIELD",
      "field": "population",
      "message": "Population is missing."
    }
  ],
  "errors": []
}
```

### Warning vs Reject Rules

Reject:

- Missing/blank title.
- Unsupported file type.
- File too large.
- Invalid lifecycle bucket if policy decides bucket is required.

Warn:

- Missing category.
- Missing session year.
- Missing supervisor name.
- Missing population/location/study focus.
- Inconsistent category value.
- Existing duplicate candidate.
- Nullable embedding.

### Commit Report Structure

```json
{
  "success": true,
  "data": {
    "importBatchId": "generated-batch-id",
    "persistence": {
      "inserted": 0,
      "skipped": 0,
      "failed": 0,
      "byLifecycle": {
        "historical": 0,
        "currentSession": 0,
        "underReview": 0
      }
    }
  },
  "meta": {
    "audited": true
  }
}
```

## 10. Contract Plan: System Settings API

Proposed endpoints:

```text
GET /api/v1/admin/settings
PATCH /api/v1/admin/settings/:key
```

Implementation status after PR #99:

- `GET /api/v1/admin/settings` is implemented as an admin-only read endpoint.
- Protected by `requireAuth` and `requireRole('admin')`.
- Reads only existing `SystemSetting` rows.
- Includes optional updater metadata when `updatedBy` is available.
- Empty responses return `items: []`.
- `PATCH /api/v1/admin/settings/:key` remains deferred.

### Candidate Setting Categories

- Similarity thresholds.
- Weighting configuration, only if a future evaluation-backed PR supports it.
- Feature flags.
- Email template references, only after real provider transport and template validation are implemented.

### Rules

- Settings updates require audit logging.
- Validation is mandatory for every key.
- Dangerous settings require explicit confirmation in request body.
- Preserve existing similarity thresholds unless a scoped future PR changes them.
- Never allow arbitrary unvalidated keys to change scoring behavior.

### Current Read Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "key": "demo_auth_users_notice",
        "value": "Demo users are available for local authentication testing.",
        "updatedAt": "2026-06-05T15:37:00.000Z",
        "updatedBy": {
          "id": 1,
          "name": "Admin User",
          "email": "admin@example.edu",
          "role": "admin"
        }
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-06-05T15:37:00.000Z",
    "dataCoverage": "Read-only settings from SystemSetting table.",
    "mutationStatus": "Settings updates remain deferred until key-specific validation is approved."
  }
}
```

### Patch Request

```json
{
  "value": "0.70",
  "reason": "Reviewed by department committee",
  "confirmation": "I understand this changes similarity behavior"
}
```

### Patch Response

```json
{
  "success": true,
  "data": {
    "key": "similarity.highRiskThreshold",
    "value": "0.70",
    "updatedAt": "2026-06-05T15:37:00.000Z",
    "updatedBy": {
      "id": 1,
      "name": "Admin User"
    }
  },
  "meta": {
    "auditEventType": "ADMIN_SETTING_UPDATED"
  }
}
```

Patch request/response examples remain future contract examples only. They are not implemented by PR #99.

### Frontend Integration Notes

Target page:

```text
frontend/src/pages/admin/SystemSettingsPage.jsx
```

Frontend implementation status after PR #99:

- `/admin/system-settings` now renders a connected read-only settings page instead of the generic placeholder.
- The page calls the settings read endpoint and shows real stored settings only.
- Empty and error states do not substitute fake configuration rows.
- Save buttons, edit actions, threshold sliders, feature toggles, email controls, and arbitrary setting mutations remain unavailable.

## 11. Contract Plan: Admin Audit Log API

Depends on the AuditLog model/service foundation.

Proposed endpoints:

```text
GET /api/v1/admin/audit-logs
GET /api/v1/admin/audit-logs/:id
```

Implementation status after PR #100:

- Implemented as admin-only read endpoints since PR #96.
- `/admin/audit-log` now calls the existing list and detail endpoints.
- The frontend renders stored events, safe serialized detail, empty states, and endpoint error states.
- No audit export, audit purge, audit delete, or fabricated event workflow is connected.

### Filters

```text
actorRole=admin|lecturer|student
actorId=<id>
eventType=<event>
targetType=<type>
targetId=<id>
dateFrom=<iso-date>
dateTo=<iso-date>
search=<text>
page=1
limit=25
sort=createdAt
direction=desc
```

### Rules

- Admin-only.
- No export behavior in the first audit-log API PR.
- Redact sensitive metadata.
- Empty results return `items: []`.
- Detail endpoint should return exact stored metadata with redaction policy applied.

## 12. Contract Plan: Admin Reports and Exports

Read-only first:

```text
GET /api/v1/admin/reports/summary
GET /api/v1/admin/reports/current-session
GET /api/v1/admin/reports/topic-approval
```

Implementation status after PR #100:

- `GET /api/v1/admin/reports/summary` is implemented as an admin-only read endpoint.
- The summary endpoint aggregates only existing table counts and grouped counts from `User`, `Submission`, topic lifecycle tables, `SimilarityCheckSnapshot`, and `AuditLog`.
- `/admin/reports` now calls the summary endpoint and renders returned aggregates with honest zero-data/error states.
- `GET /api/v1/admin/reports/current-session` and `GET /api/v1/admin/reports/topic-approval` remain deferred.
- Export generation remains deferred.

Deferred export endpoint:

```text
POST /api/v1/admin/reports/:type/export
```

### Report Data Principles

- Use only real submissions, topic lifecycle records, snapshots, and users.
- Return empty arrays and `dataCoverage` notes when records are unavailable.
- Do not fabricate charts, topic counts, approval rates, supervisor ratios, or export files.
- PDF/CSV export should not be built until report data is stable and audit logging exists.
- Export generation should be audited as `REPORT_EXPORTED`.

### Implemented Summary Response Shape After PR #100

The implemented summary response includes:

- `users`: total, role counts, and status counts.
- `submissions`: total, status counts, and decision coverage.
- `topics`: total and lifecycle counts.
- `similarityChecks`: stored snapshot count, risk grouping, and response-status grouping.
- `auditLogs`: total, actor-role grouping, and top event types.
- `exports`: `status: "deferred"` with an explicit no-export message.
- `meta`: `generatedAt`, `dataCoverage`, `sourceTables`, and `exportStatus`.

### Example Summary Response

```json
{
  "success": true,
  "data": {
    "currentSession": {
      "submissionCount": 0,
      "approvedCount": 0,
      "rejectedCount": 0,
      "awaitingRevisionCount": 0
    },
    "topicApproval": {
      "byCategory": [],
      "byStatus": []
    }
  },
  "meta": {
    "generatedAt": "2026-06-05T15:37:00.000Z",
    "dataCoverage": "No matching records found."
  }
}
```

## 13. Contract Plan: Lecturer Decision History

Proposed endpoint:

```text
GET /api/v1/lecturer/decisions
```

Implementation status after PR #101:

- Implemented as a read-only lecturer endpoint.
- Protected by `requireAuth` and `requireRole('lecturer')`.
- No request body is accepted or required.
- No records are created, updated, deleted, exported, or audited by this endpoint.
- The endpoint returns only decisions made by the authenticated lecturer.
- Empty responses return `items: []` with valid pagination metadata.

### Filters

```text
status=approved|rejected|awaiting_revision
dateFrom=<iso-date>
dateTo=<iso-date>
category=<category>
search=<student-or-topic>
page=1
limit=25
sort=decidedAt|submittedAt|title|status
direction=desc
```

### Data Source

Use existing `Submission` records where:

- `decidedById` equals the authenticated lecturer id.
- `decidedAt` is not null.
- `status` is one of `AWAITING_REVISION`, `APPROVED`, or `REJECTED`.

### Response Notes

- Safe student name/email may be returned from the existing student relation.
- Password hashes, reset token fields, internal user secrets, and raw similarity response payloads are not returned.
- `similaritySnapshotId` is nullable and points only to the latest stored snapshot id when a related snapshot exists.
- Decision feedback is the stored `decisionReason`.

### Frontend Integration

Target page:

```text
frontend/src/pages/lecturer/MyDecisionsPage.jsx
```

Frontend implementation status after PR #101:

- `/lecturer/my-decisions` now renders a connected read-only decision history page.
- The page calls the decision-history endpoint with supported filters and pagination.
- Empty and error states do not substitute fake decision rows.
- Approve, reject, request-revision, export, report, fake risk score, and fake activity surfaces remain unavailable.

Do not change the existing decision action endpoint:

```text
PATCH /api/v1/lecturer/submissions/:id/status
```

## 14. Contract Plan: Lecturer Supervisees

Proposed endpoint:

```text
GET /api/v1/lecturer/supervisees
```

Implementation status after PR #101:

- Not implemented.
- No backend supervisees endpoint is added.
- `frontend/src/pages/lecturer/SuperviseesPage.jsx` remains an honest deferred page.
- The page explicitly states that reviewed submissions are not treated as supervisees.

### Current Schema Gap

No explicit supervisee assignment model exists in the inspected Prisma schema.

### Options

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| Derive from reviewed submissions | Treat students whose submissions were reviewed/decided by the lecturer as supervisees. | No migration required. | Not a true assignment model; may misrepresent supervision. |
| Add explicit assignment model later | Add a `SupervisorAssignment` or similar table linking lecturer, student, topic/session, and status. | Accurate workflow model. | Requires schema migration and business-rule review. |

### Recommendation

Do not derive supervisee assignments unless the department confirms that review history equals supervision. Prefer a future explicit assignment model after workflow rules are finalized.

### Frontend Integration

Target page:

```text
frontend/src/pages/lecturer/SuperviseesPage.jsx
```

Until the schema decision is made, keep this page honest as "not connected yet".

## 15. Contract Plan: Lecturer/Admin Research Trends Analytics

Propose a shared analytics service once real data coverage is sufficient.

Possible endpoints:

```text
GET /api/v1/admin/analytics/research-trends
GET /api/v1/lecturer/research-trends
```

Implementation status after PR #102:

- `GET /api/v1/lecturer/research-trends` is implemented as a lecturer-only read endpoint.
- Protected by `requireAuth` and `requireRole('lecturer')`.
- No request body is accepted or required.
- No records are created, updated, deleted, exported, audited, recalculated, or mutated by this endpoint.
- The admin analytics endpoint remains deferred.

### Candidate Analytics

- Topic distribution by category.
- Topic distribution by academic session.
- Approval/revision/rejection trends.
- Repeated-topic risk distribution based on stored similarity snapshots.
- Keyword trends only when real keyword data exists.
- Supervisor or reviewer workload only when real assignment/review data exists.

### Implemented Lecturer Analytics After PR #102

- Topic distribution by stored category.
- Topic distribution by stored session year.
- Topic totals by lifecycle table.
- Submission totals by stored status.
- Submission distribution by stored category.
- Stored similarity snapshot counts by risk and response status.
- Explicit deferred states for keyword extraction/clustering and recommendations.

Keyword extraction remains deferred because PR #102 does not introduce a keyword analytics contract, semantic clustering, or recommendation engine.

### Rules

- No fake charts.
- Return empty arrays when no data exists.
- Include `generatedAt`.
- Include `dataCoverage` notes.
- Include `sourceTables` in metadata.
- Avoid claiming semantic trends when SBERT data is unavailable.
- Do not fabricate keywords, recommendations, or research insights.
- Do not change similarity thresholds, snapshot scoring, or SBERT behavior.

### Frontend Integration

Targets:

- `frontend/src/pages/admin/PlaceholderPage.jsx` for Reports.
- `frontend/src/pages/lecturer/ResearchTrendsPage.jsx`.

Frontend implementation status after PR #102:

- `/lecturer/research-trends` now renders a connected read-only aggregate page.
- Loading, real aggregate, zero-data, and endpoint-error states are explicit.
- Keyword trends and recommendations are visibly deferred.
- Export, download, generated chart, threshold, mutation, and recommendation actions remain unavailable.

## 16. Security and Authorization Matrix

| Endpoint group | Required role | Read/write | Audit required | Notes |
| --- | --- | --- | --- | --- |
| Admin dashboard | Admin | Read | Optional for read; required for suspicious access if policy chooses | Read-only counts and safe health summaries. |
| Admin users | Admin | Read first; future write | Required for mutations | Never return password hashes/reset tokens. |
| Admin topics | Admin | Read first | Optional for read; required for import/migration actions | Include lifecycle/provenance fields honestly. |
| Admin import preview | Admin | Read/preview file processing | Required | Existing import preview should be admin-protected before production use. |
| Admin import commit | Admin | Write | Required | Must audit batch id, source filename, inserted/skipped counts. |
| Admin settings | Admin | Read/write | Required for writes | Preserve thresholds until scoped PR changes them. |
| Admin audit logs | Admin | Read | Audit reads if policy requires | Redact sensitive metadata. |
| Admin reports | Admin | Read; future export write | Required for exports | No fake metrics/exports. |
| Lecturer decisions | Lecturer | Read | Optional for read; existing status writes should be audited | Uses existing `Submission` decision fields. |
| Lecturer supervisees | Lecturer | Read | Optional | Requires schema/workflow decision. |
| Lecturer trends | Lecturer | Read | Optional | Use real data only; empty arrays are valid. |

## 17. Testing Strategy

| Contract area | Backend unit tests | Controller/RBAC tests | Empty/pagination/filter tests | Audit tests | Later frontend/smoke tests |
| --- | --- | --- | --- | --- | --- |
| AuditLog foundation | Audit service redaction and serialization | Admin-only audit-log reads | Empty audit list, filter combinations | Event creation for selected workflow events | Audit log placeholder becomes real page smoke |
| Admin dashboard | Summary aggregation service | Admin required, non-admin forbidden | Unknown/unavailable sections | Optional read audit if policy chooses | Dashboard real-data/empty-state tests |
| Admin users | User query service, serializer excludes secrets | Admin required, non-admin forbidden | Role/status/search/page/limit/sort | Mutations only after audit foundation | User management table smoke |
| Admin topics | Lifecycle query service | Admin required | Lifecycle/category/session/search pagination | Import actions later | Topic repository table/filter smoke |
| Import governance | Duplicate/data-quality helpers | Admin required for preview/commit | Warning/error row reports | Preview/commit audit events | Import panel preview/commit smoke |
| System settings | Key validation service | Admin required | Empty settings list, invalid key | Update event required | Settings page read/update tests later |
| Admin reports | Aggregation service | Admin required | Empty reports and filters | Export event later | Reports page empty/real-data smoke |
| Lecturer decisions | Decision history query service | Lecturer required | Status/date/category/search pagination | Optional read audit | My Decisions real list smoke |
| Lecturer supervisees | Assignment query service once model decided | Lecturer required | Empty assignments | Optional | Supervisees real list smoke |
| Research trends | Analytics aggregation service | Admin/lecturer role-specific access | Empty arrays/data coverage | Optional | Chart/empty-state smoke |

Every implementation PR should include:

- Unit tests for service logic.
- Controller tests for request validation and response shape.
- RBAC tests for unauthenticated, wrong-role, and correct-role access.
- Empty-state tests that prove no fake data is returned.
- Pagination/filter/sort tests for list endpoints.
- Audit tests for any mutation or privileged operation.

## 18. Implementation Roadmap After This Contract PR

### PR #96: Audit, RBAC, and Admin Governance Foundation

Purpose:

- Add AuditLog model/service and admin route foundation.
- Protect import routes or introduce admin-protected v1 import aliases.

Likely files:

- `backend/prisma/schema.prisma`
- migration files
- `backend/src/services/auditLog.service.js`
- `backend/src/controllers/adminAuditLog.controller.js`
- `backend/src/server.js`
- backend tests

Tests required:

- Audit service unit tests.
- RBAC controller tests.
- Import route protection tests.

Risks:

- Migration compatibility.
- Sensitive metadata leakage.
- Legacy import route behavior.

Must not include:

- Admin user mutations.
- Fake audit records.
- Report/export generation.
- Similarity threshold changes.

### PR #97: Admin Read-Only Console APIs + Dashboard Connection

Purpose:

- Add `GET /api/v1/admin/dashboard/summary`.
- Connect admin dashboard to real read-only data.

Status:

- Implemented by branch `backend/admin-dashboard-summary-api`.

Likely files:

- Backend admin dashboard controller/service/tests.
- `frontend/src/pages/admin/DashboardPage.jsx`.
- Admin dashboard tests.

Tests required:

- Backend aggregation tests.
- Empty/unknown service health tests.
- Frontend loading/error/empty/real-count tests.

Risks:

- Misleading health data.
- Overclaiming unavailable SBERT/database state.

Must not include:

- Mutations.
- Fake metrics.
- Exports.

### PR #98: Admin Topic Repository + Import Governance

Purpose:

- Add read-only admin topic repository endpoints.
- Harden import preview/commit governance and reporting.

Status:

- Read-only admin topic repository endpoints and frontend connection are implemented by branch `backend/admin-topic-repository-import-governance`.
- Import endpoint hardening was already implemented by PR #96.
- Richer import duplicate-existing detection and row-level operator reporting remain deferred.

Likely files:

- Backend admin topic controller/service/tests.
- Topic repository frontend page and tests.
- Import documentation updates.

Tests required:

- Lifecycle filters.
- Pagination.
- Read-only RBAC.
- Empty repository responses.
- No embedding vector exposure.
- No fake frontend topic rows or mutation actions.
- Import duplicate-existing/report behavior remains a future test target.

Risks:

- Data-quality false positives.
- Import route compatibility.

Must not include:

- Fake topic rows.
- Automatic migrations of topic lifecycle.
- Embedding generation unless separately scoped.

### PR #99: Admin Users + System Settings

Purpose:

- Add admin user read-only endpoints.
- Add settings read endpoint.
- Add one constrained audited user status mutation.
- Keep settings mutation deferred until key-specific validation is complete.

Status:

- Implemented by branch `backend/admin-users-system-settings`.
- User list/detail endpoints and frontend connection are implemented.
- User status update is implemented with `USER_STATUS_CHANGED` audit logging.
- Settings read endpoint and frontend connection are implemented.
- Settings writes remain deferred.

Likely files:

- Backend admin users/settings controllers/services/tests.
- Frontend user/settings pages and tests.
- Contract documentation updates.

Tests required:

- Secret redaction.
- RBAC.
- User list filtering, pagination, and empty states.
- User status update audit event.
- Settings read empty states.
- No fake frontend users/settings.
- No unsupported account or settings controls.

Risks:

- Overbroad admin privileges.
- Unsafe settings mutation.

Must not include:

- Role mutations.
- User status mutation without audit tests.
- Password reset delegation unless scoped.
- Threshold changes without evaluation.
- Arbitrary settings writes.

### PR #100: Admin Audit Log + Reports Governance

Purpose:

- Connect the existing audit-log read API to the admin Audit Log page.
- Add the read-only admin reports summary endpoint using real data.
- Connect the admin Reports page to the summary endpoint while keeping exports deferred.

Status:

- Implemented by branch `backend/admin-audit-reports-governance`.

Likely files:

- Backend admin reports service/controller/tests.
- Admin Audit Log and Reports frontend pages.
- Admin API helper, role page exports, smoke, and governance docs.

Tests required:

- Audit list/detail frontend states.
- Reports empty states and data coverage.
- Aggregation correctness.
- Role enforcement.
- Export-deferred assertions.

Risks:

- Fake or misleading metrics.
- Overexpanding exports.
- Overclaiming analytics from sparse data.

Must not include:

- PDF/CSV export generation unless report data is stable and audit logging exists.
- Fake charts.
- Fake audit records.
- Audit deletion or purge workflows.

### PR #101: Lecturer Decision History + Supervisees

Purpose:

- Add read-only lecturer decision history.
- Connect My Decisions to real decided submissions.
- Keep supervisees deferred unless a true assignment model exists.

Status:

- Implemented by branch `backend/lecturer-decisions-supervisees`.
- Lecturer decision history endpoint and frontend connection are implemented.
- Supervisees remains deferred because no explicit assignment model/business rule exists.

Likely files:

- Backend submission service/controller/server tests.
- Frontend submissions API helper.
- Lecturer My Decisions and Supervisees pages and tests.
- Smoke and governance docs.

Tests required:

- Lecturer-only access.
- Decision filters.
- Empty history.
- Pagination.
- Excludes other lecturers' decisions.
- No sensitive fields.
- No read-only audit creation.
- Supervisees deferred/no-fake-data UI behavior.

Risks:

- Confusing review history with supervision.
- Overexposing student/user internals.

Must not include:

- Changing existing decision action endpoint.
- Fake supervisees.
- Fake decisions.
- Supervisees derived from reviewed submissions without a real assignment rule.

### PR #102: Lecturer Research Trends Governance

Purpose:

- Add read-only lecturer research trend aggregates backed by existing topic, submission, and similarity snapshot data.
- Connect Research Trends to the real endpoint while keeping keyword clustering, recommendations, charts, exports, and mutations deferred.

Status:

- Implemented by branch `backend/lecturer-research-trends-governance`.

Likely files:

- Backend lecturer research trends service/controller/tests.
- Frontend submissions API helper.
- Lecturer Research Trends page and tests.
- Smoke and governance docs.

Tests required:

- Lecturer-only access.
- Aggregate correctness.
- Empty aggregate state.
- No raw rows, embeddings, or sensitive user fields.
- No mutation/export/recommendation/chart actions.
- No fake frontend trends, keywords, or insights.

Risks:

- Overclaiming analytics from sparse or imported records.
- Treating stored snapshot risks as live SBERT health or recalculated similarity.

Must not include:

- Fake trend charts.
- Fake keywords.
- Fake analytics insights.
- Generated recommendations.
- Lecturer mutations.
- Similarity threshold or scoring changes.

### PR #103: Admin Import UI + Import Governance Frontend Connection

Purpose:

- Connect the existing admin-protected import preview/commit backend endpoints to the admin Topic Repository page.
- Allow `.xlsx` file selection, preview, report rendering, and commit from the frontend without inventing unsupported import capabilities.
- Keep duplicate-existing checks, richer row-level reports, embedding generation, similarity integration, CSV import, exports, migrations, and topic edit/delete workflows deferred.

Status:

- Implemented by branch `frontend/admin-import-governance-ui`.

Likely files:

- Frontend admin API helper.
- Admin Topic Repository page and tests.
- Smoke and governance/import workflow docs.

Tests required:

- File selection.
- Preview loading, success, and error states.
- Commit disabled before preview.
- Commit loading, success, and error states.
- Real mocked backend report values rendered.
- Deferred duplicate-existing/richer report messaging.
- No fake import rows, duplicate-existing counts, row-level details, export/download, or topic mutation actions.

Risks:

- Overclaiming duplicate-existing or row-level governance before backend support exists.
- Accidentally treating preview data as persisted data.
- Introducing unsupported import/export/edit/delete behavior in the repository page.

Must not include:

- Backend parser, normalization, or persistence changes.
- Prisma migrations.
- Fake import results.
- Fake duplicate-existing results.
- Fake row-level details.
- Export/download behavior.
- Topic edit/delete/migration workflows.
- Similarity threshold or scoring changes.
- Auth/session changes.

### PR #104: Production Email + Notification Foundation

Purpose:

- Replace mock-only reset email behavior with explicit safe provider modes.
- Add a real notification backend foundation without fake notification feeds or frontend UI.
- Keep SMTP transport and notification event hooks deferred until they are scoped and tested.

Status:

- Implemented by branch `backend/production-email-notification-foundation`.

Likely files:

- `backend/src/services/email.service.js`
- `backend/src/config/env.js`
- `backend/env.example`
- `backend/prisma/schema.prisma`
- notification migration file
- notification service/controller/server routes
- backend tests and setup docs

Tests required:

- Provider mock tests.
- Disabled/misconfigured provider tests.
- Production email env validation tests.
- Token redaction tests.
- Existing forgot-password/reset-password service flow tests.
- Authenticated notification list/read endpoint tests.
- Own-user notification authorization tests.
- Empty notification list tests.
- Sensitive notification metadata redaction tests.

Risks:

- Secret leakage.
- Deliverability assumptions before a real transport is implemented.
- Fake notification data or event semantics before workflow contracts are reviewed.

Must not include:

- Fake notification feeds.
- Unconfigured provider success behavior.
- Real credentials.
- Real email sending in tests.
- Frontend notification center.
- Notification event hooks unless each hook is scoped and tested.

### PR #105: Evaluation, Data Quality, and FYP Evidence

Purpose:

- Expand evaluation dataset and data-quality validation evidence.
- Generate reproducible FYP evidence reports without changing production scoring.

Status:

- Implemented by branch `evaluation/data-quality-fyp-evidence`.
- Governed pilot dataset metadata, multiclass evaluation metrics, generated evaluation artifacts, read-only topic data-quality audit, generated data-quality artifacts, and FYP benchmark evidence documentation are implemented.
- The latest evaluation run used the local SBERT service successfully, but final lecturer-reviewed effectiveness evidence remains deferred.
- Final benchmark evidence using lecturer-reviewed labels remains deferred.

Likely files:

- `backend/evaluation/datasets/*`
- `backend/scripts/run-topic-evaluation.js`
- data-quality services/tests
- docs/testing/evaluation docs
- generated JSON/Markdown evidence artifacts

Tests required:

- Evaluation metrics tests.
- Data-quality fixtures/tests.
- Evaluation runner command.
- Data-quality audit command.

Risks:

- Changing production scoring prematurely.
- Overclaiming manually constructed pilot data as expert ground truth.
- Treating fallback-only metrics as semantic SBERT evidence.

Must not include:

- Production threshold/scoring changes without scoped approval.
- Fake evaluation results.
- Fake data-quality findings.
- Raw sensitive topic data in committed reports.
- Prisma migrations.

### PR #106: Similarity Scoring Contract Correction + Regression Evidence

Purpose:

- Correct production scoring behavior after explicit approval.
- Align production scoring with the approved FYP methodology.
- Add regression evidence proving weights, fallback weights, thresholds, tier minimums, tier 2/3 requirements, ranking, and overall-risk behavior.

Status:

- Implemented by branch `fix/similarity-scoring-contract`.
- Shared scoring config, production controller behavior, evaluation runner scoring, generated evidence, and regression tests are aligned to the approved methodology.

Likely files:

- `backend/src/controllers/similarity.controller.js`
- similarity controller/service tests
- evaluation runner/docs only as needed for regression evidence

Tests required:

- Approved normal weights `0.20 / 0.30 / 0.50`.
- Approved fallback weights `0.40 / 0.60`.
- MEDIUM boundary starts at `0.40`; HIGH starts at `0.70`.
- Tier minimum `0.10` behavior if retained in the approved contract.
- Tier 2/3 requirement `combined >= 0.60` and SBERT `>= 0.60`.
- Overall risk uses the approved scoring contract.

Risks:

- Changing production risk behavior without stakeholder approval.
- Breaking compatibility with existing lecturer review expectations.

Must not include:

- Unapproved threshold/scoring changes beyond the approved PR #106 contract.
- Fake evaluation results.
- Deployment/readiness work.

### PR #107: Deployment Readiness + Release Candidate

Purpose:

- Create deployment/runbook/env readiness documentation and checks.
- Add minimal operational readiness reporting.
- Add release-gate automation and focused CI.

Status:

- Implemented by branch `release/deployment-readiness-rc`.
- No tag or GitHub release is created by this PR.

Likely files:

- `backend/src/controllers/readiness.controller.js`
- `backend/src/services/readiness.service.js`
- `backend/src/config/env.js`
- `scripts/release-readiness.js`
- `.github/workflows/ci.yml`
- `docs/deployment/*`
- `docs/release/v0.4.0-rc1.md`
- `docs/testing/release-readiness-report.md`

Tests required:

- Readiness endpoint/service tests.
- Production configuration validation tests.
- Build/test/evaluation/data-quality commands as release gate.

Risks:

- Treating local demo setup as production-ready.
- Treating degraded SBERT fallback as full semantic readiness.
- Letting release tooling hide failed commands or credential requirements.

Must not include:

- Last-minute feature work.
- Similarity scoring changes.
- Tag or release creation.
- Fake deployment evidence.

## 19. Non-Goals

This PR does not:

- Change production similarity scoring beyond the approved PR #106 scoring contract correction.
- Change SBERT fallback availability, API response shape, frontend behavior, import parsing, import normalization, import persistence, or database records.
- Add Prisma migrations.
- Add frontend pages or UI workflows.
- Add admin, lecturer, student, import, notification, or email endpoints.
- Implement lecturer mutations.
- Implement supervisee assignment endpoints.
- Implement exports.
- Implement duplicate-existing semantic governance.
- Implement richer row-level import operator reports beyond existing backend support.
- Implement embedding generation for imported records.
- Implement similarity integration for imported records.
- Implement CSV import.
- Implement migration workflows.
- Implement topic edit/delete workflows.
- Implement audit export, purge, or delete workflows.
- Implement real SMTP/provider transport delivery.
- Add real email credentials, SMTP passwords, API keys, or secrets.
- Send real emails in tests.
- Implement create-user, delete-user, role-change, invitation, password-reset, bulk account, or profile-edit workflows.
- Implement settings writes, threshold sliders, feature toggles, email controls, or arbitrary configuration updates.
- Tune or relabel the manually constructed pilot dataset.
- Claim manually constructed pilot labels are final expert or departmental ground truth.
- Claim fallback-only metrics prove SBERT semantic performance.
- Write raw sensitive topic data to committed evaluation or data-quality reports.
- Add fake evaluation results, fake data-quality findings, fake benchmark claims, fake duplicate-existing results, fake embeddings, fake import rows, fake reports, fake exports, fake activity, fake research insights, or fake analytics.

## 20. Verification

Requested verification commands for PR #107:

```powershell
cd backend
npm test -- --runInBand
npx prisma validate
npx prisma migrate status
npm run evaluate:topics
npm run audit:data-quality
cd ..\sbert-service
.\venv\Scripts\python.exe quick_test.py
$env:PYTHONIOENCODING='utf-8'
.\venv\Scripts\python.exe test_service.py
cd ..\frontend
npm run build
npm test -- --run --maxWorkers=1 --minWorkers=1
cd ..
npm run release:check
git diff --check
git status --short --ignored reference img frontend/smoke-artifacts frontend/dist frontend/playwright-report frontend/test-results backend/node_modules frontend/node_modules sbert-service/venv
git diff --stat
git diff --name-only
```

Expected implementation files:

```text
backend/src/config/env.js
backend/src/config/env.test.js
backend/src/controllers/readiness.controller.js
backend/src/controllers/readiness.controller.test.js
backend/src/services/readiness.service.js
backend/src/services/readiness.service.test.js
backend/src/server.js
scripts/release-readiness.js
package.json
.github/workflows/ci.yml
backend/env.example
README.md
sbert-service/README.md
docs/backend/admin-governance-api-contract-plan.md
docs/deployment/deployment-runbook.md
docs/deployment/environment-matrix.md
docs/deployment/database-migrations-and-rollback.md
docs/deployment/security-readiness-checklist.md
docs/project/full-worktree-gap-benchmark-audit.md
docs/project/fyp-evaluation-benchmark-evidence.md
docs/release/v0.4.0-rc1.md
docs/testing/release-readiness-report.md
```
