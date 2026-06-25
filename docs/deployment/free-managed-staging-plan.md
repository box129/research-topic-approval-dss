# Free Managed Staging Plan

## Status

PR #120 prepares a no-cost managed staging plan for final-year project demonstration. It does not deploy the Research Topic Approval DSS and does not prove dependable departmental production readiness.

Use this path when the goal is to demonstrate the system safely without paying for a VPS. Use the paid pilot plan when the Public Health Department needs a reliable departmental service.

## Objective

Create a staging/demo deployment that can show the real application workflow with no committed secrets and no real student records.

The free staging proof should demonstrate:

- frontend can be served from a managed static host
- backend can run from a managed app host
- PostgreSQL can use a managed free database tier
- SBERT can run on a free or no-cost ML/app host if capacity allows
- SMTP remains disabled unless approved smoke credentials exist
- health, readiness, and smoke evidence are captured honestly

## Suggested No-Cost Architecture

| Component | Suggested free/demo option | Notes |
| --- | --- | --- |
| Frontend | Vercel Hobby, Netlify Free, or similar static hosting | Good fit for the Vite build. Configure API base/proxy according to the chosen host. |
| Backend | Render Free web service, Railway trial/free credit, Koyeb Free instance, or similar app host | Must support Node/Express, environment variables, outbound network access, and enough memory for the backend. |
| PostgreSQL | Supabase Free, Render Postgres Free, Neon Free, or equivalent managed PostgreSQL | Use only sanitized/demo data. Free storage, retention, and sleeping limits vary by provider. |
| SBERT service | Hugging Face Space CPU Basic or another free Python app/ML host | SBERT is the hardest free-tier component. If the model cannot start reliably, mark SBERT proof as not passed rather than faking semantic readiness. |
| Email | `EMAIL_PROVIDER=disabled` | Only run SMTP smoke if deployment-owned SMTP credentials and a controlled recipient are available. |
| Backups | Provider export/manual `pg_dump` if allowed | Free tiers may not include automated backups or point-in-time recovery. |

This split is intentionally managed-service oriented. It is easier for FYP demonstration than running a public VPS, but it is less reliable and less controllable than the Docker/VPS pilot architecture.

## Provider Selection Notes

Recheck provider pricing and free-tier limits before deployment. Free plans change often.

Current planning references checked on 2026-06-25:

- Vercel Hobby is positioned as a free plan for personal projects.
- Netlify Free provides a no-cost static hosting plan with usage credits.
- Render Free supports some web services/datastores, with documented free-tier limitations.
- Supabase Free provides managed PostgreSQL for development/demo use.
- Hugging Face Spaces CPU Basic is a possible free SBERT host, but startup and persistence behavior must be tested.

Recheck these official pricing pages before execution:

- `https://vercel.com/pricing`
- `https://www.netlify.com/pricing/`
- `https://render.com/pricing`
- `https://supabase.com/pricing`
- `https://huggingface.co/pricing`

These references are not procurement approval and should not be treated as a service-level guarantee.

## Environment Setup

Start from the existing deployment template:

```bash
cp .env.compose.example .env.staging.example.local
```

Then translate the required values into the chosen provider dashboards. Do not commit provider-specific `.env` files.

Minimum variables to configure:

- `NODE_ENV=production` for backend-like staging
- `DATABASE_URL` from the managed PostgreSQL provider
- `JWT_SECRET` generated for the staging demo
- `FRONTEND_URL` set to the managed frontend origin
- `CORS_ORIGIN` set to the same explicit trusted origin if needed
- `SBERT_SERVICE_URL` set to the hosted SBERT service URL
- `EMAIL_PROVIDER=disabled` unless SMTP smoke is intentionally run

Never use:

```text
CORS_ORIGIN=*
EMAIL_PROVIDER=mock
JWT_SECRET=local-dev-auth-secret-change-before-production
```

## Expected Free-Tier Limitations

Free managed staging is suitable for demonstration only. Expect:

- cold starts after inactivity
- sleeping services
- slower first SBERT request while the model warms up
- memory limits that may prevent SBERT from running on some hosts
- storage limits for PostgreSQL
- request, bandwidth, build-minute, or compute-credit limits
- database expiry or paused projects on some providers
- no production reliability guarantee
- limited logs and monitoring retention
- no formal uptime SLA
- limited backup/restore support

If any of these limits break a demo, document the limit as evidence. Do not patch the application to fake readiness.

## Demo Data Boundary

Use only:

- synthetic topic records
- approved sample imports
- lecturer-reviewed validation samples that contain no real student identifiers
- demo accounts explicitly approved for FYP demonstration

Do not upload:

- real student submissions
- departmental production data
- private lecturer notes
- database dumps containing real identities
- screenshots exposing secrets or private records

## Free Staging Proof Steps

1. Deploy the managed PostgreSQL database.
2. Deploy the SBERT service if the chosen free host supports it.
3. Deploy the backend with explicit environment variables.
4. Run Prisma migrations against the managed database:

```bash
npx prisma migrate deploy
npx prisma migrate status
```

5. Deploy the frontend static build.
6. Verify backend health and readiness:

```bash
curl -fsS <backend-url>/api/v1/health
curl -fsS <backend-url>/api/v1/readiness
```

7. Verify SBERT health:

```bash
curl -fsS <sbert-url>/health
```

8. Verify frontend loads:

```bash
curl -fsSI <frontend-url>/
```

9. Run SMTP smoke only if approved SMTP credentials exist:

```bash
EMAIL_PROVIDER=smtp \
SMTP_HOST=<provider-host> \
SMTP_PORT=<provider-port> \
SMTP_SECURE=true|false \
EMAIL_FROM=<approved-sender> \
SMTP_USER=<provider-user-if-needed> \
SMTP_PASSWORD=<provider-secret-if-needed> \
SMTP_SMOKE_TO=<controlled-recipient> \
npm run smoke:smtp
```

10. Capture evidence without secrets.

## Evidence To Capture

Capture:

- commit hash
- selected providers
- frontend URL domain label only, if public URLs should not be committed
- backend health result
- backend readiness result
- SBERT health result
- migration status result
- frontend HTTP result
- SMTP smoke result or `NOT RUN - CREDENTIALS UNAVAILABLE`
- known free-tier limitations encountered
- pass/fail conclusion

Do not capture:

- database URLs
- JWT secrets
- SMTP credentials
- provider API keys
- raw database exports
- real student records
- private IP addresses if policy forbids them

## Passed / Failed Definition

Free staging passes for FYP/demo only when:

- frontend loads from the managed host
- backend health passes
- backend readiness passes, or any degraded state is clearly explained
- migrations deploy cleanly
- SBERT health passes if semantic demonstration is in scope
- SMTP smoke is either passed with approved credentials or explicitly marked not run
- no secrets or real student records are committed

Free staging fails when:

- the app cannot be reached
- migrations fail
- SBERT is claimed healthy without a real health check
- fake records or fake readiness are used
- secrets or real student data appear in evidence

## Production Warning

Free managed hosting is for FYP demonstration and staging-style proof only. It should not be used as dependable departmental production infrastructure because free tiers can sleep, expire, throttle, delete data after provider-defined limits, or change terms without the operational controls expected for a department service.
