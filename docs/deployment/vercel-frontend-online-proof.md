# Vercel Frontend Online Proof

> **Historical/superseded evidence.** This records the pre-Phase-6
> Vercel-to-Render rewrite path and is retained only for traceability. It is not
> proof of the current same-origin Nginx/Voyage deployment; see the
> [production runbook](./deployment-runbook.md).

## Status

PR #130 records safe online proof that the free managed staging frontend is deployed on Vercel and that Vercel rewrites existing relative `/api/*` calls to the Render backend.

This evidence proves the free managed staging chain for FYP/demo readiness:

```text
Vercel frontend -> Vercel /api rewrite -> Render backend -> Neon PostgreSQL + Hugging Face SBERT Space
```

It does not prove public production readiness, lecturer validation completion, real SMTP provider delivery, credentialed browser workflow smoke, monitoring/backup drills, or departmental production readiness.

## Deployment Metadata

| Field | Value |
| --- | --- |
| Vercel deployed commit | `a52925c` |
| Commit subject | `deploy: add Vercel frontend proxy config (#129)` |
| Frontend URL | `https://research-topic-approval-dss.vercel.app` |
| Render backend URL | `https://research-topic-approval-dss-backend.onrender.com` |
| Render `FRONTEND_URL` | Updated to `https://research-topic-approval-dss.vercel.app` before final checks |
| Render redeploy before final checks | Completed |

No Vercel tokens, Render secrets, `DATABASE_URL`, JWT secrets, SMTP credentials, provider tokens, screenshots containing secrets, database dumps, or student records are included.

## Vercel Frontend Proof

### Frontend Root

Command:

```bash
curl -I https://research-topic-approval-dss.vercel.app
```

Result:

```text
HTTP/1.1 200 OK
```

Meaning: the Vercel frontend root responds successfully.

### SPA Fallback

Command:

```bash
curl -I https://research-topic-approval-dss.vercel.app/login
```

Result:

```text
HTTP/1.1 200 OK
```

The response served `index.html`, confirming that non-API routes fall back to the React SPA as intended.

## Vercel To Render API Proxy Proof

### Health Through Vercel

Command:

```bash
curl -sS --http1.1 --retry 3 --retry-all-errors https://research-topic-approval-dss.vercel.app/api/v1/health
```

Result:

```json
{
  "status": "OK",
  "message": "Server is running",
  "environment": "production",
  "apiVersion": "v1"
}
```

Meaning: Vercel `/api` rewrites reach the Render backend health endpoint.

### Readiness Through Vercel

Command:

```bash
curl -sS --http1.1 --retry 3 --retry-all-errors https://research-topic-approval-dss.vercel.app/api/v1/readiness
```

Result summary:

| Check | Status |
| --- | --- |
| Overall readiness | `ready` |
| `api` | `available` |
| `database` | `available` |
| `sbert` | `available` |

Meaning: Vercel proxying reaches Render, and Render can reach Neon PostgreSQL and the Hugging Face SBERT Space.

## Direct Render Backend Proof

### Direct Health

Command:

```bash
curl -sS --http1.1 --retry 3 --retry-all-errors https://research-topic-approval-dss-backend.onrender.com/api/v1/health
```

Result:

```json
{
  "status": "OK",
  "message": "Server is running",
  "environment": "production",
  "apiVersion": "v1"
}
```

### Direct Readiness

Command:

```bash
curl -sS --http1.1 --retry 3 --retry-all-errors https://research-topic-approval-dss-backend.onrender.com/api/v1/readiness
```

Result summary:

| Check | Status |
| --- | --- |
| Overall readiness | `ready` |
| `api` | `available` |
| `database` | `available` |
| `sbert` | `available` |

Meaning: direct Render readiness confirms the backend, Neon PostgreSQL connection, and Hugging Face SBERT service are available.

## Free Managed Staging Meaning

The free managed staging path is now proven for FYP/demo readiness:

- Vercel serves the React/Vite frontend.
- Vercel SPA fallback works for client routes such as `/login`.
- Vercel `/api/*` rewrites reach the Render backend.
- Render backend health succeeds.
- Render backend readiness is `ready`.
- Neon PostgreSQL is available to the backend.
- Hugging Face SBERT is available to the backend.

## Remaining Non-Staging Gaps

Still not proven by this evidence:

- public production readiness.
- lecturer-reviewed validation completion.
- departmental-scale data-quality validation.
- real SMTP provider smoke/delivery confirmation.
- credentialed browser workflow smoke.
- monitoring alerts and backup/restore drills.
- paid departmental pilot deployment.

## Current Boundary

PR #130 is a docs-only evidence PR. It records online staging proof and does not change app code, frontend UI, API clients, backend routes, auth behavior, Prisma schema, Docker behavior, algorithms, similarity scoring, thresholds, or tests.
