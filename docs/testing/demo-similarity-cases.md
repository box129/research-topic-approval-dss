# Demo Similarity Cases and Expected Results

## Purpose

This guide provides controlled demo and evaluation cases for the lecturer similarity pre-check flow. It is intended for local testing, Chapter 3/4 discussion, presentation preparation, and defense practice.

The cases use the demo comparison topics seeded by:

```powershell
cd backend
npm run prisma:seed:demo-comparison
```

They help demonstrate how the similarity checker behaves across near duplicates, paraphrases, unrelated topics, and contextual variations.

## Prerequisites

- Backend running on port `3000`
- Frontend running on port `5173`
- Auth demo users seeded
- Demo comparison topics seeded with `npm run prisma:seed:demo-comparison`
- A student demo account available:
  - `student.demo@uniosun.edu.ng`
  - `DemoPass123`
- A lecturer demo account available:
  - `lecturer.demo@uniosun.edu.ng`
  - `DemoPass123`

## Important Caution

Exact scores are not guaranteed. Similarity output may vary depending on:

- whether the SBERT service is available
- whether SBERT is using real semantic embeddings or fallback behavior
- additional local database rows
- rounding in the frontend display
- when under-review demo rows were seeded

Use this guide to check expected risk and tier patterns, not exact numeric scores.

## Tier Meaning

- Tier 1: historical topics from `historical_topics`
- Tier 2: current session topics from `current_session_topics`
- Tier 3: under-review topics from `under_review_topics` within the recent review window

Similarity checking is decision support only. It should not automatically approve, reject, or mutate a submission.

## Demo Cases

### Case A: HIGH Near Duplicate

Topic:

```text
Assessment of Health Awareness Campaigns on Student Malaria Prevention Practices
```

What it demonstrates:

This is close to the seeded malaria prevention and student health campaign examples.

Expected risk and tier pattern:

- Likely `HIGH`
- Tier 1 should be non-empty
- Tier 2 and Tier 3 may also show conflicts

Interpretation note:

This case is useful for showing that the system can catch topic repetition even when wording is not exactly identical.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case B: MEDIUM Or HIGH Paraphrased Topic

Topic:

```text
Influence of Public Awareness Programmes on Malaria Prevention Behaviour among University Students
```

What it demonstrates:

This tests paraphrase detection across malaria prevention, awareness campaigns, and university student populations.

Expected risk and tier pattern:

- Likely `MEDIUM` or `HIGH`, depending on SBERT availability and local data
- Should show malaria/student-related matches

Interpretation note:

This case helps explain why semantic similarity is useful: the topic can be meaningfully similar even when the wording differs.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case C: LOW Unrelated Topic

Topic:

```text
Design and Implementation of a Library Seat Reservation System
```

What it demonstrates:

This is unrelated to the public-health and malaria demo topics.

Expected risk and tier pattern:

- Likely `LOW`
- No strong public-health similarity match is expected

Interpretation note:

Do not use the exact seeded unrelated topic as a LOW test submission. Exact seeded matches may correctly return `HIGH` because the title is already present in the comparison data.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case D: Same Population, Different Focus

Topic:

```text
Relationship Between Sleep Habits and Academic Performance among Undergraduate Students in Osogbo
```

What it demonstrates:

This shares a student and Osogbo population pattern but has a different study focus.

Expected risk and tier pattern:

- May show similarity to student/Osogbo records
- Risk may vary depending on lexical and semantic overlap

Interpretation note:

This case is useful for explaining that matching population alone should not automatically mean duplicate topic meaning.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case E: Same Focus, Different Location

Topic:

```text
Assessment of Malaria Prevention Practices among Undergraduate Students in Lagos State
```

What it demonstrates:

This shares malaria prevention and undergraduate student focus but changes the location.

Expected risk and tier pattern:

- May produce strong similarity
- Historical matches may be non-empty

Interpretation note:

This case helps explain why lecturer judgment remains important. A topic may be similar in focus but meaningfully different because of location.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case F: Same Disease, Different Population

Topic:

```text
Knowledge of Malaria Prevention among Mothers of Under-Five Children in Osogbo
```

What it demonstrates:

This shares the malaria prevention theme but changes the population from students to mothers of under-five children.

Expected risk and tier pattern:

- May show malaria-related similarity
- Historical matches may be non-empty

Interpretation note:

This case demonstrates why topic similarity should consider population, not only disease or keywords.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case G: Current Session Conflict

Topic:

```text
Effect of School Health Campaigns on Malaria Prevention among Undergraduate Students in Osun State
```

What it demonstrates:

This is close to the current-session seeded topic.

Expected risk and tier pattern:

- Tier 2 should help demonstrate a current-session comparison
- Overall risk may be `MEDIUM` or `HIGH`

Interpretation note:

This case is useful when explaining why current-session checks matter: two students may submit similar topics in the same approval cycle.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

### Case H: Under-Review Conflict

Topic:

```text
Awareness Campaigns and Malaria Prevention Practices among Students in Osogbo Tertiary Institutions
```

What it demonstrates:

This is close to the seeded under-review topic.

Expected risk and tier pattern:

- Tier 3 should help demonstrate an under-review comparison
- Overall risk may be `MEDIUM` or `HIGH`

Interpretation note:

Under-review rows use a recent review window. If Tier 3 is unexpectedly empty, rerun `npm run prisma:seed:demo-comparison` so the demo under-review timestamps are refreshed.

Submission status reminder:

After running the similarity check, the submission should remain `pending_review`.

## Browser Test Flow

Repeat this flow for each demo case as needed:

1. Log in as the student demo user.
2. Open `/student/submit-topic`.
3. Create a submission using the demo topic title.
4. Log out.
5. Log in as the lecturer demo user.
6. Open `/lecturer/pending-reviews`.
7. Open the submission detail page.
8. Click `Run Similarity Check`.
9. Observe the risk level, maximum similarity, recommendation, and tier results.
10. Confirm the submission status remains `pending_review`.

The similarity panel must remain separate from lecturer decision actions. Running a similarity check should not approve, reject, request revision, or store a result.

## Optional API Flow

Use these examples as a concise API smoke flow. Replace `SUBMISSION_ID` with the created submission id.

```powershell
# Student login
curl.exe -i -c student-cookies.txt -H "Content-Type: application/json" -d "{\"email\":\"student.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" http://localhost:3000/api/v1/auth/login

# Create a submission
curl.exe -i -b student-cookies.txt -H "Content-Type: application/json" -d "{\"title\":\"Assessment of Health Awareness Campaigns on Student Malaria Prevention Practices\",\"category\":\"Public Health\",\"keywords\":\"malaria, prevention, students, awareness\"}" http://localhost:3000/api/v1/submissions

# Lecturer login
curl.exe -i -c lecturer-cookies.txt -H "Content-Type: application/json" -d "{\"email\":\"lecturer.demo@uniosun.edu.ng\",\"password\":\"DemoPass123\"}" http://localhost:3000/api/v1/auth/login

# Run wrapper-based similarity check
curl.exe -i -b lecturer-cookies.txt -X POST http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID/similarity-check

# Confirm submission status is unchanged
curl.exe -i -b lecturer-cookies.txt http://localhost:3000/api/v1/lecturer/submissions/SUBMISSION_ID

# Logout
curl.exe -i -b lecturer-cookies.txt -X POST http://localhost:3000/api/v1/auth/logout
```

Expected API behavior:

- Similarity response is `success` or `partial_success`
- Response includes risk, maximum similarity, recommendation, and tier arrays
- `partial_success` is acceptable when SBERT is unavailable
- The follow-up detail request still shows the same submission status

## Confirmed Local Smoke Snapshot

One local smoke test after seeding demo comparison topics used this submission:

```text
Assessment of Health Awareness Campaigns on Student Malaria Prevention Practices
```

Observed result:

- `status`: `success`
- `overall_risk`: `HIGH`
- `max_similarity`: `81.4`
- Tier 1 historical matches were non-empty
- Tier 2 current-session matches were non-empty
- Tier 3 under-review matches were non-empty
- Submission status stayed `pending_review`

This is a snapshot from one local demo run, not a guaranteed score for every environment.

## Research Evaluation Use

These cases can support the project write-up by showing controlled examples of lexical and semantic similarity behavior:

- near duplicates show direct repetition detection
- paraphrases show why semantic comparison is useful
- unrelated topics show expected low-risk behavior
- context variation cases show why population, location, and study focus matter
- Tier 2 and Tier 3 cases show why current-session and under-review comparisons are useful in a topic approval workflow

Final evaluation metrics such as precision, recall, and F1-score should be handled in a later evaluation PR using a controlled labelled dataset.
