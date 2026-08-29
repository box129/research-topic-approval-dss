# Visual Baseline

Reproducible visual record of the Research Topic Approval DSS **before**
departmental pilot feedback. Every capture uses **synthetic data only** — the
accounts, matric numbers, emails (`.invalid`), lecturers and topics are all
fabricated (see `tooling/synthetic-dataset.mjs`).

| | |
| --- | --- |
| **APPLICATION SOURCE BASELINE** | `e5e3fc18555fafde7fa409352b37357c0bb22c43` (branch `staging/render-acceptance`) |
| **DOCUMENTATION COMMIT** | 4bb6643ba0357816194dfbdae56a6086f4bab939 |
| Capture date | 2026-08-29 |
| Previous package | source `ff833cf0bc645bd4678bf480bb3c4070216f78cf`, documentation `4bb6643ba0357816194dfbdae56a6086f4bab939` (historically valid; superseded by this package) |
| Refreshed at this baseline | screenshots 20, 30, 37, 38, 39 and 54 and all four videos (pre-pilot identity/visual polish); the other 41 screenshots show screens the polish did not change and are carried forward from the previous capture |
| Desktop viewport | 1440×900 (PNG, unscaled) · Mobile 390×844 |
| Videos | 1920×1080, H.264 MP4, silent with captions — kept outside Git, see `videos/MANIFEST.md` |

Companion documents: [feature inventory](../current-feature-inventory.md) ·
[navigation map](./navigation-map.md) · [walkthrough script](./walkthrough-script.md) · [coverage audit](./coverage-audit.md) ·
[hosting decision runbook](../../operations/hosting-decision-runbook.md).

## Screenshots (47 files, 3.84 MB)

| File | Role | Feature / state | Route | Synthetic scenario | Captured | Size |
| --- | --- | --- | --- | --- | --- | --- |
| `01-landing-desktop.png` | Public | Landing page (desktop 1440×900) | `/` | No sign-in; product overview | 2026-08-29 | 0.09 MB |
| `02-landing-mobile.png` | Public | Landing page (mobile 390×844) | `/` | No sign-in; product overview | 2026-08-29 | 0.04 MB |
| `03-login.png` | Public | Sign in — email address or matric number | `/login` | Empty form | 2026-08-29 | 0.04 MB |
| `04-forgot-password.png` | Public | Forgot password (email on record required) | `/forgot-password` | Empty form | 2026-08-29 | 0.04 MB |
| `05-forced-password-change.png` | Student | Forced first-login password change | `/change-password` | Student PHD/24/0101 (no email) after signing in with a one-time credential | 2026-08-29 | 0.04 MB |
| `10-student-dashboard.png` | Student | Dashboard with an approved topic | `/student/dashboard` | PHD/24/0101 after the revised topic was approved | 2026-08-29 | 0.06 MB |
| `11-student-check-topic-empty.png` | Student | Check My Topic — empty form | `/student/check-my-topic` | PHD/24/0101 before any check | 2026-08-29 | 0.08 MB |
| `12-student-check-topic-results.png` | Student | Check My Topic — results with similarity level, related topics, population/location/study focus, session/supervisor, advisory wording | `/student/check-my-topic` | Malaria-prevention proposal against the 12-topic fictional corpus | 2026-08-29 | 0.11 MB |
| `13-student-submit-topic.png` | Student | Submit Topic — form with research context | `/student/submit-topic` | Title, population, location, study focus, category, keywords filled | 2026-08-29 | 0.06 MB |
| `14-student-submit-review.png` | Student | Review before submitting | `/student/submit-topic` | Same proposal, nothing saved yet | 2026-08-29 | 0.08 MB |
| `15-student-submission-pending.png` | Student | My Submissions — pending review | `/student/my-submissions` | First submission just created | 2026-08-29 | 0.05 MB |
| `16-student-submission-revision-required.png` | Student | My Submissions — action required with lecturer feedback | `/student/my-submissions` | Lecturer requested a revision with rationale | 2026-08-29 | 0.07 MB |
| `17-student-revise-prefilled.png` | Student | Revise and Resubmit — pre-filled form with feedback | `/student/my-submissions/:id/revise` | Original title and context pre-filled | 2026-08-29 | 0.07 MB |
| `18-student-revised-submission.png` | Student | My Submissions — revised submission linked to original | `/student/my-submissions` | Revision pending; original preserved with history | 2026-08-29 | 0.09 MB |
| `19-student-approved-submission.png` | Student | My Submissions — approved | `/student/my-submissions` | Revision approved | 2026-08-29 | 0.09 MB |
| `20-student-my-submissions.png` | Student | My Submissions — full page | `/student/my-submissions` | Original + revision cards; order-independent revision guidance (refreshed at the polish baseline) | 2026-08-29 | 0.11 MB |
| `30-lecturer-dashboard.png` | Lecturer | Dashboard | `/lecturer/dashboard` | Queue preview identifies the student by name and matric number; one pending submission in the demo queue (refreshed at the polish baseline) | 2026-08-29 | 0.06 MB |
| `31-lecturer-pending-reviews.png` | Lecturer | Pending Reviews — student name, matric number, email only when available | `/lecturer/pending-reviews` | Includes no-email students (e.g. PHD/24/0101, PHD/24/0103) | 2026-08-29 | 0.10 MB |
| `32-lecturer-review-detail.png` | Lecturer | Review detail | `/lecturer/pending-reviews/:id` | PHD/24/0101 first submission | 2026-08-29 | 0.08 MB |
| `33-lecturer-review-similarity-context.png` | Lecturer | Similarity evidence on a submission with research context | `/lecturer/pending-reviews/:id` | Run similarity check on the stored structured representation | 2026-08-29 | 0.08 MB |
| `34-lecturer-request-revision.png` | Lecturer | Request Revision with rationale — confirmation | `/lecturer/pending-reviews/:id` | Rationale typed; confirm dialog open | 2026-08-29 | 0.11 MB |
| `35-lecturer-revised-submission.png` | Lecturer | Revised submission — revision context (previous/feedback/current) | `/lecturer/pending-reviews/:id` | Revision of PHD/24/0101 | 2026-08-29 | 0.09 MB |
| `36-lecturer-approve.png` | Lecturer | Approve — confirmation | `/lecturer/pending-reviews/:id` | Approving the revision | 2026-08-29 | 0.11 MB |
| `37-lecturer-my-decisions.png` | Lecturer | My Decisions | `/lecturer/my-decisions` | Decisions with each student identified by name and matric number, email only when present (refreshed at the polish baseline) | 2026-08-29 | 0.11 MB |
| `38-lecturer-supervisees.png` | Lecturer | Supervisees | `/lecturer/supervisees` | Admin-assigned students identified by name and matric number (refreshed at the polish baseline) | 2026-08-29 | 0.10 MB |
| `39-lecturer-similarity-checker.png` | Lecturer | Check Similarity — results | `/lecturer/check-similarity` | Same proposal as the student pre-check; research context stacked one field per row inside the narrow cards (refreshed at the polish baseline) | 2026-08-29 | 0.10 MB |
| `40-lecturer-research-trends.png` | Lecturer | Research Trends | `/lecturer/research-trends` | Fictional corpus | 2026-08-29 | 0.06 MB |
| `50-admin-dashboard.png` | Admin | Dashboard — service health and metrics | `/admin/dashboard` | Populated demo database | 2026-08-29 | 0.06 MB |
| `51-admin-user-management.png` | Admin | User Management — list | `/admin/user-management` | Synthetic accounts | 2026-08-29 | 0.09 MB |
| `52-admin-create-student-no-email.png` | Admin | Create student with matric and no email — one-time credential (masked) | `/admin/user-management` | PHD/24/0101; credential text masked at capture time | 2026-08-29 | 0.09 MB |
| `53-admin-create-lecturer.png` | Admin | Create lecturer — form (email required) | `/admin/user-management` | Form filled before submission | 2026-08-29 | 0.09 MB |
| `54-admin-bulk-import.png` | Admin | Bulk onboarding — spreadsheet selected | `/admin/user-management` | 6-row cohort (2 no-email students, 1 with email, 1 lecturer, 1 conflict, 1 invalid); assignment cards identify students by name and matric number (refreshed at the polish baseline) | 2026-08-29 | 0.12 MB |
| `55-admin-bulk-preview.png` | Admin | Bulk onboarding — preview (valid / conflict / invalid) | `/admin/user-management` | Preview only — nothing created | 2026-08-29 | 0.10 MB |
| `56-admin-bulk-result.png` | Admin | User Management immediately after the bulk commit (page top; the commit summary and manifest panel are in 57) | `/admin/user-management` | Four accounts created, one already existed, one invalid | 2026-08-29 | 0.09 MB |
| `57-admin-credential-manifest-state.png` | Admin | One-time credential manifest state (download only; no plaintext on screen) | `/admin/user-management` | After commit | 2026-08-29 | 0.10 MB |
| `58-admin-invitation-action.png` | Admin | Invitation sent to an account with an email | `/admin/user-management` | Bulk-created student PHD/24/0203 | 2026-08-29 | 0.10 MB |
| `59-admin-credential-reset.png` | Admin | Credential reset for a no-email student — new one-time password (masked) | `/admin/user-management` | PHD/24/0103 | 2026-08-29 | 0.09 MB |
| `60-admin-topic-repository.png` | Admin | Topic Repository | `/admin/topic-repository` | Historical / current-session / under-review | 2026-08-29 | 0.10 MB |
| `61-admin-settings.png` | Admin | System Settings | `/admin/system-settings` | Non-secret effective settings | 2026-08-29 | 0.05 MB |
| `62-admin-audit-log.png` | Admin | Audit Log | `/admin/audit-log` | Provisioning, decisions, imports | 2026-08-29 | 0.10 MB |
| `63-admin-reports.png` | Admin | Reports | `/admin/reports` | Summary and exports | 2026-08-29 | 0.09 MB |
| `70-empty-corpus-honesty.png` | Student | Empty comparison corpus reported truthfully (not as originality) | `/student/check-my-topic` | Check run before any topic existed | 2026-08-29 | 0.08 MB |
| `71-semantic-provider-unavailable.png` | Student | Semantic provider unavailable — fail-closed, no fallback, no false LOW/original result | `/student/check-my-topic` | A genuine transient provider outage observed during capture (not simulated); the checker reports it honestly | 2026-08-29 | 0.06 MB |
| `72-no-pending-reviews.png` | Lecturer | Pending Reviews — empty queue | `/lecturer/pending-reviews` | Before any submission | 2026-08-29 | 0.05 MB |
| `73-no-submissions.png` | Student | My Submissions — empty state | `/student/my-submissions` | New student before submitting | 2026-08-29 | 0.04 MB |
| `74-import-conflict.png` | Admin | Bulk onboarding — replayed file: every row already exists | `/admin/user-management` | Same cohort previewed again | 2026-08-29 | 0.11 MB |
| `75-no-email-invitation-skip.png` | Admin | Invitation refused truthfully for a student without email | `/admin/user-management` | Bulk-created student PHD/24/0201 | 2026-08-29 | 0.10 MB |

## Videos (4 files, 36.24 MB)

| File | Role | Content | Routes | Scenario | Duration | Size | Captured |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `01-system-overview.mp4` | All roles | Landing → student → lecturer → admin, briefly | `/, /login, dashboards, queues` | Departmental demonstration | 00:02:20.76 | 5.50 MB | 2026-08-29 |
| `02-student-walkthrough.mp4` | Student | Matric login, forced change, Check My Topic, Submit, revision required, Revise and Resubmit, approved | `/student/*` | New student a fresh per-run matric (PHD/24/7271 in this recording); lecturer actions prepared between segments | 00:04:23.28 | 8.41 MB | 2026-08-29 |
| `03-lecturer-walkthrough.mp4` | Lecturer | Queue with matric identity, review detail, similarity context, request revision, revised comparison, approve, decisions, checker, supervisees | `/lecturer/*` | Student PHD/24/0102; student revision prepared between segments | 00:04:55.44 | 9.82 MB | 2026-08-29 |
| `04-admin-walkthrough.mp4` | Admin | Provisioning (no-email student, lecturer), bulk preview/conflict/commit, invitation eligibility, credential reset, repository, audit, reports, settings | `/admin/*` | Credentials masked live | 00:06:22.28 | 12.50 MB | 2026-08-29 |

The MP4 binaries live in the export directory named in `videos/MANIFEST.md`
(not in Git history). Each entry there carries a SHA-256 so a copy can be
verified.

## Reproducing the baseline

1. Build and start the local acceptance stack (`docker compose --profile
   maintenance build`, `up -d` with the acceptance overlay), migrate a fresh
   demo database with `backend-migrate`, bootstrap the administrator, and
   complete the forced password change with the administrator in
   `tooling/synthetic-dataset.mjs`.
2. `NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/product/visual-baseline/tooling/capture-screenshots.mjs`
3. `VB_FFMPEG=<ffmpeg-with-libx264> NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/product/visual-baseline/tooling/record-videos.mjs`
4. `node docs/product/visual-baseline/tooling/build-index.mjs --source-commit <sha> --docs-commit <sha>`

The tooling imports Playwright from the frontend's existing dev dependency and
ExcelJS from the backend; it adds no application dependency and changes no
application code. `NODE_TLS_REJECT_UNAUTHORIZED=0` applies only to the capture
process, because the local edge uses a self-signed certificate.

## Known demo-environment limitations (not application defects)

- No academic session was configured in the demo database, so submission
  records show "Session: Not recorded"/"Not provided".
- No stored configuration values exist in the demo database, so System
  Settings shows "0 settings" (the page is read-only by design).
- The admin dashboard reports the semantic provider as "Unknown — not checked
  by this dashboard endpoint yet"; provider health is reported by
  `/api/v1/readiness`.
- The audit log shows the actor address `172.18.0.1`, the demo stack's Docker
  bridge address, as rendered by the product's own audit view.
- Defects observed during capture are recorded in `observed-defects.md`; VB-1, VB-3, VB-4 and VB-5 were fixed by the pre-pilot polish pass (this baseline) and their captures refreshed, and VB-2 is a hosted-acceptance observation, not an application defect.
- Feature-to-media coverage against the feature inventory (28 FULL, 9 PARTIAL, 1 NOT CAPTURED, 7 N/A of 45 rows) is in `coverage-audit.md`; the PARTIAL and NOT CAPTURED rows are the remaining visual gaps.

## Safeguards applied to every capture

- One-time credentials are masked in the DOM before a screenshot is taken. During
  video recording a paint-level mask is installed (the credential text is made
  transparent and overlaid with dots by CSS, with a DOM rewrite as a second
  layer) and re-applied the moment each credential panel renders; the mask was
  proven on the live UI before recording.
- The visible page text is scanned before every screenshot for credentials,
  keys, database URLs, tokens and real-domain addresses; a capture is refused,
  not blurred afterwards, if anything matches.
- No browser chrome, devtools, terminals, bookmarks or host paths appear:
  captures are headless viewport renders of the application only.
