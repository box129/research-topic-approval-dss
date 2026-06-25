# Hugging Face SBERT Space

## Status

This document prepares Hugging Face Spaces setup for the SBERT service in free managed staging. It does not create a Space and does not prove SBERT availability.

## Purpose

Host the existing `sbert-service` FastAPI app so the Render backend can call semantic embedding endpoints during FYP/demo staging.

## Suggested Space Setup

Create a Hugging Face Space for the existing Python service.

Suggested settings:

| Setting | Value |
| --- | --- |
| SDK | Docker or Python/FastAPI-compatible setup, depending on final Space packaging |
| App source | `sbert-service/` |
| Public/private | deployment-owner decision; avoid exposing secrets |
| Hardware | Free CPU first, if model startup succeeds |

The current repository does not add a Space-specific Dockerfile or config in PR #121. If Hugging Face requires a packaging change, handle it in a later reviewed config PR and explain why.

## Required Backend Environment Variable

Set in Render:

```text
SBERT_SERVICE_URL=https://<space-owner>-<space-name>.hf.space
```

Do not commit the real Space URL if it identifies private deployment ownership and policy says not to.

## Expected Endpoints

The backend expects SBERT-style service behavior compatible with:

```text
GET /health
POST /embed
```

Expected health proof:

```bash
curl -fsS https://<huggingface-space-origin>/health
```

Expected safe embed proof:

```bash
curl -fsS https://<huggingface-space-origin>/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"malaria prevention among children"}'
```

Do not commit full embeddings in evidence.

## Free-Tier Limitations

Expect:

- slow first startup
- sleeping after inactivity
- model download/cache delay
- memory pressure on free CPU
- request latency spikes
- possible app restarts
- no production uptime guarantee

If the Space cannot run SBERT reliably, mark semantic staging as failed or degraded. Do not claim SBERT readiness from lexical fallback behavior.

## Troubleshooting

| Symptom | Likely cause | Check |
| --- | --- | --- |
| `/health` times out | Space is sleeping or model is loading | Wait for warmup and inspect Space logs |
| `/embed` fails | model load failed or request shape mismatch | Test with one short safe sentence |
| Render readiness is degraded | Render cannot reach Space or Space is sleeping | Check `SBERT_SERVICE_URL` and Space health |
| Memory error | free CPU/RAM is insufficient | Use a smaller model only in a reviewed similarity/config PR, or choose paid hardware |

## Evidence To Capture

Capture:

- Space health result
- approximate warmup time
- whether `/embed` returns a 384-dimensional embedding
- Render readiness result after SBERT warmup
- any free-tier sleep/cold-start behavior

Do not capture:

- private tokens
- full embeddings
- provider credentials
- real student topics
- private Space admin pages
