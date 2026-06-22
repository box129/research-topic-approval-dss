# Topic Similarity MVP

Topic Similarity MVP is a research-topic approval decision-support system. It combines lexical similarity, TF-IDF scoring, and SBERT embeddings to help identify reused or overly similar research topics while preserving lecturer/admin review workflows.

## Current Release Classification

| Mode | Status |
| --- | --- |
| Local native development | SUPPORTED |
| Local integrated demonstration | SUPPORTED |
| Controlled release-candidate deployment | CONDITIONALLY SUPPORTED |
| Public HTTPS production deployment | NOT VERIFIED |

Current published pre-release: `v0.4.0-rc1`. Current post-RC work is preparing stable-release validation evidence. Do not treat local passing tests as proof of public production readiness. Public deployment still requires HTTPS, secrets management, backups, monitoring, operational ownership, and provider configuration.

## Main Services

- `backend/`: Node.js/Express API, Prisma, auth, governance APIs, import endpoints, notifications foundation, and similarity orchestration.
- `frontend/`: React/Vite role-based UI.
- `sbert-service/`: Python FastAPI service for 384-dimensional embeddings with a deterministic fallback mode.
- `docs/`: setup, deployment, evaluation, governance, and release documentation.

## Quick Local Start

1. Start PostgreSQL and configure `backend/.env` from `backend/env.example`.
2. Apply database migrations:

   ```powershell
   cd backend
   npm ci
   npx prisma validate
   npx prisma generate
   npx prisma migrate deploy
   ```

3. Start SBERT:

   ```powershell
   cd ..\sbert-service
   .\venv\Scripts\python.exe app.py
   ```

4. Start the backend:

   ```powershell
   cd ..\backend
   npm run dev
   ```

5. Start the frontend:

   ```powershell
   cd ..\frontend
   npm ci
   npm run dev -- --host 127.0.0.1
   ```

## Health and Readiness

Backend liveness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health
```

Backend readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/readiness
```

SBERT health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Readiness distinguishes full readiness from degraded lexical fallback when SBERT is unavailable.

## Release Gate

From repository root:

```powershell
npm run release:check
```

While validating an uncommitted PR:

```powershell
$env:RELEASE_CHECK_ALLOW_DIRTY='1'
npm run release:check
```

Credentialed smoke tests are opt-in with `RELEASE_CHECK_SMOKE=1` and `SMOKE_*` credentials. Do not commit credentials.

## Validation Framework

Post-RC validation work prepares lecturer-reviewed benchmark collection and departmental-scale data-quality validation without claiming final results. PR #108 alone does not make the project a stable release. Start with:

- [Lecturer review protocol](docs/validation/lecturer-review-protocol.md)
- [Final effectiveness evaluation workflow](docs/validation/final-effectiveness-evaluation-workflow.md)
- [Departmental data-quality validation workflow](docs/validation/departmental-data-quality-validation.md)
- [Stable production readiness tracker](docs/release/stable-production-readiness-tracker.md)

These documents and templates are framework evidence only. There are no completed lecturer labels yet, no departmental-scale data-quality proof yet, and stable release readiness still depends on collecting and validating real approved evidence.

## Documentation

- [Deployment runbook](docs/deployment/deployment-runbook.md)
- [Environment matrix](docs/deployment/environment-matrix.md)
- [Database migration and rollback runbook](docs/deployment/database-migrations-and-rollback.md)
- [Security readiness checklist](docs/deployment/security-readiness-checklist.md)
- [Release notes for v0.4.0-rc1](docs/release/v0.4.0-rc1.md)
- [Release readiness report](docs/testing/release-readiness-report.md)

## Important Boundaries

- Do not change similarity scoring, weights, thresholds, tiers, ranking, or fallback behavior without a dedicated evaluation-backed change.
- Do not commit `.env`, secrets, `node_modules`, virtual environments, build outputs, smoke artifacts, screenshots, or reports.
- Do not use `prisma migrate dev` or `prisma db push` for production-like deployments.
- Do not claim provider-smoke-verified SMTP delivery, notification UI/event hooks, departmental-scale evaluation, or public production readiness until those are proven.
