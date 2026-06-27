# Render Backend Online Proof

## Status

PR #128 records safe online evidence for the Render backend stage of the free managed staging path. It also corrects the Render build command to the command that succeeded online:

```text
npm install && npx prisma generate
```

This proof does not complete Vercel frontend deployment, Vercel-to-Render API routing, full staging proof, or public production readiness.

## Public Backend Endpoint

The Render backend service is publicly reachable at:

```text
https://research-topic-approval-dss-backend.onrender.com
```

This URL is intentionally documented because it is the public staging backend origin needed for later Vercel routing proof. No Render dashboard secrets, private service tokens, environment values, or screenshots containing secrets are included.

## Render Deployment Evidence

| Check | Result | Safe evidence |
| --- | --- | --- |
| Render service built | Passed | Render build completed successfully. |
| Prisma Client generation | Passed | `npx prisma generate` succeeded during the Render build. |
| Backend start command | Passed | Render started the backend with `npm start`. |
| Runtime port | Observed | Server ran on Render port `10000`. |
| Render live status | Passed | Render reported the service live. |
| Public backend URL | Confirmed | `https://research-topic-approval-dss-backend.onrender.com` |

The earlier PR #127 suggested `npm ci && npx prisma generate`. The online Render deployment showed that command is not suitable for the current backend lockfile state. The working build command is now documented as:

```text
npm install && npx prisma generate
```

## Health Check Evidence

The online health endpoint was checked:

```text
GET https://research-topic-approval-dss-backend.onrender.com/api/v1/health
```

It returned:

```json
{
  "status": "OK",
  "message": "Server is running",
  "environment": "production",
  "apiVersion": "v1"
}
```

This proves the Express process is running in production mode on Render. It does not by itself prove full application readiness, Vercel routing, authenticated workflows, or production deployment completion.

## Neon Migration Evidence

`npx prisma migrate deploy` was run manually from the local `backend` folder using a private Neon `DATABASE_URL` entered without printing it.

Seven migrations were applied successfully:

```text
20260518120000_init_v1_auth_foundation
20260519133945_add_student_submissions
20260522121805_add_similarity_check_snapshots
20260522202153_add_submission_decision_rationale
20260605164000_add_audit_logs
20260619120000_add_notifications
20260622120000_add_lecturer_supervisee_assignments
```

Prisma reported:

```text
All migrations have been successfully applied.
```

A follow-up `npx prisma migrate status` was attempted after the successful deploy, but it returned `P1001` connectivity error. This should be treated as a pending connectivity/status confirmation, not as evidence that the successful migration deploy failed.

The private `DATABASE_URL` was unset from the shell afterward.

## Secrets And Sensitive Data Excluded

This evidence intentionally excludes:

- the real `DATABASE_URL`
- JWT secrets
- Render environment values
- provider tokens
- SMTP credentials
- database dumps
- screenshots containing secrets
- student records

## Remaining Free Staging Gaps

Still pending:

- follow-up Neon `npx prisma migrate status` confirmation after the `P1001` issue is resolved or explained.
- Render `/api/v1/readiness` proof against Neon and Hugging Face SBERT.
- Vercel frontend deployment.
- Vercel `/api` routing to the Render backend.
- frontend-to-backend health proof through the Vercel origin.
- full free managed staging evidence log completion.

## Current Boundary

Render backend online health proof and Neon migration deploy evidence are recorded. Full free managed staging is not complete until readiness and Vercel evidence are captured safely.
