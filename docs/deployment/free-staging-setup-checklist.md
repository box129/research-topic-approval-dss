# Free Staging Setup Checklist

## Status

PR #122 adds a practical execution checklist for the free managed staging path. It does not complete deployment, prove provider availability, add real service URLs, or change application behavior.

Selected FYP/demo stack:

| Component | Provider |
| --- | --- |
| Database | Neon PostgreSQL |
| SBERT service | Hugging Face Spaces |
| Backend | Render Free |
| Frontend | Vercel |
| Email | `EMAIL_PROVIDER=disabled` initially |

Use this checklist with:

- [free-managed-staging-deployment-prep.md](./free-managed-staging-deployment-prep.md)
- [neon-postgres-setup.md](./neon-postgres-setup.md)
- [huggingface-sbert-space.md](./huggingface-sbert-space.md)
- [render-backend-deployment.md](./render-backend-deployment.md)
- [vercel-frontend-deployment.md](./vercel-frontend-deployment.md)
- [free-staging-evidence-log-template.md](./free-staging-evidence-log-template.md)

## Safety Rules

Do not commit or paste into evidence:

- real service URLs if policy treats them as private
- `DATABASE_URL`
- PostgreSQL passwords
- JWT secrets
- provider API tokens
- SMTP credentials
- reset links or tokens
- real student records
- raw database dumps

Do not use fake deployment proof. If a step is not completed, mark it `NOT RUN` or `FAILED` with the reason.

## Correct Setup Order

### 1. Create Neon PostgreSQL

Checklist:

- Create a Neon project for staging/demo.
- Create or select the staging database.
- Choose a region close to Render where possible.
- Copy the connection string into a private operator note only.
- Do not paste the connection string into Git, docs, screenshots, or issue comments.

Record safe evidence:

- provider: `Neon`
- database created: `yes/no`
- region label, if allowed
- connection string stored outside Git: `yes/no`

Output needed for next step:

```text
DATABASE_URL=<private Neon connection string>
```

### 2. Create Hugging Face Spaces SBERT Service

Checklist:

- Create the Hugging Face Space for `sbert-service`.
- Use the existing SBERT FastAPI app packaging approach approved for the Space.
- Wait for the model to start.
- Verify health:

```bash
curl -fsS https://<huggingface-space-origin>/health
```

- Optionally verify a safe short embed request without storing the full embedding:

```bash
curl -fsS https://<huggingface-space-origin>/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"malaria prevention among children"}'
```

Record safe evidence:

- Space created: `yes/no`
- `/health` result
- warmup time estimate
- embedding dimension only, if checked
- no full embedding vectors committed

Output needed for Render:

```text
SBERT_SERVICE_URL=https://<huggingface-space-origin>
```

### 3. Deploy Backend To Render

Checklist:

- Create a Render Free web service.
- Set root directory:

```text
backend
```

- Set build command:

```bash
npm install && npx prisma generate
```

- Set start command:

```bash
npm start
```

- Set health check path:

```text
/api/v1/health
```

Set Render environment variables:

| Variable | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | private Neon connection string |
| `JWT_SECRET` | strong generated staging secret |
| `SBERT_SERVICE_URL` | Hugging Face Space URL |
| `EMAIL_PROVIDER` | `disabled` |
| `LOG_LEVEL` | `info` |
| `FRONTEND_URL` | Vercel frontend origin after Vercel is created; use a temporary explicit planned origin only if Render needs this before first deploy |
| `CORS_ORIGIN` | Vercel frontend origin if needed; never `*` |

Important:

- `EMAIL_PROVIDER=mock` must not be used for staging.
- `CORS_ORIGIN=*` must not be used.
- The `JWT_SECRET` must be strong and not a local placeholder.

Record safe evidence:

- Render service created: `yes/no`
- build result
- build command used, expected as `npm install && npx prisma generate`
- backend health result:

```bash
curl -fsS https://<render-backend-origin>/api/v1/health
```

Do not record secret env values.

Note: PR #128 records that `npm install && npx prisma generate` is the working Render build command for the current backend lockfile state. Do not use the earlier `npm ci && npx prisma generate` Render command unless it is re-tested successfully after lockfile changes.

Output needed for Vercel:

```text
RENDER_BACKEND_ORIGIN=https://<render-backend-origin>
```

PR #129 commits `frontend/vercel.json` for the approved staging backend origin:

```text
https://research-topic-approval-dss-backend.onrender.com
```

This is deploy configuration only. It does not prove Vercel deployment has succeeded.

### 4. Run Prisma Migrations

Run migrations after Render has the Neon `DATABASE_URL`, or from a local/admin shell with the Neon `DATABASE_URL` exported only for that command.

Commands:

```bash
cd backend
npx prisma migrate deploy
npx prisma migrate status
```

Do not run:

```bash
npx prisma db push
```

Record safe evidence:

- `migrate deploy`: `passed/failed`
- `migrate status`: `up to date/not up to date`
- no full `DATABASE_URL`
- no raw database dump

Then verify backend readiness:

```bash
curl -fsS https://<render-backend-origin>/api/v1/readiness
```

Pass:

- database is available
- SBERT is available, or degraded SBERT is clearly explained as a free-tier warmup/sleep condition

### 5. Deploy Frontend To Vercel

Checklist:

- Create a Vercel project from the repository.
- Set root directory:

```text
frontend
```

- Set framework:

```text
Vite
```

- Set install command:

```bash
npm ci
```

- Set build command:

```bash
npm run build
```

- Set output directory:

```text
dist
```

Record safe evidence:

- Vercel deployment result
- frontend root HTTP result:

```bash
curl -fsSI https://<vercel-origin>/
```

Output needed for Render:

```text
FRONTEND_URL=https://<vercel-origin>
CORS_ORIGIN=https://<vercel-origin>
```

Update Render with the final Vercel origin after Vercel exists, then redeploy/restart Render if required.

### 6. Configure Frontend API Routing To Backend

The frontend currently calls relative `/api/v1` and `/api/similarity/check` endpoints. For Vercel staging, the committed `frontend/vercel.json` configures routing so:

```text
https://<vercel-origin>/api/*
```

forwards to:

```text
https://research-topic-approval-dss-backend.onrender.com/api/*
```

Checklist:

- Confirm Vercel uses the committed `frontend/vercel.json` from PR #129.
- Verify through the Vercel origin:

```bash
curl -fsS https://<vercel-origin>/api/v1/health
curl -fsS https://<vercel-origin>/api/v1/readiness
```

Pass:

- Vercel `/api/v1/health` reaches Render.
- Vercel `/api/v1/readiness` returns the real backend readiness response.
- Browser login/session behavior is tested without fake responses.

Fail:

- frontend loads but API calls fail
- Vercel returns a static 404 for `/api/v1/health`
- API responses are mocked to hide routing failure

### 7. Capture Evidence

Use [free-staging-evidence-log-template.md](./free-staging-evidence-log-template.md).

Required evidence:

- commit hash
- Neon setup result
- Hugging Face SBERT health result
- Render backend health result
- Prisma migration result
- Render backend readiness result
- Vercel frontend HTTP result
- Vercel-to-Render `/api` routing result
- email status: `EMAIL_PROVIDER=disabled`
- known free-tier issues
- pass/fail conclusion

Do not claim deployment complete until evidence is captured.

## Final Pass Criteria

Free staging is considered passed for FYP/demo only when:

- Neon database exists and migrations are applied.
- Hugging Face SBERT health succeeds after warmup.
- Render backend health succeeds.
- Render readiness succeeds, or any degraded SBERT state is documented honestly.
- Vercel frontend loads.
- Vercel `/api` routes to Render.
- Email is intentionally disabled.
- No secrets, private URLs, database strings, tokens, or real student data are committed.

## Final Fail Criteria

Free staging fails when:

- migrations fail
- Render cannot reach Neon
- Render cannot reach Hugging Face and semantic readiness is still claimed
- Vercel cannot reach Render through `/api`
- `EMAIL_PROVIDER=mock` is used
- wildcard CORS is used
- fake data or fake provider proof is used
- evidence leaks secrets or real student data

## Current Boundary

This checklist prepares execution. It does not complete deployment, add provider configuration, or change the application.
