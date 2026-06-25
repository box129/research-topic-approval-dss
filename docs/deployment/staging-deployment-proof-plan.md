# Staging Deployment Proof Plan

## Status

PR #119 prepares the staging deployment proof plan for the Research Topic Approval DSS. It does not complete a staging deployment and does not prove public production readiness.

The first staging path should use the Docker Compose stack added by PR #115 because it already covers PostgreSQL, backend, frontend, and SBERT service.

## Objective

Prove that the DSS can be deployed in a staging-like environment and pass repeatable operational checks before any public production launch.

The staging proof should answer:

- Can the full stack build and start on a server/VPS?
- Can migrations be applied safely with `npx prisma migrate deploy`?
- Does SBERT start and report healthy?
- Does backend readiness report full readiness?
- Does the frontend respond over HTTP or HTTPS?
- Can SMTP provider smoke pass when credentials are available?
- Can a backup be created and restored into a separate validation database?
- Is rollback documented and practical?

## Recommended Staging Architecture

Use one staging server/VPS for the first proof:

| Component | Recommended staging placement |
| --- | --- |
| Frontend | Nginx container from root `docker-compose.yml` |
| Backend | Express API container from root `docker-compose.yml` |
| PostgreSQL | Compose PostgreSQL for first proof, or managed private PostgreSQL if available |
| SBERT | FastAPI container from root `docker-compose.yml` |
| SMTP | External provider, only if deployment-owned credentials exist |
| Reverse proxy/TLS | Optional for staging proof; required before public production |

For public production, database and SBERT network exposure must be hardened beyond a basic single-server staging proof.

## Server/VPS Prerequisites

Before staging:

- Linux server or VPS with SSH access controlled by the operations owner.
- Docker Engine installed.
- Docker Compose v2 available through `docker compose`.
- Sufficient CPU/RAM/disk for PostgreSQL, Node, Nginx, and SBERT.
- Outbound network access for npm/Python image builds and optional SMTP.
- Firewall rules reviewed.
- Storage location selected for backups.
- No real student records copied unless department approval exists.
- Repository checked out at the target commit.

Record exact versions:

```bash
git rev-parse --short HEAD
docker --version
docker compose version
node --version
npm --version
```

## Environment Setup

Start from the checked-in template:

```bash
cp .env.compose.example .env
```

Edit `.env` on the staging server only. Do not commit `.env`.

Required staging edits:

- replace `POSTGRES_PASSWORD`
- replace `DATABASE_URL`
- replace `JWT_SECRET`
- set `FRONTEND_URL` to the staging origin
- set `CORS_ORIGIN` to the staging origin if `FRONTEND_URL` is not enough for the deployment topology
- set `EMAIL_PROVIDER=disabled` unless SMTP smoke will be tested
- set audit retention values intentionally

Never use:

```text
CORS_ORIGIN=*
EMAIL_PROVIDER=mock
JWT_SECRET=local-dev-auth-secret-change-before-production
```

## Staging Secrets Checklist

Confirm all secrets are deployment-owned and kept outside Git:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `SMTP_USER`, if needed
- `SMTP_PASSWORD`, if needed
- smoke-test account credentials, if credentialed smoke is performed
- TLS private key, if staging uses HTTPS

Do not capture secret values in evidence.

## Build And Start

From repo root:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Capture:

- command names
- pass/fail result
- service names and health status
- no secrets

## Database Migration Step

Apply committed Prisma migrations explicitly:

```bash
docker compose run --rm backend npx prisma migrate deploy
docker compose run --rm backend npx prisma migrate status
```

Do not use:

```bash
prisma db push
```

Pass:

- migration deploy exits successfully
- migration status reports database schema is up to date

Fail:

- migration deploy fails
- drift is reported
- manual schema changes are needed

## SBERT Startup And Health

Expected:

- `sbert-service` container starts
- first startup may take longer while model/cache initializes
- health endpoint returns `status: "healthy"`

Check:

```bash
curl -fsS http://127.0.0.1:8000/health
docker compose logs --tail=80 sbert-service
```

Pass:

- health endpoint succeeds
- no repeated model-load failure loop

Fail:

- health endpoint fails after warmup
- service restarts repeatedly
- host does not have enough memory/disk

## Backend Readiness Proof

Check:

```bash
curl -fsS http://127.0.0.1:3000/api/v1/health
curl -fsS http://127.0.0.1:3000/api/v1/readiness
docker compose logs --tail=80 backend
```

Pass:

- `/api/v1/health` returns HTTP 200
- `/api/v1/readiness` returns HTTP 200 and `status: "ready"`
- readiness details show database and SBERT available

Fail:

- readiness is `not_ready`
- readiness is `degraded`
- database or SBERT checks fail
- logs expose secrets

`degraded` is useful diagnostic information, but it is not a passing full staging readiness state.

## Frontend HTTP Proof

Check:

```bash
curl -fsSI http://127.0.0.1:8080/
curl -fsS http://127.0.0.1:8080/ | head
docker compose logs --tail=80 frontend
```

Pass:

- frontend returns HTTP 200
- frontend serves the built application
- `/api/*` proxying works for backend routes through the frontend host if that topology is used

Fail:

- frontend container exits
- static host returns 404/5xx for root
- API proxying is broken

## Automated Compose Smoke

Run:

```bash
npm run docker:smoke
```

Pass:

- backend health passes
- backend readiness passes
- SBERT health passes
- frontend response passes

Fail:

- any smoke check fails
- smoke requires manual patching of the app or scripts

## SMTP Smoke Proof

Only run if staging has approved SMTP credentials:

```bash
EMAIL_PROVIDER=smtp \
SMTP_HOST=<provider-host> \
SMTP_PORT=<provider-port> \
SMTP_SECURE=true|false \
EMAIL_FROM=<approved-sender> \
SMTP_USER=<provider-user-if-needed> \
SMTP_PASSWORD=<provider-secret-if-needed> \
SMTP_SMOKE_TO=<controlled-recipient> \
npm run smoke:smtp
```

Pass:

- script sends one labelled smoke email
- provider accepts recipient
- controlled recipient confirms receipt
- no secrets or reset tokens appear in logs/evidence

Fail:

- credentials missing
- provider rejects the message
- recipient does not receive the message
- script output/logs expose secrets

If credentials are unavailable, mark SMTP smoke as `NOT RUN - CREDENTIALS UNAVAILABLE`, not passed.

## Backup And Restore Proof

Use [backup-and-restore-runbook.md](./backup-and-restore-runbook.md).

Minimum staging proof:

1. Create a backup from staging database.
2. Restore it into a separate validation database.
3. Run migration status against restored database.
4. Start backend against restored database in a controlled check, or verify with database-only checks if app startup is not approved.
5. Record result without storing dump files in Git.

Pass:

- backup command succeeds
- restore command succeeds into a non-production target
- migration status is clean
- readiness or database check passes

Fail:

- backup cannot be created
- restore cannot be completed
- restored database has migration drift
- dump files or credentials are committed

## Rollback Checklist

Before staging proof begins:

- identify previous known-good commit/image
- confirm `docker compose down` behavior
- confirm volume preservation policy
- confirm database backup exists before risky migration
- confirm who can approve restore
- confirm how to redeploy previous version

Rollback commands are environment-dependent. Basic Compose rollback pattern:

```bash
git checkout <previous-known-good-commit>
docker compose build
docker compose up -d
docker compose ps
npm run docker:smoke
```

If migrations were applied and are incompatible with the previous app version, prefer a corrective forward migration or restore from verified backup with owner approval.

## Evidence To Capture

Use [staging-deployment-evidence-template.md](./staging-deployment-evidence-template.md).

Capture:

- commit hash
- server class, without sensitive host identifiers if policy requires
- Docker and Compose versions
- sanitized `.env` checklist
- `docker compose config` pass/fail
- build/start pass/fail
- migration pass/fail
- SBERT health result
- backend readiness result
- frontend HTTP result
- `npm run docker:smoke` result
- SMTP smoke result or reason not run
- backup/restore proof result
- rollback readiness result
- known gaps

Do not capture:

- passwords
- tokens
- database URLs
- private IPs if policy forbids
- raw student data
- SMTP credentials
- raw database dumps

## Passed / Failed Definition

Staging proof passes only when:

- Compose config/build/up succeeds
- migrations deploy cleanly
- backend readiness is `ready`
- SBERT health is `healthy`
- frontend responds
- `npm run docker:smoke` passes
- backup/restore proof passes or is explicitly deferred with owner approval
- SMTP smoke passes if SMTP is in scope, or is explicitly marked not run because credentials are unavailable
- rollback procedure is documented for the deployed commit
- no secrets or student data are committed

Staging proof fails when:

- any core service cannot start
- database migration fails
- readiness remains `not_ready` or `degraded`
- frontend cannot serve the app
- backup/restore proof fails when required
- logs/evidence expose secrets or student data
- operators must change application code during proof

## Current Boundary

This PR adds the proof plan only. Staging deployment remains unproven until the plan is executed and evidence is recorded safely.
