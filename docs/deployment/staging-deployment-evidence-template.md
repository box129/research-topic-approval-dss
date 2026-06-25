# Staging Deployment Evidence Template

Use this template after executing [staging-deployment-proof-plan.md](./staging-deployment-proof-plan.md).

Do not commit completed evidence if it contains secrets, private infrastructure details, or student data. Store completed evidence according to the deployment owner policy.

## Metadata

| Field | Value |
| --- | --- |
| Evidence date | `<yyyy-mm-dd>` |
| Reviewer/operator role | `<role only, no private contact details>` |
| Repository commit | `<short hash>` |
| Branch/tag | `<branch or tag>` |
| Environment | `staging` |
| Server/VPS class | `<cpu/ram/disk summary, no secrets>` |
| Public production? | `No` |

## Version Checks

| Check | Command | Result |
| --- | --- | --- |
| Git commit | `git rev-parse --short HEAD` | `<pass/fail + value>` |
| Docker | `docker --version` | `<pass/fail + value>` |
| Compose | `docker compose version` | `<pass/fail + value>` |
| Node | `node --version` | `<pass/fail + value>` |
| npm | `npm --version` | `<pass/fail + value>` |

## Environment Checklist

Do not paste values. Mark configured/not configured.

| Variable | Configured? | Notes |
| --- | --- | --- |
| `NODE_ENV` | `<yes/no>` | Expected production-like value for staging proof. |
| `DATABASE_URL` | `<yes/no>` | Secret; do not paste. |
| `POSTGRES_PASSWORD` | `<yes/no>` | Secret; do not paste. |
| `JWT_SECRET` | `<yes/no>` | Secret; do not paste. |
| `FRONTEND_URL` | `<yes/no>` | Exact staging origin. |
| `CORS_ORIGIN` | `<yes/no>` | Must not be `*`. |
| `SBERT_SERVICE_URL` | `<yes/no>` | Usually `http://sbert-service:8000` inside Compose. |
| `EMAIL_PROVIDER` | `<disabled/smtp>` | `mock` is not acceptable for production-like staging. |
| `SMTP_*` | `<yes/no/not in scope>` | Required only if SMTP smoke is in scope. |

## Compose Proof

| Step | Command | Result | Notes |
| --- | --- | --- | --- |
| Config validation | `docker compose config` | `<pass/fail>` | |
| Build | `docker compose build` | `<pass/fail>` | |
| Start | `docker compose up -d` | `<pass/fail>` | |
| Service status | `docker compose ps` | `<pass/fail>` | |

## Migration Proof

| Step | Command | Result | Notes |
| --- | --- | --- | --- |
| Deploy migrations | `docker compose run --rm backend npx prisma migrate deploy` | `<pass/fail>` | |
| Migration status | `docker compose run --rm backend npx prisma migrate status` | `<pass/fail>` | |

## Health And Readiness Proof

| Service | Command | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| SBERT | `curl -fsS http://127.0.0.1:8000/health` | `status: healthy` | `<summary>` | `<pass/fail>` |
| Backend health | `curl -fsS http://127.0.0.1:3000/api/v1/health` | HTTP 200 | `<summary>` | `<pass/fail>` |
| Backend readiness | `curl -fsS http://127.0.0.1:3000/api/v1/readiness` | `status: ready` | `<summary>` | `<pass/fail>` |
| Frontend | `curl -fsSI http://127.0.0.1:8080/` | HTTP 200 | `<summary>` | `<pass/fail>` |
| Compose smoke | `npm run docker:smoke` | All checks pass | `<summary>` | `<pass/fail>` |

## SMTP Smoke

| Field | Value |
| --- | --- |
| In scope? | `<yes/no>` |
| Command | `npm run smoke:smtp` |
| Provider accepted message? | `<yes/no/not run>` |
| Recipient confirmed receipt? | `<yes/no/not run>` |
| Secrets exposed? | `No` |
| Notes | `<summary>` |

If not run, record why:

```text
SMTP smoke not run because <credentials unavailable/provider not approved/out of scope>.
```

## Backup And Restore Proof

| Step | Result | Notes |
| --- | --- | --- |
| Backup created | `<pass/fail/not run>` | No dump committed. |
| Restore target prepared | `<pass/fail/not run>` | Non-production target only. |
| Restore completed | `<pass/fail/not run>` | |
| Restored migration status clean | `<pass/fail/not run>` | |
| Readiness/database check against restored data | `<pass/fail/not run>` | |

If deferred, include owner approval reason.

## Rollback Readiness

| Check | Result | Notes |
| --- | --- | --- |
| Previous known-good commit identified | `<yes/no>` | |
| Backup available before risky changes | `<yes/no/not needed>` | |
| Rollback command sequence documented | `<yes/no>` | |
| Rollback owner identified | `<yes/no>` | Role only. |
| Rollback smoke criteria defined | `<yes/no>` | |

## Logs Reviewed

| Log | Command | Result |
| --- | --- | --- |
| Backend | `docker compose logs --tail=80 backend` | `<no secrets / issue>` |
| Frontend | `docker compose logs --tail=80 frontend` | `<no secrets / issue>` |
| SBERT | `docker compose logs --tail=80 sbert-service` | `<no secrets / issue>` |

## Overall Result

Choose one:

- `PASS`
- `FAIL`
- `PARTIAL - FOLLOW-UP REQUIRED`

Summary:

```text
<short summary>
```

Known gaps:

- `<gap 1>`
- `<gap 2>`

Approval:

```text
This evidence does not prove public production deployment unless all production-specific checks were executed in the target public environment.
```
