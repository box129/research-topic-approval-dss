# Similarity Snapshot Read Smoke Checklist

## Purpose

Use this checklist to verify that lecturers can read stored similarity check snapshots for a submission through:

```text
GET /api/v1/lecturer/submissions/:id/similarity-snapshots
```

This endpoint is evidence-only. Reading snapshots must not create new snapshots, rerun similarity checks, or change the submission status.

## Prerequisites

- Backend is running on port `3000`
- The development database has committed migrations applied
- Auth demo users are seeded
- Demo comparison topics are seeded
- At least one similarity snapshot exists for the target submission

To create a snapshot first, run the lecturer similarity check endpoint:

```text
POST /api/v1/lecturer/submissions/:id/similarity-check
```

Recommended setup:

```powershell
cd backend
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed:auth-demo
npm run prisma:seed:demo-comparison
```

Do not run `prisma db push`.

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

Replace `SUBMISSION_ID` with the target submission id.

### 1. Count Snapshots Before GET

Use pgAdmin, Prisma Studio, or SQL:

```sql
SELECT COUNT(*)
FROM similarity_check_snapshots
WHERE submission_id = SUBMISSION_ID;
```

Record this as `beforeSnapshotCount`.

### 2. Lecturer Login

```powershell
curl.exe -i -c lecturer-cookies.txt -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" http://localhost:3000/api/v1/auth/login
```

Expected:

- HTTP `200`
- `rtadss_session` cookie is set

### 3. Read Snapshot History

```powershell
curl.exe -i -b lecturer-cookies.txt http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID/similarity-snapshots
```

Expected:

- HTTP `200`
- response `status` is `success`
- `data.submission_id` matches `SUBMISSION_ID`
- `data.snapshots` is an array

When snapshots exist, each item should include:

- `checked_by.id`
- `checked_by.name`
- `checked_by.email`
- `response_status`
- `overall_risk`
- `max_similarity`
- `recommendation`
- `result_summary`
- `created_at`

Snapshots should be sorted newest first and limited to 10 rows.

### 4. Confirm Submission Status Is Unchanged

```powershell
curl.exe -i -b lecturer-cookies.txt http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID
```

Expected:

- HTTP `200`
- submission status is unchanged
- for an untouched pending test submission, status should remain `pending_review`

### 5. Lecturer Logout

```powershell
curl.exe -i -b lecturer-cookies.txt -X POST http://localhost:3000/api/v1/auth/logout
```

Expected:

- HTTP `200`
- session cookie is cleared

### 6. Count Snapshots After GET

Run the same count query:

```sql
SELECT COUNT(*)
FROM similarity_check_snapshots
WHERE submission_id = SUBMISSION_ID;
```

Expected:

- `afterSnapshotCount` equals `beforeSnapshotCount`
- no new snapshot is created by the read endpoint

## Expected Safety Behavior

- Reading snapshots does not create a new snapshot.
- Reading snapshots does not rerun similarity checks.
- Reading snapshots does not mutate `Submission.status`.
- Reading snapshots does not affect public similarity endpoints:
  - `POST /api/similarity/check`
  - `POST /api/v1/check-similarity`
- Reading snapshots does not auto-approve, auto-reject, or request revision.

## No-Snapshot Case

For an existing submission with no stored snapshots:

```powershell
curl.exe -i -b lecturer-cookies.txt http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID/similarity-snapshots
```

Expected:

```json
{
  "status": "success",
  "data": {
    "submission_id": 5,
    "snapshots": []
  }
}
```

An empty snapshot list is valid and should not be treated as an error.

## Auth And Role Expectations

- Unauthenticated users should be rejected.
- Students should be rejected.
- Admin users should be rejected for this lecturer-only endpoint.
- Lecturers should be allowed.

Optional checks:

```powershell
# No cookie: should be rejected
curl.exe -i http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID/similarity-snapshots

# Student cookie: should be rejected
# Admin cookie: should be rejected
# Lecturer cookie: should return 200 when submission exists
```

## Warnings

- Snapshots are evidence, not final approval or rejection decisions.
- Exact score values may vary because they were captured at similarity-check time.
- Repeated `POST /api/v1/lecturer/submissions/:id/similarity-check` calls may create multiple snapshots.
- The `GET /similarity-snapshots` endpoint should not create additional snapshots.
- Do not use `prisma db push`.
- If Prisma drift appears, stop and do not reset automatically.

## Research And Defense Note

The read endpoint supports auditability and transparency. Stored snapshots can show when similarity checks were performed and what evidence was available to the lecturer at that time.

This helps explain the system as decision support rather than automatic topic approval. Final approval, rejection, or revision requests remain separate lecturer-controlled actions.
