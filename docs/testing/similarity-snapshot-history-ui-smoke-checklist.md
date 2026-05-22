# Similarity Snapshot History UI Smoke Checklist

## Purpose

Use this checklist to verify that the lecturer submission detail page displays saved similarity snapshot history.

The history panel is evidence-only. It should help lecturers see previous similarity checks without approving, rejecting, or changing a submission.

This smoke test confirms:

- saved similarity snapshots appear on the lecturer detail page
- the history panel is separate from live similarity checking
- Basic Decision actions remain separate from similarity evidence
- reading history does not mutate `Submission.status`

## Prerequisites

- Backend is running on port `3000`
- Frontend is running on port `5173`
- The development database has committed migrations applied
- Auth demo users are seeded
- Demo comparison topics are seeded
- At least one stored snapshot exists for the target submission

Recommended setup:

```powershell
cd backend
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed:auth-demo
npm run prisma:seed:demo-comparison
```

If no snapshot exists yet, open the lecturer submission detail page and click `Run Similarity Check` once.

Do not run `prisma db push`.

## Automated Verification

Run the frontend build:

```powershell
cd frontend
npm run build
```

Run backend regression checks for the snapshot endpoint used by the UI:

```powershell
cd backend
npx prisma validate
npx prisma generate
npx jest src/services/similaritySnapshot.service.test.js src/controllers/lecturerSimilarity.controller.test.js src/server.test.js --runInBand
```

Expected result:

- frontend build passes
- Prisma schema validates
- Prisma client generates
- targeted snapshot/controller/server tests pass

If Prisma reports drift, stop and do not reset the database automatically.

## Manual Browser Smoke

Use a lecturer demo account:

- `lecturer.demo@uniosun.edu.ng`
- `DemoPass123`

Steps:

1. Start the backend on port `3000`.
2. Start the frontend on port `5173`.
3. Log in as the lecturer demo user.
4. Open `/lecturer/pending-reviews`.
5. Open a submission detail page, preferably a submission with saved snapshots such as submission id `5`.
6. Confirm the page shows these sections in order:
   - `Similarity Pre-check`
   - `Similarity Check History`
   - `Basic Decision`
7. Confirm the `Similarity Check History` section loads.
8. If no snapshots exist, confirm the empty state appears:

```text
No similarity checks have been saved for this submission yet.
```

9. If snapshots exist, confirm saved history cards appear.
10. Confirm each visible snapshot card shows:
    - checked by
    - response status
    - overall risk
    - max similarity
    - recommendation
    - created date
    - tier counts
11. Confirm full top matches are not displayed in this PR.
12. Click `Run Similarity Check`.
13. Confirm the live result still appears in the `Similarity Pre-check` section.
14. Confirm `Similarity Check History` refreshes and shows the newly saved snapshot.
15. Confirm the submission status remains unchanged.
16. Confirm `Basic Decision` buttons remain visually and behaviorally separate.

## Network Smoke

Open browser DevTools and use the Network tab.

On page load, confirm a request is made to:

```text
GET /api/v1/lecturer/submissions/:id/similarity-snapshots
```

After clicking `Run Similarity Check`, confirm:

```text
POST /api/v1/lecturer/submissions/:id/similarity-check
```

Then confirm the history is refreshed with another read request:

```text
GET /api/v1/lecturer/submissions/:id/similarity-snapshots
```

The old public similarity endpoint should not be used by the lecturer detail pre-check flow:

```text
POST /api/similarity/check
```

## Expected Safety Behavior

- The UI history does not approve or reject a topic.
- The UI history does not mutate `Submission.status`.
- The UI history does not trigger similarity checks by itself.
- The UI history does not store new snapshots by itself.
- Snapshot history is saved evidence, not a final lecturer decision.
- Basic Decision buttons remain separate from similarity evidence.

## Warnings

- Repeated `Run Similarity Check` clicks may create multiple snapshots.
- Exact scores may vary depending on the similarity check environment at the time of capture.
- The frontend displays saved scores from previous checks.
- Do not use `prisma db push`.
- If Prisma drift appears, stop and do not reset automatically.

## Research And Defense Note

The UI demonstrates transparent access to stored similarity evidence. Lecturers can view previous checks before making a human decision, which supports auditability and decision-support explanation.

Final approval, rejection, or revision requests remain separate from similarity evidence.
