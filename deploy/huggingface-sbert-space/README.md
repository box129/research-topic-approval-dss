---
title: Research Topic Approval DSS SBERT Service
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# Research Topic Approval DSS SBERT Service

This is the Hugging Face Spaces Docker package for the Research Topic Approval DSS staging SBERT service.

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

Only after the deployed Space responds should Render receive:

```text
SBERT_SERVICE_URL=https://<space-owner>-<space-name>.hf.space
```

## Free-Tier Notes

The first request can be slow because the model may download and load on CPU. Free Spaces can sleep, restart, or rebuild, and they do not provide departmental production reliability guarantees.

If `/health` or `/embed` fails online, record the failure honestly and leave Render readiness as degraded until the Space is fixed.
