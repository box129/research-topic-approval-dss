# Docker Compose Deployment Readiness

PR #115 adds a local/staging-style full-stack Docker Compose path. This is repeatable deployment verification, not a public production deployment recipe.

## Services

The root `docker-compose.yml` defines:

| Service | Purpose | Default host port |
| --- | --- | --- |
| `postgres` | PostgreSQL database for Prisma | `5432` |
| `sbert-service` | FastAPI embedding service | `8000` |
| `backend` | Express API | `3000` |
| `backend-migrate` | Explicit Prisma migration maintenance target | None (profile only) |
| `frontend` | Static Vite build served by Nginx | `8080` |

The frontend container proxies `/api/*` to the backend container so the existing relative `/api/v1` frontend API client works without baking an environment-specific API URL into the build.

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2.
- Enough memory for PostgreSQL, Node, Nginx, and the SBERT service.
- No real secrets committed to the repository.

## Environment

For local verification:

```powershell
Copy-Item .env.compose.example .env
```

Then edit `.env` locally. Keep `.env` uncommitted. The checked-in example uses placeholders and local-only defaults.

Important defaults:

- `EMAIL_PROVIDER=disabled` avoids sending real email.
- `JWT_SECRET` and `POSTGRES_PASSWORD` are required; Compose will not supply a predictable fallback for either value.
- `COMPOSE_BIND_HOST=127.0.0.1` keeps the PostgreSQL, SBERT, backend, and frontend ports local to the machine by default.
- `FRONTEND_URL` and `CORS_ORIGIN` default to `http://localhost:8080`.
- `VOYAGE_API_KEY`, `VOYAGE_REQUEST_TIMEOUT_MS`, and `VOYAGE_READINESS_PROBE_CACHE_MS` are passed directly to the backend. A blank key is only suitable for deliberately degraded local verification; semantic similarity and full readiness require a deployment-owned key.
- `SBERT_SERVICE_URL` points to `http://sbert-service:8000` inside Compose.
- PostgreSQL credentials are local placeholders and must be replaced for any shared environment.

## Build And Start

From the repository root:

```powershell
docker compose config
docker compose build
docker compose up -d
```

## Migrations

Compose startup does not run migrations automatically. The serving image is
built from a pruned dependency target; the profile-only `backend-migrate`
target explicitly retains the pinned Prisma CLI and runs migrations without
downloading packages at runtime:

```powershell
docker compose --profile maintenance run --rm backend-migrate
```

The maintenance target has no published port, runs as the non-root `app` user,
and is not started by an ordinary `docker compose up`.

Optional local demo seed commands remain explicit and should not be used with real departmental data unless approved:

```powershell
docker compose run --rm backend node prisma/seed.js
```

Do not use `prisma db push` for deployment verification.

## Health And Smoke

Check service status:

```powershell
docker compose ps
```

Backend liveness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health
```

Backend readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/readiness
```

SBERT health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Frontend:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/
```

Automated non-mutating smoke:

```powershell
npm run docker:smoke
```

The smoke script checks backend liveness, backend readiness, SBERT health, and frontend HTTP response. It does not require SMTP, credentials, raw departmental data, or database mutations.

## Logs And Shutdown

Useful logs:

```powershell
docker compose logs --tail=80 backend
docker compose logs --tail=80 frontend
docker compose logs --tail=80 sbert-service
```

Shutdown:

```powershell
docker compose down
```

Remove local database/model-cache volumes only when you intentionally want to discard local container state:

```powershell
docker compose down -v
```

## Boundaries

This Compose setup does not prove:

- Public HTTPS production deployment.
- Cloud networking, backups, monitoring, or alerting.
- Zero-downtime deploys.
- Provider-level SMTP delivery.
- Departmental data import or real-user smoke.

For public production, keep PostgreSQL and SBERT private, provide real secrets through the deployment environment, enforce HTTPS at the edge, run migrations intentionally, and complete backup/monitoring/incident-response evidence.

Do not set `COMPOSE_BIND_HOST=0.0.0.0` as a shortcut for a public deployment. This Compose file is a local/staging-style verification path, not a replacement for a reviewed private network and HTTPS edge configuration.
