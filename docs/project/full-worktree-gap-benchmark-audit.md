# Full Worktree Gap and Benchmark Audit

## Purpose

This document preserves the original PR #94 repository audit as historical context and records the current repository status after PRs #96 through #104 plus the in-progress PR #105 evaluation/data-quality evidence work.

The original June 5 audit should not be read as current truth unless a section is explicitly labelled historical.

## Historical Baseline at PR #94

PR #94 was a documentation-only audit created on June 5, 2026 from commit `9b9c2eb` on branch `docs/full-worktree-gap-benchmark-audit`.

At that time, the repository had:

- Auth, student submission, lecturer review, public similarity, topic import, SBERT fallback, and basic health endpoints.
- Protected frontend shells for student, lecturer, and admin routes.
- Honest placeholder/admin secondary pages from PRs #91 through #93.
- No `AuditLog` model/service.
- No admin dashboard summary API.
- No admin topic repository API connection.
- No admin users/settings API.
- No admin audit-log/reports API connection.
- No lecturer decision-history API.
- No lecturer research-trends API.
- No admin import UI.
- Mock-only email behavior.
- No notification foundation.
- No FYP evaluation/data-quality evidence artifacts.

Those gaps were correct for PR #94. They are historical now.

## Current Status After PR #105

Current branch context: `evaluation/data-quality-fyp-evidence`.

Current implemented governance sequence:

| PR | Current status |
| --- | --- |
| #96 AuditLog and import governance | Implemented `AuditLog`, audit service/read endpoints, admin-protected import aliases, and import audit events. |
| #97 Admin dashboard summary | Implemented read-only admin dashboard summary API and connected dashboard page to real counts. |
| #98 Admin topic repository | Implemented read-only admin topic repository APIs and connected Topic Repository page. |
| #99 Admin users/settings | Implemented admin user list/detail, audited user status mutation, settings read endpoint, and frontend connections. |
| #100 Admin audit log/reports | Connected audit-log frontend to read endpoints; added read-only reports summary API and frontend connection. |
| #101 Lecturer decisions | Implemented read-only lecturer decision-history API and frontend connection; supervisees remain deferred. |
| #102 Lecturer research trends | Implemented read-only lecturer research-trends API and frontend connection using aggregate real data. |
| #103 Admin import UI | Connected `/admin/topic-repository` import panel to real admin preview/commit endpoints. |
| #104 Email/notification foundation | Added explicit email provider modes and authenticated own-user notification backend foundation; real SMTP transport and event hooks remain deferred. |
| #105 Evaluation/data-quality evidence | Adds governed pilot evaluation reports, data-quality audit, scoring-contract drift evidence, and generated JSON/Markdown artifacts without production scoring changes. |

## Current Implemented Areas

### Frontend

| Area | Current status |
| --- | --- |
| Auth shell and protected routes | Implemented. |
| Student dashboard, submit topic, my submissions, checker, research explorer | Implemented with honest unsupported/deferred states where needed. |
| Lecturer dashboard, pending reviews, submission detail, manual checker | Implemented. |
| Lecturer My Decisions | Connected to read-only decision-history endpoint. |
| Lecturer Supervisees | Still deferred because no assignment model/business rule exists. |
| Lecturer Research Trends | Connected to read-only aggregate endpoint; no fake charts, keywords, recommendations, or exports. |
| Admin dashboard | Connected to read-only summary API. |
| Admin topic repository | Connected to read-only topic APIs and import preview/commit panel. |
| Admin user management | Connected to user read endpoints and constrained audited status action. |
| Admin system settings | Connected to read-only settings endpoint; writes remain deferred. |
| Admin audit log | Connected to audit-log list/detail endpoints. |
| Admin reports | Connected to read-only reports summary endpoint; exports remain deferred. |

### Backend

| Area | Current status |
| --- | --- |
| Auth/session | Implemented with httpOnly cookie-backed JWT sessions. |
| Role protection | Implemented through `requireAuth` and `requireRole`. |
| Public/student similarity | Implemented with Jaccard, TF-IDF, SBERT service integration, and fallback. |
| Student submissions | Implemented. |
| Lecturer review workflow | Pending/detail/similarity/status update implemented. |
| Lecturer decision history | Implemented as read-only endpoint. |
| Lecturer research trends | Implemented as read-only aggregate endpoint. |
| Lecturer supervisees | Deferred pending explicit assignment model/business rule. |
| Audit logging | `AuditLog` model/service/read endpoints implemented. |
| Admin dashboard | Read-only summary endpoint implemented. |
| Admin users/settings | User read endpoints, audited status mutation, and settings read endpoint implemented. |
| Admin topic repository | Read-only list/detail/summary implemented. |
| Admin reports | Read-only summary implemented; export generation deferred. |
| Admin import governance | Admin-protected preview/commit endpoints and UI connection implemented. |
| Email | Mock/disabled/provider-ready modes implemented; real SMTP transport deferred. |
| Notifications | Backend foundation and own-user endpoints implemented; event hooks/frontend UI deferred. |
| Evaluation/data-quality | PR #105 adds reproducible pilot evaluation and local database data-quality evidence. |

### Prisma Models

Current schema includes:

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

Still absent/deferred:

- explicit lecturer supervisee assignment model
- report/export history model
- richer import duplicate-resolution model

## Current Evaluation Evidence

PR #105 generated the latest pilot evaluation report with local SBERT running:

- Total/valid cases: 16/16
- Dataset support: LOW 4, MEDIUM 5, HIGH 7
- SBERT attempted/success/failed/unavailable/skipped: 16/16/0/0/0
- Full tri-algorithm coverage: 16/16, 100%
- Operational fallback-used cases: 0
- Operational fallback coverage: 0%
- Operational fallback metrics: `NOT_EVALUATED` because support is zero
- Offline fallback-policy evaluation: counterfactual pilot-only evaluation across all 16 cases using current fallback policy without SBERT output
- Final production behavior accuracy: 0.313
- Final production behavior macro F1: 0.224
- Final production behavior weighted F1: 0.215

This is not final FYP effectiveness proof. The dataset is manually constructed, small, not lecturer-reviewed, and not departmental ground truth.

## Current Data-Quality Evidence

PR #105 generated a read-only database-mode data-quality audit:

- Topic records inspected: 9
- Historical/current/under-review: 6/1/2
- Blank titles: 0
- Missing category/session/supervisor/keywords/context fields: 0
- With embeddings: 0
- Without embeddings: 9
- Import warnings: 0
- Normalized duplicate-title candidate groups: 0

This is a local database snapshot only. It does not represent the complete departmental repository, departmental-scale data quality remains NOT YET VERIFIED, and no broad data-quality conclusion should be drawn from nine inspected records.

## Benchmark Status

| Benchmark | Current status | Notes |
| --- | --- | --- |
| Role-based DSS workflow | Reached | Auth, protected routing, student submission, lecturer review, and admin governance surfaces exist. |
| Jaccard similarity evidence | Reached for pilot | Evaluated on all 16 valid pilot cases. |
| TF-IDF similarity evidence | Reached for pilot | Evaluated on all 16 valid pilot cases. |
| SBERT execution/coverage | Reached for pilot | Local SBERT service succeeded on all 16 valid cases. |
| SBERT effectiveness validation | Partially reached | Pilot metrics exist, but labels are not lecturer-reviewed or departmental ground truth. |
| Runtime fallback performance | Not evaluated in SBERT-active run | Operational fallback-used cases were zero; metrics are null/`NOT_EVALUATED`. |
| Offline fallback-policy evaluation | Reached for pilot only | Counterfactual evaluation; not evidence runtime fallback was triggered. |
| Production tri-algorithm behavior | Partially reached | Full coverage exists, but current behavior drifts from approved FYP scoring methodology. |
| Approved FYP scoring contract | Not reached | Requires separate scoring-contract correction PR. |
| Topic data-quality audit | Reached for local snapshot | Departmental-scale quality remains not verified. |
| Admin report exports | Deferred | Summary API/page exist; export generation is not implemented. |
| Lecturer supervisees | Deferred | Requires assignment model/business rule. |
| Production email delivery | Deferred | Provider modes exist; real transport remains unimplemented. |
| Notification event hooks/frontend | Deferred | Backend foundation exists; real workflow hooks/UI remain deferred. |
| Deployment readiness | Deferred | Should follow scoring-contract correction. |

## Scoring-Contract Drift

Approved FYP methodology:

- Jaccard `0.20`
- TF-IDF `0.30`
- SBERT `0.50`
- fallback Jaccard/TF-IDF `0.40 / 0.60`
- MEDIUM begins at `0.40`
- HIGH begins at `0.70`
- tier minimum `0.10`
- Tier 2/3 requires combined `>= 0.60` and SBERT `>= 0.60`

Observed current implementation:

- configured weights `0.30 / 0.30 / 0.40`
- configured fallback `0.50 / 0.50`
- MEDIUM begins at `0.50`
- normal ranking uses unweighted sum
- normal overall risk uses max SBERT
- fallback risk uses max lexical
- tier minimum `0.10` not verified

PR #105 documents and measures this drift. It does not correct production scoring.

## Current Package Commands

Backend evidence commands:

```powershell
cd backend
npm run evaluate:topics
npm run audit:data-quality
```

No alternate legacy spelling is documented as canonical.

Other relevant checks:

```powershell
cd backend
npm test -- --runInBand
npx prisma validate
```

SBERT smoke checks:

```powershell
cd sbert-service
./venv/Scripts/python.exe quick_test.py
./venv/Scripts/python.exe test_service.py
```

## Current Gaps

- Lecturer-reviewed, departmental-ground-truth evaluation dataset.
- Scoring-contract correction and regression evidence.
- Departmental-scale data-quality audit.
- Explicit supervisee assignment model/endpoint.
- Admin reports export generation.
- Audit export/purge/delete workflows.
- Admin settings mutations with key-specific validation.
- Import duplicate-existing governance beyond current batch-level duplicate-title handling.
- Real SMTP/provider transport and production email credentials.
- Notification event hooks and frontend notification center.
- Deployment/runbook/release-candidate verification.

## Next Recommended PR Sequence

| PR | Scope | Rationale |
| --- | --- | --- |
| #106 | Similarity Scoring Contract Correction + Regression Evidence | Correct or formally reconcile scoring drift before deployment readiness. |
| #107 | Deployment Readiness + Release Candidate | Run final build/test/smoke gates after scoring behavior is approved and stable. |

PR #106 must remain separate from PR #105. PR #105 measures and documents drift; PR #106 may change production behavior only after explicit approval.
