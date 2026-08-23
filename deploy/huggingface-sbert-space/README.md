---
title: Research Topic Approval DSS SBERT Service
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# Research Topic Approval DSS SBERT Service

> **Historical/research-only deployment package.** The current production and
> staging architecture uses Voyage `voyage-4-large` from the Node backend and
> must not deploy, configure, or depend on this Hugging Face SBERT service.
> See the [Phase 6 production runbook](../../docs/deployment/deployment-runbook.md)
> for the authoritative deployment topology.

This package is retained for historical evaluation/reproducibility of the
former Hugging Face Spaces SBERT service.

It preserves the backend-facing contract used by `backend/src/services/sbert.service.js`:

- `GET /health`
- `POST /embed` with JSON body `{ "text": "..." }`
- successful embedding response shape `{ "embedding": number[], "dimension": 384 }`

## Status

This package prepares deployable files for the existing Hugging Face Space. It does not prove that the online Space has been deployed, started, or tested.

Do not commit:

- Hugging Face tokens
- private Space URLs
- `SBERT_SERVICE_URL`
- database URLs
- SMTP credentials
- student records
- raw embeddings from real student topics

## Local Smoke

From this directory:

```bash
docker build -t rtadss-sbert-space .
docker run --rm -p 7860:7860 rtadss-sbert-space
```

Then, in another shell:

```bash
curl -fsS http://127.0.0.1:7860/health
curl -fsS http://127.0.0.1:7860/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"malaria prevention among children"}'
```

The `/embed` response should contain `dimension: 384`. Do not paste full embeddings into committed evidence.

## Hugging Face Space Deployment

Copy or push these files into the root of the Hugging Face Space repository:

- `README.md`
- `Dockerfile`
- `requirements.txt`
- `app.py`
- `.dockerignore`

After the Space builds and runs, verify with placeholder URLs:

```bash
curl -fsS https://<space-owner>-<space-name>.hf.space/health
curl -fsS https://<space-owner>-<space-name>.hf.space/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"malaria prevention among children"}'
```

Historically, the former Render integration received:

```text
SBERT_SERVICE_URL=https://<space-owner>-<space-name>.hf.space
```

Do not set this value in the current Voyage production or staging deployment.

## Free-Tier Notes

The first request can be slow because the model may download and load on CPU. Free Spaces can sleep, restart, or rebuild, and they do not provide departmental production reliability guarantees.

If `/health` or `/embed` fails online, record the failure honestly as legacy
research evidence. It does not change current Voyage production or staging
readiness.
