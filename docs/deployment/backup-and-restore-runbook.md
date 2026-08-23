# Backup and Restore Runbook

## Status

- Backup/restore **tooling is implemented** (`npm run db:backup`,
  `npm run db:restore`) and covered by automated safety-guard tests.
- A **full synthetic backup → restore → integrity → corpus-rebuild → login
  drill has been executed and passed** (Phase 7, local PostgreSQL 14,
  scratch databases only, synthetic identities only). See "Drill evidence".
- A drill against the real production provider/instance remains
  environment-owned and must be repeated there before go-live.

What must be protected and what can be rebuilt is defined in
[data-recovery-classification.md](./data-recovery-classification.md).

## Backup contract (vendor-neutral)

| Property | Contract |
| --- | --- |
| Scope | The entire application PostgreSQL database (all authoritative tables plus `_prisma_migrations`; embeddings included because they restore for free). |
| Tool/format | `pg_dump --format=custom --no-owner --no-privileges` (compressed, `pg_restore`-compatible, role-portable). |
| Command | `npm run db:backup -- --output-dir <dir>` from `backend/` (add `--print-plan` to preview, `--force` to deliberately overwrite). |
| Source selection | `--database-url` argument, else `BACKUP_DATABASE_URL`, else `DATABASE_URL`. Missing configuration fails loudly. |
| Credentials | Passed to `pg_dump` via `PGPASSWORD` in the child environment only — never in argv, output, logs, or shell-history examples. |
| Naming | `rtadss-backup-<database>-<UTC timestamp>.dump`; existing files are never overwritten without `--force`. |
| Storage | Off-host, access-controlled storage owned by operations. Local disk copies are staging only. Dumps must never enter Git (`backups/` and `*.dump` are gitignored). |
| Encryption | The dump itself is not encrypted; the storage layer must provide encryption at rest and in transit. Anyone with the dump has all departmental data and password hashes. |
| Verification | Non-empty archive check is built into the command; periodic restore drills (below) are the real verification. |
| Automated provider backups | The chosen managed-PostgreSQL provider must additionally offer scheduled automated backups (and ideally point-in-time recovery); the logical dump is the portable/off-provider layer, not a replacement for provider automation. |

## Restore contract

- Command: `npm run db:restore -- --file <archive.dump> --database-url <target-url>`.
- The target must be named **explicitly**; the command never defaults to the
  application's `DATABASE_URL`, so the live database cannot be overwritten by
  omission.
- By default only scratch-looking target names
  (`scratch|restore|rehearsal|drill|test|staging`) are accepted. Any other
  target requires the explicit flag
  `--i-understand-this-overwrites-the-target-database`. There is no casual
  production-overwrite command.
- `pg_restore --clean --if-exists --no-owner --no-privileges` recreates the
  schema and data inside the named target.
- Prisma interaction: the dump carries `_prisma_migrations`, so after restore
  run `npx prisma migrate status` (expect "up to date"). Never run
  `migrate dev` or `db push` against a restored/production database; if the
  running application is newer than the backup, apply pending migrations with
  `npx prisma migrate deploy` only.

## Proposed engineering targets (NOT approved institutional policy)

PROPOSED ENGINEERING TARGET — for departmental review and approval:

| Target | Proposed value | Rationale |
| --- | --- | --- |
| Backup frequency | Provider automated daily backup + logical `db:backup` before every deployment/migration and before/after bulk imports | Bulk onboarding and topic imports are the largest change events. |
| Retention | 14 daily + 8 weekly (~2 months), 12 months for pre-semester baselines | Covers a teaching semester's dispute window without unbounded storage. |
| RPO (acceptable loss) | ≤ 24 h normally; ≤ 5 min if the provider offers point-in-time recovery | Departmental workflow is low-velocity outside deadline bursts; PITR closes deadline-day risk. |
| RTO (time to recover) | ≤ 4 h for full service with operator availability | Restore drill measured minutes for data restore; the bound covers diagnosis + secret coordination + smoke. |
| Drill cadence | Restore drill each semester and after any provider/topology change | Backups that are never restored are assumptions, not backups. |

## Emergency restore runbook

1. **Identify the incident** — capture what failed, when, and the blast
   radius (readiness output, request IDs, error categories from logs).
2. **Stop/disable writes if data corruption is suspected** — scale the
   backend to zero or block traffic at the edge. Do not let users keep
   writing into a corrupted database.
3. **Select the validated backup** — newest archive whose timestamp precedes
   the corruption; record its ID/timestamp in the incident note.
4. **Restore into an isolated database first** — a fresh scratch/staging DB
   via `npm run db:restore`. **DO NOT restore over production blindly.**
5. **Verify integrity before promotion** — `prisma migrate status`; row
   counts vs expectation; relational spot-checks (submission→student,
   decision→lecturer, approved-topic provenance, assignment links, audit
   actors); bcrypt hash prefixes; embedding validity (drill checklist).
6. **Update the application connection only after validation** — point
   `DATABASE_URL` at the validated database (or promote it per provider
   procedure); coordinate secrets per `secrets-management.md`; prefer
   rotating `JWT_SECRET` after incident-driven restores (global sign-out).
7. **Run readiness and smoke** — `/api/v1/readiness` must show database
   available and Voyage verified; login smoke with a known synthetic/admin
   account; one similarity check to confirm corpus rebuild.
8. **Re-enable traffic.**
9. **Record the incident** — timeline, backup used, data-loss window,
   verification evidence (IDs and counts, never credentials), follow-ups.
   Re-issue outstanding invitations per the recovery-classification doc.

## Application rollback vs database rollback

These are different operations and must never be conflated:

- **Application rollback** (redeploy the previous image/commit) is cheap and
  usually safe: the schema contract is additive-only (Phase hygiene), so an
  older application runs against a newer schema in the common case.
- **Database rollback** means restoring an older backup and **destroys every
  write made after that backup**. There are no automatic down-migrations in
  this repository, and none may be added casually.

Decision process: for an application defect → roll back the application
only. For data corruption → restore per the emergency runbook, accepting and
documenting the data-loss window. Never "roll back" a migration by editing
or deleting migration files; recover through backups.
(Also see `database-migrations-and-rollback.md`.)

## Drill evidence (Phase 7, synthetic)

Executed locally with PostgreSQL 14 client tools against scratch databases
(`topic_similarity_ops_drill_source` → dump → `topic_similarity_ops_drill_restored`),
synthetic identities only; 32/32 checks passed, including: baseline counts
reproduced exactly; submission→student/decision and approved-topic provenance
intact; supervisee links intact; every topic kept a valid embedding +
metadata + source hash; bcrypt hashes usable (pre-backup passwords logged in
successfully against the restored DB); audit actor references resolved;
invitation failure state preserved; resident corpus rebuilt with the expected
eligible topics; restart recovery; migration state "up to date"; no
credentials in any tool output. Scratch databases and dump files were
deleted afterwards. Backup archive size for the drill dataset: ~98 KB.

## Evidence to record for every real backup/restore (outside Git)

Backup/restore ID and timestamp, target environment, operator role, `migrate
status` result, readiness result, integrity checklist result, known
limitations. Never record credentials, dumps, or personal data in evidence.
