# Similarity Snapshot Storage Smoke Checklist

## Purpose

Use this checklist to verify that lecturer similarity checks create stored snapshot evidence after PR #19.

The smoke test confirms that:

- a lecturer similarity check through the wrapper endpoint creates a `SimilarityCheckSnapshot` record
- the original similarity response is still returned to the frontend/API caller
- `Submission.status` remains unchanged
- lecturer decisions remain separate from similarity checking

## Prerequisites

- Backend is running on port `3000`
- The development database has committed migrations applied
- Auth demo users are seeded
- Demo comparison topics are seeded
- A pending submission exists, such as submission id `5`

If submission id `5` does not exist, create a fresh student submission using the auth and student submission smoke checklists.

Recommended setup commands:

```powershell
cd backend
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed:auth-demo
npm run prisma:seed:demo-comparison
```

Do not run `prisma db push` for this smoke test.

## Automated Verification

Run:

```powershell
cd backend
npx prisma validate
npx prisma generate
npx jest src/services/similaritySnapshot.service.test.js src/controllers/lecturerSimilarity.controller.test.js src/server.test.js --runInBand
```

Optional frontend regression check:

```powershell
cd frontend
npm run build
```

Expected result:

- Prisma schema validates
- Prisma client generates
- targeted snapshot/controller/server tests pass
- optional frontend build passes

If Prisma reports drift, stop and do not reset the database automatically.

## Manual API Smoke

Replace `SUBMISSION_ID` with an existing pending submission id.

### 1. Lecturer Login

```powershell
curl.exe -i -c lecturer-cookies.txt -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" http://localhost:3000/api/v1/auth/login
```

Expected:

- `200 OK`
- `rtadss_session` cookie is set

### 2. Run Similarity Check

```powershell
curl.exe -i -b lecturer-cookies.txt -X POST http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID/similarity-check
```

Expected:

- response is `success` or `partial_success`
- response includes `overall_risk`, `max_similarity`, tier arrays, and recommendation when available
- no approval, rejection, or request-revision decision is made automatically

### 3. Confirm Submission Status Is Unchanged

```powershell
curl.exe -i -b lecturer-cookies.txt http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID
```

Expected:

- `200 OK`
- submission status is still `pending_review`

### 4. Verify Snapshot Row Exists

Use Prisma Studio, pgAdmin, or SQL.

Example SQL:

```sql
SELECT
  id,
  submission_id,
  checked_by_id,
  response_status,
  overall_risk,
  max_similarity,
  recommendation,
  result_summary,
  created_at
FROM similarity_check_snapshots
WHERE submission_id = SUBMISSION_ID
ORDER BY created_at DESC
LIMIT 5;
```

Expected:

- at least one row exists after a successful or partial-success similarity check
- `submission_id` matches the checked submission
- `checked_by_id` matches the lecturer user
- `response_status` is `success` or `partial_success`
- `result_summary` is present

### 5. Lecturer Logout

```powershell
curl.exe -i -b lecturer-cookies.txt -X POST http://localhost:3000/api/v1/auth/logout
```

Expected:

- `200 OK`
- session cookie is cleared

## Expected Snapshot Fields

Each stored snapshot should include:

- `submissionId`
- `checkedById`
- `responseStatus`
- `overallRisk`
- `maxSimilarity`
- `recommendation`
- `resultSummary`
- `createdAt`

The snapshot is intentionally lightweight. It stores summary evidence, not the full raw similarity response.

## Expected Storage Behavior

- `success` responses create a snapshot.
- `partial_success` responses create a snapshot.
- authentication failures do not create a snapshot.
- role failures do not create a snapshot.
- invalid submission id errors do not create a snapshot.
- missing submission errors do not create a snapshot.
- similarity error responses do not create a persisted snapshot.
- storage failure should not block the similarity response.
- repeated clicks may create multiple snapshots.

## Important Warnings

- Exact similarity scores may vary depending on SBERT availability, fallback behavior, local database rows, and rounding.
- Snapshots are evidence that a similarity check was performed, not final approval or rejection decisions.
- Lecturer decisions remain separate from similarity checking.
- Do not use `prisma db push` for this smoke test.
- If Prisma drift appears, stop and do not reset automatically.

## Research And Defense Note

Stored similarity snapshots support auditability and decision-support evidence. They help show:

- which submission was checked
- who checked it
- when it was checked
- what risk and maximum similarity were returned at that time

This is useful for project reporting and defense discussion because it demonstrates traceability without removing human control. Final approval, rejection, or revision requests remain lecturer-controlled decisions.
