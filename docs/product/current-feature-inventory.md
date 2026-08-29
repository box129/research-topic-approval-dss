# Current Feature Inventory

**Accepted application tree:** `staging/render-acceptance` @
`ff833cf0bc645bd4678bf480bb3c4070216f78cf`.

This lists what the product **actually does today**, by role. Status values:

- **IMPLEMENTED** — reachable and working in the accepted tree.
- **DEFERRED** — exists as a route/scaffold but is deliberately not offered.
- **OPERATOR-ONLY** — no UI; run by the operator against the deployment.

## Identity contract (current)

| Role | Primary identifier | Email |
| --- | --- | --- |
| Student | **Matric number** (required, unique) | Optional personal email (unique when supplied); no university-issued address is assumed |
| Lecturer | Email (required) | — |
| Administrator | Email (required) | — |

Login accepts either an email address or a matric number in one field. A new
account receives a one-time temporary password (shown once to the
administrator) and must change it at first sign-in before any other access.
Self-service password reset and invitations require an email on record;
students without one recover through an administrator credential reset.

---

## STUDENT

| Feature | Route | Purpose | Primary action | Expected result | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Sign in | `/login` | Authenticate by matric number or email | Enter identifier + password | Redirect to Student Dashboard; forced password change on first login | Account provisioned by admin | IMPLEMENTED |
| Forced password change | `/change-password` | Replace the one-time credential | Enter current + new password | Normal access unlocked | First login / after credential reset | IMPLEMENTED |
| Forgot / reset password | `/forgot-password`, `/reset-password` | Self-service recovery | Request link by email; set new password | Reset email delivered; password replaced | Email on record; SMTP configured | IMPLEMENTED |
| Accept invitation | `/accept-invitation` | Activate an invited account | Set password from emailed link | Account active | Email on record; SMTP configured | IMPLEMENTED |
| Dashboard | `/student/dashboard` | Current submission status and next step | Read; follow shortcuts | Shows latest submission, status, "what happens next" | — | IMPLEMENTED |
| Check My Topic | `/student/check-my-topic` | Advisory similarity pre-check before submitting | Enter title (7–24 words) + optional population, location, study focus; run check | Plain-language similarity level, related topics with context (population/location/study focus, session/supervisor when recorded), advisory wording; empty corpus reported truthfully; temporary browser state only | Voyage provider available | IMPLEMENTED |
| Submit Topic | `/student/submit-topic` | Submit a topic for lecturer review | Enter title, optional research context (population, location, study focus), category, keywords; review; confirm | Pending submission created and embedded from the same structured representation as the pre-check | Voyage provider available (submission fails honestly otherwise) | IMPLEMENTED |
| My Submissions | `/student/my-submissions` | History, status, lecturer feedback, action required | Read; open revise action | Each submission shows status, feedback, research context, revision history, next step | — | IMPLEMENTED |
| Revise and Resubmit | `/student/my-submissions/:id/revise` | Respond to a revision request | Edit pre-filled title/context; review; confirm | New submission linked to the original; original preserved with its feedback | Submission in "revision required" state | IMPLEMENTED |
| Notifications | header bell (all pages) | Decision notices with links | Open; mark read | Unread count; deep link to My Submissions | — | IMPLEMENTED |
| Research Explorer | `/student/research-explorer` | Browse approved topics | — | Placeholder with disabled controls and honest "not currently available" copy; **not in navigation** | Pilot feedback decision | **DEFERRED** |

## LECTURER

| Feature | Route | Purpose | Primary action | Expected result | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Sign in | `/login` | Authenticate by email | Enter email + password | Redirect to Lecturer Dashboard | Account provisioned/invited by admin | IMPLEMENTED |
| Dashboard | `/lecturer/dashboard` | Queue overview and shortcuts | Read | Pending count, recent activity, links | — | IMPLEMENTED |
| Pending Reviews | `/lecturer/pending-reviews` | Work queue of pending submissions | Search/filter/sort; open a submission | Rows show title, **student name, matric number, email only when present**, category, submitted date, revision marker with the feedback that produced it | — | IMPLEMENTED |
| Review Detail | `/lecturer/pending-reviews/:id` | Full review of one submission | Read details and research context; run similarity check; decide | Decision recorded; student notified | Voyage for similarity check | IMPLEMENTED |
| Similarity evidence on a submission | (within Review Detail) | Advisory similarity for the stored structured representation | Run check; expand technical details | Plain-language level, related topics with context, snapshot history persisted | Voyage provider available | IMPLEMENTED |
| Decision: Approve / Request Revision / Reject | (within Review Detail) | Record the outcome | Enter rationale (required for revision and rejection); confirm | Status updated; approved topic promoted to current-session repository; revision request removes the under-review copy | — | IMPLEMENTED |
| Revision context | (within Review Detail, for revised submissions) | See what was proposed before, the feedback given, and what is proposed now | Read | Previous title/context, previous feedback, current proposal | Submission is a revision | IMPLEMENTED |
| My Decisions | `/lecturer/my-decisions` | Paginated decision history | Filter by status/date; sort | List of own decisions with rationale | — | IMPLEMENTED |
| Supervisees | `/lecturer/supervisees` | Students assigned by the administrator | Read | Assigned students and their latest submission status | Admin-managed assignments | IMPLEMENTED |
| Check Similarity | `/lecturer/check-similarity` | Direct advisory checker for any proposed topic | Enter title + context; run | Same result contract as the student checker | Voyage provider available | IMPLEMENTED |
| Research Trends | `/lecturer/research-trends` | Read-only aggregate view of topic categories/sessions | Read | Counts and trends from stored topics | Stored topics | IMPLEMENTED |
| Notifications | header bell | New submission notices with links | Open; mark read | Deep link to Pending Reviews | — | IMPLEMENTED |

## ADMIN

| Feature | Route | Purpose | Primary action | Expected result | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Sign in | `/login` | Authenticate by email | Enter email + password | Redirect to Admin Dashboard | Bootstrapped or invited account | IMPLEMENTED |
| Dashboard | `/admin/dashboard` | Service health and key metrics | Read | API/database/provider status; user, topic, review and similarity counts; "Unavailable" shown truthfully when a section fails | — | IMPLEMENTED |
| User Management — list | `/admin/user-management` | Find and inspect accounts | Search/filter/paginate | Users with role, identity (matric/email), status | — | IMPLEMENTED |
| Create user | (User Management) | Provision one account | Choose role; enter name; matric (student) and/or email; create | One-time temporary password shown **once**; student may have no email | — | IMPLEMENTED |
| Identity correction | (User Management) | Fix matric/email | Edit and save | Identity updated within role rules (student keeps matric; lecturer/admin keep email) | — | IMPLEMENTED |
| Suspend / reactivate | (User Management) | Control access | Change status | Sessions invalidated on suspension | — | IMPLEMENTED |
| Credential reset | (User Management) | Replace a lost/expired credential | Reset | New one-time password shown once; previous sessions invalid; works for no-email students | — | IMPLEMENTED |
| Invitation | (User Management) | Email an activation link | Invite | Sent for accounts with email; **refused truthfully** for a student without email | SMTP configured | IMPLEMENTED |
| Bulk onboarding — preview / commit | (User Management) | Onboard a cohort from a spreadsheet | Upload `.xlsx` (name, email, role, matric_number); preview; commit | Preview classifies valid / already-exists / invalid rows; commit creates accounts and offers a **one-time credential manifest download**; replay creates zero duplicates | Long-request path ≥ 600 s for large cohorts | IMPLEMENTED |
| Bulk invitations | (User Management) | Invite many accounts | Select and send | Sent to accounts with email; no-email accounts reported as skipped with reason | SMTP configured | IMPLEMENTED |
| Supervisee assignments | (User Management) | Assign students to lecturers | Create/end assignment | Lecturer sees supervisees; new-submission notices routed to assigned lecturers | — | IMPLEMENTED |
| Topic Repository | `/admin/topic-repository` | Inspect historical, current-session and under-review topics | Search/filter; open detail; import historical topics from `.xlsx` (preview/commit) | Lifecycle counts and records with research context and embedding status; imports embed before commit and replay idempotently | Voyage provider for imports | IMPLEMENTED |
| System Settings | `/admin/system-settings` | Read-only effective configuration and status | Read | Non-secret settings and provider/email capability | — | IMPLEMENTED |
| Audit Log | `/admin/audit-log` | Governance trail | Search/filter; open detail; purge preview/purge within retention policy | Correlated events (provisioning, decisions, resets, imports) | — | IMPLEMENTED |
| Reports | `/admin/reports` | Summary and exports | Read; export | Counts by status/category and downloadable exports | — | IMPLEMENTED |
| Notifications | header bell | Submission notices | Open; mark read | Deep link | — | IMPLEMENTED |

## OPERATOR-ONLY (no UI)

| Feature | Mechanism | Purpose | Status |
| --- | --- | --- | --- |
| First-administrator bootstrap | `docker compose --profile maintenance run --rm backend-bootstrap --email … --name …` | Create the first admin with a one-time credential | OPERATOR-ONLY |
| Database migrations | `docker compose --profile maintenance run --rm backend-migrate` (`prisma migrate deploy`) | Apply schema changes; never `db push` / `migrate dev` | OPERATOR-ONLY |
| Logical backup / restore | `npm run db:backup`, `npm run db:restore` | Guarded backup and scratch-target restore | OPERATOR-ONLY |
| Health / readiness endpoints | `/api/v1/health`, `/api/v1/readiness` | Liveness; database + provider + email capability | OPERATOR-ONLY |
| Release readiness gate | `node scripts/release-readiness.js` | Pre-release verification | OPERATOR-ONLY |
| Embedding backfill | `npm run backfill:voyage-embeddings` | Legacy repair tool only | OPERATOR-ONLY |

## Deliberately not present

Thesis submission, grading, defence scheduling, supervisor–student messaging,
project management, publication/archival, public registration, a university
email requirement, any SBERT/FastAPI runtime, any semantic fallback.
