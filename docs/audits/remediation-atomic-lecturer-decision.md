# Remediation Record — Atomic Lecturer Decision Transition (P0)

Baseline before the fix: `staging/render-acceptance` = `e5e3fc18555fafde7fa409352b37357c0bb22c43`.
Evidence: `docs/audits/production-readiness-forensic-audit.md` (P1-2, raised to P0 in
`docs/audits/production-readiness-finding-adjudication.md` §1).
Branch: `production/atomic-lecturer-decision` (cut from `e5e3fc1`). Scope: this defect only.

# 1. Original P0

A submission awaiting a lecturer decision (`status = PENDING_REVIEW`, the state the product calls "awaiting
review") could receive two terminal decisions. Reproduced on real PostgreSQL through the baseline's own service
and HTTP paths (adjudication §1):

- 48 service-level APPROVE-vs-REJECT races: 41 double-successes; 9 ended `REJECTED` while a searchable
  `CURRENT_SESSION` corpus row for the same submission survived every refresh;
- in the other ordering the later commit silently overwrote the earlier decision and its rationale, both callers
  receiving 200;
- 2 contradictory "Topic approved"/"Topic rejected" notifications per race; 0 audit rows;
- 17/36 HTTP controller-path races inconsistent.

# 2. Root Cause

`updateLecturerSubmissionStatus` (`backend/src/services/submission.service.js`) read the submission and checked
`status === 'PENDING_REVIEW'` **before** opening the transaction, then updated the row inside the transaction
with `tx.submission.update({ where: { id } })` — a predicate on `id` alone. Two callers passing the pre-check
concurrently both updated; the row lock only serialised them, it never re-checked the status. The lifecycle
writes (`currentSessionTopic.upsert`, `underReviewTopic.deleteMany`), the corpus refresh and the student
notification then ran for both.

# 3. Atomicity Strategy

The database decides the winner. Inside the existing transaction the transition is now a compare-and-set:

```js
const transition = await tx.submission.updateMany({
  where: { id, status: 'PENDING_REVIEW' },
  data: decisionData
});
if (transition.count !== 1) { /* 404 if the row vanished, else SUBMISSION_NOT_PENDING (400) */ }
const updated = await tx.submission.findUnique({ where: { id }, include: decisionInclude });
// … lifecycle writes exactly as before, only after a successful transition
```

Prisma emits a single statement (captured with query logging on the scratch database):

```
UPDATE "public"."submissions" SET "status" = …, "decided_by_id" = $2, "decided_at" = $3, "decision_reason" = $4, "updated_at" = $5
WHERE ("public"."submissions"."id" = $6 AND "public"."submissions"."status" = 'PENDING_REVIEW')
```

Under PostgreSQL's default READ COMMITTED isolation the second concurrent UPDATE waits on the row lock and
re-evaluates its WHERE clause against the committed row, so it matches zero rows. Zero rows throws inside the
callback, Prisma rolls the interactive transaction back, and nothing after the compare-and-set runs for the loser.
The mechanism needs no in-process lock, no timing, no frontend guard, and holds for two HTTP requests, two Node
processes and network retries. `update` with an extended `where` was deliberately **not** used: Prisma resolves
those extra filters with a preceding SELECT, not in the UPDATE, so it would not have been a compare-and-set.

# 4. Files Changed

| File | Change |
| --- | --- |
| `backend/src/services/submission.service.js` | compare-and-set transition inside the existing transaction; zero-row → existing 400 `SUBMISSION_NOT_PENDING` (404 if the row is gone); decided row re-read in the transaction (+27 / −2) |
| `backend/src/services/submission.service.test.js` | mock factory and decision tests follow the new call sequence (`updateMany` → `findUnique`); two new unit tests for the zero-row outcomes |
| `backend/src/services/semanticRepresentationContract.test.js` | inline Prisma mock gains `updateMany` (fixture only) |
| `backend/tests/integration/lecturerDecisionConcurrency.test.js` | **new** real-PostgreSQL concurrency suite (six tests, 129 races) |

No other file. No frontend change. No schema, migration, Render, Compose, auth, RBAC, Voyage, embedding,
representation, source-hash, threshold, classification, corpus-admission or 48-hour-policy change.

# 5. Transaction Before

```
findUnique(submission)                 ← pre-check: status must be PENDING_REVIEW (outside the transaction)
validate status/reason
[APPROVED] findUnique(underReviewTopic) → reuse or regenerate embedding (outside the transaction)
$transaction:
  update(submission WHERE id)          ← matches regardless of current status
  [APPROVED] upsert(currentSessionTopic by submissionId)
  deleteMany(underReviewTopic by submissionId)
refreshResidentCorpusSafely(); notifyStudentOfSubmissionDecisionSafely(); serialize
```

# 6. Transaction After

```
findUnique(submission)                 ← fast-path pre-check unchanged (sequential repeats still get 400 cheaply)
validate status/reason
[APPROVED] findUnique(underReviewTopic) → reuse or regenerate embedding (outside the transaction, as before)
$transaction:
  updateMany(submission WHERE id AND status = PENDING_REVIEW)   ← the database arbitrates
  count ≠ 1 → throw (404 if vanished, else 400 SUBMISSION_NOT_PENDING) → ROLLBACK, nothing below runs
  findUnique(submission with decisionInclude)                   ← the decided row
  [APPROVED] upsert(currentSessionTopic by submissionId)
  deleteMany(underReviewTopic by submissionId)
refreshResidentCorpusSafely(); notifyStudentOfSubmissionDecisionSafely(); serialize   ← winner only
```

Known, accepted residue (not a state defect): a losing APPROVE that reads the under-review row *after* the
winning REJECT deleted it regenerates a document embedding before its transaction discovers the lost race —
one avoidable provider call in that window; it never writes and still ends in the 400 conflict. Left for the
P2 list; moving the provider call inside the transaction would violate the codebase rule of never calling Voyage
inside a transaction.

# 7. Database Invariant

For every submission: `status ∈ {PENDING_REVIEW}` xor exactly one terminal decision, where

```
terminal status == decision side effects == stored topic lifecycle == resident corpus after refresh
APPROVED  ⇒ current_session_topics has exactly one row for the submission, under_review_topics none, corpus shows CURRENT_SESSION
REJECTED / AWAITING_REVISION ⇒ no current_session_topics row, no under_review_topics row, corpus shows nothing
decisionReason / decidedById belong to the winner only; exactly one decision notification
```

The winner is selected by the row-level compare-and-set, so the invariant holds independently of process count.

# 8. Concurrency Tests

`backend/tests/integration/lecturerDecisionConcurrency.test.js` — real PostgreSQL (`DATABASE_URL`: CI service or a
scratch database), Voyage mocked (`embedQuery`/`embedDocument` stubbed; approvals reuse the valid stored vector),
session cookies signed with the app's own JWT contract, real Express app via `supertest`:

| Case | Iterations | Assertions per race |
| --- | --- | --- |
| Normal single decision (approve, reject) | 2 | behaves exactly as before: promotion / rationale, one notification, no provider call |
| A. service APPROVE vs REJECT, staggers 0–25 ms, alternating starter | 50 | exactly one success, exactly one `400 SUBMISSION_NOT_PENDING` with the existing message; one terminal status; rationale belongs to the winner only; `under_review` row gone; `current_session` row iff APPROVED; corpus after **two** refreshes matches the DB; exactly one notification with the winner's title; both winners observed across the run |
| B. HTTP APPROVE vs REJECT (approve request genuinely started first) | 24 | statuses exactly `[200, 400]`; conflict body uses the existing error envelope and leaks no transaction/database detail; same state assertions |
| C. APPROVE vs APPROVE | 10 | one approval, one conflict, exactly one current-session row |
| D. REJECT vs REJECT | 10 | one rejection, one conflict, no corpus row |
| E. terminal decision, then a sequential retry and two concurrent identical retries | 5 | every retry conflicts; `decidedAt` unchanged; state unchanged |

Repeated locally three times (full run 20.6 s / 69.2 s / 45.3 s): 6/6 each time.

# 9. Before/After Race Results

The **original adjudication harnesses** (unchanged scripts) were rerun against the corrected code on a fresh
scratch database:

| Harness | BEFORE (baseline `e5e3fc1`) | AFTER (`8c588f0`) |
| --- | --- | --- |
| Service-level APPROVE vs REJECT, 48 races (staggers 0/3/15 ms, alternating starter) | 41 double-successes, 7 conflicts; 9 REJECTED submissions with a searchable `CURRENT_SESSION` row; 2 notifications in 41 races | **0 double-successes, 48 one-conflict; 0 inconsistent; exactly 1 notification in 48/48**; winners split 13 approve / 35 reject |
| Sequential control (approve then reject) | second call 400, consistent | second call 400, consistent |
| HTTP controller path, 36 races, approve started 5–70 ms first | 17 inconsistent (both 200, REJECTED + searchable corpus row), 19 conflicts | **0 inconsistent**; 35 × approve 200 / reject 400, 1 × reject 200 / approve 400 |
| HTTP controller path, 16 races, simultaneous start | 8 + 8 double-successes (silent overwrite) | **0 double-successes**; every pair one 200 and one 400 |
| New suite (129 races across A–E) | — | 0 inconsistent, 0 double-success, 0 contradictory notifications |

Targets met: 0 inconsistent final states, 0 double-success terminal races, 0 contradictory terminal notifications.

# 10. Corpus Consistency

Every race in the new suite rebuilds a `ResidentCorpus` snapshot **twice** after the decisions and asserts the
searchable set: APPROVED ⇒ exactly `['CURRENT_SESSION']` for the submission; REJECTED ⇒ `[]`, with the
`under_review_topics` row gone in both cases. Repeated refreshes never reintroduced contradictory state. The
original harness's post-race refresh confirmed the same for all 48 + 36 + 16 races. Admission rules,
`validStoredEmbedding`, source hashes and the 48-hour rule are untouched (§9 of the task).

# 11. Notification Consistency

`notifyStudentOfSubmissionDecisionSafely` runs after the transaction resolves; the loser's transaction throws, so
only the winner reaches it. Measured: exactly one `SUBMISSION_DECISION` notification per race in all 48 harness
races and all 129 suite races, titled for the winning outcome. The notification system itself was not changed.

# 12. Regression Results

| Check | Result |
| --- | --- |
| Focused unit suites (`submission.service.test.js`, `submission.controller.test.js`) | 95 / 95 passed |
| Contract suite (`semanticRepresentationContract.test.js`, fixture-only change) | 21 / 21 passed |
| New real-PostgreSQL concurrency suite | 6 / 6 passed, three consecutive runs |
| Full backend suite (`jest --runInBand`, scratch database) | **76 suites / 1 017 tests passed** (baseline had 75 / 1 009) |
| Frontend | no frontend change; not run |
| Deployment contract (`node scripts/verify-deployment-contract.js`) | PASS |
| Scope | changed files: 1 service + 3 test files; no `prisma/`, migrations, `render.yaml`, Compose, auth, RBAC, Voyage/embedding/representation/similarity/corpus files |

Authorization regression (task §8): the route still requires `requireAuth` + `requireRole('lecturer')`
(`server.js:422`) and the service still calls `assertLecturerUser`; no ownership, student-isolation or admin
check was touched. The HTTP races used two distinct lecturer sessions through the real middleware chain.

# 13. Application Commit

`8c588f0fa19971638b5fe0b4c48d5253336eafb3` — `fix(submissions): make the lecturer decision transition an atomic
database compare-and-set` — branch `production/atomic-lecturer-decision`, parent `e5e3fc1`, pushed.
This record is committed on the same branch immediately after the fix.

# 14. Staging Promotion

`origin/staging/render-acceptance` (`e5e3fc1`) is the parent of the fix commit, so the promotion is a pure
fast-forward (no force push, no merge commit). `staging/render-acceptance` is fast-forwarded to the docs-only
commit that adds this record (the commit immediately after `8c588f0`), so the staging head contains the fix, its
tests and this record; the exact SHA is reported in the task output and visible as `git log -2 staging/render-acceptance`.

# 15. Defence Baseline Integrity

`v0.5.0-defense-baseline` remains the annotated tag object `499af758b4adf9265b44034a64724f69d6d77e5c` (peeled
commit `1898a96e95fb2fb635f8f08b777cb129fdb7529f`); not moved, not touched.

# 16. Deployment Status

NO deployment. NO Render resources. NO billing action. `render.yaml` unchanged; `autoDeployTrigger: off` on both
services. The scratch databases used for verification were dropped.

# 17. Verdict

| | Question | Answer |
| --- | --- | --- |
| A | Can two concurrent terminal decisions both succeed? | **No.** The status-predicated UPDATE admits exactly one; 0 double-successes in 48 + 52 harness races and 129 suite races. |
| B | Can REJECTED retain a searchable CURRENT_SESSION row? | **No.** The loser rolls back before any lifecycle write; 0 such states after the fix (9 before). |
| C | Can APPROVED lose its approved corpus state to a concurrent reject? | **No.** A reject arriving after an approval matches zero rows and writes nothing. |
| D | Can loser rationale overwrite winner rationale? | **No.** `decision_reason`/`decided_by_id` are written only by the single matching UPDATE. |
| E | Can contradictory decision notifications persist? | **No.** Exactly one notification per race, always the winner's. |
| F | Does the fix remain correct across multiple Node processes because the database arbitrates? | **Yes, in principle and by mechanism:** the arbitration is a single conditional UPDATE under PostgreSQL row locking; no process-local state is involved. Verified here with two concurrent requests in one process and one database; multi-process execution was not separately exercised. |
| G | Any schema/migration change? | **None.** |
| H | Any semantic/auth/RBAC change? | **None.** |
| I | Is the P0 closed? | **Yes** for the reproduced defect, on `8c588f0` (fast-forwarded to `staging/render-acceptance`). The remaining P1/P2 findings are untouched by design. |

STOP. Nothing deployed.
