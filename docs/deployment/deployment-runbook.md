# Deployment Runbook

This runbook prepares a controlled release-candidate deployment or local integrated demonstration. It does not claim public production readiness.

## Supported Target

| Target | Status |
| --- | --- |
| Local native development | SUPPORTED |
| Local integrated demonstration | SUPPORTED |
| Controlled release-candidate deployment | CONDITIONALLY SUPPORTED |
| Local/staging-style Compose deployment | SUPPORTED FOR VERIFICATION |
| Public HTTPS production | NOT VERIFIED |

## Startup Topology

Start services in this order:

1. PostgreSQL
2. SBERT service
3. Backend API
4. Frontend dev server, preview server, or static frontend host

## PostgreSQL

Provision PostgreSQL before starting the backend. The backend requires `DATABASE_URL`.

Health/readiness:

```powershell
cd backend
npx prisma validate
npx prisma migrate status
```

Use the migration runbook for production-style migration commands: [database-migrations-and-rollback.md](./database-migrations-and-rollback.md).

## SBERT Service

Working directory:

```powershell
cd sbert-service
```

Install dependencies:

```powershell
./venv/Scripts/python.exe -m pip install -r requirements.txt
```

Start:

```powershell
./venv/Scripts/python.exe app.py
```

Alternative:

```powershell
./venv/Scripts/python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Port: `8000`

Health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected successful response includes:

```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2"
}
```

Safe embed probe:

```powershell
$body = @{ text = "malaria prevention among children" } | ConvertTo-Json
$result = Invoke-RestMethod -Uri http://127.0.0.1:8000/embed -Method Post -ContentType "application/json" -Body $body
$result.dimension
```

Expected dimension: `384`. Do not print full embeddings into release evidence.

Release-candidate worker guidance: use one SBERT worker unless memory capacity is measured. Each worker can load its own model and increase memory usage.

## Backend API

Working directory:

```powershell
cd backend
```

Install dependencies:

```powershell
npm ci
```

Generate Prisma client:

```powershell
npx prisma generate
```

Development start:

```powershell
npm run dev
```

Release-candidate start after migrations:

```powershell
npm start
```

Port: `3000` by default.

Liveness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health
```

Readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/readiness
```

Readiness policy:

- `200` with `status: "ready"` means API, database, and SBERT are available.
- `503` with `status: "degraded"` means the database is available but SBERT is unavailable. The application may fall back to degraded lexical similarity, but that is not full semantic readiness.
- `503` with `status: "not_ready"` means the database check failed.

Common failures:

| Symptom | Likely cause |
| --- | --- |
| `Missing required environment variables` | `DATABASE_URL`, production CORS origin, `JWT_SECRET`, or `EMAIL_PROVIDER` is not configured. |
| Readiness `database: unavailable` | PostgreSQL is not reachable or migrations are not applied. |
| Readiness `sbert: unavailable` | SBERT service is stopped, warming up, or `SBERT_SERVICE_URL` is wrong. |
| Auth cookie not retained | CORS origin/credentials or HTTPS cookie behavior is misconfigured. |

## Frontend

Working directory:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm ci
```

Development/demo start:

```powershell
npm run dev -- --host 127.0.0.1
```

Build:

```powershell
npm run build
```

Preview built artifact:

```powershell
npm run preview -- --host 127.0.0.1
```

Production artifact directory: `frontend/dist`.

The frontend API client uses relative `/api/v1` requests. For a static host, configure the web server or reverse proxy to route `/api` to the backend. `vite dev` is not a production web server.

## Docker and Compose Status

PR #115 adds a root full-stack Compose setup for local/staging-style verification:

```powershell
docker compose config
docker compose build
docker compose up -d
```

Apply existing Prisma migrations explicitly after the database is healthy:

```powershell
docker compose run --rm backend npx prisma migrate deploy
```

Run the non-mutating Compose smoke check:

```powershell
npm run docker:smoke
```

The Compose topology includes PostgreSQL, backend, frontend, and SBERT service. It is not a public production deployment: HTTPS, real secrets, backups, monitoring, public network policy, and incident ownership remain environment-owned. See [docker-compose.md](./docker-compose.md).

## Release Gate

From repo root:

```powershell
npm run release:check
```

While validating an uncommitted PR:

```powershell
$env:RELEASE_CHECK_ALLOW_DIRTY='1'
npm run release:check
```

To include credentialed frontend smoke, start all services and provide credentials without committing them:

```powershell
$env:RELEASE_CHECK_ALLOW_DIRTY='1'
$env:RELEASE_CHECK_SMOKE='1'
$env:SMOKE_STUDENT_EMAIL='...'
$env:SMOKE_STUDENT_PASSWORD='...'
$env:SMOKE_LECTURER_EMAIL='...'
$env:SMOKE_LECTURER_PASSWORD='...'
$env:SMOKE_ADMIN_EMAIL='...'
$env:SMOKE_ADMIN_PASSWORD='...'
npm run release:check
```

The script never commits, tags, pushes, deploys, or creates a release.

## Rollback

If deployment fails:

1. Stop or remove the new application process.
2. Restore the previous application version.
3. Repoint the reverse proxy or process manager to the previous version.
4. If migrations were applied and data compatibility is broken, restore a verified database backup or apply a corrective migration.
5. Re-run backend readiness and smoke checks before reopening access.

Prisma migrations are forward migrations. Do not delete production databases as a rollback strategy.
