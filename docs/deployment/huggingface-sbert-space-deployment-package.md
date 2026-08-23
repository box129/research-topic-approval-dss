# Hugging Face SBERT Space Deployment Package

> **Historical/superseded package record.** SBERT/Hugging Face is not part of
> the Phase 6 runtime. This material remains for research/evaluation
> traceability only; use the [production runbook](./deployment-runbook.md) and
> [environment matrix](./environment-matrix.md) for current deployment.

## Status

PR #125 prepares a deployable Hugging Face Spaces Docker package for the SBERT staging service. It does not deploy the online Space and does not prove that `/health` or `/embed` works online.

Package location:

```text
deploy/huggingface-sbert-space/
```

## Existing Backend Contract

The backend uses `backend/src/services/sbert.service.js` and expects:

```text
GET <SBERT_SERVICE_URL>/health
POST <SBERT_SERVICE_URL>/embed
```

Health must return HTTP 200 with:

```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2"
}
```

Embed must accept:

```json
{
  "text": "malaria prevention among children"
}
```

and return:

```json
{
  "embedding": [0.0],
  "dimension": 384
}
```

The `embedding` example is intentionally shortened. Do not commit full embeddings from real student topics.

## Package Contents

| File | Purpose |
| --- | --- |
| `README.md` | Hugging Face Space metadata with `sdk: docker` and `app_port: 7860`, plus safe smoke commands. |
| `Dockerfile` | Builds a Python FastAPI service and runs Uvicorn on port `7860`. |
| `requirements.txt` | Runtime Python dependencies for FastAPI and `sentence-transformers`. |
| `app.py` | FastAPI app implementing `/health` and `/embed`. |
| `.dockerignore` | Keeps local env files, logs, and caches out of the Space image context. |

## Model Choice

The package uses:

```text
sentence-transformers/all-MiniLM-L6-v2
```

This is the same lightweight 384-dimensional model family used by the existing local SBERT service and is suitable for CPU/free-tier staging demonstration.

## Hugging Face Docker SDK Notes

Hugging Face Docker Spaces use the Space repository `README.md` YAML block to set:

```yaml
sdk: docker
app_port: 7860
```

The Dockerfile then exposes and runs the app on the same port:

```text
EXPOSE 7860
uvicorn app:app --host 0.0.0.0 --port 7860
```

## Deployment Steps

Copy or push the package contents into the root of the Hugging Face Space repository:

```text
deploy/huggingface-sbert-space/README.md
deploy/huggingface-sbert-space/Dockerfile
deploy/huggingface-sbert-space/requirements.txt
deploy/huggingface-sbert-space/app.py
deploy/huggingface-sbert-space/.dockerignore
```

Do not commit Hugging Face tokens or private Space URLs.

## Smoke Tests After Deployment

Only after the Space build succeeds, run:

```bash
curl -fsS https://<space-owner>-<space-name>.hf.space/health
curl -fsS https://<space-owner>-<space-name>.hf.space/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"malaria prevention among children"}'
```

Expected:

- `/health` returns `status: "healthy"`
- `/embed` returns `dimension: 384`

Only then should Render receive:

```text
SBERT_SERVICE_URL=https://<space-owner>-<space-name>.hf.space
```

## Cold-Start And Free-Tier Limitations

Expect:

- Docker build time while installing CPU ML dependencies.
- model download/load delay on first startup.
- slow first request after sleep.
- possible Space sleep or rebuild on free tier.
- no production reliability guarantee.

If the Space is unavailable, backend readiness should remain degraded. Do not claim semantic readiness from lexical fallback.

## Current Boundary

The package is prepared for deployment. The Hugging Face Space has not been deployed from this package in this PR, `SBERT_SERVICE_URL` is not confirmed, and online `/health` or `/embed` evidence is still pending.
