# Post-Prototype Visual Integration Evidence

## 1. Context

This report documents fresh browser evidence after the prototype-informed visual integration sequence merged into `main`.

- Latest merged commit reviewed: `53232dc polish: integrate admin prototype visuals (#81)`
- Evidence branch: `docs/post-prototype-visual-evidence`
- Capture date: `2026-05-31`
- Scope: documentation and screenshot evidence only
- Runtime source of truth: the real DSS repository
- Visual reference only: `reference/prototypeFyp/` and the mirrored ignored `img/` folder

The current UI is visually closer to the prototype while preserving real DSS behavior. The screenshots support describing this as a behavior-safe visual checkpoint. They do not support claims of pixel-perfect matching, complete Figma fidelity, or final visual alignment.

## 2. PR Sequence Covered

| PR | Purpose |
| --- | --- |
| `#77` | Ignored the reference-only prototype folder. |
| `#78` | Stabilized responsive authenticated navigation and long-page layout behavior. |
| `#79` | Integrated Auth and Student prototype-informed visuals. |
| `#80` | Integrated Lecturer prototype-informed visuals. |
| `#81` | Integrated Admin prototype-informed visuals and honest admin placeholders. |

## 3. Screenshot Capture Method

Fresh screenshots were captured with headless Chromium through Playwright against local services:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:3000`
- Demo roles: seeded student, lecturer, and admin accounts
- Ignored artifact directory: `frontend/smoke-artifacts/post-prototype-visual-integration-evidence/20260531-092434/`
- Local capture manifest: `frontend/smoke-artifacts/post-prototype-visual-integration-evidence/20260531-092434/manifest.json`

The capture helper logged in once per role, reused authenticated browser state, and used client-side route transitions for protected pages. This avoided mutating workflows while keeping the evidence run within local authentication limits.

The manifest recorded:

- `40` fresh screenshots
- `0` unexpected mutation requests
- Safe lecturer detail route captured: `/lecturer/pending-reviews/6`
- Reset-password screen rendered safely without a token, so no real reset request was submitted

## 4. Routes And Viewports Captured

Every required major route was captured at desktop width and the `1024px` evidence width. Login and the three role dashboards were also captured at `720px`.

| Area | Route | `1440px` | `1024px` | `720px` |
| --- | --- | --- | --- | --- |
| Auth | `/login` | Captured | Captured | Captured |
| Auth | `/forgot-password` | Captured | Captured | Not captured; login provides the smaller auth-shell check |
| Auth | `/reset-password` without token | Captured | Captured | Not captured; safe missing-token state verified at larger widths |
| Student | `/student/dashboard` | Captured | Captured | Captured |
| Student | `/student/submit-topic` | Captured | Captured | Not captured; dashboard provides the smaller student-shell check |
| Student | `/student/my-submissions` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Student | `/student/check-my-topic` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Student | `/student/research-explorer` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Lecturer | `/lecturer/dashboard` | Captured | Captured | Captured |
| Lecturer | `/lecturer/pending-reviews` | Captured | Captured | Not captured; dashboard provides the smaller lecturer-shell check |
| Lecturer | `/lecturer/check-similarity` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Lecturer | `/lecturer/pending-reviews/6` | Captured | Captured | Not captured; safe existing demo detail route inspected at larger widths |
| Admin | `/admin/dashboard` | Captured | Captured | Captured |
| Admin | `/admin/user-management` | Captured | Captured | Not captured; dashboard provides the smaller admin-shell check |
| Admin | `/admin/topic-repository` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Admin | `/admin/system-settings` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Admin | `/admin/audit-log` | Captured | Captured | Not captured; inspected at desktop and evidence widths |
| Admin | `/admin/reports` | Captured | Captured | Not captured; inspected at desktop and evidence widths |

## 5. Prototype References Compared

The screenshots were compared with relevant ignored local prototype references, including:

- Auth: `img/figma_AUTH_01_S1.png` and related auth images
- Student dashboard: `img/figma/student-dashboard/STUD_01_S1.png` through `STUD_01_S4.png`
- Student submit topic: `img/figma/student-submit-topic/STUD_02_S1.png` through `STUD_02_S4.png`
- Student submissions: `img/figma/student-my-submissions/STUD_03_S1.png` through `STUD_03_S5.png`
- Student checker: `img/figma/student-check-my-topic/STUD_04_S1.png` through `STUD_04_S4.png`
- Student explorer: `img/figma/student-research-explorer/STUD_05_S1.png` through `STUD_05_S4.png`
- Lecturer dashboard: `img/figma/lecturer-dashboard/LECT_01_S1.png` and `LECT_01_S2.png`
- Lecturer queue and detail: `img/figma/lecturer-pending-review/LECT_02_S1.png` through `LECT_02_S6.png`
- Lecturer checker: `img/figma/lecturer-check-similarity/LECT_04_S1.png` through `LECT_04_S5.png`
- Admin dashboard: `img/figma/admin-dashboard/ADMIN_01_S1.png` through `ADMIN_01_S3.png`
- Admin placeholders: the corresponding admin user-management, topic-repository, settings, audit-log, and reports references

The real app intentionally differs wherever prototype screens depend on unsupported data or workflow behavior.

## 6. Visual Findings By Area

### Shared Navigation

- The authenticated shell is consistent across student, lecturer, and admin roles.
- Desktop navigation uses the same emerald bar, active gold underline, role identity, and logout treatment.
- Navigation no longer causes document-level horizontal overflow in the captured matrix.
- At narrow widths, overflow is contained inside the navigation row rather than expanding the page.
- Remaining gap: the resting `720px` lecturer and admin screenshots visibly truncate later nav items. Horizontal scrolling works, but the affordance is subtle and would benefit from another polish pass.
- The manifest also detected a small contained lecturer navigation scroll range at desktop width (`705px` visible versus `728px` content). It does not break layout, but it is worth tightening later.

### Auth

- Login is visually close to the prototype composition: dark page surround, green institutional panel, white sign-in panel, warm gold action, and role-free credential flow.
- At `720px`, the split layout stacks cleanly and remains readable.
- Forgot-password and reset-password pages use the same visual language and preserve the existing recovery workflow.
- The reset-password screenshot honestly shows the missing-token warning and disabled submission state.
- Remaining gap: typography, exact panel proportions, and ornamental treatment differ from the prototype. This is acceptable for the current checkpoint.

### Student

- The student dashboard presents the latest real submission with a strong current-topic card, supported status, real timestamps, honest similarity-score unavailability, recent activity, and a real navigation action.
- Submit Topic uses a clear staged form composition while keeping unsupported pre-check and confirmation stages marked as coming later.
- My Submissions, Check My Topic, and Research Explorer read as part of the same role workspace.
- The student checker clearly states that it is advisory, local to the screen, and not a lecturer decision.
- Research Explorer borrows the prototype composition but keeps search, filters, insights, metrics, and rows honestly unavailable until a student-safe endpoint exists.
- At `720px`, dashboard cards stack cleanly with readable content and no document-level clipping.

### Lecturer

- The lecturer dashboard is visually closer to the prototype review-desk hierarchy while using only supported queue data.
- Pending Reviews has a clear read-only queue summary, client-side search controls, and a table that opens the existing detail workflow.
- The fresh capture verified the safe detail route `/lecturer/pending-reviews/6`.
- Submission Detail has a readable progression from submitted topic to evidence history, temporary similarity check, and controlled lecturer decision actions.
- The lecturer checker is visually consistent with the student checker while clearly preserving its standalone advisory role.
- Unsupported risk alerts, decision analytics, activity feeds, workload trends, and archives remain unavailable rather than being simulated.
- Remaining gap: lecturer navigation needs a more discoverable narrow-width overflow treatment.

### Admin

- The admin dashboard is visually closer to the prototype control-room composition: service-health area, metric region, activity region, planned state previews, and deferred workflow panels.
- The `1024px` service-health cards stack cleanly and remain readable.
- API, database, and SBERT status remain marked `Not connected yet`; metric cards remain `Not available yet`.
- The optional admin routes use a coherent admin placeholder shell with explicit presentation-only and deferred messaging.
- User management, repository, settings, audit log, and reports intentionally do not display the prototype's fake rows, counts, actions, logs, exports, or live statuses.
- Remaining gap: admin placeholder pages are compositionally aligned but intentionally much less populated than prototype screens because their backend capabilities do not exist.

## 7. Responsiveness Findings

### Desktop

- Auth split panels, role dashboards, forms, queues, and admin surfaces are readable and well spaced.
- No captured route produced document-level horizontal overflow.
- Lecturer navigation has a small contained scroll range even at desktop width. This is not a release blocker for a visual checkpoint, but it should be tightened.

### `1024px`

- This evidence width is stable across all captured routes.
- Auth remains readable.
- Student and lecturer content stacks without clipping.
- Lecturer detail remains usable on a long page without top-navigation overlay.
- Admin health cards stack vertically inside the right-side panel, resolving the earlier squeezed-card issue.

### `720px`

- Login stacks vertically and remains usable.
- Student dashboard stacks cleanly and retains readable hierarchy.
- Lecturer dashboard stacks into a long but readable review workspace.
- Admin dashboard stacks into readable control-room sections.
- The main remaining responsive issue is navigation discoverability: later lecturer and admin items are partially clipped at the resting scroll position even though horizontal scrolling contains the overflow.

## 8. Remaining Visual Gaps

- Add a clearer narrow-width navigation affordance for lecturer and admin roles, such as a visible fade, scroll cue, or a more compact treatment.
- Tighten lecturer desktop navigation width so it does not require a small contained scroll range.
- Continue typography, icon, and micro-spacing refinement where higher visual fidelity is desired.
- Prototype screens with populated explorer insights, admin tables, reports, audit activity, health status, analytics, and lecturer metrics remain visually richer than the real app because the corresponding real data is unavailable.
- Admin placeholder pages could receive another presentation-only polish pass later, but they should stay intentionally sparse until supported APIs and workflows exist.

## 9. Behavior Boundaries Preserved

- The prototype remains a visual reference only.
- The real DSS repository remains the functional source of truth.
- Existing routes, protected role behavior, authentication, API contracts, validation, submission behavior, lecturer decision payloads, snapshots, similarity behavior, Prisma schema, and database behavior were not changed by this evidence PR.
- Screenshot capture did not submit topics, run similarity checks, save snapshots, confirm lecturer decisions, import records, change settings, create users, or generate reports.
- The capture manifest recorded zero unexpected mutation requests.

## 10. Unsupported Prototype Features Deferred

The following prototype-only ideas remain unavailable, not connected, deferred, or presentation-only:

- Fake admin metrics, counts, live service health, audit logs, notifications, charts, exports, reports, imports, repository rows, settings mutations, and user-management actions
- Fake lecturer risk summaries, activity feeds, workload analytics, trend charts, assignments, archives, and supervisee data
- Fake student notifications, reviewer metadata, populated explorer rows, trend insights, and unsupported similarity-score claims
- Any unsupported workflow shortcut or mutation

## 11. Screenshot Artifact Boundary

The fresh evidence screenshots and manifest are local ignored artifacts only:

```text
frontend/smoke-artifacts/post-prototype-visual-integration-evidence/20260531-092434/
```

They must not be staged or committed. The reference folders also remain local and ignored:

```text
reference/
img/
frontend/smoke-artifacts/
```

## 12. Recommendation

`v0.3.0-ui-rc6` is reasonable as a behavior-safe post-prototype visual integration checkpoint.

The release notes should describe improved prototype-informed visual integration across Auth, Student, Lecturer, and Admin surfaces. They should not claim pixel-perfect parity, complete Figma fidelity, or final visual alignment.

A follow-up visual polish PR is still recommended for narrow-width lecturer and admin navigation affordance and for small typography, icon, and spacing refinements. That polish is desirable before any stronger visual-fidelity claim, but the captured gaps do not block an `rc6` checkpoint.
