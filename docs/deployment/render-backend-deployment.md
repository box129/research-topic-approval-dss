# Render Backend Deployment

## Status

This document prepares Render Free backend deployment for FYP/demo staging. PR #128 records the first safe online Render backend proof and corrects the build command to the one that succeeded on Render.

## Purpose

Run the Express backend as a Render web service connected to Neon PostgreSQL and the Hugging Face SBERT Space.

## Service Settings

Suggested Render settings:

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Root directory | `backend` |
| Runtime | Node |
| Build command | `npm install && npx prisma generate` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

Run migrations intentionally after Neon is configured. Do not use `prisma db push`.

The earlier `npm ci && npx prisma generate` command is not suitable for the current backend lockfile state on Render. Use the working command above unless the lockfile state is later fixed and re-tested.

## Required Environment Variables

Set these in Render dashboard. Do not commit real values.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Render-provided port or `3000` only if Render requires explicit fallback |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | strong generated staging secret, at least 32 random characters |
| `FRONTEND_URL` | Vercel frontend origin |
| `CORS_ORIGIN` | Vercel frontend origin if needed; never `*` |
| `SBERT_SERVICE_URL` | Hugging Face Space URL |
| `EMAIL_PROVIDER` | `disabled` initially |
| `LOG_LEVEL` | `info` |

Optional SMTP variables are intentionally omitted until SMTP smoke is in scope.

## Database Connection

Render backend should point to Neon through:

```text
DATABASE_URL=<neon-postgres-connection-string>
```

Use Neon connection pooling only if Prisma compatibility is verified for the selected connection string. Keep the raw password hidden in Render secrets.

## SBERT Connection

Render backend should point to Hugging Face Spaces through:

```text
SBERT_SERVICE_URL=https://<space-owner>-<space-name>.hf.space
```

Confirm the Space exposes:

```text
GET /health
POST /embed
```

If the Space sleeps or takes time to warm up, Render readiness may be degraded until SBERT responds.

## Migration Step

After `DATABASE_URL` is configured, run:

```bash
cd backend
npx prisma migrate deploy
npx prisma migrate status
```

For Render, run this through an approved shell/job mechanism or locally with the Neon staging `DATABASE_URL` exported only for that command. Do not paste the URL into evidence.

## Verification

```bash
curl -fsS https://<render-backend-origin>/api/v1/health
curl -fsS https://<render-backend-origin>/api/v1/readiness
```

Pass:

- health returns HTTP 200
- readiness is `ready`, or degraded SBERT is documented honestly
- logs do not expose secrets
- `EMAIL_PROVIDER=disabled` is visible as the intentional staging setting, not a failure

Fail:

- production startup accepts weak secrets
- `CORS_ORIGIN=*` is used
- `EMAIL_PROVIDER=mock` is used
- backend cannot reach Neon
- backend cannot reach SBERT while claiming semantic readiness

## Free-Tier Notes

Render Free services may sleep after inactivity, cold start slowly, and have resource limits. Recheck `https://render.com/pricing` before demo day.
