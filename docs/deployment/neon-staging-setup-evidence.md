# Neon Staging Setup Evidence

> **Historical/superseded provider evidence.** This is retained for the
> pre-Phase-6 managed staging record only. Use the
> [production runbook](./deployment-runbook.md) and
> [database migration contract](./database-migrations-and-rollback.md) for the
> current topology.

## Status

PR #123 records safe evidence that the Neon PostgreSQL staging database has been created for the free managed staging path. It does not record secrets and does not prove the full free staging deployment.

This evidence is intentionally partial. It covers Neon project/database setup only.

## Evidence Summary

| Check | Status | Evidence boundary |
| --- | --- | --- |
| Neon project created | Completed manually | No private project URL or screenshot committed. |
| PostgreSQL database created | Completed manually | No hostname, username, password, or connection string committed. |
| Connection string copied privately | Completed manually | `DATABASE_URL` is stored outside Git and not reproduced here. |
| `DATABASE_URL` committed | Not committed | Repository evidence contains no Neon connection string. |
| Provider tokens/passwords committed | Not committed | No Neon tokens, passwords, usernames, or credentials are included. |
| Student records committed | Not committed | No real student records or database dumps are included. |

## Connection String Handling

The Neon connection string was copied privately for later deployment use.

It must be added only as a private Render environment variable:

```text
DATABASE_URL=<private Neon connection string>
```

Do not paste the real value into:

- Git
- Markdown docs
- issue comments
- screenshots
- logs intended for commit
- chat transcripts
- frontend environment variables

## Pending Work

The following are not yet confirmed by this evidence note:

- Prisma migrations against Neon.
- Backend deployment to Render.
- Render `DATABASE_URL` environment variable configuration.
- Render backend health/readiness against Neon.
- Hugging Face Spaces SBERT deployment.
- Render `SBERT_SERVICE_URL` configuration.
- Vercel frontend deployment.
- Vercel `/api` routing to Render.
- SMTP smoke. Email remains planned as `EMAIL_PROVIDER=disabled` initially.

## Migration Boundary

Prisma migrations are not claimed as complete in this PR.

Only mark migrations complete after running:

```bash
cd backend
npx prisma migrate deploy
npx prisma migrate status
```

against the Neon staging database without exposing `DATABASE_URL`.

Do not use:

```bash
npx prisma db push
```

## Security And Privacy Confirmation

This PR does not include:

- real `DATABASE_URL`
- Neon hostnames
- Neon usernames
- Neon passwords
- provider tokens
- private service URLs
- screenshots containing secrets
- SMTP credentials
- real student data
- raw database dumps

## Current Boundary

Neon database setup is prepared for the free managed staging path, but the full staging deployment remains pending until migrations, Render, Hugging Face Spaces, Vercel, and evidence capture are completed.
