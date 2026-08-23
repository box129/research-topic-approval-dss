# Production Deployment Runbook

> **Authoritative Phase 6 deployment contract.** This is the current deployment
> runbook for the Voyage-backed system. It supersedes older SBERT, Hugging Face,
> Render, and Vercel deployment instructions where they conflict. Historical
> evidence is retained in this repository, but it is not a production recipe.

## Scope and deployment decision

The initial controlled departmental deployment is intentionally **single-instance**:

```text
Browser
  -> HTTPS edge / reverse proxy
  -> frontend Nginx (SPA files and same-origin /api proxy)
  -> private Node/Express backend (one instance)
       -> private PostgreSQL
       -> Voyage AI over outbound HTTPS
       -> SMTP provider over configured secure SMTP
```

Only the HTTPS edge and frontend Nginx are public. The backend and PostgreSQL
are reachable only on the private deployment network. The frontend uses relative
`/api/...` requests, so the browser sees one HTTPS origin for pages, cookies,
reset/invitation links, and API requests.

This topology is deliberately simple for the expected initial scale (about 600
students, 50 lecturers, and thousands of topic records). It is compatible with
the application’s process-local rate-limit store and Voyage readiness cache only
while there is one backend instance. Do not add a second backend replica until a
shared rate-limit store or equivalent gateway policy, and a deliberate
multi-instance readiness strategy, are in place.

Production requires Node/Express, PostgreSQL, Nginx/static serving, outbound
HTTPS to Voyage, and configured SMTP when email delivery is enabled. It does
**not** require FastAPI SBERT, Hugging Face model downloads, a model cache, or
deterministic fallback embeddings. The semantic contract remains Voyage
`voyage-4-large`, 1024 dimensions, and `structured-context-v1`; this runbook
does not change semantic methodology or thresholds.

This phase does not admit real departmental data or real departmental users. It
does not perform the backup/restore drill, deploy centralized observability, buy
hosting or SMTP, or create incident/on-call tooling.

## Prerequisites

Before a staging or production-like release, the deployment owner must provide:

- a private PostgreSQL database and a least-privilege application credential;
- a public HTTPS origin and an edge capable of redirecting HTTP to HTTPS;
- a reviewed secret store for `DATABASE_URL`, `JWT_SECRET`, and
  `VOYAGE_API_KEY`, plus SMTP credentials when applicable;
- a container runtime capable of building/running the backend and frontend
  images, a persistent PostgreSQL volume or managed database, and controlled
  process termination;
- outbound HTTPS from the backend to Voyage and outbound secure SMTP to the
  selected provider when `EMAIL_PROVIDER=smtp`;
- health and readiness probes, log collection from stdout/stderr, and a
  platform/proxy request timeout that satisfies the long-request requirement
  below.

Use the [environment matrix](./environment-matrix.md) as the authoritative
variable list. Do not copy an example `.env` into a secret store without
replacing every placeholder.

## Long-running administrative request requirement

A 650-user bulk-provisioning request measured approximately **142 seconds** on
the development laptop. The initial platform must support this legitimate
synchronous operation.

- Absolute minimum request and upstream proxy allowance: **180 seconds**.
- Required configured target for Nginx, edge/load balancer, platform, and any
  client timeout: **300 seconds**.
- Backend process draining is a separate **300-second** lifecycle budget; its
  outer container/platform termination allowance must be at least **330
  seconds** so Prisma cleanup can complete.
- Do not choose a hosting platform whose hard request cap is below 180 seconds
  unless the application is changed in a separately scoped job-queue project.

The frontend, Nginx, edge proxy, backend request policy, and platform idle
timeout must all meet the same contract. A lower hidden proxy timeout is a
release blocker even if direct backend testing succeeds.

## Environment and secret preparation

1. Create a new secret set for the target environment. Staging secrets must be
   distinct from future production secrets where practical.
2. Set `NODE_ENV=production` for production-like staging and production.
3. Set `FRONTEND_URL=https://<approved-origin>`; with the same-origin topology,
   `CORS_ORIGIN` is normally omitted. If it is supplied, it must be the same
   bare HTTPS origin, never `*`.
4. Set `TRUST_PROXY` to the exact reviewed reverse-proxy topology. Never use
   `true` or `*`.
5. Supply `VOYAGE_API_KEY` through the secret store. It is startup-fatal in
   production; the DSS must not start or accept traffic without it.
6. Set `EMAIL_PROVIDER=disabled` only for a deliberately email-disabled staging
   environment. Set `EMAIL_PROVIDER=smtp` plus complete SMTP configuration for
   email-enabled operation. `mock` is not permitted in production.
7. Keep `.env`, password manifests, database dumps, API keys, and raw user data
   outside Git and image build contexts.

## Database provisioning and migration contract

PostgreSQL is persistent state and must not share a database with the defence
baseline, prior demonstrations, or future production.

- Use PostgreSQL with TLS/SSL according to the managed provider or private
  network policy. Put provider-specific TLS parameters in `DATABASE_URL`; do
  not disable certificate verification merely to connect.
- A direct PostgreSQL connection is acceptable for the initial single backend
  instance. Use a provider pooler only after verifying Prisma compatibility,
  including the migration connection path.
- The runtime database user needs only the grants required by the application.
  The migration/release credential may require additional schema privileges and
  should be handled as a separate operator concern where the provider supports
  it.
- Migrations are an explicit release step. They use the repository-pinned
  Prisma CLI through the `backend-migrate` maintenance target; they do not run
  when the serving application starts.

For a Compose-style deployment, after PostgreSQL is healthy and before traffic
is admitted:

```powershell
docker compose --profile maintenance run --rm backend-migrate
```

The target runs `prisma migrate deploy` and exits non-zero on failure. Then
confirm migration state using the same reviewed, pinned release environment.

Do **not** run `prisma migrate dev`, `prisma db push`, a demo seed, or an
automatic administrator bootstrap in production-like environments. Prisma
migrations are forward-only: an incompatible migration is handled by a
corrective forward migration or an approved restore, never an invented
automatic destructive rollback.

## Build and release sequence

1. Confirm the branch, reviewed commit/image identity, clean release inputs,
   and that no secret or data artifact is being built.
2. Build the backend production image and frontend static-serving image. The
   backend production image must run as its non-root application user; secrets
   are injected only at runtime.
3. Validate rendered Compose/release configuration without printing secrets.
4. Provision or verify the private PostgreSQL target and its persistent storage.
5. Run the explicit `backend-migrate` release job above. Stop on any migration
   failure; do not start the new serving version.
6. Start the standard topology. The standard `docker compose up` path must not
   start legacy SBERT. If retained for research, it is opt-in only through the
   `legacy-sbert` profile.
7. Wait for backend liveness, then require backend readiness before admitting
   public traffic.
8. If an approved synthetic administrator is needed, use the explicit
   profile-only maintenance operation below. It never seeds topics/users or
   runs automatically.
9. Run the non-destructive deployment smoke checks and record sanitized
   pass/fail evidence.

For a reviewed Compose deployment, the one-off bootstrap command is:

```powershell
docker compose --profile maintenance run --rm backend-bootstrap --email <admin-email> --name "<administrator name>"
```

Run it only after migrations and backend readiness, with the target's production
`DATABASE_URL`, `JWT_SECRET`, HTTPS `FRONTEND_URL`, reviewed `TRUST_PROXY`,
`EMAIL_PROVIDER`, and `VOYAGE_API_KEY` already injected. It runs the dedicated non-root
`node scripts/bootstrap-admin.js` maintenance target; it never runs from
ordinary startup, migrations, demo seeding, or an automatic release hook.
Transfer its one-time credential through an approved secure channel.

## Health, readiness, and traffic admission

| Endpoint | Meaning | Consumer | Traffic rule |
| --- | --- | --- | --- |
| `GET /api/v1/health` | Liveness: the Node process can answer HTTP. It does not prove database, Voyage, or SMTP availability. | Container/runtime liveness probe | Do not restart solely because Voyage or PostgreSQL is temporarily unavailable. |
| `GET /api/v1/readiness` | Readiness: database and required semantic provider state are usable for real DSS traffic. | Edge/load balancer/readiness check and release smoke | Admit traffic only when it reports HTTP 200 / `ready`. |

Readiness exposes safe Voyage status only (`not_configured`,
`configured_not_yet_verified`, `available`, `unavailable`, or `stale`). A
missing, stale, or unavailable Voyage provider is degraded/not ready for real
traffic; it never authorizes lexical or fabricated-vector fallback. A liveness
success is therefore not deployment success.

## HTTPS, same-origin cookie, and proxy contract

- The browser origin is `https://<approved-origin>`. HTTP is redirected at the
  edge before cookies or credentials are used.
- Nginx serves the SPA and proxies `/api/` privately to the backend. It must
  retain SPA fallback for `/login`, `/accept-invitation`, `/reset-password`,
  and protected client routes while never sending `/api/*` to `index.html`.
- Session cookies remain `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
  Do not disable `Secure` to work around a proxy error.
- `FRONTEND_URL` is the one exact browser origin used for CORS, CSRF origin
  checking, invitation links, and reset links. Wildcards, paths, credentials,
  queries, and fragments are invalid.
- The edge and Nginx must preserve a verified forwarded-protocol/client chain.
  Do not replace HTTPS with an internal `http` value before the backend. Set
  `TRUST_PROXY` only to the exact known hop count or proxy CIDR set after
  confirming that the backend cannot be reached directly and clients cannot
  inject trusted forwarding headers. A two-proxy edge-to-Nginx chain commonly
  needs two trusted hops, but the deployment owner must validate the actual
  chain rather than copy that value blindly.

## Shutdown, restart, and rollback

The backend receives `SIGTERM` during normal container replacement and `SIGINT`
during controlled interactive termination. A production shutdown must stop
accepting new work, allow in-flight work to complete within the configured
**300-second backend drain window**, close the HTTP server, disconnect Prisma,
and force exit only after that bounded grace period. The outer
container/orchestrator termination allowance must be longer than the application
drain so cleanup can occur: configure **at least 330 seconds**. This is separate
from the 180-second minimum / 300-second target for a single long HTTP request.

For a routine restart:

1. Remove the backend from traffic using readiness/draining controls.
2. Send the platform’s normal termination signal and wait for clean exit.
3. Start the same reviewed image with unchanged target secrets and database.
4. Require liveness and readiness again before re-admitting traffic.

For an application rollback:

1. Stop/drain the failed application version.
2. Redeploy the last known-good image/commit with its compatible configuration.
3. Re-check liveness, readiness, and the smoke script.
4. If a migration is incompatible with the prior app, prefer a corrective
   forward migration. Restore requires separate owner approval and a verified
   backup; do not delete or automatically overwrite a database.

## Staging contract

Staging mirrors the same-origin production architecture with synthetic data
only. It must use:

- a staging database distinct from the defence database and future production
  database;
- staging secrets distinct from future production secrets where practical;
- a dedicated HTTPS staging origin, private backend/database networking, and
  the same `TRUST_PROXY`, cookie, CORS, CSRF, timeout, migration, restart, and
  readiness contracts;
- explicit migration, explicit synthetic administrator bootstrap, synthetic
  bulk users/topics only, Voyage connectivity, and SMTP disabled or a controlled
  safe provider/recipient smoke.

Never migrate the defence database into staging, import real departmental data,
or create real departmental accounts during this phase.

## Logging and temporary files

Containers must emit useful, redacted application logs to stdout/stderr; that is
the operational sink for this phase. The current logger additionally writes the
fixed local paths `logs/error.log` and `logs/combined.log`, but they are
nondurable container files and do not replace a later observability decision.
`LOG_FILE` is not consumed by the active logger and must not be treated as a
retention setting. Never log credentials, reset/invitation tokens, raw database
URLs, Voyage keys, SMTP passwords, raw user data, or embedding vectors.

Administrative `.xlsx` imports use a temporary `tmp/imports` directory and are
cleaned in controller `finally` blocks after preview or commit. They do not
require object storage or a durable import volume; an interrupted container may
leave only ephemeral temporary files that must not be treated as records.

## SMTP verification

`EMAIL_PROVIDER=smtp` is configuration support, not proof of delivery. Run one
controlled smoke message only when deployment-owned credentials and an
explicitly safe recipient are available. Otherwise record:

```text
REAL SMTP PROVIDER SMOKE PENDING
```

Do not purchase or select a provider automatically, and do not put SMTP
credentials or recipient data in documentation or evidence.

## Required deployment smoke evidence

The non-destructive smoke mechanism must verify:

- frontend root and SPA fallback reachability;
- same-origin `/api/v1/health` liveness;
- same-origin `/api/v1/readiness` semantic/database readiness;
- authentication route reachability without credentials in output;
- anonymous direct similarity is rejected;
- anonymous direct similarity is rejected. A separately authorized, controlled
  role-based similarity check is required before sign-off; the non-destructive
  unauthenticated smoke deliberately does not accept or emit credentials.

Record commit/image identity, sanitized configuration checklist, migration
result, liveness/readiness result, restart result, and known gaps outside Git.
Do not record secrets, tokens, private URLs where policy prohibits them, raw
database dumps, or real user data.

## Explicit prohibitions

Never use this runbook to:

- deploy SBERT/FastAPI as a required production dependency;
- run `prisma migrate dev` or `prisma db push`;
- run demo seeds or automatic administrator bootstrap;
- commit `.env` files, database URLs, credentials, or generated manifests;
- use the defence database as staging or production;
- treat an empty corpus as evidence that a topic is original;
- claim a Docker build, SMTP provider smoke, backup/restore drill, HTTPS proof,
  observability setup, or real-data readiness without actual evidence.

The next backup/observability/recovery phase is intentionally not started by
this deployment work.
