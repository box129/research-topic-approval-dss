// Builds docs/product/visual-baseline/README.md (screenshot + video index) and
// docs/product/visual-baseline/videos/MANIFEST.md from the files actually
// present. Documentation-only.
//
//   node docs/product/visual-baseline/tooling/build-index.mjs \
//     --source-commit <sha> [--docs-commit <sha>] [--export <dir-with-mp4s>]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(here, '..');
const REPO = path.resolve(BASE, '..', '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter(Boolean));
const SOURCE = args['source-commit'] || 'ff833cf0bc645bd4678bf480bb3c4070216f78cf';
const DOCS = args['docs-commit'] || '(this documentation commit — recorded after commit)';
const EXPORT = args.export || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Development', 'rtadss-visual-baseline-export', 'videos');
const SHOT_DIR = path.join(BASE, 'screenshots');
const VIDEO_DIR = path.join(BASE, 'videos');

// filename -> [role, feature/state, route, synthetic scenario]
const META = {
  '01-landing-desktop.png': ['Public', 'Landing page (desktop 1440×900)', '/', 'No sign-in; product overview'],
  '02-landing-mobile.png': ['Public', 'Landing page (mobile 390×844)', '/', 'No sign-in; product overview'],
  '03-login.png': ['Public', 'Sign in — email address or matric number', '/login', 'Empty form'],
  '04-forgot-password.png': ['Public', 'Forgot password (email on record required)', '/forgot-password', 'Empty form'],
  '05-forced-password-change.png': ['Student', 'Forced first-login password change', '/change-password', 'Student PHD/24/0101 (no email) after signing in with a one-time credential'],
  '10-student-dashboard.png': ['Student', 'Dashboard with an approved topic', '/student/dashboard', 'PHD/24/0101 after the revised topic was approved'],
  '11-student-check-topic-empty.png': ['Student', 'Check My Topic — empty form', '/student/check-my-topic', 'PHD/24/0101 before any check'],
  '12-student-check-topic-results.png': ['Student', 'Check My Topic — results with similarity level, related topics, population/location/study focus, session/supervisor, advisory wording', '/student/check-my-topic', 'Malaria-prevention proposal against the 12-topic fictional corpus'],
  '13-student-submit-topic.png': ['Student', 'Submit Topic — form with research context', '/student/submit-topic', 'Title, population, location, study focus, category, keywords filled'],
  '14-student-submit-review.png': ['Student', 'Review before submitting', '/student/submit-topic', 'Same proposal, nothing saved yet'],
  '15-student-submission-pending.png': ['Student', 'My Submissions — pending review', '/student/my-submissions', 'First submission just created'],
  '16-student-submission-revision-required.png': ['Student', 'My Submissions — action required with lecturer feedback', '/student/my-submissions', 'Lecturer requested a revision with rationale'],
  '17-student-revise-prefilled.png': ['Student', 'Revise and Resubmit — pre-filled form with feedback', '/student/my-submissions/:id/revise', 'Original title and context pre-filled'],
  '18-student-revised-submission.png': ['Student', 'My Submissions — revised submission linked to original', '/student/my-submissions', 'Revision pending; original preserved with history'],
  '19-student-approved-submission.png': ['Student', 'My Submissions — approved', '/student/my-submissions', 'Revision approved'],
  '20-student-my-submissions.png': ['Student', 'My Submissions — full page', '/student/my-submissions', 'Original + revision cards; order-independent revision guidance (refreshed at the polish baseline)'],
  '30-lecturer-dashboard.png': ['Lecturer', 'Dashboard', '/lecturer/dashboard', 'Queue preview identifies the student by name and matric number; one pending submission in the demo queue (refreshed at the polish baseline)'],
  '31-lecturer-pending-reviews.png': ['Lecturer', 'Pending Reviews — student name, matric number, email only when available', '/lecturer/pending-reviews', 'Includes no-email students (e.g. PHD/24/0101, PHD/24/0103)'],
  '32-lecturer-review-detail.png': ['Lecturer', 'Review detail', '/lecturer/pending-reviews/:id', 'PHD/24/0101 first submission'],
  '33-lecturer-review-similarity-context.png': ['Lecturer', 'Similarity evidence on a submission with research context', '/lecturer/pending-reviews/:id', 'Run similarity check on the stored structured representation'],
  '34-lecturer-request-revision.png': ['Lecturer', 'Request Revision with rationale — confirmation', '/lecturer/pending-reviews/:id', 'Rationale typed; confirm dialog open'],
  '35-lecturer-revised-submission.png': ['Lecturer', 'Revised submission — revision context (previous/feedback/current)', '/lecturer/pending-reviews/:id', 'Revision of PHD/24/0101'],
  '36-lecturer-approve.png': ['Lecturer', 'Approve — confirmation', '/lecturer/pending-reviews/:id', 'Approving the revision'],
  '37-lecturer-my-decisions.png': ['Lecturer', 'My Decisions', '/lecturer/my-decisions', 'Decisions with each student identified by name and matric number, email only when present (refreshed at the polish baseline)'],
  '38-lecturer-supervisees.png': ['Lecturer', 'Supervisees', '/lecturer/supervisees', 'Admin-assigned students identified by name and matric number (refreshed at the polish baseline)'],
  '39-lecturer-similarity-checker.png': ['Lecturer', 'Check Similarity — results', '/lecturer/check-similarity', 'Same proposal as the student pre-check; research context stacked one field per row inside the narrow cards (refreshed at the polish baseline)'],
  '40-lecturer-research-trends.png': ['Lecturer', 'Research Trends', '/lecturer/research-trends', 'Fictional corpus'],
  '50-admin-dashboard.png': ['Admin', 'Dashboard — service health and metrics', '/admin/dashboard', 'Populated demo database'],
  '51-admin-user-management.png': ['Admin', 'User Management — list', '/admin/user-management', 'Synthetic accounts'],
  '52-admin-create-student-no-email.png': ['Admin', 'Create student with matric and no email — one-time credential (masked)', '/admin/user-management', 'PHD/24/0101; credential text masked at capture time'],
  '53-admin-create-lecturer.png': ['Admin', 'Create lecturer — form (email required)', '/admin/user-management', 'Form filled before submission'],
  '54-admin-bulk-import.png': ['Admin', 'Bulk onboarding — spreadsheet selected', '/admin/user-management', '6-row cohort (2 no-email students, 1 with email, 1 lecturer, 1 conflict, 1 invalid); assignment cards identify students by name and matric number (refreshed at the polish baseline)'],
  '55-admin-bulk-preview.png': ['Admin', 'Bulk onboarding — preview (valid / conflict / invalid)', '/admin/user-management', 'Preview only — nothing created'],
  '56-admin-bulk-result.png': ['Admin', 'User Management immediately after the bulk commit (page top; the commit summary and manifest panel are in 57)', '/admin/user-management', 'Four accounts created, one already existed, one invalid'],
  '57-admin-credential-manifest-state.png': ['Admin', 'One-time credential manifest state (download only; no plaintext on screen)', '/admin/user-management', 'After commit'],
  '58-admin-invitation-action.png': ['Admin', 'Invitation sent to an account with an email', '/admin/user-management', 'Bulk-created student PHD/24/0203'],
  '59-admin-credential-reset.png': ['Admin', 'Credential reset for a no-email student — new one-time password (masked)', '/admin/user-management', 'PHD/24/0103'],
  '60-admin-topic-repository.png': ['Admin', 'Topic Repository', '/admin/topic-repository', 'Historical / current-session / under-review'],
  '61-admin-settings.png': ['Admin', 'System Settings', '/admin/system-settings', 'Non-secret effective settings'],
  '62-admin-audit-log.png': ['Admin', 'Audit Log', '/admin/audit-log', 'Provisioning, decisions, imports'],
  '63-admin-reports.png': ['Admin', 'Reports', '/admin/reports', 'Summary and exports'],
  '70-empty-corpus-honesty.png': ['Student', 'Empty comparison corpus reported truthfully (not as originality)', '/student/check-my-topic', 'Check run before any topic existed'],
  '71-semantic-provider-unavailable.png': ['Student', 'Semantic provider unavailable — fail-closed, no fallback, no false LOW/original result', '/student/check-my-topic', 'A genuine transient provider outage observed during capture (not simulated); the checker reports it honestly'],
  '72-no-pending-reviews.png': ['Lecturer', 'Pending Reviews — empty queue', '/lecturer/pending-reviews', 'Before any submission'],
  '73-no-submissions.png': ['Student', 'My Submissions — empty state', '/student/my-submissions', 'New student before submitting'],
  '74-import-conflict.png': ['Admin', 'Bulk onboarding — replayed file: every row already exists', '/admin/user-management', 'Same cohort previewed again'],
  '75-no-email-invitation-skip.png': ['Admin', 'Invitation refused truthfully for a student without email', '/admin/user-management', 'Bulk-created student PHD/24/0201']
};
const VIDEO_META = {
  '01-system-overview.mp4': ['All roles', 'Landing → student → lecturer → admin, briefly', '/, /login, dashboards, queues', 'Departmental demonstration'],
  '02-student-walkthrough.mp4': ['Student', 'Matric login, forced change, Check My Topic, Submit, revision required, Revise and Resubmit, approved', '/student/*', 'New student a fresh per-run matric (PHD/24/7271 in this recording); lecturer actions prepared between segments'],
  '03-lecturer-walkthrough.mp4': ['Lecturer', 'Queue with matric identity, review detail, similarity context, request revision, revised comparison, approve, decisions, checker, supervisees', '/lecturer/*', 'Student PHD/24/0102; student revision prepared between segments'],
  '04-admin-walkthrough.mp4': ['Admin', 'Provisioning (no-email student, lecturer), bulk preview/conflict/commit, invitation eligibility, credential reset, repository, audit, reports, settings', '/admin/*', 'Credentials masked live']
};

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Duration straight from the file when an ffmpeg binary is available
// (VB_FFMPEG); ffmpeg reports it on stderr and exits non-zero with no output.
function probeDuration(file) {
  const ff = process.env.VB_FFMPEG;
  if (!ff || !fs.existsSync(ff)) return null;
  let text = '';
  try { execFileSync(ff, ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { text = String(error.stderr || ''); }
  return text.match(/Duration:\s*([\d:.]+)/)?.[1] || null;
}
const mb = (n) => (n / 1e6).toFixed(2) + ' MB';
const today = new Date().toISOString().slice(0, 10);

const shots = fs.existsSync(SHOT_DIR) ? fs.readdirSync(SHOT_DIR).filter((f) => f.endsWith('.png')).sort() : [];
const missing = Object.keys(META).filter((f) => !shots.includes(f));
let totalShotBytes = 0;
const shotRows = shots.map((f) => {
  const st = fs.statSync(path.join(SHOT_DIR, f)); totalShotBytes += st.size;
  const [role, feature, route, scenario] = META[f] || ['?', '?', '?', '?'];
  return `| \`${f}\` | ${role} | ${feature} | \`${route}\` | ${scenario} | ${st.mtime.toISOString().slice(0, 10)} | ${mb(st.size)} |`;
});

let recording = null;
try { recording = JSON.parse(fs.readFileSync(path.join(EXPORT, 'recording-log.json'), 'utf8')); } catch { /* no recordings yet */ }
const videos = fs.existsSync(EXPORT) ? fs.readdirSync(EXPORT).filter((f) => f.endsWith('.mp4')).sort() : [];
let totalVideoBytes = 0;
const videoRows = videos.map((f) => {
  const file = path.join(EXPORT, f); const st = fs.statSync(file); totalVideoBytes += st.size;
  const rec = recording?.results?.find((r) => r.name === f);
  const [role, feature, route, scenario] = VIDEO_META[f] || ['?', '?', '?', '?'];
  return { f, role, feature, route, scenario, size: st.size, duration: probeDuration(file) || rec?.duration || 'unknown', sha: sha256(file), date: st.mtime.toISOString().slice(0, 10), incomplete: rec?.failure || null };
});

const readme = `# Visual Baseline

Reproducible visual record of the Research Topic Approval DSS **before**
departmental pilot feedback. Every capture uses **synthetic data only** — the
accounts, matric numbers, emails (\`.invalid\`), lecturers and topics are all
fabricated (see \`tooling/synthetic-dataset.mjs\`).

| | |
| --- | --- |
| **APPLICATION SOURCE BASELINE** | \`${SOURCE}\` (branch \`staging/render-acceptance\`) |
| **DOCUMENTATION COMMIT** | ${DOCS} |
| Capture date | ${today} |
| Previous package | source \`ff833cf0bc645bd4678bf480bb3c4070216f78cf\`, documentation \`4bb6643ba0357816194dfbdae56a6086f4bab939\` (historically valid; superseded by this package) |
| Refreshed at this baseline | screenshots 20, 30, 37, 38, 39 and 54 and all four videos (pre-pilot identity/visual polish); the other 41 screenshots show screens the polish did not change and are carried forward from the previous capture |
| Desktop viewport | 1440×900 (PNG, unscaled) · Mobile 390×844 |
| Videos | 1920×1080, H.264 MP4, silent with captions — kept outside Git, see \`videos/MANIFEST.md\` |

Companion documents: [feature inventory](../current-feature-inventory.md) ·
[navigation map](./navigation-map.md) · [walkthrough script](./walkthrough-script.md) · [coverage audit](./coverage-audit.md) ·
[hosting decision runbook](../../operations/hosting-decision-runbook.md).

## Screenshots (${shots.length} files, ${mb(totalShotBytes)})

| File | Role | Feature / state | Route | Synthetic scenario | Captured | Size |
| --- | --- | --- | --- | --- | --- | --- |
${shotRows.join('\n')}
${missing.length ? `\n**Not captured:** ${missing.map((m) => `\`${m}\``).join(', ')} — see the completeness audit in the final report.\n` : ''}
## Videos (${videos.length} files, ${mb(totalVideoBytes)})

| File | Role | Content | Routes | Scenario | Duration | Size | Captured |
| --- | --- | --- | --- | --- | --- | --- | --- |
${videoRows.map((v) => `| \`${v.f}\` | ${v.role} | ${v.feature} | \`${v.route}\` | ${v.scenario} | ${v.duration} | ${mb(v.size)} | ${v.date} |`).join('\n')}

The MP4 binaries live in the export directory named in \`videos/MANIFEST.md\`
(not in Git history). Each entry there carries a SHA-256 so a copy can be
verified.

## Reproducing the baseline

1. Build and start the local acceptance stack (\`docker compose --profile
   maintenance build\`, \`up -d\` with the acceptance overlay), migrate a fresh
   demo database with \`backend-migrate\`, bootstrap the administrator, and
   complete the forced password change with the administrator in
   \`tooling/synthetic-dataset.mjs\`.
2. \`NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/product/visual-baseline/tooling/capture-screenshots.mjs\`
3. \`VB_FFMPEG=<ffmpeg-with-libx264> NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/product/visual-baseline/tooling/record-videos.mjs\`
4. \`node docs/product/visual-baseline/tooling/build-index.mjs --source-commit <sha> --docs-commit <sha>\`

The tooling imports Playwright from the frontend's existing dev dependency and
ExcelJS from the backend; it adds no application dependency and changes no
application code. \`NODE_TLS_REJECT_UNAUTHORIZED=0\` applies only to the capture
process, because the local edge uses a self-signed certificate.

## Known demo-environment limitations (not application defects)

- No academic session was configured in the demo database, so submission
  records show "Session: Not recorded"/"Not provided".
- No stored configuration values exist in the demo database, so System
  Settings shows "0 settings" (the page is read-only by design).
- The admin dashboard reports the semantic provider as "Unknown — not checked
  by this dashboard endpoint yet"; provider health is reported by
  \`/api/v1/readiness\`.
- The audit log shows the actor address \`172.18.0.1\`, the demo stack's Docker
  bridge address, as rendered by the product's own audit view.
- Defects observed during capture are recorded in \`observed-defects.md\`; VB-1, VB-3, VB-4 and VB-5 were fixed by the pre-pilot polish pass (this baseline) and their captures refreshed, and VB-2 is a hosted-acceptance observation, not an application defect.
- Feature-to-media coverage against the feature inventory (28 FULL, 9 PARTIAL, 1 NOT CAPTURED, 7 N/A of 45 rows) is in \`coverage-audit.md\`; the PARTIAL and NOT CAPTURED rows are the remaining visual gaps.

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
`;
fs.writeFileSync(path.join(BASE, 'README.md'), readme);

const manifest = `# Walkthrough Videos — Manifest

The MP4 files are **not tracked in Git** (see \`.gitignore\`). They are kept in
the export directory below; verify a copy with the SHA-256 listed.

| | |
| --- | --- |
| Export directory | \`${EXPORT}\` |
| Application source baseline | \`${SOURCE}\` |
| Recorded | ${recording?.recordedAt?.slice(0, 10) || today} |
| Format | 1920×1080, H.264 (libx264, CRF 24, yuv420p, faststart), no audio, on-screen captions |
| Total size | ${mb(totalVideoBytes)} |

| File | Duration | Size | SHA-256 | Status |
| --- | --- | --- | --- | --- |
${videoRows.map((v) => `| \`${v.f}\` | ${v.duration} | ${mb(v.size)} | \`${v.sha}\` | ${v.incomplete ? 'INCOMPLETE — ' + v.incomplete.split('\n')[0] : 'complete'} |`).join('\n')}

Scenes, captions and expected states for each video are in
[\`../walkthrough-script.md\`](../walkthrough-script.md); the recorder is
\`../tooling/record-videos.mjs\`.
`;
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.writeFileSync(path.join(VIDEO_DIR, 'MANIFEST.md'), manifest);

console.log(`README: ${shots.length} screenshots (${mb(totalShotBytes)}), ${videos.length} videos (${mb(totalVideoBytes)}); missing screenshots: ${missing.length ? missing.join(', ') : 'none'}`);
