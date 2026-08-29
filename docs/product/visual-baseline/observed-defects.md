# Defects Observed During Visual Baseline Capture

> **Update — pre-pilot polish pass.** VB-1, VB-3, VB-4 and VB-5 were fixed in
> application commit `e5e3fc18555fafde7fa409352b37357c0bb22c43` (branch
> `production/prepilot-visual-polish`, fast-forwarded onto `staging/render-acceptance`),
> and the affected captures were refreshed. VB-2 is classified as a **hosted
> acceptance observation**, not an application defect. The table below is the
> original record as captured at `ff833cf`; the resolution table follows it.

Recorded, **not fixed** — this package makes no application change. Each item
names the evidence and the accepted source commit it was observed on
(`ff833cf0bc645bd4678bf480bb3c4070216f78cf`).

| # | Where | Observation | Evidence | Severity | Suggested owner action |
| --- | --- | --- | --- | --- | --- |
| VB-1 | Lecturer → Check Similarity results, narrow match cards (`ResultsDisplay`, three-column layout at 1440 px) | The research-context block (`Population:` / `Location:` / `Study focus:`) renders as a two-column grid inside a card too narrow for it: the `Location:` label overlaps `Population:` and values wrap character-by-character. The student checker (wider cards) is unaffected. | `screenshots/39-lecturer-similarity-checker.png` | Cosmetic; content remains readable when the card is widened | Let the context list collapse to one column below a card width threshold (a CSS-only change in `ResultsDisplay`), in a normal change with tests — not as part of documentation work |
| VB-2 | Student → Check My Topic / Lecturer → Review detail during a transient provider outage | Not a defect: the checker reported "Semantic similarity unavailable" and produced no classification. Recorded because it happened naturally twice during capture (18:22 and 18:24 local) while API-driven steps retried successfully; useful hosted-capacity evidence. | `screenshots/71-semantic-provider-unavailable.png` (genuine occurrence, not simulated) | Operational, not a bug | Track provider throttling/outage frequency during hosted staging acceptance |
| VB-3 | Student → My Submissions, superseded (revised) card | The next-step text reads "Its progress is shown on the revised submission **below**", but the list is ordered newest-first, so the revised submission appears **above** the original. | `screenshots/20-student-my-submissions.png` | Cosmetic copy | Change the word to "above" (or "in this list") in `MySubmissionsPage` as a normal change with a test update |
| VB-4 | Lecturer → My Decisions, student column | A student without an email is rendered as "No email available" beneath the name; the matric number (the primary identifier) is not shown. The pending queue and review detail were corrected in the pilot closure, but this history table still uses the email-primary presentation. | `screenshots/37-lecturer-my-decisions.png` | Minor identity-presentation inconsistency | Reuse the shared `StudentIdentity` presentation in `MyDecisionsPage` (needs the decision serializer to carry `student_matric_number`) as a normal change with tests |
| VB-5 | Lecturer → Dashboard queue preview; Lecturer → Supervisees; Admin → assignment cards | These surfaces still present students email-first: Supervisees and the admin assignment cards show "Email unavailable" under a no-email student, and the dashboard queue preview lists name/category only — none shows the matric number. Same family as VB-4; the pilot closure corrected only the pending queue and review detail. | `screenshots/30-lecturer-dashboard.png`, `38-lecturer-supervisees.png`, `54-admin-bulk-import.png` (assignment cards) | Minor identity-presentation inconsistency | Apply the shared `StudentIdentity` presentation (name → matric → email when present) across these views in one normal change |

## Resolution (pre-pilot polish pass, application commit `e5e3fc1`)

| # | Resolution | Where | Verification |
| --- | --- | --- | --- |
| VB-1 | **Fixed.** In lecturer-checker mode the research-context list stacks one field per row (`grid-cols-1`) instead of following the viewport `sm:` breakpoint; student checker and default view unchanged. | `frontend/src/components/features/Results/ResultsDisplay.jsx` | Layout tests in `frontend/tests/SimilarityContext.test.jsx`; refreshed `39-lecturer-similarity-checker.png` and a 390 px check show no label collision |
| VB-2 | **Not a defect — hosted acceptance observation.** Provider failure stays explicit and fail-closed: no score, no classification, no fallback vector. No change. | — | Existing provider-unavailable tests unchanged; `71-semantic-provider-unavailable.png` retained |
| VB-3 | **Fixed.** Guidance now reads "Its progress is shown on the revised submission in this list." (order-independent; the list stays newest-first). | `frontend/src/pages/student/MySubmissionsPage.jsx` | `frontend/tests/MySubmissionsPage.test.jsx`; refreshed `20-student-my-submissions.png` |
| VB-4 | **Fixed.** Decision history selects the student's matric number and exposes additive `studentMatricNumber` (`studentEmail` retained; search also matches matric); My Decisions renders the shared `StudentIdentity` (name -> matric -> optional email). | `backend/src/services/submission.service.js`, `frontend/src/pages/lecturer/MyDecisionsPage.jsx` | Backend and frontend tests; refreshed `37-lecturer-my-decisions.png` |
| VB-5 | **Fixed.** Dashboard preview shows the matric it already received; supervisee assignments select/serialize `matricNumber` (null for lecturers); Supervisees and admin assignment cards render `StudentIdentity` for the student side, lecturers stay email-based; the supervisee-assignment CSV export gains `studentMatricNumber`. | `frontend/src/pages/lecturer/DashboardPage.jsx`, `SuperviseesPage.jsx`, `frontend/src/pages/admin/UserManagementPage.jsx`, `backend/src/services/superviseeAssignment.service.js`, `adminReportExport.service.js` | Backend and frontend tests; refreshed `30`, `38`, `54` |

Nothing further was found during the video reviews.
