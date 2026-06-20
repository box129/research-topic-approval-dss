# Database Migrations and Rollback Runbook

This repository uses PostgreSQL and Prisma migrations. Production-style environments must use `npx prisma migrate deploy`, not `prisma migrate dev` or `prisma db push`.

## Current Migration Sequence

Apply these migrations in order:

1. `20260518120000_init_v1_auth_foundation`
2. `20260519133945_add_student_submissions`
3. `20260522121805_add_similarity_check_snapshots`
4. `20260522202153_add_submission_decision_rationale`
5. `20260605164000_add_audit_logs`
6. `20260619120000_add_notifications`

## Provision a Database

Create a database and least-privilege application user with your PostgreSQL tooling. Example placeholders:

```sql
CREATE DATABASE topic_similarity;
CREATE USER topic_similarity_app WITH PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE topic_similarity TO topic_similarity_app;
```

Adjust schema privileges for your PostgreSQL version and organization policy. Do not paste real passwords into docs, logs, or release evidence.

## Configure the Backend

Set:

```text
DATABASE_URL=postgresql://topic_similarity_app:<password>@<host>:5432/topic_similarity?schema=public
```

For production-like deployments also set a strong `JWT_SECRET`, explicit `FRONTEND_URL` or `CORS_ORIGIN`, and non-mock `EMAIL_PROVIDER`.

## Validate and Apply

From `backend/`:

```powershell
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

Seed only when explicitly intended:

```powershell
node prisma/seed.js
node prisma/seed-auth-demo.js
node prisma/seed-demo-comparison-topics.js
```

Do not seed demo users or demo topics into public production unless the deployment owner has explicitly approved that data.

## Verify Database-Backed Readiness

Start the backend and call:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/readiness
```

The database check must be `available`. If SBERT is down, readiness is `degraded` and HTTP `503`; that means the API can report degraded fallback but is not full semantic readiness.

## Backup Before Risky Changes

Example backup placeholder:

```powershell
pg_dump --format=custom --file=topic_similarity-<date>.dump "postgresql://<user>:<password>@<host>:5432/topic_similarity"
```

Store backups outside the deployment host according to departmental policy. Verify restore before relying on a backup for rollback.

## Restore Placeholder

Example restore into a replacement database:

```powershell
createdb topic_similarity_restore
pg_restore --clean --if-exists --dbname "postgresql://<user>:<password>@<host>:5432/topic_similarity_restore" topic_similarity-<date>.dump
```

Do not run restore commands against production without an approved incident plan.

## Rollback Policy

Prisma migrations are forward migrations. If a deployment fails:

1. Roll back the application version first.
2. If the migrated database is incompatible with the previous app, restore a verified backup or deploy a corrective forward migration.
3. Re-run `npx prisma migrate status`.
4. Re-run `/api/v1/readiness`.
5. Re-run smoke checks before reopening the system.

Do not delete the database as a rollback strategy.
