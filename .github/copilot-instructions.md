# AI Coding Agent Instructions for Topic Similarity MVP

## Current architecture

The supported application path is a same-origin React/Vite frontend behind
Nginx, a Node/Express backend, PostgreSQL through Prisma, and Voyage
`voyage-4-large` for protected semantic similarity. The browser calls relative
`/api` paths through Nginx; PostgreSQL and the backend remain private services.

The `sbert-service/` FastAPI application, Jaccard/TF-IDF research material, and
SBERT evaluation harness are legacy artifacts. They may be used only for
explicit research work (`legacy-sbert` Compose profile or
`RELEASE_CHECK_LEGACY_SBERT=1`) and must not be restored as a production
dependency or direct-similarity fallback.

## Runtime and security boundaries

- The protected direct-similarity route is authenticated, uses Voyage semantic
  evidence, and fails closed with the documented `semantic_unavailable` result
  if the provider is unavailable. Do not introduce a lexical or SBERT fallback
  without an approved methodology change.
- In production, require a strong `JWT_SECRET`, nonblank `VOYAGE_API_KEY`,
  exact HTTPS `FRONTEND_URL`, explicitly reviewed `TRUST_PROXY`, and a valid
  PostgreSQL `DATABASE_URL`. Do not weaken startup validation.
- Keep frontend API endpoints relative and do not commit provider URLs, `.env`
  files, tokens, database URLs, or SMTP credentials.
- Preserve cookie/CSRF/CORS behavior, authorization boundaries, rate limits,
  audit logging, response contracts, Prisma schema, and existing workflow
  tests unless a scoped change proves compatible behavior.

## Data and migrations

- Use committed Prisma migrations for staging and production:
  `npm run prisma:migrate:deploy` locally or the dedicated
  `backend-migrate` maintenance image target. Never use `prisma db push`,
  `migrate dev`, force resets, or demo seeds against staging/production.
- Administrator bootstrap is an explicit operator action through
  `backend-bootstrap`; never automate it in service startup.
- Do not use real users, institutional datasets, or production databases for
  local tests, smoke checks, or development fixtures.

## Development and verification

- Inspect protected files and the authoritative deployment docs before edits:
  `docs/deployment/deployment-runbook.md`,
  `docs/deployment/environment-matrix.md`, and
  `docs/api/direct-similarity-security-contract.md`.
- For backend changes run targeted Jest tests, then `cd backend && npm test`.
  For frontend changes run focused Vitest tests and `cd frontend && npm run build`.
- Run `npm run verify:deployment-contract` after Compose, Dockerfile, Nginx,
  smoke, or deployment-doc changes. Docker build/run claims require a working
  Docker daemon; static Compose validation is not runtime proof.
- Use `npm run release:check` for the current gate. Legacy SBERT checks are
  opt-in and not a production release requirement.

## UI work

Before visual or structural frontend changes, read and follow:

- `docs/ui/DESIGN.md`
- `docs/ui/COMPONENT-MAP.md`
- `docs/ui/REPRESENTATIVE-SCREEN-BRIEFS.md`
- `docs/ui/VISUAL-ACCEPTANCE-CRITERIA.md`

Keep the institutional workflow factual: similarity is advisory evidence and
lecturers retain the final academic decision.
