# Full Worktree Gap and Benchmark Audit

## 1. Audit Metadata

| Field | Value |
| --- | --- |
| Repository | `box129/research-topic-approval-dss` |
| Local path | `~/Development/topic-similarity-mvp` |
| Branch before starting | `main` |
| Audit branch | `docs/full-worktree-gap-benchmark-audit` |
| Current commit hash | `9b9c2eb` |
| Audit date/time | `2026-06-05 15:43:59 +01:00` |
| Working tree before branch | Clean |
| Scope | Documentation-only audit |

Latest merged PRs visible in `git log --oneline -12`:

| Commit | Summary |
| --- | --- |
| `9b9c2eb` | polish: refine admin secondary placeholder pages (#93) |
| `4d05579` | polish: refine admin dashboard visuals (#92) |
| `533b558` | polish: refine lecturer secondary placeholder pages (#91) |
| `2f5ae62` | polish: refine lecturer similarity checker visuals (#90) |
| `f54963b` | polish: refine lecturer dashboard and pending reviews visuals (#89) |
| `af8c92b` | polish: refine student research explorer visuals (#88) |
| `661b472` | polish: refine student topic checker visuals (#87) |
| `db8feec` | polish: refine student submissions visuals (#86) |
| `5a15e12` | polish: refine student submit topic visuals (#85) |
| `e118578` | polish: refine student dashboard responsive visuals (#84) |
| `e9629d6` | polish: improve role nav scroll affordance (#83) |
| `d229bf2` | docs: add post-prototype visual integration evidence (#82) |

Ignored/generated folders observed with `git status --short --ignored`:

```text
!! backend/node_modules/
!! frontend/dist/
!! frontend/node_modules/
!! frontend/playwright-report/
!! frontend/smoke-artifacts/
!! frontend/test-results/
!! img/
!! reference/
!! sbert-service/venv/
```

These folders are intentionally excluded from the tracked-file audit unless a tracked file already exists inside them.

## 2. Full Tracked Worktree Overview

This overview is derived from `git ls-files` and intentionally excludes ignored/generated folders such as `node_modules`, `frontend/dist`, `frontend/smoke-artifacts`, `img`, and `reference`.

Tracked-file counts by broad group:

| Group | Tracked files |
| --- | ---: |
| `backend` | 92 |
| `frontend` | 98 |
| `docs` | 156 |
| `tests` | 19 |
| `sbert-service` | 13 |
| `config/root` | 9 |

Readable tracked tree summary:

```text
backend/
  package.json, jest config, env examples, setup scripts
  prisma/
    schema.prisma
    migrations/
      auth foundation
      student submissions
      similarity snapshots
      decision rationale
    seed scripts and CSV/demo data
  src/
    config/
    controllers/
      auth, similarity, lecturerSimilarity, submission, topicImport
    middleware/
      auth, error handler
    services/
      auth, email, jaccard, tfidf, sbert, submissions, snapshots,
      topic import, topic import file parsing, import persistence,
      evaluation metrics, context similarity
    utils/
      preprocessing, topic normalization, data-quality fixtures
  tests/
    integration, load, unit algorithm/error-handler tests

frontend/
  package.json, Vite, Playwright, Tailwind/PostCSS, ESLint config
  src/
    App.jsx route map
    api/
      client, similarity, submissions
    auth/
      AuthContext, ProtectedRoute, PublicAuthRoute, roleRoutes
    components/
      ResultsDisplay, TopicForm, shared UI primitives
    layouts/
      authenticated top nav, role layouts, auth layouts
    pages/
      auth, student, lecturer, admin, common placeholders
    index.css, App.css, main.jsx
  tests/
    component/page tests, e2e user flow, Playwright smoke tests

docs/
  api/
  architecture/
  backend/
  decisions/
  defense/
  frontend/
  full-system knowledge pack/
  planning/
  setup/
  status/
  testing/
  workflow/
  archive/

sbert-service/
  FastAPI app, Dockerfile, requirements, service tests, run scripts

root/config/
  AGENTS.md, README.md, .gitignore, GitHub PR template, seed CSV files
```

Tracked generated-like files noted:

- `frontend/coverage/...` is tracked in the current repo. It is not ignored in the tracked-file view, but it is generated coverage output and should not be expanded in future audits unless specifically requested.
- Root and backend seed CSV files are tracked sample/import data.

## 3. Current Implemented Areas

### Frontend

| Area | Current implementation evidence | Status |
| --- | --- | --- |
| Auth shell | `/login`, `/forgot-password`, `/reset-password`; `PublicAuthRoute`; auth split/recovery layouts; tests in `LoginPage.test.jsx` and `PasswordRecoveryPages.test.jsx`. | Implemented |
| Protected routes | `ProtectedRoute`, `AuthContext`, role-aware route groups in `App.jsx`. | Implemented |
| Role navigation/layout | `AppLayout`, `AuthenticatedTopNav`, `navigation.js`, role layouts. Current admin shell uses top navigation, not a Figma left sidebar. | Implemented |
| Student dashboard | `frontend/src/pages/student/DashboardPage.jsx`; visual pass through recent PRs. | Implemented |
| Student submit topic | `SubmitTopicPage.jsx`; uses existing submission API behavior. | Implemented |
| Student my submissions | `MySubmissionsPage.jsx`; shows real student submission states. | Implemented |
| Student checker | `CheckMyTopicPage.jsx`; read-only similarity checker using public similarity endpoint. | Implemented |
| Student research explorer | `ResearchExplorerPage.jsx`; visually implemented with honest unsupported/deferred states where needed. | Implemented/partial depending on backend data availability |
| Lecturer dashboard | `lecturer/DashboardPage.jsx`; visually refined in PR #89, uses real available queue data and honest unavailable dashboard metrics. | Implemented with deferred metrics |
| Lecturer pending reviews | `PendingReviewsPage.jsx`; uses lecturer pending submissions endpoint and preserves open review behavior. | Implemented |
| Lecturer submission detail | `SubmissionDetailPage.jsx`; supports detail, similarity evidence/snapshots, and decision actions. | Implemented |
| Lecturer similarity checker | `CheckSimilarityPage.jsx`; form-first advisory pre-check after PR #90, no decision/snapshot mutation from this page. | Implemented |
| Lecturer secondary pages | `MyDecisionsPage`, `SuperviseesPage`, `ResearchTrendsPage`; refined as honest placeholders in PR #91. | Placeholder/deferred |
| Admin dashboard | `admin/DashboardPage.jsx`; refined in PR #92 as admin console shell without fake metrics. | Implemented shell, no live admin APIs |
| Admin secondary pages | `admin/PlaceholderPage.jsx` and route wrappers in `rolePages.jsx`; refined in PR #93 as honest presentation-only placeholders. | Placeholder/deferred |
| Shared UI primitives | `PageHeader`, `MetricCard`, `StatCard`, `RiskBadge`, `StatusBadge`, `TableShell`, `InfoCallout`, `EmptyStatePanel`, form inputs, buttons. | Implemented |
| Similarity UI | `TopicForm`, `ResultsDisplay`, checker pages. | Implemented |
| Visual evidence | `docs/frontend/post-prototype-visual-integration-evidence.md`, screenshot audit docs, smoke result docs. | Documented |

### Backend

| Area | Current implementation evidence | Status |
| --- | --- | --- |
| Auth endpoints | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, forgot/reset password in `server.js`, `auth.controller.js`, `auth.service.js`. | Implemented |
| Auth cookie/security basics | `httpOnly`, `sameSite: lax`, secure flag controlled by env; documented in `docs/setup/auth-foundation.md`. | Implemented basics |
| Password hashing | `bcryptjs` in `auth.service.js`. | Implemented |
| Password reset token | Reset token hash and expiry stored on user; reset endpoint implemented. | Implemented |
| Production email delivery | `email.service.js` is mock provider only. | Deferred |
| Public similarity endpoint | `POST /api/similarity/check`, `POST /api/v1/check-similarity`. | Implemented |
| Similarity algorithms | Jaccard, TF-IDF, SBERT service integration/fallback, context/evaluation services. | Implemented |
| Similarity tiers/risk | Controller returns tiered results and LOW/MEDIUM/HIGH risk; tests cover success and partial-success behavior. | Implemented |
| Student submissions | `GET/POST /api/v1/submissions`; `Submission` model and service. | Implemented |
| Lecturer pending/detail/decision | `GET /api/v1/lecturer/submissions`, `GET /api/v1/lecturer/submissions/:id`, `PATCH /api/v1/lecturer/submissions/:id/status`. | Implemented |
| Lecturer similarity snapshots | `POST /api/v1/lecturer/submissions/:id/similarity-check`, `GET /api/v1/lecturer/submissions/:id/similarity-snapshots`, `SimilarityCheckSnapshot` model. | Implemented |
| Import preview/commit | `/api/import/topics/preview`, `/api/import/topics/commit`, `/api/v1/import/topics/preview`, `/api/v1/import/topics/commit`; file parser/persistence services. | Implemented but governance hardening remains |
| Health endpoints | `/health`, `/api/v1/health`. | Implemented |
| Admin dashboard/user/reports APIs | No safe live admin dashboard, user management, audit log, report/export, or repository admin endpoints found in `server.js`. | Not implemented |
| Audit logging model/service | No `AuditLog` Prisma model or audit service found. | Not implemented |
| Reports/export generation | No reports/export endpoints found. | Not implemented |
| Lecturer decision history endpoint | No dedicated lecturer decision history endpoint found. | Not implemented |
| Supervisee assignment workflow | No supervisee assignment model/service endpoint found. | Not implemented |

### Prisma/Database

Current schema includes:

- `User`
- `AcademicSession`
- `Category`
- `SystemSetting`
- `Submission`
- `SimilarityCheckSnapshot`
- `HistoricalTopic`
- `CurrentSessionTopic`
- `UnderReviewTopic`

Enums include:

- `Role`: `STUDENT`, `LECTURER`, `ADMIN`
- `UserStatus`: `ACTIVE`, `SUSPENDED`
- `SubmissionStatus`: `PENDING_REVIEW`, `AWAITING_REVISION`, `APPROVED`, `REJECTED`

Missing database structures based on current repo evidence:

- No explicit audit log table.
- No report/export history table.
- No lecturer supervisee assignment table.
- No admin user-management workflow tables beyond existing `User`.
- No notification table.

### Testing

Frontend test scripts from `frontend/package.json`:

- `npm test`
- `npm run build`
- `npm run smoke:figma-ui`
- `npm run smoke:browser`
- `npm run test:coverage`

Frontend test files include page/component tests for:

- Auth
- Password recovery
- Student dashboard, submit topic, my submissions, checker, research explorer
- Lecturer dashboard, pending reviews, submission detail, checker
- Admin dashboard and admin placeholder route assertions
- Results display
- Topic form
- E2E user flow
- Playwright Figma UI smoke flows

Backend test scripts from `backend/package.json`:

- `npm test`
- `npm run test:coverage`
- `npm run evaluation:topics`
- `npm run import:fixture`

Backend tests cover:

- Controllers: auth, similarity, lecturer similarity, submission, topic import
- Services: auth, jaccard, TF-IDF through unit tests, context similarity, evaluation metrics, snapshots, submission, import parsing/persistence/normalization
- Middleware and integration tests

### Documentation

Current docs include:

- Setup/auth docs: `docs/setup/auth-foundation.md`, quick start, backend startup, frontend setup, import workflow, SBERT setup.
- API docs: `docs/api/API.md`, `docs/api/backend-api.md`, `docs/api/errors.md`.
- Architecture docs: `docs/architecture/overview.md`, decision docs under `docs/decisions/`.
- Figma/prototype alignment docs: `docs/frontend/*implementation-plan.md`, `figma-implementation-index.md`, visual evidence reports.
- Testing docs: role smoke checklists, backend/frontend/manual/evaluation guides.
- Full-system knowledge pack: `docs/full-system/04-Full-System-Build-Knowledge-Pack/`.
- Status and release-candidate docs under `docs/status/`.

## 4. Not Done / Deferred Work List

| Area | Item not done | Current evidence | Why deferred | Required future work | Priority |
| --- | --- | --- | --- | --- | --- |
| Admin | Real admin dashboard API | Admin dashboard frontend is shell-only; no admin dashboard endpoint in `server.js`. | Avoided fake live metrics and health claims. | Define read-only dashboard contract; add backend endpoint, tests, frontend connection. | High |
| Admin | Admin user management backend | `/admin/user-management` is `AdminPlaceholderPage`; no user-management admin endpoints. | Privileged mutations need safe RBAC and audit model first. | Plan API contract; add read-only list before mutations; add audit logging. | High |
| Admin | Admin topic repository backend connection | `/admin/topic-repository` placeholder; import endpoints exist but no protected repository browsing/admin API. | Topic repository management needs data-governance rules. | Add read-only repository query endpoint; protect import/admin operations; add duplicate/data-quality reporting. | High |
| Admin | System settings workflow | `SystemSetting` model exists, but `/admin/system-settings` is placeholder and no settings endpoint found. | Settings mutations affect thresholds/config and need validation. | Add settings read endpoint, then scoped update endpoint with audit trail. | Medium |
| Admin | Audit log backend | No audit model/service/endpoint found. | Requires schema and event policy. | Add `AuditLog` model, service, middleware/service hooks, read-only admin endpoint. | High |
| Admin | Reports/exports | `/admin/reports` placeholder; no report/export endpoint. | Metrics would be fake without backend aggregation. | Define reports contract; add read-only reporting endpoint before exports. | Medium |
| Lecturer | Decision history endpoint | Lecturer `MyDecisionsPage` is placeholder; no dedicated history endpoint found. | Current decision flow stores status/rationale but no history list API. | Add lecturer-safe decision history endpoint and tests. | Medium |
| Lecturer | Supervisee assignment workflow | `SuperviseesPage` placeholder; no assignment model/endpoint found. | Requires department/supervisor assignment data model. | Model supervisee/supervisor relationships; add read-only list first. | Medium |
| Lecturer | Research trends analytics endpoint | `ResearchTrendsPage` placeholder/soon; no trends endpoint found. | Analytics require real topic/review data and aggregation rules. | Define analytics scope and read-only endpoint; avoid fake charts. | Low/Medium |
| Notifications | Real notification system | No notification model/service found. | Notification semantics and delivery channels not yet defined. | Add notification model/contract only after workflow events are finalized. | Medium |
| Email | Production email delivery | `email.service.js` provider is `mock`; docs state reset email is mock-only. | Avoided unconfigured SMTP/Resend behavior. | Add provider config, secrets handling, production tests/checklist. | High for production |
| Password reset | Production email delivery for reset links | Reset token flow exists; delivery is mock-only. | Same email provider gap. | Connect production email provider and add operational docs. | High for production |
| Import | Real department records import workflow completion | Import preview/commit exists; docs flag governance/data-quality risks and import endpoint protection concerns. | Import is sensitive and needs admin authorization/data-quality hardening. | Protect import endpoints; add duplicate checks across DB; improve completeness reporting. | High |
| Deployment | Production deployment | No deployment manifest/platform config found beyond SBERT Docker assets and setup docs. | Local MVP focus. | Add production deployment plan, env matrix, service health checks, runbooks. | High for release |
| Security | Role-based hardening/security review | RBAC middleware exists; deeper CSRF/session/import/admin hardening is not documented as complete. | Needs dedicated review. | CSRF/session review, import endpoint protection, audit logging, rate-limit review. | High |
| SBERT | Production reliability | SBERT FastAPI service exists; backend supports fallback; docs note SBERT availability affects results. | Operational reliability and embedding coverage need production setup. | Add service deployment, monitoring, retry/timeout policy review, embedding generation plan. | Medium/High |
| Data quality | Historical topic validation | Roadmap docs list missing metadata, duplicate detection, inconsistent categories, nullable embeddings. | Data quality needs reviewed rules and lecturer validation. | Implement staged data-quality PRs; expand validation and reports. | High |
| Evaluation | Final evaluation dataset/metrics | Pilot dataset with 16 cases exists; docs say not final validation dataset. | Needs lecturer-reviewed dataset and repeatable metrics. | Expand dataset; run/store evaluation reports; report precision/recall/F1. | Medium/High |
| Research docs | Chapter/documentation gaps | Defense/evaluation docs exist but final FYP chapters are not evident as complete tracked deliverables. | Project docs focus implementation/status. | Complete academic chapter write-up and final evaluation narrative. | Medium |

## 5. Benchmark / Status Table

### Core System

| Benchmark | Target | Current status | Evidence from repo | Reached? | Notes |
| --- | --- | --- | --- | --- | --- |
| Role-based login and protected routing | Authenticated users reach only role routes | Login/auth context/protected routes and backend auth endpoints exist | `App.jsx`, `ProtectedRoute.jsx`, `auth.service.js`, auth tests | Reached | Cookie auth uses httpOnly session token. |
| Student topic submission workflow | Student can submit title/category/keywords | Submission page and `POST /api/v1/submissions` exist | `SubmitTopicPage.jsx`, `submission.service.js`, tests | Reached | Lecturer decision remains separate. |
| Student topic checker workflow | Student can run read-only similarity check | Student checker page and public similarity API exist | `CheckMyTopicPage.jsx`, `similarity.controller.js`, tests | Reached | Does not mutate submissions. |
| Lecturer pending review workflow | Lecturer can view pending queue/detail | Pending/detail routes and endpoints exist | `PendingReviewsPage.jsx`, `SubmissionDetailPage.jsx`, submission endpoints/tests | Reached | Queue depends on real submissions. |
| Lecturer similarity checker workflow | Lecturer can run manual advisory check | Form-first checker page exists | `CheckSimilarityPage.jsx`, tests | Reached | No decision write/snapshot save from manual page. |
| Lecturer decision actions | Approve/request revision/reject with rationale | Status patch endpoint and modal/UI tests exist | `SubmissionDetailPage.jsx`, `submission.service.js`, tests | Reached | Similarity remains advisory. |
| Admin dashboard shell | Protected admin dashboard present | Admin dashboard exists visually | `admin/DashboardPage.jsx`, admin tests | Partially reached | No live admin dashboard API. |
| Admin secondary pages | Admin pages present for user/repo/settings/audit/reports | Protected placeholder pages exist | `rolePages.jsx`, `admin/PlaceholderPage.jsx` | Partially reached | Presentation-only, no backend data. |
| No fake unsupported data | Unsupported admin/lecturer surfaces are honest | Placeholder text and visual evidence docs | PR #91/#93 files and docs | Reached | Current repo intentionally avoids fake rows/metrics. |
| Placeholder honesty | Deferred pages label unavailable state | Placeholder pages use "Presentation-only", "not connected yet", "Deferred admin workflow" | `PlaceholderPage.jsx` | Reached | Good boundary language. |

### Similarity Engine

| Benchmark | Target | Current status | Evidence from repo | Reached? | Notes |
| --- | --- | --- | --- | --- | --- |
| Jaccard implemented | Lexical set similarity | Service and tests exist | `jaccard.service.js`, tests | Reached | Used in public similarity. |
| TF-IDF/cosine implemented | Term-weighted lexical similarity | Service exists | `tfidf.service.js`, tests via controller/unit coverage | Reached | Used in public similarity. |
| SBERT integration or fallback | Semantic scorer with graceful fallback | SBERT service wrapper and FastAPI service exist | `sbert.service.js`, `sbert-service/app.py`, partial-success tests | Reached | Production reliability still needs hardening. |
| Weighted tri-algorithm behavior | Jaccard + TF-IDF + SBERT comparison | Controller combines algorithm results; evaluation harness has explicit weights | `similarity.controller.js`, `run-topic-evaluation.js` | Partially reached | Production weighting details should remain verified against business rules. |
| LOW/MEDIUM/HIGH classification | Risk classes returned | Controller and evaluation metrics classify risk | `similarity.controller.js`, `evaluationMetrics.service.js` | Reached | Threshold preservation is covered by tests/docs. |
| Thresholds preserved | Consistent risk thresholds | Controller tests cover risk and degraded behavior | similarity controller tests | Reached | Future scoring changes need scoped PR. |
| Top matches returned | Tiered top matches | Tier formatting functions and result display exist | `similarity.controller.js`, `ResultsDisplay.jsx` | Reached | Tiers cover historical/current/under-review. |
| Fallback when semantic service unavailable | Lexical partial success, no fake SBERT | Tests assert `partial_success` and degraded lexical behavior | similarity controller tests, docs | Reached | Good honesty boundary. |

### Backend/Data

| Benchmark | Target | Current status | Evidence from repo | Reached? | Notes |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL/Prisma schema | Role users, submissions, topics, snapshots | Schema exists with migrations | `backend/prisma/schema.prisma`, migrations | Reached | Admin/audit/report models absent. |
| Seed/demo users | Demo auth users available | Seed scripts exist | `seed-auth-demo.js`, setup docs | Reached | Needs production separation. |
| Topic repository data | Historical/current/under-review topic tables | Models and seed/import files exist | Prisma schema, seed CSVs | Reached | Data quality still needs hardening. |
| Import normalization | Normalize topic import rows | Import services/tests exist | `topicImport*.service.js`, tests | Reached | More validation recommended. |
| Import validation/reporting | Preview/report import issues | Preview/commit controllers and services exist | topic import tests/docs | Partially reached | Cross-DB duplicate checks and governance deferred. |
| Audit logging | Store/admin-view audit events | No audit model/service found | Prisma/server inspection | Not reached | Needed before privileged admin workflows. |
| Reports/export generation | Generate admin reports/exports | No report/export endpoint found | server inspection | Not reached | Avoided fake reports. |
| Decision history | Lecturer history list | Decision fields exist, no dedicated history endpoint | schema/server inspection | Partially reached | Data exists in submissions, route is placeholder. |
| Supervisee assignment | Lecturer supervisee records | No assignment model/endpoint found | schema/server inspection | Not reached | Placeholder only. |

### Testing/Quality

| Benchmark | Target | Current status | Evidence from repo | Reached? | Notes |
| --- | --- | --- | --- | --- | --- |
| Full frontend tests | Component/page/e2e suite | 17 frontend test files tracked | `frontend/tests` | Reached | Last PR #93 ran 180 tests successfully; this audit did not rerun tests. |
| Role page tests | Auth/student/lecturer/admin route tests | Role page tests exist | `frontend/tests/*Page.test.jsx` | Reached | Admin tests cover placeholders. |
| Similarity tests | Backend and frontend similarity behavior | Backend controller/service and frontend result tests exist | backend and frontend tests | Reached | Includes partial-success behavior. |
| Import tests | Import parser/persistence/controller coverage | Import tests exist | `topicImport*.test.js` | Reached | Future hardening needs new tests. |
| Smoke UI tests | Playwright smoke specs | Smoke scripts and specs exist | `frontend/tests/smoke` | Reached | Credentialed paths depend on env. |
| Screenshot evidence | Visual evidence docs/artifacts | Evidence docs exist; artifacts ignored | `docs/frontend/*evidence*.md`, ignored smoke artifacts | Reached | Screenshots are not committed. |
| Build passes | Frontend build should pass | Build script exists | `frontend/package.json` | Unknown from repo | This docs-only audit did not run build. |
| No horizontal overflow evidence | Visual audit should confirm | Evidence docs mention responsive checks | visual evidence docs | Reached for audited PRs | Current audit did not recapture UI. |
| No unexpected mutation evidence | Smoke manifests should confirm | Prior screenshot workflows documented no unexpected mutations | evidence docs/status | Reached for audited PRs | Current audit is docs-only. |

### Security/Production

| Benchmark | Target | Current status | Evidence from repo | Reached? | Notes |
| --- | --- | --- | --- | --- | --- |
| httpOnly cookie auth | Server-set session cookie | Implemented | `auth.service.js`, docs/tests | Reached | `sameSite: lax`, secure via env. |
| Password hashing | Store password hashes only | Implemented with bcrypt | `auth.service.js` | Reached | Demo seed still needs operational care. |
| RBAC enforcement | Role middleware protects role APIs/routes | Implemented | `auth.middleware.js`, `server.js`, frontend routes | Reached | Admin placeholder pages are protected. |
| CSRF/session hardening | Production-grade cross-site/session review | Basic cookie/session setup only | auth docs/code | Partially reached | Needs security review before production. |
| Production email | Real email provider | Mock-only | `email.service.js`, auth docs | Not reached | Required for production reset flow. |
| Deployment readiness | Production deployment and runbooks | Setup docs exist; no complete deployment stack found | docs/setup, SBERT Dockerfile | Partially reached | Needs deployment plan and monitoring. |
| Environment configuration | Env config and examples | Backend env config/example exist | `backend/env.example`, `env.js` | Partially reached | Production secret handling needs review. |
| Error logging/monitoring | Operational monitoring | Winston logger exists | `logger.js`, logging docs | Partially reached | Monitoring integration not evident. |

### Research/FYP Benchmarks

| Benchmark | Target | Current status | Evidence from repo | Reached? | Notes |
| --- | --- | --- | --- | --- | --- |
| DSS objective satisfied | Support topic approval decisions | Student submission, lecturer review, similarity evidence exist | frontend/backend workflows | Partially reached | Admin/reporting and final evaluation remain incomplete. |
| Rule-based logic present | Explicit thresholds/workflows | Status validation, risk tiers, import rules exist | services/controllers/docs | Reached | Future changes need business-rule reconciliation. |
| Tri-algorithm text similarity present | Jaccard, TF-IDF, SBERT | Implemented with fallback | services/controllers/tests | Reached | SBERT reliability still operational concern. |
| Evaluation dataset available | Validation cases tracked | Pilot dataset exists | `backend/evaluation/datasets/pilot-topic-pairs.json` | Partially reached | Pilot only, not final dataset. |
| Precision/recall/F1 evaluation done | Final metrics reported | Evaluation harness calculates metrics | docs/testing/evaluation.md, script | Partially reached | Final stored/reportable evaluation not evident. |
| Public Health Department scope maintained | Topic data and docs stay in scope | Docs and topic examples are Public Health oriented | docs/seed data | Partially reached | Needs final data-quality validation. |
| Avoids topic repetition | Detect similar topics before approval | Similarity checker and lecturer workflow exist | checker/detail pages and APIs | Reached | Depends on topic repository quality. |
| Supports supervisor judgement with evidence | Similarity advisory, lecturer decides | Lecturer detail and decision workflow exist | `SubmissionDetailPage.jsx`, backend status endpoint | Reached | Does not automate approval. |
| Does not replace lecturer decision | Similarity is advisory | Manual checker says no decision write/snapshot saved; decision endpoint separate | lecturer checker/detail tests | Reached | Good DSS boundary. |

## 6. Reached vs Not Reached Summary

### Fully Reached

- Role-based login and protected routing.
- Student topic submission, submission listing, and read-only checker workflows.
- Lecturer pending review, submission detail, similarity evidence, snapshot, and decision-action workflows.
- Jaccard and TF-IDF similarity services.
- SBERT integration path with honest fallback behavior.
- LOW/MEDIUM/HIGH risk classification and tiered result display.
- Prisma schema for users, submissions, topic lifecycle tables, settings, and similarity snapshots.
- Frontend visual integration for auth/student/lecturer/admin shells.
- Honest placeholder language for unsupported admin and lecturer secondary surfaces.

### Partially Reached

- Admin dashboard: visual/protected shell exists, but no live admin dashboard API.
- Admin secondary pages: protected and polished, but presentation-only.
- Topic import: preview/commit exists, but governance, admin protection, cross-DB duplicate checks, and richer data-quality reporting remain.
- Decision history: decision data exists in submissions, but no dedicated lecturer decision-history endpoint.
- Deployment readiness: setup docs and service assets exist, but production deployment/monitoring are not complete from repo evidence.
- Evaluation: pilot harness exists, but final lecturer-reviewed dataset and final precision/recall/F1 reporting remain.

### Not Reached

- Real admin user management backend workflow.
- Real admin audit log model/service/API.
- Real admin reports/export generation.
- Supervisee assignment workflow.
- Production email delivery provider.
- Notification system.

### Deferred Intentionally

- Fake admin metrics, fake user rows, fake topic rows, fake audit entries, fake reports, fake exports, and fake charts.
- Unsupported lecturer decision history, supervisee, and trends data.
- Production scoring changes based on context-aware evaluation.
- Broad admin privileged mutations before audit logging and security hardening.

### Unknown / Needs Verification

- Current build/test status at this exact audit commit was not rerun because this PR is docs-only.
- Final deployed production behavior.
- Production SBERT reliability under real operational load.
- Final FYP evaluation metrics against a lecturer-reviewed dataset.

## 7. Next Recommended PR Sequence

Recommended sequence based only on repository evidence:

| PR | Scope | Rationale |
| --- | --- | --- |
| PR #94 | Documentation audit/evidence | This file. Establish current truth before adding backend/admin features. |
| PR #95 | Backend/admin API contract planning | Define read-only admin dashboard, audit, user, repository, settings, and reports contracts without implementation churn. |
| PR #96 | Real admin dashboard read-only endpoint | Add safe aggregated dashboard data only where backend can support it honestly. No mutations. |
| PR #97 | Audit log model/service foundation | Add Prisma model, service, tests, and limited event capture policy before privileged admin operations. |
| PR #98 | Admin topic repository read-only connection | Connect repository page to real existing topic data with search/filter basics and no import/export mutations. |
| PR #99 | Import governance hardening | Protect import endpoints with admin authorization and add safer preview/data-quality reporting. |
| PR #100 | Admin user management read-only list | Add user list/search/status visibility after audit logging exists; defer role/status mutations. |
| PR #101 | Lecturer decision history endpoint | Convert lecturer decisions placeholder into a real read-only history page. |
| PR #102 | Production email provider integration | Replace mock reset delivery with configured provider and operational docs. |
| PR #103 | Evaluation expansion | Expand pilot dataset, run/store metrics, and document precision/recall/F1 for final research evidence. |

Do not jump directly into multi-surface admin mutations. The next backend work should be read-only, audited, and contract-led.

## 8. Verification

Commands requested for this docs-only PR:

```powershell
git diff --check
git status --short
git diff --stat
git diff --name-only
```

Full frontend/backend tests were intentionally not run for this audit because no application code, tests, routes, APIs, auth behavior, similarity logic, thresholds, Prisma schema, or UI behavior were changed.

Expected changed file:

```text
docs/project/full-worktree-gap-benchmark-audit.md
```
