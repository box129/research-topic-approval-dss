# Docker Compose Deployment Contract

> **Current Phase 6 Compose contract.** This document is the authoritative
> repository Compose guide for the Voyage-backed, same-origin deployment. For
> public deployment policy, use the [production runbook](./deployment-runbook.md)
> and [environment matrix](./environment-matrix.md) with it. Older Compose,
> SBERT, Render, Vercel, and Hugging Face instructions are historical evidence,
> not current deployment instructions.

## Standard topology

The normal `docker compose up` topology is intentionally a single backend
instance:

```text
HTTPS edge -> frontend:8080 Nginx (SPA + /api proxy)
                         -> private backend:3000
                              -> private postgres:5432
                              -> Voyage over outbound HTTPS
                              -> SMTP when configured
```

Only `frontend` publishes a host port:

```text
${COMPOSE_BIND_HOST:-127.0.0.1}:${FRONTEND_PORT:-8080}:8080
```

`backend` and `postgres` have no host-published ports. Nginx serves SPA refresh
routes and proxies `/api/` to the private backend, so browser pages and APIs use
one origin. Do not expose the backend or database as a debugging shortcut.
Within Compose, Nginx re-resolves the `backend` service through Docker DNS so a
backend container recreation does not leave the frontend proxy pinned to a
stale container IP. A non-Docker platform must supply equivalent service-DNS
refreshing or reload/restart the frontend proxy after a backend recreation.

| Service | Standard startup | Purpose |
| --- | --- | --- |
| `postgres` | Yes | Private persistent PostgreSQL, with a named `postgres-data` volume. |
| `backend` | Yes | Private Node/Express application; Compose healthcheck is liveness only. |
| `frontend` | Yes | Unprivileged Nginx on port 8080, SPA/static serving and same-origin `/api/` proxy. |
| `backend-migrate` | No, `maintenance` profile only | Explicit pinned Prisma `migrate deploy` job. |
| `backend-bootstrap` | No, `maintenance` profile only | Explicit non-root first-administrator operator task. Never a seed/startup task. |
| `sbert-service` | No, `legacy-sbert` profile only | Retained research/evaluation service. It has no standard backend dependency, port, liveness/readiness role, or browser path. |

The `legacy-sbert` profile may retain its `sbert-model-cache` volume, but that
profile is not a production dependency and must not be enabled for standard
staging/production verification.

## Local Compose preparation

For local verification only:

```powershell
Copy-Item .env.compose.example .env
```

Keep `.env` uncommitted. The example intentionally uses local development
values: `NODE_ENV=development`, HTTP localhost origin, disabled email, and a
blank Voyage key for deliberately degraded local checks. It is **not** a
production secret file.

For a production-like Compose target, inject values from the approved secret
store instead. At minimum use a unique `POSTGRES_PASSWORD`, `DATABASE_URL`,
strong `JWT_SECRET`, exact HTTPS `FRONTEND_URL`, verified `TRUST_PROXY`, and
`VOYAGE_API_KEY`. A blank/missing Voyage key is startup-fatal when
`NODE_ENV=production`. Normally leave `CORS_ORIGIN` unset for the same-origin
topology; if supplied, it must exactly equal `FRONTEND_URL` and must not be a
wildcard.

`COMPOSE_BIND_HOST=127.0.0.1` is intentionally local-only. A public deployment
puts a reviewed HTTPS edge in front of `frontend`, rather than changing this
binding to expose internal services.

## Build, migrate, start, and smoke

Run release operations from the repository root. These commands do not seed
data or bootstrap an account automatically.

```powershell
docker compose config --quiet
docker compose build
docker compose --profile maintenance run --rm backend-migrate
docker compose up -d
npm run docker:smoke
```

The copied local `.env` intentionally has no Voyage credential, so it supports
only degraded local configuration checks and **must not** be used to claim a
passing readiness smoke. The final `npm run docker:smoke` command is a
production-like verification step: inject a valid deployment-owned
`VOYAGE_API_KEY`, use a database that can pass readiness, and keep the key out
of command output and Git. Without those prerequisites it correctly fails at
the readiness check.

The migration service runs `prisma migrate deploy` and exits. It starts only
when explicitly requested through `maintenance`; an ordinary `docker compose
up -d` never migrates, seeds, or creates an administrator. Stop the release if
the migration job fails.

After the standard stack is up, verify the same-origin paths rather than direct
private ports:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health
Invoke-RestMethod http://127.0.0.1:8080/api/v1/readiness
```

`npm run docker:smoke` uses `FULLSTACK_FRONTEND_URL` only (default
`http://127.0.0.1:8080/`) and `FULLSTACK_SMOKE_TIMEOUT_MS` (default
`30000`, allowed 1000–300000). The value is a bounded per-check deadline.
`FULLSTACK_FRONTEND_URL` must be a bare HTTP(S) origin with no credentials,
path, query, or fragment, so the smoke never prints a credential-bearing URL.
The readiness check polls inside that deadline because a healthy first Voyage
probe can honestly report `configured_not_yet_verified` while asynchronous
verification is in flight. It checks SPA root/login/invitation/reset routes,
same-origin liveness and readiness, an
unauthenticated `401` auth result, and a rejected anonymous similarity request.
It has no direct backend, PostgreSQL, or SBERT URL override.

For an approved synthetic first administrator, wait for migration and backend
readiness, then run the operator-only target once:

```powershell
docker compose --profile maintenance run --rm backend-bootstrap --email <admin-email> --name "<administrator name>"
```

This target runs `node scripts/bootstrap-admin.js` as the production non-root
user. It requires the target's `DATABASE_URL`, `JWT_SECRET`, HTTPS
`FRONTEND_URL`, reviewed `TRUST_PROXY`, `EMAIL_PROVIDER`, and `VOYAGE_API_KEY` (plus SMTP settings when
SMTP is selected). It never starts with the standard stack and never seeds demo
users/topics. Do not use it for real departmental users in this phase.

## Liveness, readiness, proxy, and timing

Compose restarts the backend based on `GET /api/v1/health`: that endpoint proves
the Node process can answer, not that PostgreSQL or Voyage is usable. Admit
traffic only after same-origin `GET /api/v1/readiness` reports HTTP 200 with
`ready`; it requires database and safe Voyage availability. A transient Voyage
readiness failure must not cause a container restart or an SBERT fallback.

Nginx has a 6 MiB multipart request envelope so a backend-allowed 5 MiB file
can include multipart boundaries and form fields; the backend remains the
authoritative 5 MiB file enforcer. It also has 300-second client/send and
upstream read/send timeouts. The measured bulk provisioning operation is about **142
seconds**. The outer edge/platform request budget must be at least **180
seconds** and is configured/recommended at **300 seconds**; a hidden lower edge
timeout blocks release.

The backend's separate lifecycle drain is **300 seconds**. Compose gives it a
**330-second** `stop_grace_period` so bounded HTTP close and Prisma cleanup can
finish before forced termination. `frontend` and `postgres` use 300-second stop
grace periods. A production platform must preserve at least the same backend
termination allowance.

When an upstream HTTPS edge terminates TLS, it must sanitize and provide the
public `X-Forwarded-Proto`. Nginx preserves that verified value across its
internal HTTP hop. Set `TRUST_PROXY` only to the actual reviewed hop count or
proxy CIDR set; never use `true` or `*`, and never allow direct client access to
the backend where forwarding headers could be forged.

## Logs, temporary files, and shutdown

Use normal Compose logs for the operational sink:

```powershell
docker compose logs --tail=80 backend
docker compose logs --tail=80 frontend
docker compose down
```

The application writes Console/stdout/stderr plus fixed local
`logs/error.log` and `logs/combined.log`; the latter are nondurable container
files. `LOG_FILE` is not consumed by the active logger and must not be used as
a retention setting. Centralized observability is deliberately outside this
phase.

Administrative import files are temporary `tmp/imports` files cleaned in
controller `finally` blocks. No durable upload/object-storage volume is part of
this Compose contract. Do not treat leftover interrupted-container temp files
as records.

`docker compose down -v` removes the named local database volume. Use it only
when intentionally discarding local, non-production state; it is not a
deployment rollback mechanism.

## Boundaries

This Compose path does not prove public HTTPS, a provider-level SMTP delivery,
real users/data, backups/restores, centralized observability, or zero-downtime
rollouts. Use synthetic data only in staging, keep the staging database and
secrets separate from the defence database, and record `REAL SMTP PROVIDER
SMOKE PENDING` until a controlled provider smoke is actually performed.
