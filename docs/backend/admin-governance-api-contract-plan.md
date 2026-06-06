# Admin and Governance API Contract Plan

## 1. Metadata

| Field | Value |
| --- | --- |
| Branch | `backend/admin-audit-reports-governance` |
| Current commit hash | `ca5abf9` |
| Date/time | `2026-06-06 14:30:34 +01:00` |
| Scope | Admin audit-log frontend connection, read-only reports summary API, admin reports frontend connection, tests, smoke, and documentation |
| Change type | Backend, frontend, tests, and documentation |
| Implementation status | PR #100 connects the admin Audit Log page to existing audit-log read endpoints, adds a read-only admin reports summary endpoint, and connects the admin Reports page to real aggregate data. No Prisma migration, report export workflow, audit deletion/export workflow, admin mutation, auth behavior change, similarity behavior change, threshold change, package file change, fake audit row, fake report metric, fake chart, fake export, or fake analytics state is introduced. |

Latest relevant PRs:

| PR | Summary | Relevance |
| --- | --- | --- |
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

## 2. Current Reality From Repository

### Existing Backend Behavior

| Area | Existing behavior | Evidence |
| --- | --- | --- |
| Auth/session | Login, logout, current-user, forgot-password, and reset-password endpoints exist. Auth uses an httpOnly cookie-backed JWT session. | `backend/src/server.js`, `backend/src/controllers/auth.controller.js`, `backend/src/services/auth.service.js` |
| Role protection | `requireAuth` validates the session cookie; `requireRole` enforces client roles such as `student`, `lecturer`, and `admin`. | `backend/src/middleware/auth.middleware.js` |
| Student submissions | Student can create and list submissions through authenticated student endpoints. | `GET /api/v1/submissions`, `POST /api/v1/submissions`, `submission.controller.js`, `submission.service.js` |
| Lecturer review workflow | Lecturer can list pending submissions, open detail, run submission similarity checks, read snapshots, and update status. | `/api/v1/lecturer/submissions...` routes |
| Public similarity checker | Public similarity endpoint exists at legacy and v1 paths. | `POST /api/similarity/check`, `POST /api/v1/check-similarity` |
| Similarity stack | Jaccard, TF-IDF, SBERT service integration/fallback, tiered results, risk classification, and partial success behavior exist. | `similarity.controller.js`, `jaccard.service.js`, `tfidf.service.js`, `sbert.service.js` |
| Topic import | Spreadsheet preview/commit endpoints exist and call import file, normalization, and persistence services. | `/api/import/topics/*`, `/api/v1/import/topics/*`, `topicImport*.service.js` |
| Health | Basic health endpoints exist. | `/health`, `/api/v1/health` |
| Email | Password reset email service is mock-only. | `backend/src/services/email.service.js`, `docs/setup/auth-foundation.md` |

### Existing Frontend Behavior

| Area | Existing behavior | Evidence |
| --- | --- | --- |
| Admin dashboard | Protected visual shell, explicitly not connected to live admin metrics or service health. | `frontend/src/pages/admin/DashboardPage.jsx` |
| Admin topic repository | Protected read-only page connected to lifecycle topic repository endpoints. It shows real rows, safe empty states, and no import/export/edit actions. | `frontend/src/pages/admin/TopicRepositoryPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin user management | Protected page connected to admin user read endpoints. It shows real user rows, safe filters, empty/error states, and a narrow audited status action. It does not expose create, delete, role-change, invitation, or password-reset workflows. | `frontend/src/pages/admin/UserManagementPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin system settings | Protected read-only page connected to existing `SystemSetting` records. It does not expose save controls, threshold sliders, feature toggles, or arbitrary settings writes. | `frontend/src/pages/admin/SystemSettingsPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin audit log | Protected read-only page connected to existing audit-log list/detail endpoints. It shows stored audit events, honest empty/error states, and no export/delete/purge actions. | `frontend/src/pages/admin/AuditLogPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Admin reports | Protected read-only page connected to the admin reports summary endpoint. It shows real aggregates, honest zero-data/error states, and disabled/deferred export messaging. | `frontend/src/pages/admin/ReportsPage.jsx`, `frontend/src/pages/rolePages.jsx` |
| Lecturer decisions | Placeholder page for future decision history. | `frontend/src/pages/lecturer/MyDecisionsPage.jsx` |
| Lecturer supervisees | Placeholder page for future supervisee assignment/progress workflow. | `frontend/src/pages/lecturer/SuperviseesPage.jsx` |
| Lecturer trends | Placeholder page for future analytics. | `frontend/src/pages/lecturer/ResearchTrendsPage.jsx` |

### Existing Prisma Models

The current schema includes:

- `User`
- `AcademicSession`
- `Category`
- `SystemSetting`
- `Submission`
- `SimilarityCheckSnapshot`
- `AuditLog`
- `HistoricalTopic`
- `CurrentSessionTopic`
- `UnderReviewTopic`

Enums include:

- `Role`: `STUDENT`, `LECTURER`, `ADMIN`
- `UserStatus`: `ACTIVE`, `SUSPENDED`
- `SubmissionStatus`: `PENDING_REVIEW`, `AWAITING_REVISION`, `APPROVED`, `REJECTED`

### Missing Backend/Governance Areas

These do not currently exist as implemented APIs/models/services in the inspected repository after PR #100:

- Admin user mutations beyond audited status updates.
- Admin system settings mutations.
- Admin reports export workflow.
- Audit log export, purge, and delete workflows.
- Lecturer decision history endpoint.
- Lecturer supervisee assignment endpoint.
- Lecturer/admin research trends analytics endpoint.
- Production email provider.
- Notification model/service.

Import-specific gap:

- Import preview/commit endpoints are present and admin-protected after PR #96. Frontend import UI, richer duplicate governance, and operational import workflow screens remain deferred.

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
11. Preserve current similarity thresholds and scoring behavior unless a future scoped evaluation-backed PR changes them.
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
- Import governance endpoints should move under admin protection before operational use.

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

Audit logging should be implemented before admin mutations.

### Proposed Prisma Model Fields

Candidate model only; do not implement in this PR:

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
| `AUTH_LOGIN` | Immediate | Existing auth behavior can log successful login once audit service exists. |
| `AUTH_LOGOUT` | Immediate | Existing logout can log session end if actor is known. |
| `SUBMISSION_CREATED` | Immediate | Existing student submission creation is an important workflow event. |
| `SUBMISSION_REVIEWED` | Immediate | Existing lecturer approval/revision/rejection should be audited. |
| `SIMILARITY_CHECK_RUN` | Immediate | Lecturer submission similarity checks and manual checks should distinguish persisted vs advisory checks. |
| `TOPIC_IMPORT_PREVIEWED` | Immediate after import governance | Existing import preview needs admin protection first. |
| `TOPIC_IMPORT_COMMITTED` | Immediate after import governance | Existing import commit must be admin-only and audited. |
| `ADMIN_SETTING_UPDATED` | Future | Only after settings endpoint exists. |
| `USER_STATUS_CHANGED` | Future | Only after user mutation endpoint exists. |
| `REPORT_EXPORTED` | Future | Only after report export generation exists. |

### Security Concerns

- Do not store raw passwords, reset tokens, session tokens, or complete sensitive payloads.
- Redact large import row content unless explicitly needed for data-quality traceability.
- Store enough request context for accountability without turning audit logs into a sensitive-data dump.
- Audit log read endpoints must be admin-only.

### Later Endpoints Needed

- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/audit-logs/:id`

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

### Planned Changes

1. Prefer admin v1 paths for operational use:

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
- Email template references, only after production email provider is planned.

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

### Frontend Integration

Target page:

```text
frontend/src/pages/lecturer/MyDecisionsPage.jsx
```

Do not change the existing decision action endpoint:

```text
PATCH /api/v1/lecturer/submissions/:id/status
```

## 14. Contract Plan: Lecturer Supervisees

Proposed endpoint:

```text
GET /api/v1/lecturer/supervisees
```

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

### Candidate Analytics

- Topic distribution by category.
- Topic distribution by academic session.
- Approval/revision/rejection trends.
- Repeated-topic risk distribution based on stored similarity snapshots.
- Keyword trends only when real keyword data exists.
- Supervisor or reviewer workload only when real assignment/review data exists.

### Rules

- No fake charts.
- Return empty arrays when no data exists.
- Include `generatedAt`.
- Include `dataCoverage` notes.
- Include `sourceTables` in metadata.
- Avoid claiming semantic trends when SBERT data is unavailable.

### Frontend Integration

Targets:

- `frontend/src/pages/admin/PlaceholderPage.jsx` for Reports.
- `frontend/src/pages/lecturer/ResearchTrendsPage.jsx`.

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
| Import governance | Duplicate/data-quality helpers | Admin required for preview/commit | Warning/error row reports | Preview/commit audit events | Future import UI smoke |
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

- Add lecturer decision history.
- Decide supervisee data model or keep supervisees deferred.

Likely files:

- Backend lecturer decision history service/controller/tests.
- Optional schema planning for supervisees.
- Frontend lecturer decisions page if scoped.

Tests required:

- Lecturer-only access.
- Decision filters.
- Empty history.
- Pagination.

Risks:

- Confusing review history with supervision.

Must not include:

- Changing existing decision action endpoint.
- Fake supervisees.

### PR #102: Production Email + Notification Foundation

Purpose:

- Replace mock-only reset email with configured provider.
- Plan or add notification foundation.

Likely files:

- `backend/src/services/email.service.js`
- backend env docs/config
- tests and setup docs

Tests required:

- Provider mock tests.
- Token redaction tests.
- Env validation tests.

Risks:

- Secret leakage.
- Deliverability assumptions.

Must not include:

- Fake notification feeds.
- Unconfigured provider behavior.

### PR #103: Evaluation, Data Quality, and FYP Evidence

Purpose:

- Expand evaluation dataset and data-quality validation evidence.

Likely files:

- `backend/evaluation/datasets/*`
- `backend/scripts/run-topic-evaluation.js`
- data-quality services/tests
- docs/testing/evaluation docs

Tests required:

- Evaluation metrics tests.
- Data-quality fixtures/tests.

Risks:

- Changing production scoring prematurely.

Must not include:

- Production threshold/scoring changes without scoped approval.

### PR #104: Deployment Readiness + Release Candidate

Purpose:

- Create deployment/runbook/env readiness documentation and checks.

Likely files:

- setup/status/deployment docs
- env example docs
- smoke checklist updates

Tests required:

- Build/test/smoke commands as release gate.

Risks:

- Treating local demo setup as production-ready.

Must not include:

- Last-minute feature work.

## 19. Non-Goals

This PR does not:

- Add endpoints other than `GET /api/v1/admin/reports/summary`.
- Add Prisma migrations.
- Connect frontend pages other than Audit Log and Reports.
- Implement admin mutations.
- Implement exports.
- Implement audit export, purge, or delete workflows.
- Implement import UI.
- Change import parser, normalization, persistence, or commit behavior.
- Implement create-user, delete-user, role-change, invitation, password-reset, bulk account, or profile-edit workflows.
- Implement settings writes, threshold sliders, feature toggles, email controls, or arbitrary configuration updates.
- Implement an email provider.
- Add notifications.
- Change similarity behavior.
- Change similarity thresholds.
- Change auth/session behavior.
- Change tests.
- Change existing route behavior.
- Change package files.
- Add fake admin data.
- Add fake users, fake settings, fake last-active values, fake supervisor assignments, fake audit rows, fake reports, fake exports, fake charts, fake activity, or fake analytics.

## 20. Verification

Requested verification commands for PR #100:

```powershell
cd backend
npm test -- --runInBand
cd ..\frontend
npm run build
npm test -- --run tests/AdminAuditLogPage.test.jsx tests/AdminReportsPage.test.jsx tests/AdminUserManagementPage.test.jsx tests/AdminSystemSettingsPage.test.jsx tests/AdminTopicRepositoryPage.test.jsx tests/AdminDashboardPage.test.jsx
npm test -- --run --maxWorkers=1 --minWorkers=1
npm run smoke:figma-ui
cd ..
git diff --check
git status --short
git diff --stat
git diff --name-only
```

Expected implementation files:

```text
backend/src/controllers/adminReports.controller.js
backend/src/controllers/adminReports.controller.test.js
backend/src/services/adminReports.service.js
backend/src/services/adminReports.service.test.js
backend/src/server.js
docs/backend/admin-governance-api-contract-plan.md
frontend/src/api/admin.js
frontend/src/pages/admin/AuditLogPage.jsx
frontend/src/pages/admin/ReportsPage.jsx
frontend/src/pages/rolePages.jsx
frontend/tests/AdminAuditLogPage.test.jsx
frontend/tests/AdminReportsPage.test.jsx
frontend/tests/smoke/figma-ui-flow.spec.js
```
