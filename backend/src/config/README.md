# Backend Configuration Module

`env.js` loads and validates backend configuration before the application
starts. The production source of truth is the repository
[environment matrix](../../../docs/deployment/environment-matrix.md); this
document explains the code-facing shape rather than creating a second
deployment recipe.

## Current runtime contract

The protected similarity runtime uses Voyage, PostgreSQL, and the browser
origin/proxy settings. In production it requires a valid `DATABASE_URL`, strong
`JWT_SECRET`, `EMAIL_PROVIDER`, `VOYAGE_API_KEY`, and an exact HTTPS
`FRONTEND_URL`. A blank Voyage key is startup-fatal in
production.

Use `backend/env.example` only as a development/reference template. Inject
production values from the target secret store; do not commit `.env` files,
database URLs, tokens, or passwords.

## Useful configuration properties

```javascript
const config = require('./config/env');

console.log(config.port);                    // private listener (default 3000)
console.log(config.database.url);            // PostgreSQL URL
console.log(config.voyage.requestTimeoutMs); // provider request deadline
console.log(config.trustProxy);              // validated proxy topology
console.log(config.shutdownGracePeriodMs);   // bounded backend drain
```

The standard deployment keeps the backend private behind frontend Nginx. Set
`TRUST_PROXY` only to the reviewed hop count or proxy CIDR set; `true` and `*`
are rejected.

## Configuration groups

| Group | Examples | Notes |
| --- | --- | --- |
| Application | `NODE_ENV`, `PORT`, `API_VERSION`, `SHUTDOWN_GRACE_PERIOD_MS` | Production drain defaults to 300000 ms and is bounded 180000–300000 ms, so the documented 330-second outer platform allowance always leaves cleanup time. |
| Database | `DATABASE_URL` | Required; target a private per-environment PostgreSQL database. |
| Browser/proxy | `FRONTEND_URL`, `CORS_ORIGIN`, `CORS_CREDENTIALS`, `TRUST_PROXY` | Production requires one explicit HTTPS `FRONTEND_URL`; same-origin deployment leaves `CORS_ORIGIN` unset, and any supplied value must exactly match. `CORS_CREDENTIALS` is literal `true` or `false`. |
| Voyage | `VOYAGE_API_KEY`, `VOYAGE_REQUEST_TIMEOUT_MS`, `VOYAGE_READINESS_PROBE_CACHE_MS` | The key is backend-only and required in production; readiness does not permit a fallback provider. |
| Email | `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_*` | `mock` is rejected in production. SMTP requires complete validated configuration. |
| Limits | `RATE_LIMIT_*`, `JSON_BODY_LIMIT_BYTES`, `IMPORT_UPLOAD_*` | The process-local rate limits support the reviewed single-backend topology. |
| Audit/auth | `JWT_*`, `AUTH_COOKIE_NAME`, `INVITATION_EXPIRES_HOURS`, `RESET_TOKEN_EXPIRES_MINUTES`, `AUDIT_LOG_*` | See the matrix for bounds and operational meaning. |
| Logging | `LOG_LEVEL` | The active logger uses `LOG_LEVEL`, Console/stdout/stderr, and fixed local `logs/error.log` / `logs/combined.log` paths. `LOG_FILE` is not consumed by that logger. |

## Legacy SBERT compatibility

`env.js` still exposes a legacy `config.sbertService` shape for compatibility
with retained research material. It is not a current production dependency and
must not be used to add SBERT to standard Compose startup, liveness, readiness,
or browser traffic. Research-only SBERT is isolated behind the explicit
`legacy-sbert` profile described in the deployment documentation.

## Local CLI validation

After installing the pinned backend dependencies, use the local executable
rather than an unpinned network download:

```powershell
cd backend
.\node_modules\.bin\prisma.cmd validate
```

For the production migration contract, use the explicit `backend-migrate`
maintenance target or `npm run prisma:migrate:deploy` from an already-installed
reviewed release checkout. Do not use `prisma migrate dev` or `prisma db push`
for a deployment.
