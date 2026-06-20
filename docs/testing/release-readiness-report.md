# Release Readiness Report

| Field | Value |
| --- | --- |
| Branch | `release/deployment-readiness-rc` |
| Base commit | `732f6b3` |
| Generated | `2026-06-19` |
| Proposed candidate version | `v0.4.0-rc1` |
| Classification | `CONDITIONALLY READY FOR RC TAG` |

## Runtime Versions Observed Locally

| Runtime | Version |
| --- | --- |
| Node.js | `v22.20.0` |
| npm | `10.9.3` |
| Python | `3.14.0` local interpreter; SBERT Dockerfile uses `python:3.10-slim` |
| Docker | `NOT AVAILABLE` in current local shell |

## Release Gate Policy

Required gates:

- clean or expected Git state
- backend dependency availability
- Prisma validation
- Prisma migration status
- backend test suite
- SBERT quick test
- SBERT service test
- topic evaluation
- data-quality audit
- frontend build
- frontend test suite
- whitespace/diff check

Optional gates:

- credentialed frontend smoke, enabled with `RELEASE_CHECK_SMOKE=1`
- Docker/Compose verification when Docker is available

Root package metadata:

- `package.json` has no `dependencies` or `devDependencies`.
- It exists only to expose repository-level orchestration scripts, currently `npm run release:check`.
- No root `package-lock.json` is required because no root dependencies are installed.
- The release script does not install dependencies, commit, tag, push, create releases, or apply migrations. It checks migration status only.
- Topic evaluation and data-quality commands are run as required gates; generated report files are restored to their pre-run contents afterward to avoid timestamp-only PR churn.

## Verification Results

| Gate | Status | Notes |
| --- | --- | --- |
| Backend tests | PASSED | 44 suites, 546 tests passed with coverage. |
| Prisma validation | PASSED | Schema is valid. |
| Prisma migration status | PASSED | 6 migrations found; local database schema is up to date after applying pending local migrations with `npx prisma migrate deploy`. |
| SBERT quick test | PASSED | 3/3 quick checks passed. |
| SBERT service test | PASSED | Health and embed endpoint tests passed with the real running service. |
| SBERT health | PASSED | `health=healthy`, model `all-MiniLM-L6-v2`. |
| Safe embed probe | PASSED | Dimension `384`; embedding length `384`; full vector not recorded. |
| Backend liveness/readiness | PASSED | Live backend check returned `health=OK`, `readiness=ready`, `database=available`, `sbert=available`. |
| Topic evaluation | PASSED | 16/16 SBERT-success cases; 100% full tri-algorithm coverage; accuracy `0.375`, macro F1 `0.365`. |
| Data-quality audit | PASSED | Database mode; 9 inspected records; 0 duplicate candidate groups. |
| Frontend build | PASSED | Vite build succeeded; existing chunk-size warning remains. |
| Frontend tests | PASSED | 25 files, 231 tests passed. |
| Release gate clean-worktree guard | PASSED | `npm run release:check` fails while this PR worktree is dirty, as intended. |
| Release gate automation | PASSED | `RELEASE_CHECK_ALLOW_DIRTY=1 npm run release:check` completed successfully for the PR worktree. |
| GitHub CI | VERIFIED | GitHub Actions backend/frontend workflow passed on PR #107. |
| Credentialed smoke | SKIPPED | No `SMOKE_*` credentials were supplied. This must pass before RC tagging unless the release owner explicitly accepts it as a documented RC limitation. |
| Docker/Compose | NOT VERIFIED | Docker CLI is not available in the current shell. |
| Git diff check | PASSED | `git diff --check` exited 0. |

## Current Evidence Summary

- The latest similarity evaluation evidence remains the PR #106 SBERT-active pilot run with 16/16 SBERT-success cases and 100% full tri-algorithm coverage.
- Evaluation labels remain manually constructed pilot labels.
- Departmental-scale data-quality and lecturer-reviewed final effectiveness evidence remain missing.
- Production scoring is not changed by PR #107.
- Containerized deployment remains NOT VERIFIED. Full-stack Docker/Compose deployment is not provided.
- Public production deployment remains not verified.
- Backend readiness endpoint added: `GET /api/v1/readiness`.
- Production configuration validation now rejects weak/placeholder JWT secrets, missing production CORS origin, wildcard production CORS, and mock production email.

## Remaining Blockers for Public Production

- HTTPS/TLS termination and reverse proxy ownership.
- Secret management outside `.env` files.
- Backup automation and restore drill.
- Monitoring/alerting and incident ownership.
- Real SMTP transport delivery.
- Notification event hooks and frontend notification UI.
- Lecturer-reviewed final benchmark and departmental-scale data-quality validation.

## Post-Merge Tag Recommendation

This branch may become `READY FOR RC TAG` only after:

1. PR #107 merges.
2. GitHub CI passes.
3. Local `main` is synchronized and clean.
4. `npm run release:check` passes without `RELEASE_CHECK_ALLOW_DIRTY=1`.
5. Credentialed smoke passes, unless the release owner explicitly accepts skipped smoke as a documented RC limitation.

After those conditions are met:

```powershell
git tag -a v0.4.0-rc1 -m "v0.4.0-rc1"
git push origin v0.4.0-rc1
```

Create a GitHub pre-release, not a stable production release.
