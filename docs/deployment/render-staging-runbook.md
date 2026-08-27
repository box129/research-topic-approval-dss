# Render Hosted Staging Runbook

> **Status: PREPARED, NOT EXECUTED.**
> This is the provider adapter and operating procedure for hosted staging on
> Render. **No Render deployment has been performed**, so nothing in this
> document is evidence. Every acceptance item in Phase 8B remains unproven until
> the steps below are actually run and their output recorded.
>
> Keep this document separate from the provider-neutral
> [Compose contract](./docker-compose.md) and
> [environment matrix](./environment-matrix.md). Render is a staging host, not
> an architectural dependency: the application contract must remain runnable on
> any platform that supplies HTTPS, private networking and managed PostgreSQL.

## What must be supplied before this can run

Hosted staging cannot proceed without these. They are deliberately not in Git.

| Item | Why | Status |
| --- | --- | --- |
| Render account access (dashboard or API key) | Create the Blueprint services and database | **missing** |
| Authorisation to provision **paid** resources | The database and backend plans are billable | **missing** |
| Staging SMTP provider credential | Part P — real provider delivery is mandatory and has never been proven | **missing** |
| Authorised test recipient mailbox | Receive invitation/reset mail without touching departmental addresses | **missing** |
| Staging Voyage credential (or authorisation to use the existing one) | Semantic provider under hosted load | to confirm |

## Architecture

```text
Internet
  -> Render HTTPS edge (TLS terminated by Render)
       -> PUBLIC  web service   rtadss-staging-frontend   (Nginx: SPA + /api proxy)
            -> Render private network
       -> PRIVATE private service rtadss-staging-backend  (Node/Express, no public URL)
            -> Render managed PostgreSQL 16 (private connection string)
            -> Voyage AI            (outbound HTTPS)
            -> staging SMTP provider (outbound TLS)
```

Single backend instance. No Redis, no SBERT, no FastAPI semantic service, no
persistent upload volume. The browser security model stays same-origin: the SPA
and `/api/*` share one hostname, so cookies remain `Secure`, `HttpOnly`,
`SameSite=Lax` and the CSRF origin guard keeps working unchanged.

## Region

**Frankfurt**, for the database and both services. Render private networking is
regional — splitting services across regions breaks the private link, so all
three resources must share one region. Record the actual region if account
constraints force a different choice.

## Blueprint

`render.yaml` at the repository root defines the database, the private backend
and the public frontend. It contains **no secret values**: credentials are
either `generateValue: true` (the staging JWT secret) or `sync: false` (supplied
in the dashboard).

Discovery uses service references, never generated hostnames:

| Wiring | Mechanism |
| --- | --- |
| Backend → database | `fromDatabase: { name: rtadss-staging-db, property: connectionString }` |
| Frontend → backend | `fromService: { name: rtadss-staging-backend, type: pserv, property: hostport }` |

`FRONTEND_URL` is `sync: false` rather than a reference, because Render assigns
the public hostname at creation time and the Blueprint format cannot build
`https://<host>` from a reference. Set it to the exact assigned HTTPS origin
immediately after the frontend service first exists, before bootstrapping any
account — invitation and reset links are built from it.

**No Render resources have been provisioned from this Blueprint.** Field usage
has been checked against Render's current Blueprint specification, and one round
of real validator feedback has been applied:

| Drift reported | Correction |
| --- | --- |
| `pserv service type cannot have a health check path` | `healthCheckPath` removed from the backend; it is a `type: web`-only field. The private backend now uses Render's default TCP health check. |
| `autoDeploy` deprecated | Replaced with `autoDeployTrigger: off` on both services (allowed values: `commit`, `checksPass`, `off`). |

Remaining fields verified against the published specification: `pserv`, service
plans `standard`/`starter`, database plan `basic-256mb`, `region: frankfurt`,
`maxShutdownDelaySeconds` (valid on web/pserv/worker, integer 1–300, so 300 is
the maximum), `numInstances`, `preDeployCommand`, `fromDatabase` property
`connectionString`, `fromService` property `hostport`, `postgresMajorVersion` as
a string, `ipAllowList`, `generateValue`, and `sync: false`.

If Render rejects a further field, correct the field narrowly — do not weaken
the architecture to satisfy it.

## Frontend → private backend wiring

The frontend image renders `/etc/nginx/conf.d/default.conf` at container start
from `frontend/nginx.conf.template`, so the backend address comes from the
deployment rather than the image:

| Variable | Compose default | Render |
| --- | --- | --- |
| `BACKEND_UPSTREAM` | `backend:3000` | `fromService` hostport of the private backend |
| `NGINX_LOCAL_RESOLVERS` | auto-detected `127.0.0.11` | auto-detected Render internal DNS |
| `BACKEND_RESOLVER_FLAGS` | `ipv6=off` | confirm against Render's internal DNS records |
| `PROXY_TIMEOUT` | `660s` | `660s` |

`NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1` makes the image read the container's own
`/etc/resolv.conf`, so upstream re-resolution works on any platform's service
DNS without naming it. This matters: an Nginx tier with a static upstream pins
the address resolved at startup and returns 502 after the backend is replaced —
observed directly during local container acceptance.

`NGINX_ENVSUBST_FILTER` restricts substitution to those four names so Nginx's
own runtime variables (`$host`, `$remote_addr`, `$request_uri`) survive.

No public backend URL is embedded in the frontend bundle: the SPA calls the
relative `/api/v1` base only.

## Request budget

Runtime acceptance measured ~324 s for a 650-account onboarding request (worst
observed 388.6 s) and established that **every hop must tolerate at least 600
seconds**. The backend sends no bytes until the operation completes, so an
"inactivity" timeout behaves as a total deadline for this request.

| Hop | Setting | Value |
| --- | --- | --- |
| Render edge | platform | supports long responses; confirm the account's actual limit |
| Frontend Nginx | `PROXY_TIMEOUT` | **660 s** (600 s floor plus margin) |
| Backend | application | no request timeout; drain governed by `SHUTDOWN_GRACE_PERIOD_MS` |

The deployment contract test asserts the 600-second floor numerically, so this
cannot silently regress. **Verify it by running the operation, not by reading
the configuration.**

## Migrations

Pre-deploy command: `npm run prisma:migrate:deploy`. Never `db push`, never
`migrate dev`. A migration failure must fail the deploy rather than start a
backend against an unmigrated schema. Confirm a second deploy reports no pending
migrations, and that nothing seeds data or creates an administrator implicitly.

## Health and readiness

Render supports an HTTP `healthCheckPath` on **`type: web` only**; it rejects
the field on a private service. The Blueprint therefore declares a health check
path on the frontend and **none** on the backend.

**Platform health for the private backend is TCP-based.** Render checks that the
service accepts a connection on its listening port. That is a restart signal
only, and it is deliberately weaker than the application contract: a TCP accept
proves the socket is open, not that the process can answer a request, reach
PostgreSQL, or reach Voyage.

The application's own endpoints are unchanged and remain the authority:

| Endpoint | Meaning | Who checks it |
| --- | --- | --- |
| `/api/v1/health` | Liveness — the Node process can answer | verified explicitly during acceptance |
| `/api/v1/readiness` | Database + Voyage + truthful email capability | monitored continuously during acceptance |

Because the platform probe is only TCP, **both endpoints must be exercised
explicitly through the public frontend origin during hosted acceptance** rather
than assumed from a green platform indicator. Readiness must never be wired to a
platform restart probe on any service — a Voyage blip must not cycle the
container.

Readiness uses a bounded stale-while-revalidate window:

| Setting | Value |
| --- | --- |
| `VOYAGE_READINESS_PROBE_CACHE_MS` | 300000 (5 min) |
| `VOYAGE_READINESS_STALE_GRACE_MS` | 60000 (1 min) |
| Maximum tolerated staleness | 360 s |
| **Required monitor interval** | **≤ 120 s** |

Poll readiness at least every two minutes. If the endpoint is left completely
idle past cache + grace, last-known-good expires and readiness correctly returns
503 until re-verified — observed locally. This is the model behaving correctly;
do not change the readiness model to suit the monitor.

## TRUST_PROXY

**Must be determined empirically on Render, not guessed.** Inspect what actually
arrives at the backend for a real request through the public edge:

- `req.ip`
- `X-Forwarded-For` (how many hops does Render prepend?)
- `X-Forwarded-Proto`
- any Render/Cloudflare request headers present

Then set `TRUST_PROXY` to that observed hop count or trusted CIDR set. Never
`true`, never `*` — startup validation rejects both. Verify a forged
`X-Forwarded-For` from an outside client cannot become the trusted client
identity, and that HTTPS is still recognised. Record the value and the evidence.
Do not assume the production chain will be identical without re-verifying.

## Shutdown and the deployment lockout rule

Render's maximum configurable graceful shutdown delay is **300 seconds**. The
application's own drain is 300 s, and a worst-case bulk commit has been measured
above that.

> **Operational rule: NO DEPLOY DURING BULK ONBOARDING.**

Auto-deploy is disabled in the Blueprint for exactly this reason. Do not claim
the shutdown window can always drain a worst-case bulk commit — it cannot.

If a client connection disappears mid-commit (edge timeout, deploy, operator
cancels), the known behaviour is: the transaction still commits, the accounts
are valid and `mustChangePassword`, but the one-time credential manifest is lost
with the response. Recovery is Phase-4 bulk invitations or per-user credential
reset. **Never persist plaintext manifests as a workaround.** Verify on staging
that replay creates zero duplicates and yields no credentials.

## Administrator bootstrap

Run the operator-only bootstrap once against the staging database. The temporary
credential must never enter Git, documentation, Render environment variables, or
logs. Complete the forced password change immediately, then confirm normal admin
login. Treat every staging credential as disposable.

## SMTP

Use a dedicated staging SMTP credential and an explicitly authorised test
recipient — never a departmental address. The backend plan must permit outbound
SMTP; do not run the sending backend on a free instance. Record the plan used.
Mark delivery `VERIFIED AGAINST REAL PROVIDER` only if an external provider
actually accepted and delivered the messages.

## Voyage

Quota is an explicit acceptance gate. Under a synthetic burst (historical
import, similarity checks, submission, review), record request count, 429 count,
retry behaviour, total latency, whether writes fail closed, and provider
recovery. Throttling is distinguishable in logs and readiness as
`VOYAGE_RATE_LIMITED`. If the account repeatedly rate-limits under the staging
workload, record **VOYAGE CAPACITY NOT ACCEPTED** and report the required next
action. Never introduce fallback vectors, never change the model.

## Backup and restore

Run the Phase-7 logical backup tooling against the staging database. It needs
Node plus **PostgreSQL 16 client binaries** (a version-mismatched `pg_dump`
refuses to dump a newer server). Verify the archive is non-empty and that no
credential appears in output — the tooling passes the password via `PGPASSWORD`
only.

Restore into a **separate** temporary Render database, never over staging. The
restore tooling refuses a non-scratch target name unless explicitly
acknowledged. Verify users, submissions, decisions, historical and current
topics, embeddings, audit records and Prisma migration state, then delete the
temporary database once evidence is captured. Also record Render's own managed
backup/PITR capability for the chosen paid plan.

## Secrets

Staging-specific throughout: its own JWT secret (platform-generated), its own
SMTP credential, its own database credential. **Do not reuse the future
production JWT secret.** Production-bound credentials must be rotated and
installed separately when the production environment is created.
