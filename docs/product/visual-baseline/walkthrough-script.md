# Walkthrough Script

Scene-by-scene script for the four role videos. Every scene lists the role,
action, page, purpose, the on-screen caption, the expected state, and an
approximate duration, so the recordings can be reproduced later with
`tooling/record-videos.mjs` against the accepted tree
(`staging/render-acceptance` @ `ff833cf0bc645bd4678bf480bb3c4070216f78cf`).

Conventions: 1920×1080, silent, on-screen captions and title cards, a drawn
pointer, deliberate pacing with reading pauses. **All data is synthetic**
(see `tooling/synthetic-dataset.mjs`). Where another role must act mid-video,
the action is performed through the API between segments and announced by a
caption — the frontend never fakes a transition.

---

## Video 1 — `01-system-overview.mp4` (target 2–4 min)

| # | Role | Action | Page | Purpose | Caption | Expected state | ~s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Title card | `/` | Orient | "Research Topic Approval DSS — System overview" | Landing behind card | 4 |
| 2 | Public | Read, scroll | `/` | What the product is | "A decision-support system for research topic approval…" / "Students check and submit topics; lecturers review…; administrators manage…" | Landing sections | 10 |
| 3 | Student | Sign in by matric | `/login` → `/student/dashboard` | Show matric login | "Sign in as a student (matric number)" | Dashboard with an approved topic | 12 |
| 4 | Student | Open My Submissions | `/student/my-submissions` | Status + history | "My Submissions — status, lecturer feedback and history" | Approved card | 8 |
| 5 | Lecturer | Sign out, sign in by email | `/login` → `/lecturer/dashboard` | Lecturer entry | "Sign in as a lecturer (email)" | Dashboard | 12 |
| 6 | Lecturer | Pending Reviews | `/lecturer/pending-reviews` | Identity in queue | "…students identified by name and matric number; email only when they have one" | Queue with a no-email student | 12 |
| 7 | Admin | Sign out, sign in | `/admin/dashboard` | Admin entry | "Administrator dashboard — service health and key counts" | Health + metrics | 10 |
| 8 | Admin | User Management, Topic Repository | `/admin/user-management`, `/admin/topic-repository` | Scope of admin | "User Management — individual and bulk onboarding…" / "Topic Repository — historical, current-session and under-review topics" | Lists populated | 14 |
| 9 | — | End card | — | Close | "End of overview" | — | 3 |

## Video 2 — `02-student-walkthrough.mp4` (target 4–7 min)

Preparation (API, before recording): administrator provisions a new student
(no email; a fresh per-run matric such as `PHD/24/7271`) and assigns them to lecturer L1.

| # | Role | Action | Page | Purpose | Caption | Expected state | ~s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Title card | `/` | Orient | "Student walkthrough — From first sign-in to an approved topic" | — | 4 |
| 2 | Student | Sign in with matric + one-time credential | `/login` | Matric login | "Sign in as a student, using the matric number and the one-time credential" | Redirect to change password | 14 |
| 3 | Student | Forced password change | `/change-password` | First-login rule | "First sign-in: the temporary credential must be replaced before anything else" | Dashboard, no topic yet | 18 |
| 4 | Student | Check My Topic — fill title, population, location, study focus | `/student/check-my-topic` | Structured context | "The title plus population, location and study focus form the structured representation that is compared" | Form filled | 40 |
| 5 | Student | Run check; read results | same | Similarity evidence | "A plain-language similarity level leads; related topics show their population, location, study focus and session" / "Raw scores stay behind 'Show technical details' — similarity is advisory; the lecturer decides" | Results with HIGH match and context | 22 |
| 6 | Student | Submit Topic — fill and review | `/student/submit-topic` | Same context captured | "Submit Topic — the same research context is captured with the submission" / "Review before submitting — nothing is saved until confirmed" | Review panel | 45 |
| 7 | Student | Confirm; open My Submissions | `/student/my-submissions` | Pending state | "Submitted — the topic is now pending lecturer review" / "My Submissions — pending review" | Pending card | 12 |
| 8 | (API) Lecturer | Request revision with rationale | — | Prepare state | "Meanwhile, the lecturer reviews the topic and requests a revision with written feedback…" | — | 4 |
| 9 | Student | Reload | `/student/my-submissions` | Action required | "Action required — the lecturer feedback is shown right where the action is" | Card with feedback + Revise button | 8 |
| 10 | Student | Revise and Resubmit — pre-filled; edit population and study focus | `/student/my-submissions/:id/revise` | Revision UX | "Revise and Resubmit — pre-filled with the original topic and context; the feedback stays visible" | Edited form | 30 |
| 11 | Student | Review; confirm | same | Linked revision | "Confirming creates a new submission linked to the original — the original is kept, not replaced" | Confirmation | 10 |
| 12 | Student | My Submissions | `/student/my-submissions` | Lineage | "Revised submission under review, with the revision history on both entries" | Two linked cards | 10 |
| 13 | (API) Lecturer | Approve the revision | — | Prepare state | "The lecturer approves the revised topic…" | — | 3 |
| 14 | Student | Reload; Dashboard | `/student/my-submissions`, `/student/dashboard` | Outcome | "Approved — the outcome, the history and the next step are all visible" / "Dashboard reflects the approved topic" | Approved | 12 |
| 15 | — | End card | — | Close | "End of student walkthrough" | — | 3 |

## Video 3 — `03-lecturer-walkthrough.mp4` (target 4–7 min)

| # | Role | Action | Page | Purpose | Caption | Expected state | ~s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Title card | `/` | Orient | "Lecturer walkthrough — Reviewing with similarity evidence" | — | 4 |
| 2 | Lecturer | Sign in by email | `/login` → `/lecturer/dashboard` | Entry | "Sign in as a lecturer" / "Lecturer dashboard — the queue at a glance" | Dashboard | 14 |
| 3 | Lecturer | Pending Reviews | `/lecturer/pending-reviews` | Identity by matric | "Pending Reviews — each student is identified by name and matric number; an email appears only when one exists" | Queue incl. no-email rows | 12 |
| 4 | Lecturer | Open Review on a pending submission | `/lecturer/pending-reviews/:id` | Detail | "Review detail — the submitted topic and its research context" | Detail with context | 8 |
| 5 | Lecturer | Run similarity check; read | same | Evidence | "Running an advisory similarity check on the stored structured representation…" / "Related stored topics with their context — evidence to judge, not a verdict" | Results with context | 24 |
| 6 | Lecturer | Type rationale; Request Revision; confirm | same | Rationale required | "A decision needs a rationale when it sends work back to the student" / "Confirm — the student is notified with the feedback" | Status updated | 30 |
| 7 | (API) Student | Revise with changed context | — | Prepare state | "The student revises and resubmits (prepared between segments)…" | — | 4 |
| 8 | Lecturer | Pending Reviews; open the revision | `/lecturer/pending-reviews` → detail | Revision marker | "The revised submission returns to the queue, marked as a revision with the feedback that produced it" | Revised row | 12 |
| 9 | Lecturer | Read revision context | detail | Comparison | "Revision context — what was proposed before, the feedback given, and what is proposed now" | Panel with previous/current | 10 |
| 10 | Lecturer | Approve; confirm | detail | Outcome | "Approve — the topic joins the current-session repository" | Approved | 8 |
| 11 | Lecturer | My Decisions | `/lecturer/my-decisions` | History | "My Decisions — history with rationale, filters and pagination" | List | 8 |
| 12 | Lecturer | Check Similarity — fill and run | `/lecturer/check-similarity` | Direct checker | "Check Similarity — the same advisory checker, for any proposed topic" / "Results carry the stored session and supervisor when the record has them" | Results | 40 |
| 13 | Lecturer | Supervisees; Research Trends | `/lecturer/supervisees`, `/lecturer/research-trends` | Remaining pages | "Supervisees — students assigned by the administrator" / "Research Trends — a read-only view of stored topics" | Lists | 12 |
| 14 | — | End card | — | Close | "End of lecturer walkthrough" | — | 3 |

## Video 4 — `04-admin-walkthrough.mp4` (target 5–8 min)

| # | Role | Action | Page | Purpose | Caption | Expected state | ~s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Title card | `/` | Orient | "Administrator walkthrough — Accounts, onboarding and records" | — | 4 |
| 2 | Admin | Sign in | `/login` → `/admin/dashboard` | Entry | "Sign in as an administrator" / "Administrator dashboard — service health and key counts" | Dashboard | 14 |
| 3 | Admin | User Management | `/admin/user-management` | Scope | "User Management — search, status, identity, credentials, assignments" | List | 6 |
| 4 | Admin | Create a student without email | same | Matric-first identity | "Create an individual account: a student is identified by matric number; email is optional" / "A one-time temporary password is shown once (masked here) — with no email, it is handed over directly" | Credential panel, masked | 40 |
| 5 | Admin | Create a lecturer | same | Email identity | "A lecturer is identified by email" / "Lecturer created — credential masked; an invitation email can be sent instead" | Credential panel, masked | 30 |
| 6 | Admin | Bulk onboarding — upload, preview | same | Preview before commit | "Bulk onboarding — upload a spreadsheet… and preview before anything is created" / "Preview: valid new accounts, one conflict…, one lecturer without an email — nothing created yet" | Preview table | 30 |
| 7 | Admin | Commit | same | Manifest | "Commit: accounts created; the one-time credential manifest is the only copy…" | Manifest panel (no plaintext) | 14 |
| 8 | Admin | Invitation — eligible account | same | Invitation | "Invitation: available for a new account that has an email" | Invited | 14 |
| 9 | Admin | Invitation — no-email account | same | Truthful refusal | "For a student without an email, the system refuses truthfully — the credential is handed over instead" | Refusal notice | 12 |
| 10 | Admin | Credential reset | same | Recovery without email | "Credential reset: a lost credential is replaced…; previous sessions are signed out" / "Shown once, masked here" | Masked panel | 16 |
| 11 | Admin | Topic Repository | `/admin/topic-repository` | Records | "Topic Repository — historical, current-session and under-review topics with their research context" | Lists | 12 |
| 12 | Admin | Audit Log; Reports; System Settings | `/admin/audit-log`, `/admin/reports`, `/admin/system-settings` | Governance | "Audit Log — …correlated by request" / "Reports — summary counts and CSV exports" / "System Settings — effective non-secret configuration…" | Pages | 18 |
| 13 | — | End card | — | Close | "End of administrator walkthrough" | — | 3 |

## Reproduction

```
# stack up on https://localhost:8444 with a fresh demo database (see README)
NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/product/visual-baseline/tooling/capture-screenshots.mjs
VB_FFMPEG=<path-to-ffmpeg-with-libx264> NODE_TLS_REJECT_UNAUTHORIZED=0 \
  node docs/product/visual-baseline/tooling/record-videos.mjs
```

`NODE_TLS_REJECT_UNAUTHORIZED=0` is required only because the local acceptance
edge uses a self-signed certificate; it applies to the capture script's own
process, never to the application.
