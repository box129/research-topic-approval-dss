# Topic Similarity MVP

Topic Similarity MVP is a research-topic approval decision-support system with
role-based student, lecturer, and administrator workflows.

## Current production architecture

The current semantic production contract is Voyage AI (`voyage-4-large`, 1024
dimensions, `structured-context-v1`). The real similarity routes are
authenticated, fail closed when Voyage is unavailable, and do not fall back to
SBERT, lexical scores, or fabricated embeddings.

The authoritative initial deployment topology is:

```text
Browser -> HTTPS edge -> Nginx SPA and /api proxy -> one private Node/Express backend
                                                     -> private PostgreSQL
                                                     -> Voyage HTTPS
                                                     -> SMTP when configured
```

SBERT/FastAPI remains only historical/research material. It is not a required
production component, readiness dependency, or standard Compose service.

## Release boundary

| Mode | Status |
| --- | --- |
| Local development | Supported |
| Synthetic staging / production-like rehearsal | Prepared; runtime proof depends on an available Docker daemon and target services |
| Controlled single-instance deployment | Technically specified; requires target-platform validation |
| Real Public Health production/data admission | Not approved by repository evidence alone |

No real departmental data, accounts, final production database, or real secrets
belong in this repository or this phase. Passing tests or containers starting is
not a public-production go-live claim.

## Local development

1. Start a local PostgreSQL instance and configure `backend/.env` from
   `backend/env.example` with development-safe placeholders.
2. Install backend dependencies and apply existing migrations:

   ```powershell
   cd backend
   npm ci
   .\node_modules\.bin\prisma.cmd validate
   npm run prisma:generate
   npm run prisma:migrate:deploy
   ```

3. Start the backend:

   ```powershell
   npm run dev
   ```

4. Start the frontend in another terminal:

   ```powershell
   cd frontend
   npm ci
   npm run dev -- --host 127.0.0.1
   ```

`VOYAGE_API_KEY` is required for semantic similarity and full readiness. Do not
place a production key in a local `.env` or frontend build. Legacy SBERT may be
used only for explicitly historical research/evaluation work; it is not part of
the current direct similarity flow.

## Health and readiness

Backend liveness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health
```

Backend readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/readiness
```

Liveness means that the HTTP process is alive. Readiness is stricter: it checks
the database and safe Voyage provider state and is the condition for traffic
admission in a deployed environment.

## Authoritative deployment documentation

- [Production deployment runbook](docs/deployment/deployment-runbook.md)
- [Production environment matrix](docs/deployment/environment-matrix.md)
- [Docker Compose deployment guide](docs/deployment/docker-compose.md)
- [Database migration contract](docs/deployment/database-migrations-and-rollback.md)
- [Direct similarity security contract](docs/api/direct-similarity-security-contract.md)

Older Vercel, Render, Neon, Hugging Face, and SBERT documents are retained as
historical staging/research evidence only. Do not use them as a current Voyage
production recipe.

## Important boundaries

- Do not change semantic model, scoring, thresholds, tiers, ranking, topic
  lifecycle, identity semantics, or additional-admin governance in deployment
  work.
- Do not run `prisma migrate dev` or `prisma db push` in staging/production;
  use the explicit `prisma migrate deploy` maintenance/release step.
- Do not automatically seed demo users/topics or bootstrap an administrator.
- Do not commit `.env` files, database URLs, API keys, passwords, generated
  credential manifests, raw data, embeddings, or backup files.
- Do not treat an empty comparison corpus as evidence a topic is original.
- Do not claim real SMTP delivery, Docker runtime proof, backup/restore,
  observability, HTTPS/domain proof, or real-data readiness until separately
  demonstrated.
