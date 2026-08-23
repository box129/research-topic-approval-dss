# Backup and Restore Runbook

## Status

This runbook defines the required backup/restore process. It does not prove that a live production backup or restore drill has been completed.

## Scope

Back up and restore:

- PostgreSQL application database
- deployment configuration inventory, excluding secrets
- migration state
- operational evidence required by the deployment owner

Do not store raw database dumps in Git.

## Ownership

Before production, assign:

| Responsibility | Required owner |
| --- | --- |
| Backup schedule approval | Department or operations owner |
| Backup storage | Operations owner |
| Restore execution | Database/operator owner |
| Restore approval during incident | Product or department owner |
| Evidence retention | Governance owner |

## Backup Policy Checklist

- Backup frequency is approved.
- Retention period is approved.
- Storage location is outside the application host.
- Access is limited to approved operators.
- Encryption requirements are documented.
- Restore drill schedule is documented.
- Backups exclude unapproved exports or local generated artifacts.
- Backup evidence does not include raw student data.

## Manual Backup Example

Use placeholders only:

```powershell
pg_dump --format=custom --file=topic_similarity-<yyyy-mm-dd>.dump "postgresql://<user>:<password>@<host>:5432/<database>"
```

For plain SQL exports, use only if approved by the database owner:

```powershell
pg_dump --format=plain --file=topic_similarity-<yyyy-mm-dd>.sql "postgresql://<user>:<password>@<host>:5432/<database>"
```

Do not paste real connection strings into tickets, docs, release notes, shell history excerpts, or screenshots.

## Restore Drill Example

Restore into a replacement or temporary validation database:

```powershell
createdb topic_similarity_restore
pg_restore --clean --if-exists --dbname "postgresql://<user>:<password>@<host>:5432/topic_similarity_restore" topic_similarity-<yyyy-mm-dd>.dump
```

Then verify:

```powershell
cd backend
.\node_modules\.bin\prisma.cmd validate
.\node_modules\.bin\prisma.cmd migrate status
```

Start the backend against the restored database only in a controlled environment and call:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/readiness
```

## Restore Decision Rules

Do not restore over production unless:

- incident owner approves
- latest usable backup is identified
- expected data loss window is known
- affected users/stakeholders are informed according to policy
- current production database is preserved or snapshotted if required
- rollback/redeployment order is agreed

## Evidence To Record

Record outside Git:

- backup id or storage reference
- backup timestamp
- restore drill timestamp
- restore target environment
- result: passed/failed
- operator role, not personal secret data
- migration status result
- readiness result
- known limitations

## Open Production Gap

Until a real backup is created and restored successfully in the target environment, backup/restore readiness remains documented but not proven.
