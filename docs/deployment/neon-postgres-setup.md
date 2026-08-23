# Neon PostgreSQL Setup

> **Historical/superseded provider guide.** This is retained as evidence for
> the pre-Phase-6 managed staging path. It is not the authoritative database
> deployment recipe; use the [production runbook](./deployment-runbook.md) and
> [database migration contract](./database-migrations-and-rollback.md).

## Status

This document prepares Neon Free PostgreSQL setup for managed staging. It does not create a Neon project and does not commit a database URL.

## Purpose

Provide a managed PostgreSQL database for the Render backend during FYP/demo staging.

## Setup Steps

1. Create a Neon project for staging/demo only.
2. Select a region close to the Render backend where practical.
3. Create a database for the DSS.
4. Copy the connection string into Render as `DATABASE_URL`.
5. Keep the connection string out of Git, screenshots, docs, and issue comments.
6. Apply Prisma migrations:

```bash
cd backend
npx prisma migrate deploy
npx prisma migrate status
```

Do not use:

```bash
npx prisma db push
```

## Required Values

| Value | Use |
| --- | --- |
| Neon connection string | Render `DATABASE_URL` |
| Database name | evidence notes only, if non-sensitive |
| Region | evidence notes |
| Branch name | evidence notes |

Do not record the username, password, host, or full connection string in committed evidence.

## Seed And Demo Data Boundary

Use only synthetic or approved demo data.

Do not import:

- real student submissions
- raw departmental data
- private lecturer notes
- production database dumps

If demo accounts are needed, record only that demo accounts were prepared. Do not commit passwords.

## Verification

```bash
npx prisma validate
npx prisma migrate status
```

Then through Render:

```bash
curl -fsS https://<render-backend-origin>/api/v1/readiness
```

Pass:

- migrations are applied
- backend readiness reports database available
- no migration drift is reported

Fail:

- migration fails
- database connection is unstable
- database requires manual schema changes
- evidence exposes `DATABASE_URL`

## Free-Tier Notes

Neon Free limits may include compute, storage, project, branch, and inactivity behavior. Recheck `https://neon.tech/pricing` before use. Free staging is not a substitute for departmental production backup and retention policy.
