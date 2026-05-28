# Screenshot-Based Visual Fidelity Audit Results

## Audit context

- Purpose: record the screenshot-based visual fidelity audit results for the Figma-informed UI.
- Screenshot artifacts were captured under `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/`.
- Figma references are local ignored `img/` files.
- `git status --short` remained clean after the audit.
- This report is docs-only and does not change runtime behavior.
- This audit does not claim pixel-perfect parity with the original Figma screenshots.

## Screenshot evidence captured

Captured browser screenshots:

- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/01-login.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/02-student-dashboard.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/03-student-submit-topic.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/04-student-my-submissions.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/05-student-check-my-topic.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/06-student-research-explorer.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/07-lecturer-dashboard.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/08-lecturer-pending-reviews.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/09-lecturer-check-similarity.png`
- `frontend/smoke-artifacts/visual-fidelity-audit/20260528-175654/10-admin-dashboard.png`

The capture manifest recorded no unexpected mutation requests.

## Figma references compared

Compared against local ignored Figma references, including:

- `img/figma_AUTH_01_S1.png`
- `img/figma/student-dashboard/STUD_01_S1.png`
- `img/figma/student-submit-topic/STUD_02_S1.png`
- `img/figma/student-my-submissions/STUD_03_S1.png`
- `img/figma/student-check-my-topic/STUD_04_S1.png`
- `img/figma/student-research-explorer/STUD_05_S1.png`
- `img/figma/lecturer-dashboard/LECT_01_S1.png`
- `img/figma/lecturer-pending-review/LECT_02_S1.png`
- `img/figma/lecturer-pending-review/LECT_02_S2.png`
- `img/figma/lecturer-check-similarity/LECT_04_S1.png`
- `img/figma/admin-dashboard/ADMIN_01_S1.png`

These references remain local ignored files and were not staged or committed.

## Overall finding

The current UI is behavior-safe and Figma-informed, but it is not visually close or pixel-perfect to the original Figma screenshots.

The main gap is that the current implementation uses a safer sidebar/dashboard shell and honest unavailable states, while the Figma direction uses top navigation, richer populated dashboards, live metrics, analytics, activity, richer tables, and fuller visual states.

## Pages far from Figma

- `/student/dashboard`
- `/student/submit-topic`
- `/student/my-submissions`
- `/student/research-explorer`
- `/lecturer/dashboard`
- `/lecturer/pending-reviews`
- `/admin/dashboard`

## Pages moderately close

- `/student/check-my-topic`
- `/lecturer/check-similarity`

## Pages acceptable

- `/login`

`/login` is the closest match to the Figma direction. It preserves the split layout, green brand panel, gold emphasis, welcome form, forgot-password placement, and no-role-selector behavior.

## Main visual gaps by page

| Page | Visual fidelity result | Main visual gaps |
|---|---|---|
| `/login` | Acceptable / closest | Typography precision, exact split proportions, field/button styling, and background emblem treatment differ from the Figma reference. |
| `/student/dashboard` | Far from Figma | Figma uses top navigation, a welcome hero, similarity score module, activity timeline, and quick-action cards; current UI uses sidebar shell and honest current-topic/status cards. |
| `/student/submit-topic` | Far from Figma | Figma shows a wider staged form with step indicators and supervisor/category controls; current UI is simpler, narrower, and intentionally avoids draft/pre-check/supervisor behavior. |
| `/student/my-submissions` | Far from Figma | Figma uses compact accordion/history styling; current UI renders long stacked submission cards and safer feedback-only panels. |
| `/student/check-my-topic` | Moderately close | Similar checker purpose, but current layout is taller, has stronger safety copy, and uses the sidebar shell. |
| `/student/research-explorer` | Far from Figma | Figma shows populated trends, topics, category charts, and discovery controls; current UI correctly stays unavailable/not connected. |
| `/lecturer/dashboard` | Far from Figma | Figma shows populated metrics, recent decisions, alert cards, and top navigation; current UI uses honest unavailable placeholders and a pending queue preview. |
| `/lecturer/pending-reviews` | Far from Figma | Figma includes tabbed and richer table concepts; current UI avoids bulk actions/export and keeps the queue read-only. |
| `/lecturer/check-similarity` | Moderately close | Functionally aligned checker, but current UI is more conservative and safety-callout heavy than the Figma reference. |
| `/admin/dashboard` | Far from Figma | Figma shows live system status, real metrics, audit activity, and reports; current UI correctly presents an honest non-live admin shell. |

## Safe corrections

- Tighten typography scale, spacing rhythm, card padding, and section hierarchy.
- Improve desktop max-widths and table/card density.
- Add closer Figma-style logo/header treatment without changing routes.
- Polish disabled and unavailable states while keeping them clearly unavailable.
- Improve responsive layout consistency.
- Bring form field sizing, button treatment, and badge emphasis closer to Figma.
- Keep all unavailable admin, research, analytics, and health states honest.

## Subjective decisions requiring approval

- Whether to replace the current sidebar app shell with the Figma-style top navigation shell.
- Whether Figma's populated dashboard concepts should remain visual references or become future backend-backed features.
- Whether to mimic Figma tables that imply bulk actions/export where those actions are intentionally out of scope.
- Whether admin should visually resemble the live-status Figma while still saying `Not connected yet`.
- Whether to prioritize pixel closeness over the current safety-callout-heavy presentation.

## App shell decision required

The first decision before further polish is the shared app shell direction:

- Keep the current sidebar/dashboard shell and polish within that structure.
- Move student, lecturer, and admin pages toward the Figma-style top navigation shell.

This decision should be made before additional page-level polish so future work does not polish the wrong layout foundation.

## Recommended next PR order

1. Shared app shell decision: sidebar vs Figma-style top navigation.
2. Student visual fidelity pass for dashboard and submit topic.
3. Student visual fidelity pass for submissions, checker, and research explorer shell.
4. Lecturer visual fidelity pass for dashboard and pending reviews.
5. Lecturer checker polish.
6. Admin dashboard shell polish with honest non-live states.
7. Optional screenshot evidence doc after approved polish.

## Safety boundaries preserved

- No fake data.
- No fake admin metrics.
- No fake live health.
- No topic submissions.
- No similarity checks unless explicitly approved.
- No snapshots.
- No lecturer decisions.
- No route behavior changes.
- No API behavior changes.
- No auth behavior changes.
- No backend behavior changes.
- No tracked files were changed by the screenshot capture.
- `img/` and screenshot artifacts remain ignored/untracked.

## Result

The screenshot-based visual fidelity audit confirms that the UI is behavior-safe and Figma-informed, but not visually close or pixel-perfect to the original Figma screenshots. `/login` is acceptable and closest to Figma, the student and lecturer checker pages are moderately close, and the remaining student, lecturer, and admin dashboard pages need a deliberate visual fidelity pass after the shared app shell direction is approved.
