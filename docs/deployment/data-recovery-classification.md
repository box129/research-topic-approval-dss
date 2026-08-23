# Data Classification and Recovery Model

Phase 7 inventory of persistent and regenerable state, verified against the
current Prisma schema (`backend/prisma/schema.prisma`) and services. This is
the authority for what a backup must protect and what recovery can rebuild.

## Irreplaceable / authoritative (must be in every backup)

All of this lives only in PostgreSQL. Losing it without a backup is
unrecoverable data loss.

| Data | Table(s) | Notes |
| --- | --- | --- |
| User accounts and identities | `users` | Names, canonical emails, roles, statuses, unique matric numbers, bcrypt password hashes, `credential_version`, forced-change state. |
| Invitation/reset lifecycle state | `users` (invitation/reset columns) | Hashes and timestamps only. See "not relied on after DR" below. |
| Student submissions | `submissions` | Titles, keywords, category, status, timestamps. |
| Lecturer decisions and rationales | `submissions` (`status`, `decision_reason`, `decided_by_id`, `decided_at`) | The governance record of who approved/rejected what and why. |
| Imported departmental topic records | `historical_topics`, `current_session_topics`, `under_review_topics` (source fields) | Title/context/session/supervisor plus `raw_record`, `source_fingerprint`, import batch provenance. The **source text columns are authoritative**; embeddings are derived from them. |
| Approved/under-review topic provenance | `current_session_topics.submission_id`, `under_review_topics.submission_id` | Links corpus records back to the submissions that created them. |
| Supervisee relationships | `lecturer_supervisee_assignments` | Including ended-assignment history. |
| Audit history | `audit_logs` | Governance record under the retention policy; not reconstructible. |
| Administrative state | `system_settings`, `categories`, `academic_sessions`, `notifications` | Operational configuration and user-visible notification history. |
| Similarity check snapshots | `similarity_check_snapshots` | Recorded evidence of past checks. |
| Migration state | `_prisma_migrations` | Restored with the dump; lets `prisma migrate status` verify schema lineage. |

## Regenerable / derived (nice to restore, safe to rebuild)

| Data | Rebuilt from | How |
| --- | --- | --- |
| Voyage embeddings (`embedding*` columns on the three topic tables) | The topic source columns in the same row | `npm run backfill:voyage-embeddings` re-embeds rows whose stored embedding is missing/stale, using the frozen `voyage-4-large` / `structured-context-v1` contract. **Caveat: an embedding is only regenerable while its source row survives.** A lost row loses both, which is why embeddings are still included in backups (they restore for free and avoid paid re-embedding). |
| `embedding_source_hash` | Deterministic function of the row's source fields | Recomputed by the same backfill path. |
| Resident in-memory corpus | PostgreSQL topic tables | Rebuilds automatically on first semantic use after startup (proven by test and by the Phase-7 drill). No persistence exists or is needed. |
| Frontend assets | Git + `npm run build` | Never backed up. |
| Temporary import files (`backend/tmp/imports`) | Nothing — transient | Deleted after each request; never backed up. |
| Local log files (`backend/logs`) | Nothing — secondary copies | The durable log record is the platform's stdout capture, not these files. |

## Recovery-dependency map

```
PostgreSQL dump (pg_dump custom archive)
  └─ restores → users / submissions / decisions / topics(+embeddings) /
                assignments / audit / settings / _prisma_migrations
        ├─ login + sessions      ← users.password_hash + JWT_SECRET (env secret, NOT in DB backup)
        ├─ resident corpus       ← rebuilt in memory from topic tables at first use
        ├─ similarity checking   ← corpus + VOYAGE_API_KEY (env secret) + Voyage reachability
        ├─ email delivery        ← SMTP_* env secrets (NOT in DB backup)
        └─ embeddings (if lost)  ← backfill script + topic source columns + Voyage
```

Two consequences operators must internalize:

1. **A database backup alone is not a full recovery.** Environment secrets
   (`JWT_SECRET`, `VOYAGE_API_KEY`, `SMTP_PASSWORD`, `DATABASE_URL`) live in
   the platform secret store and must be recoverable independently (see
   `secrets-management.md`). Restoring the DB with a *different* `JWT_SECRET`
   keeps all data and passwords but signs everyone out — acceptable in
   disaster recovery.
2. **Voyage availability gates semantic recovery, not data recovery.** If
   Voyage is down during a restore, the application serves auth/workflow
   traffic and reports semantic readiness as unavailable; it never fabricates
   similarity results (frozen no-fallback contract).

## Embedding / corpus recovery behavior (verified)

- **A. PostgreSQL survives** — stored embeddings pass
  `validStoredEmbedding` and are reused as-is; no Voyage calls are needed.
  Verified in the Phase-7 restore drill (all restored topics kept valid
  embeddings + metadata + source hash).
- **B. Embeddings missing/corrupt, source rows survive** —
  `npm run backfill:voyage-embeddings` regenerates them under the frozen
  contract. Stale hashes are excluded from the searchable corpus until
  repaired (verified by resident-corpus tests).
- **C. Voyage unavailable during recovery** — readiness reports the provider
  `unavailable` (probe-based, cached); similarity requests fail honestly with
  a semantic-unavailable error. No fallback vector exists.
- **D. Resident memory lost (restart/crash)** — the corpus rebuilds from
  PostgreSQL on the next semantic request; the drill proved a restored DB
  rebuilds the exact eligible corpus.

## State deliberately NOT relied on after disaster recovery

- **Pending invitation/reset tokens**: hashes restore with the dump, but any
  emailed link may be older than the backup or exposed by the incident.
  Operational rule: after a real restore, treat outstanding invitation/reset
  links as suspect — re-issue invitations (resend invalidates the old link)
  and let users request fresh password resets. Never extend or revive expired
  tokens.
- **Sessions**: JWT sessions reference `credential_version`; a restore that
  rewinds it can revive sessions issued before the backup only if the same
  `JWT_SECRET` is kept. After incident-driven restores, rotating
  `JWT_SECRET` (deliberate global sign-out) is the safe default.
- **Notifications**: restored notifications may reference pre-incident
  events; they are informational and need no reconciliation.
- **In-flight import temp files**: gone by design; re-run the import from the
  original spreadsheet.
