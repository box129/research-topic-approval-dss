# Hugging Face SBERT Space Setup Evidence

## Status

PR #124 records safe evidence that the Hugging Face Space for the SBERT staging service has been created for the free managed staging path. It does not record secrets and does not prove SBERT API availability.

This evidence is intentionally partial. It covers Hugging Face Space creation and SDK selection only.

## Evidence Summary

| Check | Status | Evidence boundary |
| --- | --- | --- |
| Hugging Face Space created | Completed manually | No private Space URL or screenshot committed. |
| Space SDK set to Docker | Completed manually | SDK choice recorded without provider secrets. |
| SBERT service deployed | Not completed | No SBERT runtime/API proof is claimed. |
| `SBERT_SERVICE_URL` confirmed | Not completed | No Space service URL is committed or confirmed for Render yet. |
| Provider tokens committed | Not committed | No Hugging Face tokens or private auth tokens are included. |
| Student records committed | Not committed | No real student records, topics, or embeddings are included. |

## Space URL And Token Handling

Do not commit:

- private Hugging Face tokens
- private Space URLs if the Space is private
- provider API tokens
- screenshots containing account or deployment secrets
- service URLs that deployment policy treats as private

The eventual Render backend value should be added only as a private Render environment variable after SBERT is deployed and the URL is confirmed:

```text
SBERT_SERVICE_URL=<private-or-approved Hugging Face Space URL>
```

## Pending Work

The following are not yet confirmed by this evidence note:

- SBERT service code deployed to the Space.
- Hugging Face build/start success.
- SBERT `/health` endpoint availability.
- SBERT `/embed` endpoint availability.
- `SBERT_SERVICE_URL` confirmed for Render.
- Render backend deployment.
- Render `DATABASE_URL` and `SBERT_SERVICE_URL` environment variable configuration.
- Render backend health/readiness against Neon and SBERT.
- Vercel frontend deployment.
- Vercel `/api` routing to Render.
- Prisma migrations against Neon.

Neon project/database setup has been documented separately in [neon-staging-setup-evidence.md](./neon-staging-setup-evidence.md), but Prisma migrations against Neon are still not confirmed by this PR.

## API Proof Boundary

Do not claim SBERT availability until these checks have actually run against the deployed Space:

```bash
curl -fsS https://<huggingface-space-origin>/health
```

and, if embedding proof is in scope:

```bash
curl -fsS https://<huggingface-space-origin>/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"malaria prevention among children"}'
```

Do not commit full embedding vectors in evidence. If `/embed` is checked, record only that a response was returned and the embedding dimension if safe.

## Security And Privacy Confirmation

This PR does not include:

- private Hugging Face tokens
- private Space URLs
- provider auth tokens
- service URLs
- screenshots containing secrets
- Neon database URLs
- SMTP credentials
- real student data
- raw embeddings
- raw database dumps

## Current Boundary

The Hugging Face Space container target has been created with Docker SDK selected, but the SBERT service is not yet deployed and no SBERT endpoint is claimed reachable. Full free staging remains pending until Neon migrations, Render backend deployment, Hugging Face SBERT deployment, Vercel frontend deployment, API routing, and evidence capture are completed.
