# Reconciliation Plan

> **Superseded for current deployment and migration decisions.** This is a
> historical reconciliation snapshot. Do not follow its `prisma db push` or
> SBERT-era statements for staging/production; use the [Phase 6 deployment
> runbook](../deployment/deployment-runbook.md) and the pinned
> [migration contract](../deployment/database-migrations-and-rollback.md).

This plan reflects the current MVP state after the API contract, import workflow, and evaluation harness cleanup. Older reconciliation steps about removing public `combinedScore` behavior or switching away from normalized public scores are historical and should not be treated as active work.

## Current State

- The current primary backend API reference is [Backend API](../api/backend-api.md).
- Backend base URL is `http://localhost:3000`.
- Default API content type is `application/json`; import endpoints use `multipart/form-data`.
- Production similarity scoring is still title-based.
- Context-aware scoring is evaluation-only in `context_adjusted_combined`.
- Prisma workflow is `npm run prisma:push` / `prisma db push`; committed Prisma migrations are not the active workflow.

## Active Reconciliation Priorities

1. Preserve the current production API contract while planning context-aware scoring.
2. Keep evaluation-only scorers clearly separated from production response fields.
3. Add production context analysis first as explanation metadata, not as an immediate decision change.
4. Use lecturer-reviewed evaluation cases before changing production thresholds or final risk behavior.

## Safe Order For Future Production Context Work

1. Add or reuse a context comparison helper with unit tests.
2. Add optional API explanation fields behind a feature flag.
3. Verify feature-flag-disabled behavior remains unchanged.
4. Compare evaluation harness results before and after production integration.
5. Add frontend explanation UI after the backend response shape is reviewed.

## Not Active In This Plan

- No Prisma schema changes.
- No migration workflow switch.
- No production threshold tuning.
- No public combined-score response field.
- No frontend behavior change until the API extension is intentionally designed.

