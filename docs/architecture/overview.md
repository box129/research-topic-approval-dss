# Architecture Overview

## Current production architecture

The current production semantic contract is Voyage AI, model
`voyage-4-large`, dimension 1024, representation `structured-context-v1`.

```text
Browser
  -> HTTPS edge
  -> Nginx: React/Vite static SPA + same-origin /api proxy
  -> Node/Express backend (single initial instance)
       -> PostgreSQL via Prisma
       -> Voyage API over outbound HTTPS
       -> SMTP provider when email is enabled
```

The browser uses relative `/api` paths. In the standard deployment, Nginx
serves the SPA and forwards `/api/*` privately to the backend, keeping cookie,
CORS, CSRF, reset-link, and invitation-link behavior on one HTTPS origin.

Only the HTTPS edge/frontend layer is public. PostgreSQL and the backend are
private-network services. The initial backend is intentionally one instance:
the Phase 5 rate-limit store and Voyage readiness-probe cache are process-local,
so horizontal scale requires a separate shared-control design.

## Runtime components

### Frontend and edge

- React/Vite produces a static SPA artifact.
- Nginx serves static content, supports SPA fallback, and proxies `/api/*`.
- The HTTPS edge terminates TLS, redirects HTTP, and preserves the reviewed
  forwarded protocol/client chain.

### Backend

- `backend/src/server.js` defines the Express API, liveness/readiness endpoints,
  protected routes, security middleware, and import upload boundary.
- Prisma accesses PostgreSQL.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- `TRUST_PROXY` defaults to disabled outside production; a public production
  deployment must supply the exact reviewed proxy topology.

### Semantic provider

- `backend/src/services/voyageEmbedding.service.js` uses Voyage query/document
  embeddings.
- Stored vectors are accepted only when provider, model, dimension,
  representation, and source hash match the current contract.
- Provider failures return controlled semantic unavailability; there is no
  SBERT, lexical, deterministic, or score fallback for the protected direct
  similarity contract.

### Database and email

- PostgreSQL stores users, lifecycle records, topic records, snapshots, audits,
  notifications, and semantic metadata.
- SMTP is an optional configured delivery integration. `disabled` is a
  fail-closed staging posture; `smtp` needs an actual provider smoke before it
  is considered operationally verified.

## Health and deployment boundaries

`/api/v1/health` is liveness only. `/api/v1/readiness` is the traffic-admission
signal and reflects database plus safe Voyage provider state. Container liveness
must not restart the service simply because a transient external dependency is
unavailable.

The definitive deployment, migration, timeout, graceful-shutdown, staging, and
environment contract is in [the Phase 6 deployment runbook](../deployment/deployment-runbook.md)
and [environment matrix](../deployment/environment-matrix.md).

## Historical SBERT material

The repository retains `sbert-service/`, legacy scoring/evaluation material,
and historical Hugging Face staging evidence for research and provenance. Those
artifacts do not describe the current production runtime and must not be added
to standard Compose startup, readiness, or deployment requirements.
