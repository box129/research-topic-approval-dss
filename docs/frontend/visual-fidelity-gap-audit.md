# Visual Fidelity Gap Audit

## Audit context

- Latest release checkpoint: `v0.3.0-ui-rc2`
- Latest completed PR: PR #55
- Current UI status: Figma-informed, functionally smoke-tested, but not pixel-perfect to the original Figma.
- Playwright smoke passed after PR #53/PR #54.
- This audit does not mark the UI release candidate as failed.
- Visual fidelity should be handled as a separate polish phase.

## Figma screenshot references inspected

- Folder path found: `img/`
- Screenshot references are local-only and ignored/untracked by Git; `git status --ignored img` reports `!! img/`.
- `git ls-files img` returned no tracked image files.
- Local Figma screenshot references were inspected but not added to Git.
- No exact pixel-perfect measurement comparison was performed.
- Based on available screenshot reference, the local images cover auth, student, lecturer, and admin flows, with 74 image files total.

Representative local references inspected:

- `img/figma_AUTH_01_S1.png`
- `img/figma/student-dashboard/STUD_01_S1.png`
- `img/figma/lecturer-pending-review/LECT_02_S1.png`
- `img/figma/admin-dashboard/ADMIN_01_S1.png`

Grouped local screenshot categories include:

- Auth screens and auth modal states
- Student dashboard, submit topic, my submissions, check my topic, and research explorer
- Lecturer dashboard, pending review/detail states, check similarity, my decisions, supervisees, and research trends
- Admin dashboard, user management, topic repository, system settings, audit log, and reports

## Scope

This audit covers the implemented Figma-informed UI areas:

- AUTH-01 Login
- Student Dashboard
- Student Submit Topic
- Student My Submissions
- Student Check My Topic
- Student Research Explorer
- Lecturer Dashboard
- Lecturer Pending Reviews
- Lecturer Submission Detail
- Lecturer Check Similarity
- Admin Dashboard shell

## What is already functionally complete

- Auth, student, lecturer, and admin dashboard shell routes render.
- Playwright browser smoke coverage exists.
- Read-only Playwright smoke passed with credentials.
- Safety boundaries remain preserved.
- Student routes remain student-owned.
- Lecturer decisions remain lecturer-controlled.
- Similarity evidence remains advisory.
- Admin Dashboard and Student Research Explorer remain honest unavailable shells where backend support is not connected.

## Known visual fidelity gap

- Current UI is Figma-informed, not pixel-perfect.
- Implemented screens use shared frontend foundation components and tokenized styling.
- They do not yet fully match the original Figma screenshots in layout, spacing, density, visual hierarchy, and page composition.
- This is a design fidelity/polish gap, not a functional release failure.
- Needs side-by-side comparison with original Figma before claiming final visual fidelity.

## Page-by-page audit matrix

| Area/Page | Screenshot reference | Current implementation status | Figma fidelity gap | Functional risk | Recommended polish action | Priority |
|---|---|---|---|---|---|---|
| AUTH-01 Login | Local `img/figma_AUTH_01_S*.png` | Functionally implemented and smoke-tested. | Based on available screenshot reference, likely gap in split-panel composition, stronger green/yellow brand contrast, typography scale, hero copy hierarchy, and form density. | Low | Run side-by-side polish pass for auth layout, hero panel, field spacing, button treatment, and responsive behavior. | P1 |
| Student Dashboard | Local `img/figma/student-dashboard/STUD_01_S*.png` | Functionally implemented with existing student submission data and honest placeholders. | Likely visual gap in personalized dashboard composition, large current-topic card, activity timeline, quick-action blocks, similarity-score placement, and footer/dashboard framing. | Low | Align card hierarchy, status emphasis, metric placement, activity/quick-action layout, and spacing rhythm while preserving data honesty. | P1 |
| Student Submit Topic | Local `img/figma/student-submit-topic/STUD_02_S*.png` | Functionally implemented as submission-only page. | Likely visual gap in form step structure, guidance panel placement, text area prominence, validation presentation, and submit-state composition. | Low | Polish form hierarchy, instructional copy layout, field grouping, and success/error callout spacing. | P1 |
| Student My Submissions | Local `img/figma/student-my-submissions/STUD_03_S*.png` | Functionally implemented with safe card/history layout. | Likely visual gap in history card density, status/feedback panel styling, filters or summary composition, and spacing between records. | Low | Side-by-side card polish for status badges, feedback blocks, metadata rows, and empty/decided states. | P1 |
| Student Check My Topic | Local `img/figma/student-check-my-topic/STUD_04_S*.png` | Functionally implemented as advisory pre-check using existing checker behavior. | Likely visual gap in checker panel composition, advisory copy hierarchy, results area layout, and risk/status visual emphasis. | Low | Polish form/results split, advisory callouts, status badge prominence, and empty/result state spacing. | P1 |
| Student Research Explorer | Local `img/figma/student-research-explorer/STUD_05_S*.png` | Functionally implemented as honest unavailable shell. | Likely visual gap because original screenshots appear to show richer explorer/search/trend composition than the current safe shell. | Low | Improve shell visual richness without adding fake data: disabled controls, planned insight cards, empty state, and CTA composition. | P2 |
| Lecturer Dashboard | Local `img/figma/lecturer-dashboard/LECT_01_S*.png` | Functionally implemented using existing pending queue data and honest placeholders. | Likely visual gap in triage dashboard layout, queue preview density, risk/activity cards, and dashboard-level hierarchy. | Low | Polish dashboard stat cards, queue preview, unavailable analytics panels, and lecturer navigation layout. | P1 |
| Lecturer Pending Reviews | Local `img/figma/lecturer-pending-review/LECT_02_S*.png` | Functionally implemented as read-only queue with client-side controls. | Based on available screenshot reference, likely gap in top navigation treatment, tabbed queue presentation, filter/search density, table/card empty states, and footer framing. | Low | Polish read-only queue layout, filters, table rows, status badges, no-results/empty states, and spacing. | P1 |
| Lecturer Submission Detail | Local `img/figma/lecturer-pending-review/LECT_02_S4-S6.png` and `LECT_02_POP_01.png` | Functionally implemented with detail, snapshots, advisory similarity, rationale, and confirmation modal behavior. | Likely visual gap in evidence panel layout, snapshot history cards, decision controls, modal polish, and risk/status badge emphasis. | Low | Polish detail sections, decision panel, similarity evidence, snapshot cards, and ConfirmActionModal visual treatment. | P1 |
| Lecturer Check Similarity | Local `img/figma/lecturer-check-similarity/LECT_04_S*.png` | Functionally implemented as standalone advisory checker. | Likely visual gap in manual checker layout, empty/result states, copy hierarchy, and risk results composition. | Low | Align checker form/results layout and advisory callout styling with screenshot direction. | P1 |
| Admin Dashboard shell | Local `img/figma/admin-dashboard/ADMIN_01_S*.png` | Functionally implemented as honest shell with not-connected health/metrics. | Based on available screenshot reference, original direction shows richer system dashboard/sidebar/health/status/activity composition than the current safe shell. | Low | Polish admin shell visual hierarchy, sidebar/dashboard rhythm, health card composition, and unavailable metric treatment without claiming live data. | P1 |

## Cross-cutting visual gaps

- Spacing and layout rhythm needs side-by-side comparison with original Figma.
- Typography hierarchy is functionally clear but not final against the screenshot direction.
- Card density and whitespace likely differ from the original dashboard compositions.
- Responsive/mobile polish needs a dedicated pass across role layouts.
- Sidebar/dashboard visual consistency needs alignment with role-specific Figma navigation treatments.
- Empty, error, and loading states are reusable but may not match screenshot-specific visual weight.
- Table/card layout polish is needed for pending reviews, submissions, and history pages.
- Form visual hierarchy needs refinement for auth, submit topic, and similarity checker pages.
- Status/risk badge emphasis likely needs stronger alignment with Figma status treatments.
- Color/token alignment with original Figma should be reviewed without breaking current accessibility.
- Page-level visual hierarchy should be tuned for top sections, CTA placement, and content density.
- Hero/illustration/marketing panel differences are visible in the auth screenshots and need a separate auth polish pass.
- Dashboard/stat-card composition differs from richer Figma dashboard references.
- Modal/dialog polish should be revisited for lecturer decision confirmation.

## Recommended polish priorities

P0 usability blockers:

- No P0 visual blockers are currently identified from this audit.
- P0 should be reserved for issues found during side-by-side review that block understanding, navigation, or completion of a core task.

P1 visual alignment improvements:

- Align AUTH-01 split login composition with screenshot reference.
- Tune student and lecturer dashboard hierarchy, cards, and spacing.
- Polish student submission/history and lecturer queue/detail layouts.
- Improve admin dashboard shell visual hierarchy while preserving honest unavailable states.
- Review typography, color tokens, navigation layout, and status badge emphasis across roles.

P2 polish/nice-to-have improvements:

- Refine disabled explorer shell visuals without adding fake data.
- Improve loading/error/empty state visual consistency.
- Tune responsive/mobile spacing and card density.
- Update visual smoke notes or screenshot documentation after polish PRs.

## Safety boundaries for future polish PRs

Future polish PRs must:

- Not change backend behavior.
- Not change API contracts.
- Not change auth/protected routes.
- Not change similarity scoring/thresholds/ranking.
- Not change snapshots.
- Not change decisions/student feedback.
- Not add fake data.
- Not implement deferred admin or research-explorer features.
- Keep Playwright smoke passing.

## Suggested follow-up PR sequence

- PR #57: polish AUTH-01 and shared layout spacing
- PR #58: polish student pages
- PR #59: polish lecturer pages
- PR #60: polish admin dashboard shell
- PR #61: update visual smoke notes / screenshots if needed
