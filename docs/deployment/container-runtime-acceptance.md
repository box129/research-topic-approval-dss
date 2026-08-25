# Container Runtime Acceptance Evidence

> **Follow-up:** the two operational risks this run exposed — bulk-onboarding
> duration and the readiness cache-boundary flap — were investigated and
> corrected in
> [runtime acceptance corrections](./runtime-acceptance-corrections.md).
> Read that document alongside this one; risks 1 and 2 below are superseded by it.

> **Status: local container runtime PROVEN with synthetic data only.**
> This document records an executed acceptance run against actual Docker images
> and a running Compose stack. It is evidence of local runtime behaviour, not
> evidence of hosted staging, public HTTPS, a real SMTP provider, or approval to
> use real Public Health data.

Phase 6 established the production architecture and verified Docker/Compose
statically because no Docker daemon was available. Phase 7 proved backup and
restore through local Node/PostgreSQL processes. This run closes the remaining
gap: the images were actually built and the supported Compose topology was
actually run and exercised end to end.

## Environment

| Item | Value |
| --- | --- |
| Docker Engine / CLI | 29.5.3 (Docker Desktop, WSL2 backend) |
| Docker Compose | v5.1.4 |
| Storage driver | overlayfs |
| Host resources visible to Docker | 8 CPUs, 7.619 GiB RAM |
| PostgreSQL image | `postgres:16-alpine` (server 16.14) |
| Node runtime in images | v20.20.2 |
| Compose project | `ts-phase8a` (isolated from every other local project) |
| Scratch database | `ts_phase8a_scratch` on volume `ts-phase8a_postgres-data` |

Docker Desktop was installed but idle at the start of the run (`com.docker.service`
stopped, `docker-desktop` WSL distribution stopped, `AutoStart: false`). Starting
Docker Desktop was sufficient; **no application code was changed to work around
the local Docker installation.**

## Data and secret discipline

- Every user, topic, submission, invitation and email in this run is synthetic.
- No departmental data, no defence database, and no real departmental user.
- The scratch database is a dedicated volume in a dedicated Compose project. The
  pre-existing `topic-similarity-mvp_postgres-data` volume was never mounted.
- Secrets were generated for this run, injected at runtime only, and kept in an
  uncommitted `.env`.
- The one-time bootstrap administrator credential was captured to a temporary
  operator file, used, and then shredded and deleted. It appears in no committed
  artifact and in no log.

## Local acceptance harness (verification only, never production)

Production startup validation deliberately refuses to run with a non-HTTPS
browser origin, and issues `Secure` cookies in production. The correct response
to that rule is to supply real local TLS, not to relax the rule. Two
verification-only services therefore run from a separate overlay file:

```powershell
docker compose -f docker-compose.yml -f docker-compose.acceptance.yml up -d
```

| Service | Purpose |
| --- | --- |
| `tls-edge` | Self-signed HTTPS terminator reproducing the documented public chain `browser -> HTTPS edge -> frontend Nginx -> private backend`. |
| `mailsink` | Local SMTP capture (Mailpit) so invitation and recovery mail is proven without contracting a provider or mailing a real address. |

A plain `docker compose up` never reads the overlay, so the supported production
topology is unchanged by its presence. The self-signed key/certificate are
generated locally into a git-ignored directory and are never committed.

Because a real HTTPS edge was present, the run used the genuine production
contract throughout: `NODE_ENV=production`, `FRONTEND_URL=https://localhost:8443`,
`TRUST_PROXY=2` (edge + frontend Nginx), and `Secure` cookies. **No production
security setting was weakened to make local verification pass.**

## A. Image build

`docker compose --profile maintenance build` completed with exit code 0.

| Image | ID | Size | User | `NODE_ENV` |
| --- | --- | --- | --- | --- |
| `ts-phase8a-backend` | `15c58bc8727b` | 584 MB | `app` (uid 999) | production |
| `ts-phase8a-frontend` | `2abf0605e3bd` | 74.5 MB | `nginx` (uid 101) | n/a (static) |
| `ts-phase8a-backend-migrate` | `dfb9f4089e34` | 1.38 GB | `app` (uid 999) | production |
| `ts-phase8a-backend-bootstrap` | `2da443a3cda7` | 576 MB | `app` (uid 999) | production |

Verified by inspecting image metadata, layer history and the image filesystems:

- backend, migration and bootstrap images all run as the non-root `app` account;
  the frontend runs as `nginx` on unprivileged port 8080;
- `NODE_ENV=production` is baked into every backend-derived image;
- no `.env` file exists anywhere in any image;
- devDependencies are absent from the runtime image (`jest`, `eslint`, `nodemon`,
  `supertest`, `prettier`, `playwright` all absent);
- the frontend image contains only the static bundle — no `node`, `npm`,
  `playwright`, `chromium`, no `node_modules`, no build context;
- the migration image ships the pinned Prisma CLI 5.7.1 and all 11 migrations, so
  deployment never depends on `npx` fetching a package;
- **zero** occurrences of the Voyage key, database password or JWT secret in
  layer history, image environment, or image metadata.

The frontend build produced `assets/index-DzB0oZHP.js` and
`assets/index-B1yh3Ibo.css`, the exact asset hashes found inside the published
image, confirming the image corresponds to this source tree.

### Built frontend has no development proxy dependency

Scanning the built bundle inside the image:

- no `localhost:<port>` and no `127.0.0.1` references;
- no Vite dev/HMR markers (`@vite/client`, `import.meta.hot`);
- the only API base string is the relative `"/api/v1"`, i.e. same-origin;
- the two bare `http://localhost` strings are library internals (React Router's
  no-`window` fallback and Axios's `hasBrowserEnv` probe), not application config.

## B. Legacy SBERT is optional only

| Check | Result |
| --- | --- |
| `docker compose config --services` (no profile) | `postgres`, `backend`, `frontend` only |
| SBERT container after `docker compose up -d` | none exists |
| `sbert-service` declaration | only under `profiles: ["legacy-sbert"]` |
| Any `depends_on` edge to `sbert-service` | none anywhere in the full profile graph |
| Host port published by `sbert-service` | none |
| SBERT variable in the running backend container | none |
| Production module importing `sbert.service` | none |

No Hugging Face model download and no SBERT model cache is required for the
production topology, and no readiness, liveness or startup path depends on it.

> Naming note: `similarityScoring.config.js` still uses the field name `sbert`
> for the semantic weight slot (0.50) and `similaritySnapshot.service.js` reads
> `match?.sbert`. These are **frozen scoring-contract field labels now fed by
> Voyage**, not a runtime dependency on the SBERT service. They are deliberately
> left unchanged: the semantic contract is frozen research.

## D. Database initialisation from empty

Starting from a brand-new volume:

1. PostgreSQL 16.14 started and reached `healthy`; `public` schema contained **0 tables**.
2. `docker compose --profile maintenance run --rm backend-migrate` applied all
   **11 migrations** and exited **0**.
3. Re-running the migration job reported **"No pending migrations to apply."**;
   `prisma migrate status` reports **"Database schema is up to date!"**.
4. Immediately after migration every application table was empty:
   `users=0`, `historical_topics=0`, `current_session_topics=0`,
   `under_review_topics=0`, `submissions=0`, `categories=0`,
   `academic_sessions=0`, `system_settings=0`, `audit_logs=0`.
5. **No demo seed ran and no administrator appeared.** An ordinary
   `docker compose up -d` never migrates, seeds or creates an account.

## E. Administrator bootstrap

`docker compose --profile maintenance run --rm backend-bootstrap --email … --name …`
exited 0 on the clean database and produced exactly one administrator:

- stored as bcrypt (`$2b$`, 60 characters) — no plaintext anywhere;
- `role=ADMIN`, `status=ACTIVE`, `must_change_password=true`;
- temporary credential displayed once and never persisted in plaintext.

The full forced-change flow was then proven through the HTTPS edge (24/24 checks):

| Behaviour | Result |
| --- | --- |
| Login with wrong password | 401 |
| Login with bootstrap temporary credential | 200, signals `mustChangePassword` |
| Session cookie attributes | `HttpOnly`, **`Secure`**, `SameSite=Lax` |
| `/auth/me` while change pending | 200 (deliberately reachable) |
| Any other protected route while change pending | 403 |
| Similarity while change pending | 403 |
| Forced change with valid `Origin` | 200 |
| Login with new private password | 200 |
| Old temporary credential afterwards | 401 |
| Normal admin route after change | 200 |

## F. Health and readiness

`/api/v1/health` reflects liveness only. `/api/v1/readiness` reflects database,
Voyage and truthful email capability.

| Scenario | Readiness | Liveness | Container restarted? |
| --- | --- | --- | --- |
| All dependencies healthy | `ready`, HTTP 200 | 200 | no |
| Voyage credential invalid | `degraded`, 503, `semanticProvider: unavailable`, `VOYAGE_PROVIDER_ERROR` | 200 | no |
| Database stopped | `not_ready`, **503**, `database: unavailable` | 200 | **no** (restartCount 0 → 0, `StartedAt` unchanged) |
| Database restarted | recovered to `ready`, 200 | 200 | no |
| Voyage throttled mid-run | `degraded`, 503, `semanticProvider: unavailable` | 200 | no |
| Voyage recovered on its own | back to `available` | 200 | no |

**No dependency outage ever produced a fake healthy readiness result**, and a
dependency outage never restarted the backend — Compose health gating is
liveness-only by design, exactly as the deployment contract requires.

### Readiness stability observation (important for hosted staging)

Readiness was polled every 10 seconds for 560 seconds: 48 responses `ready`/200
and 8 responses 503. Two distinct causes, both honest:

1. **A single-sample 503 at each Voyage probe-cache boundary.** With
   `VOYAGE_READINESS_PROBE_CACHE_MS=300000`, the first readiness request after the
   cache expires returns `degraded` with `semanticProvider: "stale"` while a
   bounded refresh runs, then the next request returns `ready` again. Observed
   exactly: `t+180s ready → t+190s stale/503 → t+200s ready`.
2. **A genuine Voyage throttle** later in the run produced six consecutive
   `unavailable`/503 samples, reported truthfully and logged once as a state
   change with `failureCode: VOYAGE_PROVIDER_ERROR`.

This is correct application behaviour, but a hosted load balancer that removes an
instance after a *single* failed readiness probe would flap roughly every five
minutes. See "Remaining risks".

## G. Same-origin frontend routing

Every SPA route returned the SPA document (HTTP 200, `<div id="root"></div>`) on
direct request — i.e. browser refresh works — through the HTTPS edge and directly
against the frontend Nginx container:

`/`, `/login`, `/change-password`, `/accept-invitation`, `/reset-password`,
`/student/dashboard`, `/student/submit-topic`, `/lecturer/dashboard`,
`/lecturer/pending-review`, `/admin/dashboard`, `/admin/users`, and an arbitrary
deep nested route.

`/api/*` always reached the backend as JSON and **never** fell through to
`index.html`: `/api/v1/health` 200, `/api/v1/readiness` 200, `/api/v1/auth/me`
401, `/api/v1/does-not-exist` 404 JSON, `/api/` 404 JSON. A missing asset under
`/assets/` returned 404 rather than the SPA.

The documented `npm run docker:smoke` passed all 8 checks against the HTTPS
origin, including `readiness: ready`.

## H. Cookie, origin and proxy behaviour

- Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax` — proven over real TLS,
  **not weakened for local convenience**.
- CSRF origin guard on cookie-authenticated mutations: missing `Origin` → 403
  `CSRF_ORIGIN_REJECTED`; hostile `Origin` → 403 `CSRF_ORIGIN_REJECTED`; correct
  `Origin` → 200.
- CORS did not broaden: `CORS_ORIGIN` was left empty and the single allowed
  origin came from `FRONTEND_URL`.
- Nginx forwards `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Host` and preserves
  the edge-supplied `X-Forwarded-Proto: https` across the internal HTTP hop.
- With `TRUST_PROXY=2` matching the two real hops, a **forged
  `X-Forwarded-For: 203.0.113.99` from the outermost client was not adopted** as
  the client identity.
- Security headers present on both SPA and API responses: `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`,
  and `Cache-Control: no-store` on API and `index.html`.

## I. Similarity authorization

Proven through the actual container routing:

| Actor | Result |
| --- | --- |
| Anonymous | **401** on `/api/similarity/check` and on the `/api/v1/check-similarity` alias |
| Student (authenticated) | **200** on both routes |
| Lecturer (authenticated) | **200** |
| Administrator | **403** on both routes (Phase-5 policy is student/lecturer only) |
| Suspended user | **401** on an existing session; **403** on a fresh login attempt |
| `mustChangePassword` user | **403** on similarity and on every other protected operation |

Anonymous access was additionally denied on `/api/v1/auth/me`,
`/api/v1/admin/users`, `/api/v1/submissions` and `/api/v1/lecturer/submissions`.
**No route alias bypassed authentication.**

## J. Synthetic topic lifecycle

Import of 10 synthetic historical topics through the real admin import path:

```
accepted_rows: 10, skipped: 0, duplicates: 0,
inserted_records: 10, embedding_generated: 10, corpus_refreshed: true
```

Then, end to end:

| Step | Evidence |
| --- | --- |
| Resident corpus sees imports | `built: true, topics: 10, searchable: 10` |
| Similarity retrieves candidates | `corpus_size: 10`, 5 matches, top `semantic_score 0.6639`, `similarity_class HIGH` |
| Provider identity | `voyage` / `voyage-4-large`, `mode: semantic-only` |
| Student submission | 201 in 1.46 s |
| Under-review corpus entry | `underReview 0 → 1` |
| Under-review entry visible to similarity | returned as an `UNDER_REVIEW` candidate |
| Student attempting a lecturer decision | 403 |
| Lecturer approval | 200 |
| Promotion to current session | `currentSession 0 → 1` |
| Under-review duplicate removed | `underReview 1 → 0` |
| Backend restart → corpus rebuild | `built: true, topics: 11, searchable: 11`, `lastRefreshError: null` |

Stored embeddings in PostgreSQL: provider `voyage`, model `voyage-4-large`,
dimension 1024, actual stored vector length 1024. **No fallback vector was ever
produced.**

### Honest empty-corpus behaviour

Before any import, an authenticated similarity request returned:

```json
{"corpus_size":0,"overall_risk":null,"max_similarity":null,"matches":[],
 "recommendation":"No eligible stored topics are currently available for comparison. This result does not establish that the topic is new or original."}
```

The system did **not** present an empty comparison corpus as evidence that a
topic is new, unique or original.

### Honest provider-failure behaviour

One submission attempt failed with **503 `SEMANTIC_SYNC_UNAVAILABLE`** after
71.6 seconds, because Voyage rate-limited the burst that followed the 10-document
import. `retryVoyageCall` waits 61 s on HTTP 429 with at most 3 attempts, so the
observed duration is one 429, a 61 s backoff, then a 10 s request timeout. The
application refused the write rather than storing a degraded or fallback vector,
and the same submission succeeded in 1.46 s once the throttle window cleared.
**This is the contract behaving correctly, not a defect.**

## K. Identity and onboarding

| Operation | Result |
| --- | --- |
| Bootstrap administrator | created, forced change, proven above |
| Individual student (with matric number) | 201, `mustChangePassword=true`, no hash in response |
| Individual lecturer | 201, `mustChangePassword=true` |
| Bulk synthetic users | 100 rows and 650 rows, both `accepted 100%`, 0 invalid, 0 conflicts |
| Attempt to provision role `ADMIN` | 400 `USER_PROVISION_ROLE_NOT_ALLOWED` (governance intact) |

### Long administrative request budget

| Run | Rows | Commit duration | Per user |
| --- | --- | --- | --- |
| Calibration | 100 | 24.4 s | 244 ms |
| Resource sample | 60 | 16.3 s | 272 ms |
| Drain test | 60 | 15.0 s | 250 ms |
| Full departmental scale | **650** | **388.6 s** | 598 ms |

The 650-row commit returned **HTTP 200** through the TLS edge and the frontend
Nginx, with **no 502 or 504 at any tier**. Nothing in the local proxy or backend
chain cut the request short at or below the documented 300-second budget.

However the operation itself took **388.6 s on this container host — about 2.7×
the documented ~142 s reference and beyond the documented 300 s edge budget.**
See "Remaining risks": this is a host-sizing finding, not an application defect.

## L. Email path

With the local SMTP sink (22/23 checks, and the single flag was a false positive
in the test's own regex, disproved by an exact-string re-test that passed 11/11):

- invitation email captured; link is
  `https://localhost:8443/accept-invitation?token=…` on the configured HTTPS
  origin, with no `http://` link anywhere;
- invitation validated, accepted, private password established, invitee logged in;
- invitation token could not be replayed (400);
- forgot-password email captured; reset link on the same HTTPS origin;
- reset succeeded, login with the new password succeeded, **old password rejected
  (401)**, reset token could not be replayed (400);
- manual credential fallback remains usable: an administrator can issue a
  temporary credential that works and forces a password change.

**No plaintext credential is emailed.** Verified by exact-string comparison
against the real generated temporary passwords: neither the provisioning
temporary password nor the credential-reset temporary password appeared in any
captured message, and no bcrypt hash, session cookie or JWT appeared either. The
manual credential reset correctly returns the temporary password in the API
response for out-of-band transfer rather than mailing it.

## M. Persistence, restart and redeploy

| Event | Evidence |
| --- | --- |
| `docker compose restart backend` | same container restarted, health `healthy` |
| After restart | 816 users, 10 historical, 1 current session, credentials valid |
| Corpus after restart | rebuilt from PostgreSQL: `built: true, topics: 11, searchable: 11` |
| Force-recreate `backend` + `frontend` | backend `9376ce9c → a1566f92`, frontend `94524d7a → 0a0f24a8` (**new containers**) |
| PostgreSQL during recreation | container id **and** `StartedAt` unchanged |
| Volume | `ts-phase8a_postgres-data` unchanged (`created 2026-08-25T08:25:46Z`) |
| After recreation | 816 users, 10 historical, 1 current session, corpus rebuilt to 11 topics |

Application images are replaceable independently of database state.

> Harness finding worth recording: the acceptance TLS edge initially returned 502
> after the frontend container was recreated, because its first configuration used
> a static `proxy_pass` and Nginx pinned the IP resolved at startup. The
> production `frontend/nginx.conf` already guards against exactly this with
> `resolver 127.0.0.11 valid=10s` plus a variable upstream. The harness was fixed
> the same way. This independently validates why that resolver directive is in the
> production configuration, and why the Compose contract warns that a non-Docker
> platform must supply an equivalent service resolver.

## N. Graceful shutdown

A real `SIGTERM` was delivered with a 60-user bulk import in flight:

```
{"level":"info","message":"Graceful shutdown started.","signal":"SIGTERM","gracePeriodMs":300000}
{"level":"info","message":"Graceful shutdown completed.","signal":"SIGTERM"}
```

| Assertion | Result |
| --- | --- |
| In-flight request drained to completion | **HTTP 200 after 15.0 s** |
| New connections during drain | refused (502 at the proxy) |
| Prisma disconnect | completed before "shutdown completed" (a failure would log and force exit 1) |
| Process exit code | **0** |
| Total time from SIGTERM to exit | 10.1 s, far inside the 300 s window |
| Application drain timer | `SHUTDOWN_GRACE_PERIOD_MS=300000` |
| Compose termination allowance | `stop_grace_period` 330 s (`StopTimeout=330`) |
| Forced-shutdown bounds in code | `FORCED_DISCONNECT_TIMEOUT_MS=5000`, `FATAL_EXIT_TIMEOUT_MS=10000` |

## O. Backup and restore against the containerized database

The Phase-7 operator tooling is Node-based and needs matching PostgreSQL 16
client binaries, so it was run in a helper container carrying both, joined to the
private Compose network with the backend source mounted read-only.

| Step | Result |
| --- | --- |
| `--print-plan` | source shown as `postgresql://ts_phase8a@postgres:5432/…` — **password absent**; no credential in argv |
| Backup | `rtadss-backup-ts_phase8a_scratch-…dump`, 179,799 bytes |
| Restore into a non-scratch name | **refused**: `RESTORE_TARGET_NOT_SCRATCH` |
| Restore into a separate scratch database | completed |
| Restored contents | 816 users, 1 admin, 10 historical (10 with embeddings, `voyage-4-large`, vector length 1024), 1 current session, 1 submission, 868 audit logs, 11 migrations |
| Source database after restore | unchanged |
| Credentials in any command output | none |

## P. Logging and request correlation

From the actual container stdout stream:

- structured production JSON with `level`, `message`, `timestamp`;
- startup event `Server is listening.` carrying `environment: "production"`,
  `apiVersion`, `nodeVersion`, `version`, `port`;
- shutdown events `Graceful shutdown started.` / `Graceful shutdown completed.`;
- provider failure categories logged once per state change, e.g.
  `{"failureCode":"VOYAGE_PROVIDER_ERROR","from":"available","to":"unavailable"}`;
- per-request completion lines with `requestId`, `method`, `path`, `statusCode`,
  `durationMs`, `userId`, `ip`;
- every response carries a distinct `X-Request-Id`, and a forged/invalid upstream
  `X-Request-Id` is **replaced** rather than trusted.

Secret hygiene in logs — exact-string and pattern scan, all clean:

| Scan | Matches |
| --- | --- |
| Voyage key / DB password / JWT secret / user passwords (literal) | 0 |
| bcrypt hashes `$2[aby]$` | 0 |
| `postgresql://user:password@` | 0 |
| `Bearer <token>` | 0 |
| `rtadss_session=` cookie values | 0 |
| JWT-shaped tokens | 0 |
| `VOYAGE_API_KEY` / `JWT_SECRET` / `DATABASE_URL` / `POSTGRES_PASSWORD` / `SMTP_PASSWORD` / `password_hash` | 0 |

Routine traffic logs at the `http` level, so `LOG_LEVEL=info` shows failures and
lifecycle events only; `LOG_LEVEL=http` adds the per-request completion lines.
Container-local `logs/combined.log` and `logs/error.log` exist but were not
needed: the stdout stream alone was sufficient for diagnosis throughout.

## Q. Resource observations

Measurements from this workstation's Docker Desktop host. **These are engineering
observations to inform staging host selection, not sizing requirements.**

| Container | Idle memory | Peak memory observed | CPU idle | CPU under load |
| --- | --- | --- | --- | --- |
| backend | 79.6 MiB | 138.6 MiB | 0.00% | **628–676%** during bcrypt hashing |
| frontend (Nginx) | 8.1 MiB | 8.5 MiB | 0.00% | ~0% |
| postgres | 21.5 MiB | 26.5 MiB | ~0.1% | low |

- Peak backend CPU matches the bounded hashing worker pool
  (`min(cpus - 2, 6) = 6` workers on an 8-CPU host).
- Similarity is network-bound on the Voyage call, not CPU-bound.
- No memory or CPU limits are set on any container (`Memory=0`, `NanoCpus=0`).
- **Zero restarts and zero OOM kills** across every container for the whole run.

## R. Runtime security posture

| Check | Result |
| --- | --- |
| Backend process user | `uid=999(app)` — non-root |
| Frontend process user | `uid=101(nginx)`, master **and** all workers |
| PostgreSQL server process | runs as `postgres` (PID 1), not root |
| Privileged containers | none (`Privileged=false`, `CapAdd=[]` everywhere) |
| Published ports | only `127.0.0.1:8080` (frontend); acceptance-only `8443` edge and `8025` mail UI |
| Backend `3000/tcp` | **not published**; unreachable from the host, reachable from the frontend container |
| PostgreSQL `5432/tcp` | **not published** |
| Secrets in image metadata | none |
| Secrets at runtime | `JWT_SECRET`, `DATABASE_URL`, `VOYAGE_API_KEY` injected into the container only |
| `.env` inside images | none |
| Development browser tooling in runtime images | none |
| Rate limiting through the full chain | 8×401 then **429** at exactly `LOGIN_IDENTIFIER_RATE_LIMIT_MAX=8`, with a non-enumerating message |

Two minor hardening observations (neither is a defect, neither was changed):

1. **66 `*.test.js` files ship inside the backend runtime image**, because the
   Dockerfile copies `src` wholesale and tests live beside sources. They are inert
   (no `jest` binary in the image) but are unnecessary runtime surface.
2. **The Prisma CLI (31 MB of a 194 MB `node_modules`) survives
   `npm prune --omit=dev`** in the runtime image. This is npm behaving correctly,
   not a packaging mistake: `@prisma/client` declares `prisma` as an optional
   *peer* dependency, so the shipped lockfile entry for `node_modules/prisma`
   carries no `dev` flag and pruning retains it.

A workstation-local note, unrelated to the containers: this host runs its own
PostgreSQL service listening on `0.0.0.0:5432`. It is not the Compose database and
was never used, but a host-side port probe of 5432 is therefore not a valid test
of container exposure — Docker's published-port list is the authoritative check.

## S. Automated verification against this exact tree

| Suite | Result |
| --- | --- |
| Backend test suite (`npm test`) | **73 suites, 903 tests, all passing**, 88.33% statements, exit 0 |
| Frontend test suite (`vitest run`) | **31 files, 338 tests, all passing**, exit 0 |
| Frontend build | exit 0 (`index-DzB0oZHP.js`, 532.15 kB / 147.31 kB gzip) |
| Frontend lint | exit 0, clean |
| `docker compose config --quiet` (production) | exit 0 |
| `docker compose config --quiet` (with acceptance overlay) | exit 0 |
| Deployment contract tests | `PASS - static deployment contract` |
| Smoke-script tests | 3 tests, 3 pass, 0 fail |
| Full-stack Compose smoke | 8/8 PASS against the HTTPS origin |
| Frontend `npm audit --omit=dev` | **0 vulnerabilities** |
| Backend `npm audit --omit=dev` | **2 moderate** (`uuid` via `exceljs`), unchanged pre-existing finding |

The backend advisories are `GHSA-w5hq-g745-h8pq` in `uuid`, reachable only through
`exceljs`. The only offered remediation is `npm audit fix --force`, which would
install `exceljs@3.4.0` — a breaking downgrade of the import subsystem. Dependency
upgrades are a later phase's scope, so this was recorded rather than changed.

## Acceptance matrix

| Item | Verdict | Evidence |
| --- | --- | --- |
| IMAGE BUILD | **PASS** | 4 images built, exit 0, metadata and filesystem inspected |
| CONTAINER START | **PASS** | postgres/backend/frontend all `healthy` |
| POSTGRES PERSISTENCE | **PASS** | survived restart and full app-container recreation |
| MIGRATE DEPLOY | **PASS** | 11/11 from empty, idempotent, status current |
| ADMIN BOOTSTRAP | **PASS** | clean DB → one admin → temp credential → forced change |
| FRONTEND SPA | **PASS** | 12 routes incl. deep nested, direct refresh |
| API PROXY | **PASS** | `/api/*` never falls through to `index.html` |
| LOGIN | **PASS** | 200 with correct credentials, 401 otherwise |
| FORCED PASSWORD CHANGE | **PASS** | enforced, old credential invalidated |
| USER PROVISIONING | **PASS** | individual + bulk 100 and 650, ADMIN role refused |
| SIMILARITY AUTHORIZATION | **PASS** | full matrix incl. alias, suspended, mustChangePassword |
| VOYAGE CONNECTIVITY | **PASS** | live probe succeeded, `voyage-4-large`, semantic-only |
| TOPIC IMPORT | **PASS** | 10/10 accepted, 10 embeddings generated |
| CORPUS REFRESH | **PASS** | rebuilt from PostgreSQL after restart and recreation |
| SUBMISSION | **PASS** | 201, under-review corpus entry created and visible |
| LECTURER DECISION | **PASS** | approval promoted and removed the duplicate |
| INVITATION | **PASS** | sent, captured, validated, accepted, replay refused |
| PASSWORD RESET | **PASS** | captured, reset, old password rejected, replay refused |
| RATE LIMITS | **PASS** | 429 at the configured threshold through the full chain |
| REQUEST IDS | **PASS** | unique per request, forged upstream id replaced |
| READINESS | **PASS** | truthful under DB outage, provider outage, and recovery |
| GRACEFUL SHUTDOWN | **PASS** | SIGTERM, drain of in-flight request, exit 0 |
| BACKEND RESTART | **PASS** | state intact, corpus rebuilt |
| DB PERSISTENCE | **PASS** | volume and data survived image/container replacement |
| BACKUP | **PASS** | 179,799-byte archive from the containerized database |
| RESTORE | **PASS** | separate scratch target verified, guard refused non-scratch |
| NO-SBERT PRODUCTION DEPENDENCY | **PASS** | absent from topology, config, runtime and import graph |
| SECRET HYGIENE | **PASS** | clean across images, layers, environment, logs and email |

## Remaining risks

1. **Bulk onboarding exceeded the documented request budget on this host.**
   650 users took 388.6 s versus the documented ~142 s reference. The local chain
   tolerated it, but a hosted platform enforcing a hard 300 s edge timeout would
   fail this operation. Before hosted staging, either confirm the staging host is
   fast enough to bring this back under budget, measure it again on the real host,
   or move bulk onboarding to an asynchronous job. Do not assume the 142 s figure
   transfers to a smaller hosted instance.
2. **Readiness returns a single 503 at every Voyage probe-cache boundary.**
   Health gating that removes an instance on one failed probe will flap about
   every five minutes. Gate container restarts on `/api/v1/health`, and require
   consecutive readiness failures before withdrawing traffic.
3. **Voyage rate limiting is reachable under normal administrative bursts.**
   A 10-document import followed immediately by a submission triggered HTTP 429,
   and the 61-second backoff means a single affected write can take up to about
   two minutes before failing honestly. Confirm the production Voyage plan's rate
   limits against expected import sizes.
4. **No public HTTPS, no real DNS, no real certificate.** TLS here is a local
   self-signed edge. Certificate issuance, renewal and HTTP→HTTPS redirect remain
   unproven.
5. **Real SMTP provider smoke remains PENDING.** Delivery was proven only against
   a local sink; deliverability, SPF/DKIM and bounce handling are unproven.
6. **No container resource limits are set.** Memory and CPU limits were absent;
   the hashing pool alone consumed nearly seven cores.
7. **Two moderate backend advisories persist** (`uuid` via `exceljs`), remediable
   only by a breaking change, deferred to the dependency-upgrade phase.
8. **Single-instance topology.** No horizontal scaling, zero-downtime rollout or
   centralized log aggregation was proven.

## Readiness gates

**Gate A — Real Data Readiness: NOT MET.** The application lifecycle is proven on
synthetic data in containers, but hosted staging, a real backup destination, and
departmental approval are still outstanding.

**Gate B — Operational User Readiness: PARTIALLY MET.** Bootstrap, provisioning,
invitation, recovery and manual fallback all work in containers. Outstanding: real
SMTP provider smoke, and the bulk-onboarding duration risk above.

**Gate C — Internet Production Readiness: NOT MET.** Outstanding: public HTTPS with
a real certificate, a chosen host, reviewed `TRUST_PROXY` for the real chain,
externally stored backups, centralized observability and resource limits.

## Go / No-Go

| Question | Answer |
| --- | --- |
| A. Do production images actually build? | **YES** — 4 images, exit 0 |
| B. Does the supported Compose stack actually run? | **YES** — all services healthy, smoke 8/8 |
| C. Does it run without SBERT? | **YES** — no dependency in topology, runtime or import graph |
| D. Do migrations work from an empty PostgreSQL? | **YES** — 11/11, idempotent |
| E. Does state survive restart/redeploy? | **YES** — including corpus rebuild from PostgreSQL |
| F. Does the complete synthetic workflow function in containers? | **YES** — import → similarity → submission → decision → promotion |
| G. Do backup/restore tools work against the containerized DB? | **YES** — with credential hygiene and the scratch-target guard intact |
| H. Do production logs and request correlation work in containers? | **YES** — structured JSON, request IDs, no secrets |
| I. Is it now safe to proceed to HOSTED staging? | **YES, with the risks above carried forward** — in particular re-measure bulk onboarding against the real host budget |
| J. Is real Public Health data approved yet? | **NO** — hosted staging and the remaining environmental gates are not complete |
