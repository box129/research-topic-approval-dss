# AGENTS.md

## Project Purpose

Topic Similarity MVP is a research-topic similarity checker. Its current
deployment contract uses a Node/Express backend, React/Vite frontend,
PostgreSQL/Prisma data model, and Voyage `voyage-4-large` embeddings to compare
submitted topics against existing topic records. The Python FastAPI SBERT
service remains a legacy research/evaluation artifact, not a production runtime
dependency.

## Main Repo Areas

- `backend/`: Express API, Prisma schema, similarity services, middleware, tests, and setup scripts.
- `frontend/`: React/Vite UI for topic entry and tiered similarity results.
- `sbert-service/`: legacy FastAPI/SBERT research and evaluation artifact; use
  only through its explicit `legacy-sbert` profile, never as a required
  production dependency.
- `docs/`: practical project documentation, including archived status notes in `docs/archive/status-reports/` and API docs in `docs/api/`.
- Root Markdown files: historical guides, status reports, audits, and implementation notes; freshness needs verification.
- Seed CSV files: sample/import data for topic records.

## Protected Core Files And Logic

Do not change these casually. Inspect dependencies and behavior first.

- `backend/src/server.js`
- `backend/src/controllers/similarity.controller.js`
- `backend/src/services/jaccard.service.js`
- `backend/src/services/tfidf.service.js`
- `backend/src/services/sbert.service.js`
- `backend/src/utils/preprocessing.js`
- `backend/src/config/env.js`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.js`
- `sbert-service/app.py`
- `sbert-service/requirements.txt`
- `frontend/src/App.jsx`
- `frontend/src/components/features/TopicInput/TopicForm.jsx`
- `frontend/src/components/features/Results/ResultsDisplay.jsx`
- `frontend/vite.config.js`
- `frontend/package.json`
- `frontend/package-lock.json`

Protect the similarity scoring, result tiering, LOW/MEDIUM/HIGH risk logic, API response shape, Prisma data model, frontend response mapping, and current Voyage semantic contract from accidental changes. Do not reintroduce an SBERT or lexical fallback into the protected production direct-similarity path without an explicit approved methodology change.

## Working Rules

- Inspect the relevant files and docs before changing anything.
- Before any visual or structural frontend change, read and follow `docs/ui/DESIGN.md`, `docs/ui/COMPONENT-MAP.md`, `docs/ui/REPRESENTATIVE-SCREEN-BRIEFS.md`, and `docs/ui/VISUAL-ACCEPTANCE-CRITERIA.md`. These documents are the mandatory Institutional Evidence Workflow design contract and validation policy.
- Prefer small, low-risk edits over broad rewrites.
- Do not guess when unsure; write `needs verification`.
- Update docs when behavior, commands, ports, setup steps, or API shapes change.
- Do not overwrite existing work without checking the worktree and reading affected files.
- Avoid editing generated/local output such as `coverage/`, `dist/`, `logs/`, and `sbert-service/venv/`.
- Keep changes aligned with the existing repo structure and implementation style.

## Testing Rule

After code changes, recommend the relevant tests or verification steps. Typical checks may include:

- Backend: `cd backend && npm test`
- Frontend: `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`
- Legacy SBERT research only: `cd sbert-service && python test_service.py`
- Manual verification: backend health endpoint, frontend topic submission, and end-to-end results display.

If a command cannot be run or its result is unknown, mark it as `needs verification`.

## Pull Request Rule

Prefer small focused PRs. Each PR should include a clear summary, files changed, verification performed, known risks, and any items that need verification.
