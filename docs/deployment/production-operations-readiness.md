# Production Operations Readiness Pack

## Status

PR #118 prepares production operations documentation for the Research Topic Approval DSS. It does not prove public production deployment, staging deployment, monitoring coverage, backup drills, SMTP provider delivery, or incident-response readiness.

Use this pack as a checklist before a controlled production launch.

## Included Runbooks

| Area | Runbook |
| --- | --- |
| Backup and restore | [backup-and-restore-runbook.md](./backup-and-restore-runbook.md) |
| Secrets management | [secrets-management.md](./secrets-management.md) |
| Monitoring and logging | [monitoring-and-logging.md](./monitoring-and-logging.md) |
| HTTPS, domain, and TLS | [https-domain-checklist.md](./https-domain-checklist.md) |
| Incident response and rollback | [incident-response-runbook.md](./incident-response-runbook.md) |

Related existing docs:

- [deployment-runbook.md](./deployment-runbook.md)
- [database-migrations-and-rollback.md](./database-migrations-and-rollback.md)
- [docker-compose.md](./docker-compose.md)
- [environment-matrix.md](./environment-matrix.md)
- [security-readiness-checklist.md](./security-readiness-checklist.md)

## Required Ownership Before Public Production

Assign named owners outside the repository for:

- deployment approval
- domain/DNS/TLS
- database hosting
- database backup and restore
- secrets storage
- SMTP provider credentials
- monitoring alerts
- incident response
- data protection/privacy approval
- rollback decision-making

Do not put owner personal phone numbers, passwords, private email accounts, or secrets in this repository.

## Minimum Public Production Gate

Before public production:

1. Confirm `NODE_ENV=production`.
2. Use a strong deployment-owned `JWT_SECRET`.
3. Configure exact `FRONTEND_URL` or `CORS_ORIGIN`; never use `*`.
4. Use `EMAIL_PROVIDER=disabled` or `EMAIL_PROVIDER=smtp`; never use `mock`.
5. If SMTP is enabled, run `npm run smoke:smtp` with deployment-owned credentials and verify recipient delivery.
6. Use a managed or operations-owned PostgreSQL instance with private network exposure.
7. Apply Prisma migrations with `npx prisma migrate deploy`; do not use `prisma db push`.
8. Verify `/api/v1/health` and `/api/v1/readiness`.
9. Confirm SBERT health at `/health` and private network exposure.
10. Configure HTTPS/TLS and secure cookie behavior.
11. Confirm backups are scheduled, encrypted where required, and restore-tested.
12. Confirm monitoring alerts reach the owner.
13. Confirm rollback steps and backup restore authority.
14. Confirm no demo credentials or seed-only accounts are active unless formally approved.
15. Record evidence outside Git without secrets or raw student data.

## Evidence Boundary

Acceptable evidence:

- command names and timestamps
- pass/fail summaries
- redacted configuration checklists
- health/readiness response status without secrets
- backup/restore drill result summary
- SMTP smoke result without passwords or reset tokens

Do not commit:

- `.env` files
- database URLs
- SMTP passwords
- JWT secrets
- raw database dumps
- real student records
- screenshots containing secrets or student data
- incident contact private details

## Current Gaps

This pack does not close:

- public production deployment proof
- live backup/restore drill proof
- monitoring provider configuration proof
- provider-level SMTP delivery proof unless smoke is actually run
- departmental-scale validation evidence
- real lecturer-reviewed similarity labels
