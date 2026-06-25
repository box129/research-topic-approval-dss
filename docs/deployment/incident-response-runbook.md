# Incident Response and Rollback Runbook

## Status

This runbook defines incident handling expectations. It does not assign a real incident rota, configure alerting, or prove a rollback drill.

## Incident Severity

| Severity | Example | Initial action |
| --- | --- | --- |
| SEV1 | Public system unavailable, data exposure suspected, database corruption | Stop unsafe traffic if needed, notify owner, preserve evidence. |
| SEV2 | Login unavailable, database degraded, SBERT unavailable for extended period | Notify owner, assess rollback or dependency recovery. |
| SEV3 | Non-critical feature degraded, SMTP failures, delayed notifications | Track, mitigate, and schedule fix. |

## First Response Checklist

1. Identify alert source and time.
2. Check `/api/v1/health`.
3. Check `/api/v1/readiness`.
4. Check frontend HTTP response.
5. Check database connectivity and storage.
6. Check SBERT `/health`.
7. Check recent deployment or migration activity.
8. Check logs for errors without copying secrets.
9. Decide whether to rollback, restore, disable traffic, or continue mitigation.
10. Record timeline outside Git.

## Rollback Checklist

Application rollback:

1. Identify last known good commit/image/artifact.
2. Stop or drain the failing app version.
3. Redeploy the previous app version.
4. Confirm environment variables still match the previous version.
5. Re-run `/api/v1/health`.
6. Re-run `/api/v1/readiness`.
7. Re-run smoke checks.

Database rollback:

1. Prefer forward corrective migration when possible.
2. If restore is required, follow [backup-and-restore-runbook.md](./backup-and-restore-runbook.md).
3. Preserve the failed database state if investigation requires it.
4. Restore only with owner approval and a known data-loss window.

Do not delete production databases as a rollback strategy.

## Communication Checklist

Record:

- start time
- affected service
- severity
- customer/user impact
- mitigation owner
- decision log
- resolution time
- follow-up actions

Do not record:

- passwords
- reset tokens
- student records
- raw database exports
- private contact details

## Post-Incident Review

Within the approved review window:

- summarize cause
- summarize impact
- list detection gaps
- list prevention actions
- verify whether tests/docs/monitoring need updates
- confirm no sensitive evidence was committed

## Open Gap

Incident readiness remains unverified until owners are assigned and a rollback/alert drill is completed in the target environment.
