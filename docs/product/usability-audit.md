# Usability Audit — Research Topic Approval DSS

**Status: AUDIT ONLY. NO RECOMMENDATIONS HAVE BEEN IMPLEMENTED.**

Audit date: 2026-08-27 · Branch `production/container-acceptance` ·
Reference patterns: TUM Thesis Management, Aalto MyStudies.

---

## 1. Scope, method, and evidence basis

This audit inspected the **actual implementation** — routes, page components,
service queries, serializers and the Prisma schema — rather than the feature
list. Every finding below cites the file that produced it.

**Coverage.** All 25 page components were enumerated and machine-swept for
pagination, sorting, filtering, search and empty-state handling. The pages
central to the approval workflow were read in full: `SubmitTopicPage`,
`MySubmissionsPage`, `ResearchExplorerPage`, `PendingReviewsPage`,
`SubmissionDetailPage`, `ResultsDisplay`, `NotificationCenter`, and
admin `DashboardPage`. Backend reads covered `submission.service.js`,
`similarity.controller.js`, `residentCorpus.service.js`,
`notificationEvent.service.js`, `topicSemanticRepresentation.service.js`,
`topicCorpusLifecycle.service.js` and `schema.prisma`.

**Coverage limits — stated so this is not overclaimed.** The following were
covered by the structured sweep and targeted greps but not read line-by-line:
`lecturer/ResearchTrendsPage`, `lecturer/SuperviseesPage`,
`lecturer/CheckSimilarityPage`, `admin/TopicRepositoryPage`,
`admin/AuditLogPage`, `admin/ReportsPage`, `admin/SystemSettingsPage`.
Findings about those pages are limited to what the sweep actually establishes.

**No live session was driven.** This is a code-level audit.

---

## 2. Part A — Route and page inventory by role

24 routes exist: 6 public/auth, 18 authenticated.

| Role | Routes |
| --- | --- |
| **Student** (5) | `dashboard`, `submit-topic`, `my-submissions`, `check-my-topic`, `research-explorer` |
| **Lecturer** (6) | `dashboard`, `pending-reviews`, `pending-reviews/:topicId`, `my-decisions`, `supervisees`, `research-trends` |
| **Admin** (6) | `dashboard`, `user-management`, `topic-repository`, `system-settings`, `audit-log`, `reports` |
| **Public** (6) | landing, `login`, `forgot-password`, `reset-password`, `accept-invitation`, `change-password` |

Machine sweep of every page (line count and capability presence):

| Page | Lines | Pag. | Sort | Filter | Search | Empty |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| admin/UserManagementPage | 1743 | ✓ | – | ✓ | ✓ | ✓ |
| admin/AuditLogPage | 587 | ✓ | – | ✓ | ✓ | ✓ |
| admin/TopicRepositoryPage | 571 | ✓ | – | ✓ | ✓ | ✓ |
| lecturer/SubmissionDetailPage | 514 | n/a | n/a | – | – | – |
| admin/ReportsPage | 397 | ✓ | – | – | – | ✓ |
| lecturer/MyDecisionsPage | 303 | ✓ | – | ✓ | ✓ | ✓ |
| **lecturer/PendingReviewsPage** | 267 | **✗** | ✓ | ✓ | ✓ | ✓ |
| lecturer/ResearchTrendsPage | 196 | – | – | – | ✓ | ✓ |
| lecturer/SuperviseesPage | 184 | ✓ | – | – | – | ✓ |
| student/CheckMyTopicPage | 181 | – | – | – | ✓ | ✓ |
| lecturer/CheckSimilarityPage | 152 | – | – | – | ✓ | ✓ |
| student/DashboardPage | 130 | – | – | ✓ | – | ✓ |
| lecturer/DashboardPage | 130 | – | – | ✓ | – | ✓ |
| student/MySubmissionsPage | 127 | – | – | ✓ | ✓ | ✓ |
| admin/SystemSettingsPage | 107 | ✓ | – | – | – | ✓ |
| student/SubmitTopicPage | 93 | n/a | n/a | ✓ | ✓ | ✓ |
| admin/DashboardPage | 59 | – | – | – | – | – |
| **student/ResearchExplorerPage** | **21** | – | – | – | – | – |

Two entries are the audit's most important structural signals: the 21-line
Research Explorer, and the fact that the lecturer's primary daily work queue is
the only list lacking pagination.

---

## 3. Part B — Student journey

**Path:** log in → dashboard → (optionally) check-my-topic → submit-topic →
my-submissions → await notification → read decision.

**What works.** The pre-submission similarity check is a genuinely good idea and
is well executed: a student can test a topic before committing to it, which is
precisely the "reduce rejected proposals at source" pattern that makes TUM's
topic phase efficient. `SubmitTopicPage` has a **review-before-submit panel**
that explicitly states *"Nothing has been saved yet"*, a `submissionPendingRef`
double-submit guard, and word-count bounds (7–24 words) enforced in the form.
`MySubmissionsPage` surfaces status counts and renders **lecturer feedback**
(`decision_reason`) under a clear "Lecturer feedback" heading.

**Gap B1 — the pre-check and the real submission are not the same query.**
`TopicForm` (used by the similarity checker) collects **population, location and
study focus**. `SubmitTopicPage` collects **only title, category and keywords**.
The student therefore rehearses with a richer description than the one the
system actually evaluates. See §19 — this touches the frozen semantic contract
and is raised as an open product decision, not a recommendation.

**Gap B2 — no draft.** There is no save-draft path. A student composing a
7–24-word title with keywords must complete it in one sitting or lose it. Both
reference systems persist a draft proposal. Low severity at pilot scale.

**Gap B3 — Research Explorer is a dead end.** See §6 and §17.

---

## 4. Part C — Lecturer review journey

**Path:** notification → pending-reviews → open submission → read similarity
evidence → decide (approve / request revision / reject) → back to queue.

**What works.** All three decision outcomes are genuinely implemented —
`LECTURER_DECISION_STATUSES` accepts `approved`, `rejected` and
`awaiting_revision`, and `SubmissionDetailPage` renders all three buttons. A
rejection **requires** a rationale, with focus moved to the offending field
(`document.getElementById('decision-rationale')?.focus()`). Decisions pass
through an explicit confirmation step (`pendingDecision`). The page states
*"Similarity evidence is advisory. Final decisions remain lecturer-controlled."*
— exactly the right framing for a decision-support system, and it should be
preserved verbatim.

**Finding C1 (P0) — the queue cannot identify most students.**
`listLecturerPendingSubmissions` selects `student: { select: { name: true,
email: true } }`. It does **not** select `matricNumber`. Since students are now
matric-primary and may legitimately have no email,
`PendingReviewsPage.jsx:231` renders `{submission.student_email || 'No email
available'}` and `SubmissionDetailPage.jsx:256` renders a blank "Student email".
A lecturer reviewing a cohort sees name-only rows with "No email available"
where the student's actual institutional identifier should be. This is a direct
regression introduced by the identity change and is the single highest-value
small fix in this audit.

**Finding C2 (P1) — "Request Revision" accepts no rationale.**
`handleStatusUpdate('awaiting_revision', 'Request Revision', …)` is called
**without** `{ requireReason: true }`, unlike rejection. A lecturer can send a
topic back with no explanation, and the student's feedback panel then renders
its fallback string: *"No additional comment was provided."* Revision is the one
outcome whose entire purpose is to communicate what to change, so it is the one
outcome where a rationale matters most.

**Finding C3 (P2) — no queue continuity.** After deciding, the lecturer gets
"Back to Pending Reviews" but no "next submission" affordance. Reviewing 40
topics means 40 round-trips through the list. Both reference systems keep the
reviewer in a work queue.

**Not a finding — pagination.** `PendingReviewsPage` has client-side filter,
search and sort over an unpaginated queue. At a single-department pilot cohort
this is *correct and preferable*: filtering the whole set client-side is faster
and simpler than server pagination. This audit explicitly **does not** recommend
pagination here. Revisit only if a single pending queue routinely exceeds ~200
rows.

---

## 5. Part D — Administrator journey

`admin/DashboardPage` (59 lines) is a read-only summary and is **honest about
partial data** — it renders `'Unavailable'` rather than `0` when a section
fails, and surfaces a `warnings[]` array as a "Partial dashboard coverage"
callout. That is the correct behaviour for a decision-support system and is
consistent with the standing rule that absence of data must never be presented
as a substantive result.

`UserManagementPage` (1743 lines) carries pagination, filtering, search and ten
distinct empty/error states — it is the most thoroughly built surface in the
product. Its size is a maintainability concern, not a usability one, and is out
of scope here.

Per the coverage limit in §1, no line-level claims are made about
`TopicRepositoryPage`, `AuditLogPage`, `ReportsPage` or `SystemSettingsPage`
beyond the sweep: all four have pagination and empty-state handling.

---

## 6. Part E — Navigation and information architecture

Three role-scoped navigation arrays in `layouts/navigation.js`; role-based
layouts; unmatched routes redirect to `/login`. The IA is flat, predictable and
appropriately small — no nested menus, no hidden surfaces.

**Finding E1 (P1) — navigation advertises a surface that does not exist.**
Student navigation lists **Research Explorer**. The page is 21 lines: a disabled
search input with `placeholder="Not currently available"`, a disabled category
select, and the sentence *"Approved-topic browsing is not currently available in
the Student workspace."* The copy is commendably honest — it does not fake data
— but a permanent nav entry to a disabled page teaches students the product is
unfinished. In a pilot being evaluated for departmental adoption, that
impression is disproportionately costly.

---

## 7. Part F — Status model and lifecycle visibility

Real backend states: `PENDING_REVIEW`, `APPROVED`, `REJECTED`,
`AWAITING_REVISION` (plus `not_submitted` as a UI-only presentation state).
`StatusBadge` maps each to a colour **and** a text label — status is never
conveyed by colour alone, which satisfies WCAG 1.4.1.

No invented stages appear anywhere in the UI. The status vocabulary matches the
schema exactly.

**Finding F1 (P1, structural) — a revision is not linked to what it revises.**
`model Submission` has `submittedAt`, `decidedAt`, `decisionReason` and
`decidedById`, but **no self-referential linkage field**. There is no student
route to edit or resubmit an existing submission — student routes are
`dashboard`, `submit-topic`, `my-submissions`, `check-my-topic`,
`research-explorer` only. Therefore a student told "revise this" must create a
**brand-new, unlinked submission**. The lecturer who requested the revision
receives it as an unrelated new topic, with no visible connection to their own
earlier feedback, and the original stays parked in `AWAITING_REVISION` forever.

This is the most significant structural gap found. It is also why `Awaiting
revision` behaves as a terminal state in practice despite being designed as an
intermediate one.

---

## 8. Part G — Lists: filtering, sorting, pagination

Well covered overall (see §2). Every high-volume administrative list paginates.
`MyDecisionsPage` — a historical list — paginates and filters extensively. The
one unpaginated list is the pending queue, addressed in §4 as a deliberate
non-finding.

No recommendation is made to add controls to trivially small lists
(`student/MySubmissionsPage`, `lecturer/DashboardPage`, `student/DashboardPage`).

---

## 9. Part H — Decision and feedback loop

The loop is **complete in one direction and broken in the other**.

Forward: lecturer decides → `notificationEvent.service.js` emits
`SUBMISSION_DECISION` → student notified with deep link to
`/student/my-submissions` → student reads status and `decision_reason`.
`buildDecisionText` covers all three outcomes. This works.

Return: there is no return path. Combining C2 and F1 — a revision request may
carry no rationale, and even a well-reasoned one has no mechanism for the
student to respond to *that submission*. The student's only action is to start
over, unlinked.

---

## 10. Part I — Similarity evidence comprehensibility

**This is better implemented than expected and should not be redesigned.**
`ResultsDisplay` leads with the topic title, then a plain-language similarity
**level**, and hides the raw cosine score behind a "Show Technical Details"
disclosure. A lecturer is never forced to interpret `0.664`. That is the right
hierarchy and matches the standing instruction not to expose low-level provider
detail to ordinary users.

**Finding I1 (P0, low effort) — the serializer discards context the UI already
renders.** `ResultsDisplay` already renders `match.supervisor_name` and
`match.session_year`, declares both in `PropTypes`, and has per-tier label logic
for them ("Supervisor" / "Reviewing lecturer", "Session" / "Approved date").
But `responseMatch` in `similarity.controller.js` returns only:

```js
{ id, title, category, collection, semantic_score, similarity_class }
```

Meanwhile `residentCorpus.decorate` does `{ ...row, collection, studyFocus }` —
**the full row, including population, location, study focus, session year and
supervisor, is already in memory**. The frontend API layer then drops the fields
again during mapping. So the display capability exists, the data exists, and
nothing connects them. Widening the serializer requires **no migration and no
change to how similarity is calculated** — it changes only what is shown
alongside an already-computed score.

Consequence today: a lecturer sees *"this resembles an existing topic, HIGH"*
with no way to judge **why** without leaving the page. Showing the matched
topic's population/location/study focus turns an opaque verdict into reviewable
evidence — the single largest comprehensibility gain available for the effort.

---

## 11. Part J — Notifications

`notificationEvent.service.js` defines five event types.
`SUBMISSION_CREATED` fans out to assigned lecturers plus active admins, with a
fallback to all active reviewers so a submission is never silently unrouted.
`SUBMISSION_DECISION` notifies the student. Both carry deep links.
`NotificationCenter` implements an unread badge, mark-read-on-click, mark-all,
and ARIA labels.

**No findings.** This subsystem is production-quality and needs no work.

---

## 12. Part K — Form usability and input design

Strong. `LoginPage` uses `type="text"` with label "Email Address or Matric
Number" and `autoComplete="username"` — deliberately not `type="email"`, which
would make browsers reject valid matric numbers. Helper text is associated via
`aria-describedby` rather than nested in the label. `SubmitTopicPage` validates
word bounds inline and guards double-submit.

**Finding K1 (P3)** — no draft persistence (see B2).

---

## 13. Part L — Error, empty, and recovery states

`InfoCallout` with `role="alert"` is used consistently; 10 files use
`role="alert"`, 8 use `aria-live`. Empty states are present on every list page
that needs one. The admin dashboard distinguishes *unavailable* from *zero*,
which is the distinction that matters most in this product.

The system does not present an empty comparison corpus as evidence of novelty —
verified in the similarity surfaces inspected.

---

## 14. Part M — Accessibility

Positive signals: `aria-live` (8 files), `aria-label` (18), `role="alert"` (10),
`role="status"` (3), `sr-only` (6), focus management on validation failure,
status conveyed by colour **and** text.

**Finding M1 (P2)** — coverage is good but unverified against a real
screen-reader pass, and no automated a11y assertions were found in the test
suite. Noted; not recommended for this round.

---

## 15. Part N — Responsive and mobile behaviour

Tailwind responsive utilities are used throughout; the admin dashboard grid
degrades correctly (`sm:grid-cols-2 lg:grid-cols-4`). `TableShell` wraps tables
in `overflow-x-auto`.

**Finding N1 (P2)** — `admin/UserManagementPage` hand-rolls its own table and is
the **only** table-bearing page without an `overflow-x-auto` wrapper. On a phone
its columns will clip rather than scroll. Narrow, real, and cheap to fix, but
admin work is desk work; severity is genuinely low.

Only 4 files use `min-h-11`, so touch-target sizing is inconsistent — noted, not
recommended for this round.

---

## 16. Part O — Reference-pattern comparison

| Reference pattern | Present here? | Assessment |
| --- | --- | --- |
| Pre-submission topic check (TUM) | **Yes**, and better | Genuine strength; keep |
| Explicit proposal state machine | **Yes** | States real, no invented stages |
| Reviewer work queue | Yes | Lacks continuity (C3) |
| Revision round-trip (TUM/Aalto core) | **No** | Broken loop (F1) — the real gap |
| Decision rationale to student | Yes | Optional where it matters most (C2) |
| Notification + deep link | **Yes** | Production quality |
| Browse approved topics (Aalto) | **Advertised, not built** | E1 |
| Full thesis submission / grading / defence scheduling / supervisor chat / publication archival | No | **Correctly out of scope — not recommended** |

The reference systems do many things this product should never do. Their
relevance is confined to the *topic approval* phase.

---

## 17. Part P — Consolidated findings by severity

| # | Finding | Sev | Effort | Migration? |
| --- | --- | --- | --- | --- |
| C1 | Pending queue omits `matricNumber`; students show "No email available" | **P0** | XS | No |
| I1 | Similarity serializer drops context the UI already renders | **P0** | S | No |
| E1 | Research Explorer advertised in nav but is a 21-line placeholder | P1 | XS | No |
| C2 | "Request Revision" does not require a rationale | P1 | XS | No |
| F1 | Revisions are unlinked; `AWAITING_REVISION` is terminal in practice | P1 | M | Yes (additive) |
| C3 | No "next submission" continuity in review | P2 | S | No |
| N1 | `UserManagementPage` table lacks `overflow-x-auto` | P2 | XS | No |
| M1 | No screen-reader / automated a11y verification | P2 | — | No |
| B2/K1 | No draft persistence on submission | P3 | M | Yes |

---

## 18. Part Q — Recommended scoped improvements

Five, deliberately bounded. Together they are a corrective round, not a
redesign. **None has been implemented.**

**Q1 — Restore student identity in the review surfaces (fixes C1).** Add
`matricNumber` to the `listLecturerPendingSubmissions` select and to the detail
query; render matric as the primary identifier with email shown only when
present. Removes a false "No email available" that is currently the normal case.
*No migration. Smallest change with the largest correctness gain.*

**Q2 — Widen the similarity match serializer (fixes I1).** Extend
`responseMatch` to include the context already resident in `decorate`'s rows,
and stop the frontend API layer discarding it. The rendering code already
exists. **This changes only what is displayed beside an already-computed score —
it does not alter the representation, the model, the weights, the thresholds or
the ranking.**

**Q3 — Require a rationale when requesting a revision (fixes C2).** Pass
`{ requireReason: true }` for `awaiting_revision`, matching rejection. Eliminates
the "No additional comment was provided" dead end.

**Q4 — Resolve the Research Explorer dead end (fixes E1).** Two honest options:
remove the nav entry until the page exists, or build read-only browsing of
approved topics. **Removal is recommended for the pilot** — near-zero effort, and
it stops advertising an absent capability. This is a product call, not a
technical one.

**Q5 — Link revisions to their originals (fixes F1).** Additive, nullable
self-relation on `Submission` (e.g. `previousSubmissionId`), a student action on
an `AWAITING_REVISION` submission that pre-fills a new one and records the link,
and a "Revision of …" reference on the lecturer's detail view. This is the only
recommendation requiring a migration; it must be additive, and no existing
migration may be edited. It closes the one genuinely broken workflow loop.

**Deliberately NOT recommended:** pagination on the pending queue (§4); controls
on trivially small lists (§8); touch-target normalisation (§15); any change to
the "Similarity evidence is advisory" framing (§4); and every capability in the
out-of-scope row of §16.

---

## 19. Go/No-Go verdict

| | Question | Verdict |
| --- | --- | --- |
| **A** | Can a student complete a submission end to end? | **GO** |
| **B** | Can a lecturer complete a review end to end? | **GO** — all three outcomes work |
| **C** | Can a lecturer identify the student being reviewed? | **NO-GO** — C1; name-only, "No email available" is the normal case |
| **D** | Is similarity evidence understandable without raw scores? | **CONDITIONAL** — hierarchy is right (§10), but matches carry no context (I1) |
| **E** | Does the status model reflect real backend states? | **GO** — no invented stages |
| **F** | Can a requested revision actually be completed? | **NO-GO** — F1; no linkage, no resubmit path |
| **G** | Is the student told why a decision was made? | **CONDITIONAL** — guaranteed for rejection, optional for revision (C2) |
| **H** | Are notifications reliable and actionable? | **GO** — no findings |
| **I** | Does navigation only advertise what exists? | **NO-GO** — E1, Research Explorer |
| **J** | Is the frozen semantic contract respected by the UI? | **GO**, with one open product decision below |

**Overall: CONDITIONAL GO for a supervised departmental pilot.** The core
approval path works and the decision-support framing is correct. Three items
(C1, F1, E1) should be resolved before unsupervised departmental use — C1 and E1
are extra-small changes, F1 is the only substantial one.

### Open product decision — requires explicit confirmation, not a recommendation

`buildSubmissionTopicShape` passes `population: null, location: null,
studyFocus: null`, so **a student submission is embedded from its title alone**,
while corpus topics carry the full `structured-context-v1` context. The code
comments this deliberately, and the representation treats those fields as
optional — this is *not* a defect.

But it means the pre-check a student runs (which collects all three fields) is a
richer query than the one run against their actual submission (§3, B1).
Collecting those fields at submission time would change the text fed to the
embedding for submissions, and therefore change scores.

**That crosses from lifecycle into scoring input, so it is reported rather than
recommended or implemented.** It requires an explicit decision before any work
proceeds.

---

**No recommendation in this document has been implemented.**
