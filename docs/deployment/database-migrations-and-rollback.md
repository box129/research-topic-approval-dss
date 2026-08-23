# Database Migration and Rollback Contract

> **Current Phase 6 contract.** This document applies to the Voyage-backed,
> single-instance deployment. It replaces older SBERT/readiness references in
> deployment material.

## Database boundary

Use one dedicated PostgreSQL database per environment:

```text
staging database != defence database != future production database
```

Use synthetic data only in staging during this phase. PostgreSQL is private to
the deployment network, persistent, and reached through a deployment-owned
`DATABASE_URL`. Use provider-approved TLS/SSL settings and a least-privilege
runtime user. A direct connection is sufficient for the initial one-backend
instance; introduce a pooler only after confirming Prisma and migration
compatibility.

Repository migrations, not operator hand-edits, own the schema's integrity and
lookup contracts. Representative constraints include unique user identities,
topic source fingerprints, and submission-to-lifecycle-topic links; indexes
support role/status, lifecycle/session/time, import-batch, and audit/query
lookups. Review the pinned migration SQL, `prisma validate`, and `migrate
status` before every release rather than recreating constraints with `db push`.

The initial topology intentionally has one Node/Prisma process. Connection-pool
and database connection limits are provider-owned: size and verify them in the
target staging environment before traffic admission, then allow Prisma
reconnect/readiness recovery after a restart. No connection-capacity figure is
claimed until that target-environment check is recorded.

## Release migration sequence

Migrations are an explicit, one-off release job before a new serving version
receives traffic. They use the repository-pinned Prisma CLI and must exit
non-zero on failure.

For the Compose deployment:

```powershell
docker compose --profile maintenance run --rm backend-migrate
```

The job runs `prisma migrate deploy`. It does not seed users/topics, bootstrap
an administrator, or start the serving application.

For an approved non-Compose release environment, run the pinned repository CLI
only after installing the reviewed release dependencies. These PowerShell
commands use the checked-out local binary and never ask `npx` to download a
package:

```powershell
cd backend
.\node_modules\.bin\prisma.cmd validate
npm run prisma:migrate:deploy
.\node_modules\.bin\prisma.cmd migrate status
```

`npm run prisma:migrate:deploy` resolves the repository-pinned Prisma script.
Do not rely on a runtime download of an arbitrary latest package. The container
serving image uses the dedicated maintenance target instead of the pruned
runtime image.

## Fresh database path

1. Provision the isolated PostgreSQL database and approved credentials.
2. Store `DATABASE_URL` only in the target secret store.
3. Run the explicit migration job.
4. Start the backend with production configuration, including `VOYAGE_API_KEY`.
5. Require `/api/v1/health` and then `/api/v1/readiness` to succeed before
   traffic is admitted.
6. Create the first administrator only through the explicit one-off operator
   bootstrap path; do not seed demo accounts:

   ```powershell
   docker compose --profile maintenance run --rm backend-bootstrap --email <admin-email> --name "<administrator name>"
   ```

   This profile-only target runs `node scripts/bootstrap-admin.js`; it does not
   run during migrations or normal service startup.

## Existing database upgrade path

1. Identify the target database and current migration state.
2. Obtain approved backup/restore authority before a risky release. This phase
   does not perform the backup/restore drill.
3. Run `migrate deploy` once before traffic shifts.
4. If migration fails, stop the release and investigate; do not hand-edit the
   schema or retry against a different database without approval.
5. Start the compatible application version and verify readiness.

## Explicit prohibitions

Never use either of these as a deployment workflow:

```text
prisma migrate dev
prisma db push
```

Never automatically seed demo users/topics, automatically bootstrap an
administrator, use the defence database, or run a destructive rollback command.

## Rollback limitation

Prisma migrations are forward-only. If a release fails:

1. Drain and roll back the application image/version first.
2. Prefer a corrective forward migration if the schema must change.
3. Restore a database only with explicit owner approval and a verified backup.
4. Re-run migration status and backend readiness before reopening traffic.

Do not delete, reset, or overwrite a database as a generic rollback action.

## Readiness interpretation

Database availability is necessary but not sufficient. Full readiness also
requires safe Voyage provider availability. SBERT status is not part of the
current production migration or readiness contract. A missing/blank
`VOYAGE_API_KEY` is production startup-fatal; a Voyage provider failure after
startup must prevent readiness/traffic admission rather than cause a semantic
fallback.
