# Demo Comparison Topics

This guide explains how to seed local demo comparison topics so the similarity engine can return meaningful matches during development demos and smoke tests.

The demo rows are not real institutional records. They are public-health-style sample topics for local testing only.

## What The Seed Does

The demo seed inserts rows into:

- `historical_topics`
- `current_session_topics`
- `under_review_topics`

Each row is tagged with:

```text
source_type = demo
source_filename = demo-comparison-topics.json
import_batch_id = demo-comparison-topics-v1
```

The script is idempotent. Before inserting, it deletes only rows with:

```text
import_batch_id = demo-comparison-topics-v1
```

It does not delete users, submissions, academic sessions, categories, or topic rows that do not have this demo batch id.

## Run The Seed

From `backend/`:

```powershell
npm run prisma:seed:demo-comparison
```

This writes demo rows to the configured development database. Use a fresh or disposable development database where possible.

Do not use `prisma db push` for this workflow. If Prisma reports drift, stop and decide whether to use a fresh development database before resetting anything.

## Verify Counts

Run these SQL queries against the configured development database:

```sql
SELECT COUNT(*) FROM historical_topics WHERE import_batch_id = 'demo-comparison-topics-v1';
SELECT COUNT(*) FROM current_session_topics WHERE import_batch_id = 'demo-comparison-topics-v1';
SELECT COUNT(*) FROM under_review_topics WHERE import_batch_id = 'demo-comparison-topics-v1';
```

Expected demo counts:

```text
historical_topics: 6
current_session_topics: 1
under_review_topics: 2
```

The under-review rows use dynamic `review_started_at` values when seeded so they remain inside the 48-hour window used by the similarity query.

## Safe Cleanup

Remove only the demo rows by `import_batch_id`:

```sql
DELETE FROM historical_topics WHERE import_batch_id = 'demo-comparison-topics-v1';
DELETE FROM current_session_topics WHERE import_batch_id = 'demo-comparison-topics-v1';
DELETE FROM under_review_topics WHERE import_batch_id = 'demo-comparison-topics-v1';
```

Do not delete rows without the demo `import_batch_id`; those may be real imported records or other local test data.

## Demo Smoke Test

1. Seed local auth demo users if needed:

```powershell
cd backend
npm run prisma:seed:auth-demo
```

2. Seed demo comparison topics:

```powershell
npm run prisma:seed:demo-comparison
```

3. Start the backend on port `3000` and the frontend on port `5173`.

4. Log in as the student demo user:

```text
student.demo@uniosun.edu.ng
DemoPass123
```

5. Create a pending submission with this title:

```text
Assessment of Health Awareness Campaigns on Student Malaria Prevention Practices
```

Optional category:

```text
Public Health
```

Optional keywords:

```text
malaria prevention, health awareness campaigns, undergraduate students, Osogbo
```

6. Log out and log in as the lecturer demo user:

```text
lecturer.demo@uniosun.edu.ng
DemoPass123
```

7. Open the pending review detail page for the student submission.

8. Click `Run Similarity Check`.

Expected result:

- A similarity result panel renders.
- The response should include non-empty matches from the demo comparison tables.
- `success` or `partial_success` is acceptable.
- Exact risk level may vary based on SBERT availability and lexical scoring.
- The submission status remains unchanged.
- Approve, Request Revision, and Reject remain separate explicit lecturer actions.

## Demo Topic Coverage

The fixture includes:

- near-duplicate malaria/student topic
- paraphrased malaria/student topic
- unrelated machine-learning/stock-market topic
- same student population with different focus
- same malaria-prevention focus with different location
- same disease with different population
- current-session approved topic for Tier 2
- under-review topics inside the 48-hour Tier 3 window

These rows are intended for local demonstration only and must not be described as real departmental records.
