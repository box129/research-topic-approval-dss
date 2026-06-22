# Audit Retention and Purge Policy

This is a project governance policy for the research-topic approval DSS. It is not official UNIOSUN policy unless the department separately approves it.

## Purpose

Audit logs provide accountability for privileged and workflow-sensitive actions such as imports, user status changes, report exports, supervisee assignment changes, and audit purge operations. They are governance evidence, not a place to store request bodies or secrets.

## Default Retention

- Default retention period: 365 days.
- Default minimum purge age: 90 days.
- Default maximum purge batch: 1000 rows.
- These defaults are configurable through backend environment variables:
  - `AUDIT_LOG_RETENTION_DAYS`
  - `AUDIT_LOG_PURGE_MIN_AGE_DAYS`
  - `AUDIT_LOG_PURGE_MAX_BATCH`

Events may be retained longer when required by departmental review, incident investigation, assessment evidence, or deployment policy.

## Access Rules

- View audit logs: admins only.
- Export audit logs: admins only through `GET /api/v1/admin/reports/export/audit-logs`.
- Preview purge candidates: admins only through `POST /api/v1/admin/audit-logs/purge-preview`.
- Purge eligible logs: admins only through `POST /api/v1/admin/audit-logs/purge`.

## Purge Rules

- Purge must never be silent.
- Purge requires a preview first in the admin UI.
- Purge requires the exact confirmation phrase: `CONFIRM_AUDIT_PURGE`.
- Purge requests must target logs older than the configured minimum age.
- One purge deletes at most the configured maximum batch size.
- The purge response returns counts and cutoff information only.
- Purge actions are themselves audited as `AUDIT_LOGS_PURGED`.
- The purge audit event is created after deletion, so it is not removed by the same purge operation.

## Data Safety

Audit metadata is redacted by the audit service for sensitive key names. Raw passwords, reset tokens, session tokens, SMTP credentials, cookies, JWTs, authorization headers, and raw request bodies must never be stored in audit logs.

Audit CSV exports intentionally omit metadata bodies and include only safe event, actor, target, request id, and timestamp fields. Exported audit evidence should be stored outside the repository in an access-controlled location.

## Deferred Governance

- Formal institutional retention approval remains outside this repository.
- Legal hold / investigation hold workflow is not implemented.
- Archive-before-delete storage is not implemented.
- Scheduled background purge jobs are not implemented.
