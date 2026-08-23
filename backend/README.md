# Topic Similarity Backend

Node/Express and Prisma backend for the current Voyage-backed Topic Similarity
MVP.

## Runtime contract

The current protected similarity paths use Voyage `voyage-4-large` with a
1024-dimensional `structured-context-v1` representation. They are not backed by
the historical SBERT microservice and have no lexical/fabricated-vector
fallback. A production backend therefore requires PostgreSQL and outbound HTTPS
to Voyage, but does not require FastAPI, Hugging Face model downloads, or an
SBERT model cache.

The standard deployment keeps this backend private behind the same-origin
frontend Nginx `/api` proxy. See the repository-level
[production runbook](../docs/deployment/deployment-runbook.md) and
[environment matrix](../docs/deployment/environment-matrix.md).

## Requirements

- The reviewed backend production Docker image uses Node 20. Use that image or
  a verified compatible Node 20+ runtime; do not substitute an untested
  platform version.
- PostgreSQL with repository migrations applied through the explicit release
  step.
- `VOYAGE_API_KEY` for production semantic operation. A missing/blank key is
  startup-fatal in production.
- A strong `JWT_SECRET`, exact HTTPS `FRONTEND_URL`, accurate `TRUST_PROXY`,
  and `EMAIL_PROVIDER` configuration for production.

## Development setup

```powershell
cd backend
npm ci
Copy-Item env.example .env
.\node_modules\.bin\prisma.cmd validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Use development-only database credentials in `.env`; never commit that file or
a real Voyage/API key. `env.example` documents development and security
configuration, while the deployment environment matrix is authoritative for
production.

## Migrations

Production-like migration path:

```powershell
.\node_modules\.bin\prisma.cmd validate
npm run prisma:generate
npm run prisma:migrate:deploy
.\node_modules\.bin\prisma.cmd migrate status
```

In the container deployment, run the repository-pinned Prisma CLI through the
profile-only `backend-migrate` maintenance target before the serving version
receives traffic. Never use `prisma migrate dev` or `prisma db push` for
deployment, and never seed demo data as part of startup.

## Health and readiness

| Endpoint | Meaning |
| --- | --- |
| `GET /health`, `GET /api/v1/health` | Liveness only: the HTTP process is running. |
| `GET /api/v1/readiness` | Readiness: PostgreSQL and safe Voyage provider state are usable for real traffic. |

Only HTTP 200 / `ready` from readiness admits traffic. Provider states are
reported safely without API keys or raw provider errors. A readiness failure
does not authorise a semantic fallback.

## Shutdown and operator actions

The production server handles `SIGTERM` and `SIGINT` by draining normal
in-flight work, then closing the HTTP server and Prisma connection within its
bounded grace period. The deployment platform’s termination allowance must be
longer than the backend’s 300-second drain, for example **330 seconds or more**.

The first administrator is never seeded or created on startup. After migrations
and backend readiness, the reviewed Compose maintenance command is:

```powershell
docker compose --profile maintenance run --rm backend-bootstrap --email <admin-email> --name "<administrator name>"
```

It runs only when an operator invokes the `maintenance` profile; it never seeds
topics/users or runs as part of normal startup. Transfer its one-time credential
securely. See the repository-level runbook for required target configuration.

## Useful checks

```powershell
npm test -- --runInBand
.\node_modules\.bin\prisma.cmd validate
.\node_modules\.bin\prisma.cmd migrate status
```

Seed and evaluation scripts are local/demo/research tools. Do not run them
against staging or production data without a separately approved procedure.
