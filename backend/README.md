# Topic Similarity Backend

Node.js/Express backend for the Topic Similarity MVP.

## Requirements

- Node.js 22 is used for the PR #107 release-candidate gate.
- PostgreSQL with the migrations in `prisma/migrations`.
- SBERT service reachable through `SBERT_SERVICE_URL` for full semantic readiness.

## Setup

```powershell
cd backend
npm ci
Copy-Item env.example .env
```

Edit `.env` and set at minimum:

```text
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>?schema=public
SBERT_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

Production-like deployments must also set a strong `JWT_SECRET`, explicit `FRONTEND_URL` or `CORS_ORIGIN`, and `EMAIL_PROVIDER` to `disabled` or `smtp`. `EMAIL_PROVIDER=mock` is rejected in production.

## Migrations

Production-style migration path:

```powershell
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

Use `prisma migrate dev` only for local migration authoring. Do not use `prisma db push` for production-like deployments.

## Run

Development:

```powershell
npm run dev
```

Release-candidate process after migrations:

```powershell
npm start
```

Default port: `3000`.

## Health and Readiness

Liveness:

```text
GET /health
GET /api/v1/health
```

Readiness:

```text
GET /api/v1/readiness
```

Readiness policy:

- `ready` / HTTP `200`: API, database, and SBERT are available.
- `degraded` / HTTP `503`: database is available but SBERT is unavailable; lexical fallback may work, but full semantic readiness is not present.
- `not_ready` / HTTP `503`: database check failed.

## Scripts

```powershell
npm test -- --runInBand
npx prisma validate
npx prisma migrate status
npm run evaluate:topics
npm run audit:data-quality
```

Seed scripts exist for local/demo use only:

```powershell
npm run prisma:seed
npm run prisma:seed:auth-demo
npm run prisma:seed:demo-comparison
```

Demo credentials must never be seeded into production; `seed-auth-demo.js` refuses to run with `NODE_ENV=production`. Production databases obtain their first administrator with the explicit operator command:

```powershell
npm run bootstrap:admin -- --email <admin-email> --name "<admin name>"
```

See `docs/setup/auth-foundation.md` for the full initial-access lifecycle.

## Deployment Docs

Use the repository-level deployment docs for release-candidate operation:

- `docs/deployment/deployment-runbook.md`
- `docs/deployment/environment-matrix.md`
- `docs/deployment/database-migrations-and-rollback.md`
- `docs/deployment/security-readiness-checklist.md`
