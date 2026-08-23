# HTTPS, Domain, and Proxy Checklist

> **Current Phase 6 topology:** HTTPS edge -> frontend Nginx SPA and `/api`
> proxy -> private backend. This is a deployment checklist, not evidence that a
> domain, certificate, or target platform has already been configured.

## Domain and TLS ownership

Record outside Git:

- approved public domain/subdomain and DNS owner;
- certificate issuer, renewal owner, and expiry monitoring path;
- HTTPS edge/reverse-proxy owner and rollback/DNS plan;
- approved target environment (staging or production), never a defence database.

Do not commit registrar credentials, TLS private keys, private addresses if
policy forbids them, or screenshots containing secrets.

## Required public behavior

- HTTP redirects to HTTPS at the edge.
- The certificate is valid for the one approved browser origin.
- Nginx serves SPA files and sends `/api/*` only to the private backend.
- SPA refresh works for `/login`, `/accept-invitation`, `/reset-password`, and
  protected client routes; `/api/*` never falls through to `index.html`.
- PostgreSQL and the backend have no direct public route.
- The edge/Nginx platform permits request/proxy timeouts of at least 180
  seconds, configured to 300 seconds, for the demonstrated 142-second bulk
  administrative operation.
- Container/orchestrator termination grace is at least 330 seconds so the
  backend’s 300-second graceful drain can complete.

## Cookie, CORS, CSRF, and proxy identity

Set the backend browser origin once:

```text
FRONTEND_URL=https://<approved-origin>
```

`CORS_ORIGIN` is normally unnecessary for same-origin deployment. If it is
used, it must be the exact same bare HTTPS origin. Never use:

```text
CORS_ORIGIN=*
TRUST_PROXY=true
TRUST_PROXY=*
```

Production cookies are `HttpOnly`, `SameSite=Lax`, and `Secure`. Do not disable
the secure flag as a proxy workaround.

The backend already supports a safe configurable `TRUST_PROXY`; it is **not**
an unconfigured legacy setting. Configure it only after mapping the real chain:

```text
browser -> HTTPS edge -> Nginx -> private backend
```

The edge and Nginx must preserve a verified forwarded protocol/client chain. In
particular, Nginx must not replace an edge-provided HTTPS indication with its
internal HTTP transport value. Use the exact reviewed hop count or trusted proxy
CIDR list; do not copy a hop count blindly. Ensure the backend cannot be reached
directly by clients that could inject `X-Forwarded-*` headers.

## Post-deployment smoke checks

Use the public HTTPS origin, not a direct private backend port:

```powershell
Invoke-WebRequest https://<approved-origin>/
Invoke-WebRequest https://<approved-origin>/login
Invoke-RestMethod https://<approved-origin>/api/v1/health
Invoke-RestMethod https://<approved-origin>/api/v1/readiness
```

Also verify a protected similarity route rejects anonymous access, and run
credentialed smoke only with approved synthetic staging accounts. A successful
liveness response is not enough: readiness must be `ready` before traffic is
admitted.

## Open proof boundary

DNS, TLS, proxy-header behavior, cookie behavior in a real browser, and the
public HTTPS smoke remain environment-specific proof items. Do not claim them
until performed against the chosen staging/production-like target.
