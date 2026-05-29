# Post-Figma Shell Alignment Visual Evidence

## Audit context

- Branch: `docs/post-alignment-screenshot-evidence`
- Latest main commit referenced for this evidence: `6c86249 polish: align admin dashboard shell (#72)`
- Purpose: document screenshot evidence after the Figma-shell visual alignment pass.
- PR #70 aligned the lecturer dashboard and pending reviews pages.
- PR #71 aligned the lecturer checker and submission detail pages.
- PR #72 aligned the admin dashboard shell.
- This report is documentation-only and does not change runtime behavior.
- The UI remains behavior-safe, Figma-informed, and not pixel-perfect.

## Screenshot evidence captured

Fresh browser screenshots were captured under the ignored local artifact directory:

- `frontend/smoke-artifacts/post-alignment-screenshot-evidence/20260529-055254/`

Captured route screenshots:

- `01-login.png` for `/login`
- `02-student-dashboard.png` for `/student/dashboard`
- `03-student-submit-topic.png` for `/student/submit-topic`
- `04-student-my-submissions.png` for `/student/my-submissions`
- `05-student-check-my-topic.png` for `/student/check-my-topic`
- `06-student-research-explorer.png` for `/student/research-explorer`
- `07-lecturer-dashboard.png` for `/lecturer/dashboard`
- `08-lecturer-pending-reviews.png` for `/lecturer/pending-reviews`
- `09-lecturer-check-similarity.png` for `/lecturer/check-similarity`
- `10-admin-dashboard.png` for `/admin/dashboard`
- `11-lecturer-submission-detail.png` for an available `/lecturer/pending-reviews/:topicId` detail page

The main capture manifest recorded no unexpected mutation requests. The extra lecturer detail capture also completed without reporting unexpected mutations.

## Figma references compared

Compared against local ignored Figma references under `img/`, including:

- `img/figma_AUTH_01_S1.png`
- `img/figma/student-dashboard/STUD_01_S1.png` through `STUD_01_S4.png`
- `img/figma/student-submit-topic/STUD_02_S1.png` through `STUD_02_S4.png`
- `img/figma/student-my-submissions/STUD_03_S1.png` through `STUD_03_S5.png`
- `img/figma/student-check-my-topic/STUD_04_S1.png` through `STUD_04_S4.png`
- `img/figma/student-research-explorer/STUD_05_S1.png` through `STUD_05_S4.png`
- `img/figma/lecturer-dashboard/LECT_01_S1.png` and `LECT_01_S2.png`
- `img/figma/lecturer-pending-review/LECT_02_S1.png` through `LECT_02_S6.png`
- `img/figma/lecturer-pending-review/LECT_02_POP_01.png`
- `img/figma/lecturer-check-similarity/LECT_04_S1.png` through `LECT_04_S5.png`
- `img/figma/admin-dashboard/ADMIN_01_S1.png` through `ADMIN_01_S3.png`

The `img/` references remain local ignored files and were not staged or committed.

## Overall finding

Visual closeness improved after PR #67 through PR #72. The authenticated pages now share a more consistent green top-navigation shell, larger rounded page stages, stronger dashboard cards, and clearer Figma-like section grouping.

The evidence does not support calling the visual alignment complete or pixel-perfect. The current UI remains intentionally behavior-safe: unsupported states remain honest, no fake data was introduced, and the pages still differ from Figma where the backend does not support the populated metrics, activity, analytics, reports, audit events, or repository browsing shown in the mockups.

## Improvements observed after PR #67-#72

- Shared authenticated pages now use a top-navigation shell instead of the earlier sidebar/dashboard shell.
- Student dashboard and submit topic pages are closer to Figma-style page staging, current-topic surfaces, and form rhythm.
- Student submissions, checker, and research explorer pages now read as part of the same shell while preserving student-safe data boundaries.
- Lecturer dashboard and pending reviews now have stronger overview cards, queue framing, and table-like review structure.
- Lecturer checker now has a clearer advisory workspace and structured output area.
- Lecturer submission detail now has stronger submitted-topic, evidence-history, similarity pre-check, and decision-panel composition.
- Admin dashboard now has a stronger overview surface, compact service cards, unavailable metrics, recent-activity shell, and deferred workflow panels while preserving non-live states.

## Remaining visual gaps

- Top navigation still needs responsive polish: at the `1024x1000` evidence viewport, some nav labels are clipped or partially hidden.
- Long full-page screenshots with fixed navigation can show the top nav overlaying mid-page content, visible in the lecturer submission detail evidence.
- Several Figma references show populated dashboards, live activity, live admin health, reports, audit logs, analytics, and richer table controls that remain intentionally unavailable.
- Admin dashboard is closer in composition but still diverges from Figma because live status, metrics, reports, and audit activity are not connected.
- Research Explorer remains an honest unavailable shell rather than the populated trends/topic repository shown in Figma.
- Typography, exact spacing, card density, icon treatment, and responsive breakpoints still need a dedicated polish pass before claiming high visual fidelity.

## Safety boundaries preserved

- No fake data was added.
- No fake admin metrics were added.
- No fake live health was added.
- No fake reports or audit logs were added.
- No topic submissions were performed.
- No similarity checks were run as part of the route capture.
- No snapshots were created.
- No lecturer decisions were confirmed.
- No route behavior changed.
- No API behavior changed.
- No auth behavior changed.
- No backend behavior changed.
- Unsupported states remain honest with unavailable, not connected, or deferred messaging.
- Screenshot artifacts and manifests remain ignored local files and are not committed.

## Optional release recommendation

An optional `v0.3.0-ui-rc4` release is reasonable if the goal is to mark a behavior-safe post-alignment visual checkpoint after PR #67 through PR #73.

The release should be described carefully as improved Figma-shell visual alignment, not as final visual fidelity or pixel-perfect parity. If the next release is expected to represent near-Figma visual fidelity, the remaining navigation, screenshot-overlap, responsive, and data-state gaps should be addressed first.

## Result

The post-alignment screenshot evidence shows that visual closeness improved across the authenticated shell, student pages, lecturer pages, and admin dashboard shell. The UI remains behavior-safe and honest about unsupported data. Remaining gaps should be tracked as targeted visual polish rather than functional release blockers.
