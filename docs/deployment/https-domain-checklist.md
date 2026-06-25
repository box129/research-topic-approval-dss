# HTTPS, Domain, and TLS Checklist

## Status

This checklist prepares public endpoint requirements. It does not configure a domain, DNS record, TLS certificate, reverse proxy, or public production deployment.

## Domain Ownership

Before production, record outside Git:

- approved domain name
- DNS owner/team
- hosting environment
- TLS certificate owner
- renewal process
- rollback DNS plan

Do not commit private domain registrar credentials or TLS private keys.

## HTTPS Requirements

- Public traffic must use HTTPS.
- HTTP should redirect to HTTPS where supported.
- TLS certificate must be valid for the production domain.
- Certificate renewal must be monitored.
- TLS private keys must be stored outside Git.
- Backend production cookies depend on HTTPS because `secure` is enabled when `NODE_ENV=production`.

## Reverse Proxy Requirements

The frontend uses relative `/api/v1` calls. Production hosting must ensure:

- frontend origin is the same trusted origin configured in `FRONTEND_URL` or `CORS_ORIGIN`, or CORS is explicitly configured for the exact frontend origin
- `/api/*` routes reach the backend API
- backend is not exposed with wildcard CORS
- request body and upload limits are compatible with topic import limits
- proxy timeouts allow normal similarity checks and import previews
- logs do not include secrets

No Express `trust proxy` setting is currently configured. If a TLS-terminating reverse proxy requires proxy-aware IP/cookie behavior, document and test that separately before public production.

## DNS Checklist

- DNS record points to approved frontend/reverse proxy target.
- No old public test records point to stale deployments.
- TTL is appropriate for launch and rollback.
- DNS changes are approved by the owner.
- Internal-only services such as PostgreSQL and SBERT are not publicly published.

## CORS Checklist

Production must use:

```text
FRONTEND_URL=https://<approved-domain>
```

or:

```text
CORS_ORIGIN=https://<approved-domain>
```

Do not use:

```text
CORS_ORIGIN=*
```

`FRONTEND_URL` is preferred when both variables exist.

## Smoke Checks

After deployment:

```powershell
Invoke-WebRequest https://<approved-domain>/
Invoke-RestMethod https://<approved-domain>/api/v1/health
Invoke-RestMethod https://<approved-domain>/api/v1/readiness
```

Credentialed smoke should use approved test accounts only, with credentials supplied outside Git.

## Open Gap

Public HTTPS/domain readiness remains unverified until DNS, TLS, reverse proxy, and smoke checks are completed in the target environment.
