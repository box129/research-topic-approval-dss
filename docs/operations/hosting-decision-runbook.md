# Hosting Decision Runbook

**Audience:** the operator who will act once the Department of Public Health
selects a hosting route. **Not** a proposal. Every step below is what actually
has to happen, in order, for the accepted application tree to run somewhere
other than the developer's machine.

**Accepted application tree:** branch `staging/render-acceptance`, commit
`ff833cf0bc645bd4678bf480bb3c4070216f78cf`.

**Applies equally to both routes:**

- Hosting is a departmental/institutional decision. Nothing in this document
  authorises spending or provisioning.
- Whatever the route, **no real departmental data enters the system until a
  synthetic acceptance has passed on that hosting** (checklists A4 / B4).
- The application contract is provider-neutral: HTTPS in front, a private
  Node/Express backend, PostgreSQL, outbound HTTPS to the semantic provider,
  optional outbound SMTP. Nothing below requires a specific vendor except where
  the Render route names Render's own mechanisms.
- Production migrations use **`prisma migrate deploy` only**. Never
  `prisma db push`, never `prisma migrate dev`, never an automatic seed.

Related contracts this runbook relies on (do not duplicate them; read them):
[deployment runbook](../deployment/deployment-runbook.md) ·
[environment matrix](../deployment/environment-matrix.md) ·
[Compose contract](../deployment/docker-compose.md) ·
[backup and restore](../deployment/backup-and-restore-runbook.md) ·
[secrets management](../deployment/secrets-management.md) ·
[Render staging runbook](../deployment/render-staging-runbook.md) ·
[container runtime acceptance](../deployment/container-runtime-acceptance.md).

---

# OPTION A — UNIOSUN ICT HOSTING

## A1. Information to request from ICT

Ask for these in ICT's own terms. Do not frame the request around any cloud
provider's vocabulary.

| Area | What to ask | Why it matters |
| --- | --- | --- |
| Server / VM | Linux distribution and version; whether it is a VM or shared host; who holds root | The runtime is Linux containers or a Node/Nginx install; root access decides who can deploy |
| CPU | Physical cores available to the application | Password hashing for bulk onboarding is CPU-bound; sizing determines how long a 650-account intake takes |
| RAM | Memory guaranteed to the application | Backend ~512 MB working set plus PostgreSQL |
| Disk / storage | Size, type, and whether it is backed up | PostgreSQL data and logical backups |
| PostgreSQL | Is a managed PostgreSQL available, or will the application run its own container? | The application needs PostgreSQL **16** (or the version the migrations were proven on) |
| Database version | Exact major version | Backup tooling must match the server major version |
| Backup facilities | What ICT backs up, how often, retention, restore procedure | Determines whether the application's own logical backups are the only backups |
| DNS / subdomain | Can ICT allocate an institutional subdomain (for example under the university domain)? | The browser origin must be one fixed HTTPS name |
| HTTPS / TLS | Who issues and renews certificates; is there a central TLS terminator | The application requires HTTPS at the public edge; it does not terminate TLS itself |
| Reverse proxy | Is there an institutional reverse proxy in front of applications? What is its request timeout? | The proxy must allow **≥ 600 s** for one administrative request (see A2) |
| Outbound HTTPS | Can the server reach `api.voyageai.com` on 443? | Semantic similarity is a hosted provider call; without egress there is no similarity |
| Outbound SMTP | Is there an institutional mail relay, or an approved external provider? | Lecturer/admin invitations and password reset need email; student onboarding does not |
| Firewall rules | Inbound: 443 only to the edge. Internal: backend and database not reachable from outside | Backend and PostgreSQL are private services |
| Network topology | Public vs private segments; whether the proxy and the application share a private network | Fixes the exact proxy hop count the backend must trust |
| Administration ownership | Who patches the OS, who restarts services, who holds credentials | Decides the responsibility split in A5 |
| Monitoring | What ICT monitors (host up/down, disk, certificates) and how alerts reach people | The application exposes `/api/v1/health` and `/api/v1/readiness` for this |
| Log retention | Where container/application logs go and for how long | Audit and incident review |
| Recovery responsibility | Who restores after a host or database failure, and the expected time | The application ships restore tooling; someone must own running it |
| Maintenance windows | When restarts are acceptable | Restarts must never coincide with bulk onboarding |

## A2. Minimum application requirements

The accepted production architecture, stated without vendor assumptions.

**Runtime components**

| Component | Runtime | Notes |
| --- | --- | --- |
| Frontend | Nginx serving the built React/Vite bundle; proxies `/api/*` to the backend | Image `frontend/Dockerfile`; runs unprivileged on port 8080 |
| Backend | Node.js 20, Express | Image `backend/Dockerfile`; runs as non-root user `app` on port 3000; **single instance** |
| Database | PostgreSQL 16 | Private network only |
| External | Voyage AI over HTTPS (`voyage-4-large`) | Required; no SBERT, no FastAPI, no fallback |
| External | SMTP relay | Optional capability; see "Email" below |

**Ports and connectivity**

| Path | Requirement |
| --- | --- |
| Internet → edge | 443 (HTTPS) only |
| Edge → frontend | HTTP to Nginx on 8080 (private) |
| Frontend → backend | HTTP to 3000 (private); Nginx resolves the backend by service name and re-resolves on change |
| Backend → PostgreSQL | 5432 (private) |
| Backend → Voyage | outbound 443 |
| Backend → SMTP | outbound relay port as provided |
| Backend and PostgreSQL | **never published** to the public network |

**Reverse proxy and HTTPS**

- The public origin must be **one exact `https://` name**; the backend is
  started with that value as `FRONTEND_URL`. Cookies are `Secure` and
  `HttpOnly`; the CSRF guard compares request origin to that value.
- Every hop must tolerate **at least 600 seconds** for one request. The
  650-account bulk onboarding was measured at ~324 s (worst 388.6 s) and the
  backend sends no bytes until it finishes, so an "inactivity" timeout behaves
  as a total deadline. The frontend Nginx is shipped at 660 s; the institutional
  proxy must match or exceed it.
- `TRUST_PROXY` must be the **exact** number of trusted proxy hops (or CIDR
  set) in front of the backend, determined by inspecting what actually
  arrives — never `true`, never a guess.

**Environment variables** (names; values per the environment matrix)

Required: `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_SECRET`,
`FRONTEND_URL`, `TRUST_PROXY`, `VOYAGE_API_KEY`, `EMAIL_PROVIDER`.
When email is enabled: `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASSWORD`.
Tuning (defaults are the accepted values): `VOYAGE_REQUEST_TIMEOUT_MS`,
`VOYAGE_READINESS_PROBE_CACHE_MS`, `VOYAGE_READINESS_STALE_GRACE_MS`,
`SHUTDOWN_GRACE_PERIOD_MS`, rate-limit variables, `BULK_HASH_CONCURRENCY`,
`LOG_LEVEL`. Frontend image: `BACKEND_UPSTREAM`, `PROXY_TIMEOUT`,
`BACKEND_RESOLVER_FLAGS`. Secrets are injected at runtime and never baked into
images or committed.

**Database migration command**

```
docker compose --profile maintenance run --rm backend-migrate
# equivalent, from backend/: npm run prisma:migrate:deploy
```

Runs `prisma migrate deploy` with the pinned Prisma CLI. Fourteen migrations
exist at the accepted commit; a second run must report "up to date". Nothing
seeds data.

**First-admin bootstrap** (operator-only, once, never at startup)

```
docker compose --profile maintenance run --rm backend-bootstrap \
  --email <admin-email> --name "<administrator name>"
```

Prints a one-time temporary password to the operator's terminal only. It must
be changed at first login and must never be written to a file, ticket, or chat.

**Persistent storage**

- PostgreSQL data directory — the only state that must persist.
- Backend: no persistent uploads (import files are transient), logs to stdout.
- Frontend: stateless.

**Shutdown behaviour**

- On SIGTERM the backend stops accepting connections and drains for up to
  `SHUTDOWN_GRACE_PERIOD_MS` (300 s); the process supervisor must allow **more**
  than that (Compose uses 330 s).
- A worst-case bulk onboarding can outlive the drain window. **Operational
  rule: no restart or deploy during bulk onboarding.** If a client is cut off
  mid-commit, the accounts still exist but the one-time credential manifest is
  lost; recovery is per-user credential reset or invitations.

**Backup / restore expectations**

- Logical backups with the shipped tooling (`npm run db:backup` /
  `npm run db:restore`), which needs PostgreSQL **16 client binaries** and
  passes the password via environment only.
- Restore is rehearsed into a **separate scratch database**, never over the
  live one, and verified (users, submissions, topics, embeddings, migration
  state) before it is trusted.
- Retention, schedule and off-host copies are ICT decisions; the application
  does not decide them.

**Email**

Students are identified by matric number and may have no email; **student
onboarding does not depend on email**. Email is still required for lecturer and
administrator invitations and for self-service password reset. If ICT provides
no relay, run with `EMAIL_PROVIDER=disabled` and provision lecturers/admins by
handing over one-time credentials instead of invitations.

## A3. ICT deployment sequence

1. ICT provisions the environment (host, network segment, storage) per A1.
2. DNS/subdomain configured to the public edge.
3. HTTPS established at the edge; certificate renewal owner named.
4. PostgreSQL 16 database created on the private network; credentials issued to
   the application only.
5. Application secrets supplied through ICT's secret mechanism (environment
   file readable only by the service account, or an equivalent) — never in Git,
   never in a ticket.
6. Migrations run: `prisma migrate deploy` via the maintenance target; second
   run reports "up to date".
7. Frontend and backend deployed from the accepted images/tree; backend
   started with `FRONTEND_URL`, `TRUST_PROXY` set to the observed topology.
8. First administrator bootstrapped (A2); forced password change completed
   immediately.
9. `/api/v1/health` (200) and `/api/v1/readiness` (200 `ready` once Voyage has
   verified) checked **through the public edge**, not from localhost.
10. Synthetic acceptance conducted (A4) with fictitious accounts and topics.
11. Backup taken and **restore rehearsed** into a scratch database.
12. SMTP verified with an approved test recipient, where a relay exists.
13. Voyage connectivity and capacity verified under a realistic synthetic burst;
    rate limiting recorded.
14. Public Health approval for the pilot recorded.
15. Real departmental onboarding begins **only after** 10–14 pass. The
    synthetic accounts are removed first.

## A4. ICT acceptance checklist

Record PASS/FAIL with the date and who observed it. Synthetic data only.

| # | Check | Pass condition |
| --- | --- | --- |
| 1 | HTTPS | Public origin serves HTTPS with a valid certificate; HTTP not served or redirected |
| 2 | Login | Administrator signs in through the public origin; session cookie is `Secure`/`HttpOnly` |
| 3 | Matric-number student login | A student created with a matric number and **no email** signs in by matric |
| 4 | Lecturer/admin email login | Lecturer and admin sign in by email |
| 5 | No-email student provisioning | Admin creates a student without email; one-time credential shown once; forced change at first login |
| 6 | Similarity check | Check My Topic returns a result with plain-language level and related topics; empty corpus is reported truthfully |
| 7 | Structured submission | A submission with population/location/study focus is accepted and shows that context afterwards |
| 8 | Revision / resubmission | Lecturer requests revision **with** rationale; student sees action required; revises; new linked submission appears |
| 9 | Lecturer approval | Approval succeeds and the approved topic appears in the current-session repository |
| 10 | PostgreSQL persistence | Restart backend; data unchanged |
| 11 | Backup | Logical backup produced; non-empty; no credential in output |
| 12 | Restore | Backup restored into a scratch database; counts match |
| 13 | Health | `/api/v1/health` 200 via public edge |
| 14 | Readiness | `/api/v1/readiness` 200 `ready`; database `available`; provider `available` |
| 15 | SMTP | Invitation and reset mail delivered to the approved test recipient (or `disabled` recorded) |
| 16 | Voyage connectivity | Similarity works; readiness shows provider available; 429s, if any, recorded |
| 17 | Logging | Structured request logs with request IDs; no secrets, vectors or credentials in logs |
| 18 | Graceful restart | SIGTERM drains; no 5xx during an idle restart |
| 19 | Long bulk-onboarding request | A ~650-row synthetic user import commits through the public edge without a proxy timeout; replay creates zero duplicates |

## A5. Responsibilities

This divides responsibilities; it does **not** assert that any support
arrangement has been agreed. Agreement is a departmental/ICT matter.

| Party | Responsible for |
| --- | --- |
| **UNIOSUN ICT** | Infrastructure, operating system, network and firewall, TLS/DNS, PostgreSQL operations, backups and their retention, uptime and restarts, monitoring, log retention, recovery execution |
| **Department of Public Health** | User records and account ownership (who is a student/lecturer/admin), topic data and its accuracy, administrative policy (who may approve, when sessions change), authorising pilot and production use |
| **Application maintainer** | The deployment artifact (accepted tree/images), configuration guidance, application updates and migrations, defect fixes, this documentation |

---

# OPTION B — MANAGED RENDER HOSTING

## B1. Existing prepared architecture

Defined in `render.yaml` at the accepted commit; **nothing has been
provisioned**.

| Resource | Type | Notes |
| --- | --- | --- |
| `rtadss-staging-frontend` | Render **web** service (public) | Nginx + SPA; HTTP health check on `/`; proxies `/api` to the private backend |
| `rtadss-staging-backend` | Render **private** service (`pserv`) | No public URL; reached only over Render's private network; platform TCP health only |
| `rtadss-staging-db` | Render PostgreSQL 16 | Private; connection string injected by reference |

Region **Frankfurt** for all three (private networking is regional). Backend
**1 instance**. **Auto-deploy OFF** on both services — a deploy during a bulk
onboarding would cut the request off.

## B2. Render provisioning sequence

1. Department approves the recurring cloud cost (see B5).
2. The department/university creates or owns the Render workspace and payment
   method where possible, and grants the operator access — hosting should not
   depend permanently on the student developer's personal account.
3. Apply the existing Blueprint (`render.yaml` from
   `staging/render-acceptance`).
4. Provide the `sync: false` secrets through Render's dashboard/secret store
   (names in B3). Never paste them into Git or chat.
5. Let Render create the database, the private backend and the public frontend.
6. Capture the assigned frontend HTTPS hostname.
7. Replace the bootstrap `FRONTEND_URL` value with that exact `https://` origin.
8. Observe the actual proxy chain: inspect `X-Forwarded-For` /
   `X-Forwarded-Proto` and `req.ip` for a real request through the public edge.
9. Determine the exact `TRUST_PROXY` from that observation (hop count or CIDR;
   never `true`).
10. Redeploy the backend after the correct values are set (manual deploy;
    auto-deploy stays off).
11. Verify `/api/v1/health` through the public origin.
12. Verify `/api/v1/readiness` through the public origin; poll it at least
    every two minutes during acceptance (readiness cache 5 min + 1 min grace).
13. Verify real SMTP delivery to an approved test recipient.
14. Run the synthetic hosted acceptance (B4).
15. Run the 650-user synthetic bulk onboarding through the public edge and
    record the duration and that no hop timed out.
16. Assess Voyage rate-limit capacity under a realistic burst; record 429s and
    recovery. If throttling repeats, record **VOYAGE CAPACITY NOT ACCEPTED**.
17. Verify backup/recovery: run the logical backup tooling against the staging
    database and restore into a **separate** temporary database; delete it
    afterwards. Also record Render's managed backup/PITR for the chosen plan.
18. Only then consider real departmental data — and only with the department's
    written authorisation.

## B3. Environment variables (names only)

Backend service:

| Kind | Variables |
| --- | --- |
| **secret** (`sync: false`, supplied in Render) | `VOYAGE_API_KEY`, `SMTP_USER`, `SMTP_PASSWORD` |
| **sensitive configuration** (`sync: false`) | `FRONTEND_URL`, `TRUST_PROXY`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` |
| **generated by Render** (`generateValue: true`) | `JWT_SECRET` |
| **provider-derived** | `DATABASE_URL` ← `fromDatabase(rtadss-staging-db.connectionString)` |
| **literal configuration** (in the Blueprint) | `NODE_ENV`, `PORT`, `API_VERSION`, `CORS_CREDENTIALS`, `VOYAGE_REQUEST_TIMEOUT_MS`, `VOYAGE_READINESS_PROBE_CACHE_MS`, `VOYAGE_READINESS_STALE_GRACE_MS`, `SHUTDOWN_GRACE_PERIOD_MS`, `EMAIL_PROVIDER`, `SMTP_TIMEOUT_MS`, `INVITATION_EXPIRES_HOURS`, `RESET_TOKEN_EXPIRES_MINUTES`, `LOG_LEVEL` |

Frontend service:

| Kind | Variables |
| --- | --- |
| **provider-derived** | `BACKEND_UPSTREAM` ← `fromService(rtadss-staging-backend.hostport)` |
| **literal configuration** | `PROXY_TIMEOUT` (660s), `BACKEND_RESOLVER_FLAGS` |

The staging `JWT_SECRET` is Render-generated and must never be reused for
production. Staging SMTP and database credentials are staging-only.

## B4. Render acceptance checklist

| # | Check | Pass condition |
| --- | --- | --- |
| 1 | Frontend HTTPS | Assigned hostname serves HTTPS |
| 2 | Private backend | Backend has no public URL; reachable only via the frontend proxy |
| 3 | PostgreSQL connectivity | Backend readiness reports database `available` |
| 4 | Migrations | Pre-deploy `prisma migrate deploy` applied 14 migrations; second deploy reports none pending |
| 5 | `FRONTEND_URL` | Set to the exact assigned origin before any account is bootstrapped |
| 6 | CORS | Same-origin; no wildcard; cross-origin request refused |
| 7 | CSRF | Request with a foreign `Origin` refused |
| 8 | Cookies | `Secure`, `HttpOnly`, `SameSite=Lax` on the session cookie |
| 9 | `TRUST_PROXY` | Observed hop count; forged `X-Forwarded-For` from outside not trusted; HTTPS recognised |
| 10 | `/health` | 200 via public origin |
| 11 | `/readiness` | 200 `ready` via public origin; monitored ≤ 2 min |
| 12 | SMTP | Real provider delivery to approved recipient |
| 13 | Invitations | Lecturer invitation delivered and accepted |
| 14 | Reset | Password reset delivered and completed for a user with email |
| 15 | No-email student | Provisioned, credential handed over, signs in |
| 16 | Matric login | Student signs in by matric |
| 17 | Revision lifecycle | Request revision (rationale required) → revise → linked resubmission → approve |
| 18 | Structured semantic representation | Submission stores population/location/study focus; lecturer check runs on it |
| 19 | 650-user bulk operation | Completes through the public edge; replay creates zero duplicates |
| 20 | ≥ 600 s long-request path | No hop cuts the bulk request |
| 21 | Voyage realistic burst | Requests/429s/retries/recovery recorded; fail-closed behaviour observed |
| 22 | Backup / recovery | Logical backup + restore into a separate temporary database verified; managed backup capability recorded |
| 23 | Logs | Structured, correlated, no secrets |
| 24 | Graceful shutdown | Manual deploy while idle produces no 5xx; **no deploy during bulk onboarding** |

## B5. Cost / ownership notes

- Managed hosting carries a **recurring provider cost** for the database and
  both services; pricing can change without notice. A departmental estimate is
  kept separately in `docs/deployment/departmental-pilot-cost-estimate.md`;
  confirm current prices before approval.
- The Render workspace and payment method should belong to the department or
  university, not depend permanently on the student developer.
- Staging uses **synthetic data only**.
- Production onboarding of real departmental records requires written
  authorisation after the acceptance checklist passes.
