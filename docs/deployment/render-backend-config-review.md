# Render Backend Configuration Review

> **Historical/superseded provider guide.** This records the pre-Phase-6
> Render backend path. It must not be used for the current private backend
> behind same-origin Nginx; see the [production runbook](./deployment-runbook.md)
> and [environment matrix](./environment-matrix.md).

## Status

PR #127 documented the exact Render backend deployment configuration for the free managed staging path. PR #128 corrects the Render build command based on the first successful online Render deployment proof. This document remains configuration guidance; the online evidence is recorded separately in [render-backend-online-proof.md](./render-backend-online-proof.md).

This review is based on:

- `backend/package.json`
- `backend/src/server.js`
- `backend/src/config/env.js`
- `backend/env.example`
- `backend/prisma/schema.prisma`
- [render-backend-deployment.md](./render-backend-deployment.md)
- [huggingface-sbert-online-proof.md](./huggingface-sbert-online-proof.md)

## Render Service Settings

| Render setting | Required value |
| --- | --- |
| Service type | Web Service |
| Runtime/language | Node |
| Repository | Project GitHub repository |
| Branch | Free staging deployment branch approved for Render, normally `main` after PRs merge |
| Root directory | `backend` |
| Build command | `npm install && npx prisma generate` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

Why:

- The first Render deployment showed that `npm ci && npx prisma generate` is not suitable for the current backend lockfile state on Render.
- The working Render build command is `npm install && npx prisma generate`.
- `backend/package.json` defines `main` as `src/server.js`.
- `npm start` runs `node src/server.js`.
- `src/server.js` listens on `0.0.0.0` using `config.port`.
- `PORT` is read from environment and falls back to `3000`.
- `/api/v1/health` is a lightweight liveness endpoint.
- `/api/v1/readiness` checks database and SBERT availability and is stricter than the Render health check.

## Required Render Environment Variables

Set these in the Render dashboard only. Do not commit real values.

| Variable | Required value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production validation and secure cookie behavior. |
| `DATABASE_URL` | `<private Neon PostgreSQL connection string>` | Must be stored only in Render. Never commit or paste into evidence. |
| `JWT_SECRET` | `<strong random secret, at least 32 characters>` | Production rejects weak or placeholder values. |
| `EMAIL_PROVIDER` | `disabled` | Initial staging posture. Do not use `mock` in production-like staging. |
| `SBERT_SERVICE_URL` | `https://seun10v3-research-topic-sbert-staging.hf.space` | Confirmed by PR #126 online SBERT proof. |
| `FRONTEND_URL` | `<Vercel frontend origin after Vercel exists>` | Preferred browser origin for CORS and auth links. |
| `CORS_ORIGIN` | `<same Vercel frontend origin if needed>` | Fallback when `FRONTEND_URL` is unset. Never `*`. |
| `LOG_LEVEL` | `info` | Safe default for staging. |

Optional values:

| Variable | Suggested value | Notes |
| --- | --- | --- |
| `PORT` | leave unset unless Render requires it | Render usually injects a port. The app falls back to `3000`. |
| `CORS_CREDENTIALS` | `true` | Cookie-backed auth requires credentials. Default is true unless set to `false`. |
| `SBERT_TIMEOUT` | `30000` | Config default is 30 seconds. Keep enough time for free-tier SBERT cold starts. |
| `SBERT_RETRY_ATTEMPTS` | `3` | Existing config default. |
| `AUDIT_LOG_RETENTION_DAYS` | `365` | Project default; adjust only with approved governance. |
| `AUDIT_LOG_PURGE_MIN_AGE_DAYS` | `90` | Project default. |
| `AUDIT_LOG_PURGE_MAX_BATCH` | `1000` | Project default. |

Do not set SMTP variables until SMTP smoke is intentionally in scope.

## Production Validation Rules To Preserve

The backend config rejects unsafe production settings:

- missing `DATABASE_URL`
- missing or weak `JWT_SECRET`
- missing effective `FRONTEND_URL`/`CORS_ORIGIN`
- effective CORS origin of `*`
- missing `EMAIL_PROVIDER`
- `EMAIL_PROVIDER=mock`
- invalid SMTP configuration when `EMAIL_PROVIDER=smtp`

`FRONTEND_URL` is preferred over `CORS_ORIGIN` when both are set.

## Neon Database Configuration

The Neon database exists and `DATABASE_URL` was copied privately in PR #123 evidence.

Render must receive:

```text
DATABASE_URL=<private Neon PostgreSQL connection string>
```

Do not commit:

- Neon connection string
- Neon hostname
- Neon username
- Neon password
- database screenshots containing secrets
- migration command output that reveals the URL

## Prisma Migrations

Prisma schema uses:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

PR #128 confirms `npx prisma migrate deploy` applied the seven existing migrations against Neon. A follow-up `npx prisma migrate status` attempt returned `P1001`, so final status connectivity confirmation remains pending.

For future redeploys or status confirmation, run from an approved Render shell/job or a local admin shell with the Neon `DATABASE_URL` exported privately:

```bash
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

Do not run:

```bash
npx prisma db push
```

Record only safe evidence:

- command names
- pass/fail result
- migration status summary
- no connection string

## Health And Readiness Checks

After Render deploys:

```bash
curl -fsS https://<render-backend-origin>/api/v1/health
curl -fsS https://<render-backend-origin>/api/v1/readiness
```

Expected:

- `/api/v1/health` returns HTTP 200 when the API process is running.
- `/api/v1/readiness` returns `ready` only when database and SBERT checks both pass.
- If Neon is unavailable, readiness is `not_ready`.
- If SBERT is unavailable, readiness is `degraded`.

Do not claim full semantic readiness unless `/api/v1/readiness` confirms SBERT is available.

## Free-Tier Limitations

Expect:

- Render cold starts after inactivity.
- slower first request after sleep.
- possible free-tier CPU/RAM limits.
- Render logs with limited retention.
- Hugging Face Space cold starts can make readiness temporarily degraded.
- Neon free-tier limits can affect availability or connection behavior.
- no production uptime guarantee.

These limits are acceptable for FYP/demo staging if documented. They are not departmental production proof.

## Safe Deployment Evidence To Capture

Capture after deployment:

- Render service created: `yes/no`
- branch and commit hash
- root directory: `backend`
- build command used, expected as `npm install && npx prisma generate`
- start command used
- required environment variable names configured, without values
- `/api/v1/health` result
- `/api/v1/readiness` result
- Prisma migration deploy/status result
- logs checked for secret leakage
- free-tier cold-start behavior observed

Do not capture:

- `DATABASE_URL`
- JWT secret
- Render private service tokens
- provider screenshots with secrets
- Neon credentials
- SMTP credentials
- real student records
- raw database dumps

## Pending Work

PR #128 records that the Render backend service was created, built, started, and passed `/api/v1/health`, and that `npx prisma migrate deploy` applied the seven existing migrations against Neon. Still pending:

- follow-up Prisma `migrate status` confirmation after a post-deploy `P1001` connectivity error.
- Render `/api/v1/readiness` proof.
- Vercel frontend deployment.
- Vercel `/api` routing to Render.
- full free managed staging proof.

## Current Boundary

The exact Render backend configuration is reviewed and the build command has been corrected from online deployment evidence. Render health proof exists after PR #128, but full free staging remains pending until readiness, Vercel routing, and final evidence capture are complete.
