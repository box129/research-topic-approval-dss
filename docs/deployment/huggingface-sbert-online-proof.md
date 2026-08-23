# Hugging Face SBERT Online Proof

> **Historical/superseded evidence.** SBERT/Hugging Face is not part of the
> Phase 6 runtime. This proof is retained for research traceability only; use
> the [production runbook](./deployment-runbook.md) and
> [environment matrix](./environment-matrix.md) for the Voyage deployment.

## Status

PR #126 records safe online proof for the Hugging Face Spaces SBERT staging service. It does not prove Render backend deployment, Vercel frontend deployment, Prisma migrations against Neon, or full free managed staging deployment.

Public staging SBERT service URL:

```text
https://seun10v3-research-topic-sbert-staging.hf.space
```

## Evidence Summary

| Check | Status | Safe evidence |
| --- | --- | --- |
| Space package pushed to Hugging Face | Completed manually | Package from PR #125 was copied/pushed to the Space repository. |
| Space built and responded online | Completed manually | Online checks below passed. |
| `GET /health` | Passed | Returned `{"status":"healthy","model":"all-MiniLM-L6-v2"}`. |
| `POST /embed` | Passed | Returned an embedding response with `"dimension":384`. |
| Model reported | Confirmed | `all-MiniLM-L6-v2`. |
| Raw embedding committed | Not committed | Full vector intentionally omitted. |
| `SBERT_SERVICE_URL` for Render | Confirmed for later use | Use the public staging URL above as the Render environment value when backend deployment begins. |

## Confirmed Endpoint Contract

Health check:

```bash
curl -fsS https://seun10v3-research-topic-sbert-staging.hf.space/health
```

Verified result:

```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2"
}
```

Embedding check:

```bash
curl -fsS https://seun10v3-research-topic-sbert-staging.hf.space/embed \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"malaria prevention among children\"}"
```

Verified result summary:

```json
{
  "dimension": 384
}
```

The raw embedding vector is intentionally omitted from committed evidence.

## Render Configuration Follow-Up

When Render backend deployment begins, configure:

```text
SBERT_SERVICE_URL=https://seun10v3-research-topic-sbert-staging.hf.space
```

Do not add this value to frontend configuration. The frontend should continue to call the backend, and the backend should call SBERT.

## Still Pending

This proof does not complete:

- Prisma migrations against Neon.
- Render backend deployment.
- Render `DATABASE_URL` configuration.
- Render `SBERT_SERVICE_URL` configuration.
- Render backend readiness against Neon and SBERT.
- Vercel frontend deployment.
- Vercel `/api` routing to Render.
- Full free managed staging proof.
- Public production deployment proof.

## Security And Privacy Confirmation

This PR does not include:

- Hugging Face private tokens
- provider auth tokens
- database URLs
- Neon credentials
- SMTP credentials
- screenshots containing secrets
- real student records
- raw embedding vectors
- raw database dumps

## Current Boundary

The Hugging Face SBERT staging service is online and its backend-facing `/health` and `/embed` contract has been manually verified. The rest of the free managed staging deployment remains pending.
