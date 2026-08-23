# Production Operations Readiness Pack

## Status

This is a future public-production ownership checklist, not evidence that Phase 6
has completed an operations program. Phase 6 establishes a same-origin,
single-instance deployment contract only; it does not prove public deployment,
SMTP delivery, backup/restore drills, centralized observability, or a real
incident-response rota.

Use this pack as a checklist before a controlled production launch.

## Included Runbooks

| Area | Runbook |
| --- | --- |
| Backup and restore (future phase) | [backup-and-restore-runbook.md](./backup-and-restore-runbook.md) |
| Secrets management | [secrets-management.md](./secrets-management.md) |
| Monitoring and logging (future phase) | [monitoring-and-logging.md](./monitoring-and-logging.md) |
| HTTPS, domain, and TLS | [https-domain-checklist.md](./https-domain-checklist.md) |
| Incident response and rollback (future ownership) | [incident-response-runbook.md](./incident-response-runbook.md) |

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
2. Use a strong deployment-owned `JWT_SECRET` and production-required
   `VOYAGE_API_KEY`.
3. Configure exact HTTPS `FRONTEND_URL`; same-origin deployment normally leaves
   `CORS_ORIGIN` unset, and any supplied value must never be `*`.
4. Use `EMAIL_PROVIDER=smtp`; never use `mock` or `disabled` for a public or
   departmental launch. `disabled` is reserved for deliberately email-disabled
   synthetic/staging environments.
5. Run `npm run smoke:smtp` with deployment-owned credentials and a controlled
   recipient, then verify delivery before public traffic is admitted.
6. Use a managed or operations-owned PostgreSQL instance with private network exposure.
7. Apply Prisma migrations through the explicit `backend-migrate` maintenance
   target; do not use `prisma db push`.
8. Verify same-origin `/api/v1/health` and `/api/v1/readiness`; readiness
   includes safe Voyage availability, not SBERT.
9. Keep PostgreSQL and the backend private behind the HTTPS edge and frontend
   Nginx proxy.
10. Configure HTTPS/TLS and secure cookie behavior.
11. Before a future public-production launch, separately confirm backups are
   scheduled, encrypted where required, and restore-tested.
12. Before that future launch, separately confirm monitoring alerts reach the
   owner.
13. Confirm application rollback steps now; establish backup restore authority
   in the later backup/recovery phase.
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
