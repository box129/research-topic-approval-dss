// Role walkthrough video recorder. Documentation-only; records the built
// container stack through its public HTTPS edge with synthetic data.
//
// Each video is one Playwright browser context recorded at 1920×1080. A pointer
// and caption overlay are drawn inside the page for the recording only. Where a
// walkthrough needs another role to act (a lecturer requesting a revision while
// the student video is recording), that action is performed through the API
// between segments and announced by a caption — the frontend never fakes a
// transition it does not support.
//
// One-time credentials are masked live: a MutationObserver replaces the
// credential text the instant it is rendered, so no frame ever carries it.
//
// Expects the screenshot capture to have run first (corpus, accounts and
// submissions exist). Produces WebM intermediates in VB_WORK and H.264 MP4s in
// VB_EXPORT via the ffmpeg binary at VB_FFMPEG.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ORIGIN, VIDEO, sleep, apiSession, withProviderRetry, providerEvents, writeUsersWorkbook,
  launch, newPage, forbid, installOverlay, installCredentialMask, maskNow, caption, titleCard, glide, glideClick, typeSlowly, scrollBy, ensureDir
} from './lib.mjs';
import { ADMIN, LECTURERS, STUDENTS, PROPOSALS, FEEDBACK } from './synthetic-dataset.mjs';

const WORK = ensureDir(process.env.VB_WORK || path.join(os.tmpdir(), 'vb-video-work'));
const EXPORT = ensureDir(process.env.VB_EXPORT || path.join(os.homedir(), 'Development', 'rtadss-visual-baseline-export', 'videos'));
const FFMPEG = process.env.VB_FFMPEG;
if (!FFMPEG || !fs.existsSync(FFMPEG)) throw new Error('VB_FFMPEG must point to an ffmpeg binary with libx264 (documentation tooling only).');
const FIX = ensureDir(path.join(os.tmpdir(), 'vb-fixtures'));
const L = (k) => LECTURERS.find((x) => x.key === k);
const S = (k) => STUDENTS.find((x) => x.key === k);
[ADMIN, ...LECTURERS, ...STUDENTS].forEach((u) => forbid(u.password));

// Accounts created live during recording carry a per-run tag so a re-record
// after an interrupted run never collides with leftovers (all synthetic).
const TAG = process.env.VB_RUN_TAG || String(Date.now()).slice(-3);
const VIDEO_STUDENT = { key: 'S7', name: 'Chiamaka Bello-Adekunle', matric: `PHD/24/7${TAG}`, password: 'Demo-Student-S7-2026!x' };
const VIDEO_STUDENT_NOEMAIL = { name: 'Rasheed Okoye-Adebowale', matric: `PHD/24/8${TAG}` };
const VIDEO_LECTURER = { name: 'Dr. Ifeoma Sanni-Okorie', email: `i.sanni-okorie+${TAG}@pilot-demo.invalid` };
const VIDEO_BULK = [
  ['Temitope Ogunlana-Ibe', '', 'student', `PHD/24/${TAG}1`],
  ['Zainab Okereke-Ajayi', `zainab.okereke+${TAG}@pilot-demo.invalid`, 'student', `PHD/24/${TAG}2`],
  ['Emeka Salako-Yusuf', '', 'student', `PHD/24/${TAG}3`],
  ['Oluwaseun Fakunle', 'seun.fakunle@pilot-demo.invalid', 'student', 'PHD/24/0102'],
  ['Dr. Missing Email Example', '', 'lecturer', '']
];
forbid(VIDEO_STUDENT.password);

async function liveMask(page) {
  await installCredentialMask(page);
}

async function record(name, viewport, fn) {
  const browser = await launch();
  // Recording on a throttled host can be very slow; individual actions get a
  // long budget so a sluggish page does not abort the whole walkthrough.
  const { context, page } = await newPage(browser, { viewport, video: { dir: WORK, size: viewport }, actionTimeout: 180000 });
  await installOverlay(page);
  await liveMask(page);
  let failure = null;
  try { await fn(page); } catch (error) { failure = error; console.log(`  !! ${name}: ${error.message.split('\n')[0]}`); }
  const videoPath = await page.video().path();
  // A context that will not close must not hang the run: bound it, then force
  // the browser down so the WebM is finalised either way.
  const bounded = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('timeout'), ms))]);
  const closed = await bounded(context.close().then(() => 'closed'), 90000);
  if (closed === 'timeout') console.log(`  !! ${name}: context.close() hung; forcing browser shutdown`);
  await bounded(browser.close().then(() => 'closed'), 60000);
  // A failed take must never replace a complete one: it is written alongside
  // as .incomplete.mp4 so the operator can inspect it and delete it.
  const mp4 = path.join(EXPORT, failure && fs.existsSync(path.join(EXPORT, `${name}.mp4`)) ? `${name}.incomplete.mp4` : `${name}.mp4`);
  const out = execFileSync(FFMPEG, ['-y', '-hide_banner', '-i', videoPath, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  // ffmpeg prints stream info to stderr and exits non-zero when asked for no
  // output; that is the expected way to probe without ffprobe.
  let probe = '';
  try { execFileSync(FFMPEG, ['-hide_banner', '-i', mp4], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { probe = String(error.stderr || ''); }
  return { name, mp4, webm: videoPath, failure, probe };
}

async function login(page, identifier, password, roleLabel) {
  await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
  await caption(page, `Sign in as ${roleLabel}`, { hold: 900 });
  await typeSlowly(page, '#login-identifier', identifier);
  await typeSlowly(page, '#login-password', password, { delay: 16 });
  await glideClick(page, page.getByRole('button', { name: /sign in|log in|login/i }), { after: 300 });
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1500);
}

// Role navigation renders twice (desktop and hidden mobile menu); click the
// visible link only.
function nav(page, name) {
  return page.getByRole('link', { name }).filter({ visible: true }).first();
}

async function logout(page) {
  await caption(page, '');
  const b = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
  if (await b.count()) await glideClick(page, b, { after: 1200 });
}

async function fillCheck(page, p) {
  await typeSlowly(page, '#topic', p.title);
  await typeSlowly(page, '#population', p.population);
  await typeSlowly(page, '#location', p.location);
  await typeSlowly(page, '#studyFocus', p.studyFocus);
}

// The admin list filters on "Apply filters", not on keystrokes.
// An account-records row is the element that carries the account actions.
// Since the identity polish the lecturer-supervisee assignment cards also
// show a student's matric number, so a text-only lookup could match a card
// (which has no credential or invitation buttons) instead of the row.
function accountRows(page) {
  return page.locator('tr, article, li').filter({
    has: page.getByRole('button', { name: /reset credential|send invitation|suspend account|reactivate/i })
  });
}

async function searchUsers(page, term) {
  await typeSlowly(page, page.getByRole('searchbox').first(), term);
  await glideClick(page, page.getByRole('button', { name: /apply filters/i }), { after: 1200 });
}

async function waitResults(page) {
  const outcome = await Promise.race([
    page.locator('[data-testid="results-display"]').first().waitFor({ timeout: 150000 }).then(() => 'results'),
    page.getByText(/semantic analysis is currently unavailable/i).first().waitFor({ timeout: 150000 }).then(() => 'unavailable')
  ]).catch(() => 'timeout');
  await sleep(800);
  return outcome;
}

// Runs a checker scene until real results render. A transient provider outage
// is shown honestly with a retry caption rather than captioned as results.
async function checkUntilResults(page, run, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await run();
    const outcome = await waitResults(page);
    if (outcome === 'results') return true;
    providerEvents.push({ label: 'video checker', attempt, outcome, at: new Date().toISOString() });
    await caption(page, 'The similarity provider is temporarily unavailable — the system reports it honestly; retrying…', { hold: 20000 });
    const again = page.getByRole('button', { name: /check another topic|try again/i }).first();
    if (await again.count()) await glideClick(page, again, { after: 800 });
  }
  return false;
}

async function settled(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(/^loading/i).first().waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
  await sleep(600);
}

// ------------------------------------------------------------- videos ----
async function overview(page) {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await titleCard(page, 'Research Topic Approval DSS', 'System overview · synthetic demonstration');
  await caption(page, 'A decision-support system for research topic approval in the Department of Public Health', { hold: 3500 });
  await scrollBy(page, 900); await caption(page, 'Students check and submit topics; lecturers review with similarity evidence; administrators manage accounts and records', { hold: 4000 });
  await scrollBy(page, -900);
  await login(page, S('S4').matric, S('S4').password, 'a student (matric number)');
  await caption(page, 'Student dashboard — current submission and what happens next', { hold: 4000 });
  await caption(page, ''); await glideClick(page, nav(page, /^my submissions$/i), { after: 1500 });
  await caption(page, 'My Submissions — status, lecturer feedback and history', { hold: 4000 });
  await logout(page);
  await login(page, L('L1').email, L('L1').password, 'a lecturer (email)');
  await caption(page, 'Lecturer dashboard', { hold: 3000 });
  await caption(page, ''); await glideClick(page, nav(page, /^pending reviews$/i), { after: 1500 });
  await caption(page, 'Pending Reviews — students identified by name and matric number; email only when they have one', { hold: 5000 });
  await scrollBy(page, 500); await sleep(2000); await scrollBy(page, -500);
  await logout(page);
  await login(page, ADMIN.email, ADMIN.password, 'an administrator (email)');
  await caption(page, 'Administrator dashboard — service health and key counts', { hold: 4000 });
  await caption(page, ''); await glideClick(page, nav(page, /^user management$/i), { after: 1500 });
  await caption(page, 'User Management — individual and bulk onboarding, credentials, assignments', { hold: 4500 });
  await caption(page, ''); await glideClick(page, nav(page, /^topic repository$/i), { after: 1500 });
  await caption(page, 'Topic Repository — historical, current-session and under-review topics', { hold: 4000 });
  await logout(page);
  await titleCard(page, 'End of overview', 'Detailed walkthroughs follow for each role', 2600);
}

async function student(page) {
  // A fresh student receives a one-time credential from the administrator.
  const admin = apiSession(); await admin.login(ADMIN.email, ADMIN.password);
  const created = await admin.call('POST', '/api/v1/admin/users', { name: VIDEO_STUDENT.name, role: 'student', matricNumber: VIDEO_STUDENT.matric });
  if (created.status !== 201) throw new Error(`could not provision video student: ${created.status}`);
  const temp = created.body.data.temporaryPassword; forbid(temp);
  const l1 = apiSession(); await l1.login(L('L1').email, L('L1').password);
  await admin.call('POST', '/api/v1/admin/supervisee-assignments', { lecturerId: (await admin.call('GET', `/api/v1/admin/users?search=${encodeURIComponent(L('L1').email)}`)).body?.data?.items?.[0]?.id, studentId: created.body.data.item.id });

  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await titleCard(page, 'Student walkthrough', 'From first sign-in to an approved topic · synthetic data');
  await login(page, VIDEO_STUDENT.matric, temp, 'a student, using the matric number and the one-time credential');
  await caption(page, 'First sign-in: the temporary credential must be replaced before anything else', { hold: 3500 });
  await typeSlowly(page, '#change-current-password', temp, { delay: 12 });
  await typeSlowly(page, '#change-new-password', VIDEO_STUDENT.password, { delay: 12 });
  await typeSlowly(page, '#change-confirm-password', VIDEO_STUDENT.password, { delay: 12 });
  await glideClick(page, page.locator('form button[type="submit"]').first(), { after: 300 });
  await page.waitForURL((u) => !u.pathname.startsWith('/change-password'), { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1800);
  await caption(page, 'Student dashboard — no topic submitted yet', { hold: 3500 });

  await caption(page, ''); await glideClick(page, nav(page, /^check my topic$/i), { after: 1500 });
  await caption(page, 'Check My Topic — an advisory similarity check before submitting', { hold: 3000 });
  await caption(page, 'The title plus population, location and study focus form the structured representation that is compared', { hold: 1200 });
  await checkUntilResults(page, async () => {
    await fillCheck(page, PROPOSALS.precheckHigh);
    await glideClick(page, page.getByRole('button', { name: /check similarity/i }), { after: 500 });
    await caption(page, 'Checking against stored topics…', { hold: 500 });
  });
  await caption(page, 'A plain-language similarity level leads; related topics show their population, location, study focus and session', { hold: 5000 });
  await scrollBy(page, 700); await sleep(3500);
  await caption(page, 'Raw scores stay behind "Show technical details" — similarity is advisory; the lecturer decides', { hold: 4000 });
  await scrollBy(page, -700);

  await caption(page, ''); await glideClick(page, nav(page, /^submit topic$/i), { after: 1500 });
  await caption(page, 'Submit Topic — the same research context is captured with the submission', { hold: 3000 });
  const sub = { ...PROPOSALS.s1Submission, title: 'Awareness of malaria prevention among mothers of under-fives attending clinics in Osogbo' };
  await typeSlowly(page, '#submission-title', sub.title);
  await typeSlowly(page, '#submission-population', sub.population);
  await typeSlowly(page, '#submission-location', sub.location);
  await typeSlowly(page, '#submission-study-focus', sub.studyFocus);
  await typeSlowly(page, '#submission-category', sub.category);
  await glideClick(page, page.getByRole('button', { name: /review and submit/i }), { after: 1200 });
  await caption(page, 'Review before submitting — nothing is saved until confirmed', { hold: 4000 });
  await glideClick(page, page.getByRole('button', { name: /confirm submission/i }), { after: 500 });
  await page.locator('[data-testid="submission-confirmation"]').waitFor({ timeout: 180000 });
  await caption(page, 'Submitted — the topic is now pending lecturer review', { hold: 3500 });
  await glideClick(page, page.getByRole('link', { name: /view my submissions/i }).first(), { after: 1500 });
  await caption(page, 'My Submissions — pending review', { hold: 3500 });

  // Lecturer acts (prepared between segments).
  await caption(page, 'Meanwhile, the lecturer reviews the topic and requests a revision with written feedback…', { hold: 3000 });
  const mine = apiSession(); await mine.login(VIDEO_STUDENT.matric, VIDEO_STUDENT.password);
  const list = await mine.call('GET', '/api/v1/submissions');
  const original = (list.body?.data?.submissions || [])[0];
  await withProviderRetry('video revision request', () => l1.call('PATCH', `/api/v1/lecturer/submissions/${original.id}/status`, { status: 'awaiting_revision', reason: FEEDBACK.s1Revision }));
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(800);
  await caption(page, 'Action required — the lecturer feedback is shown right where the action is', { hold: 5000 });
  await glideClick(page, page.getByRole('button', { name: /revise and resubmit/i }).first(), { after: 1500 });
  await caption(page, 'Revise and Resubmit — pre-filled with the original topic and context; the feedback stays visible', { hold: 4500 });
  await typeSlowly(page, '#submission-population', 'Mothers attending immunisation clinics');
  await typeSlowly(page, '#submission-study-focus', 'Malaria prevention knowledge and practice');
  await glideClick(page, page.getByRole('button', { name: /review and resubmit/i }), { after: 1200 });
  await caption(page, 'Confirming creates a new submission linked to the original — the original is kept, not replaced', { hold: 4000 });
  await glideClick(page, page.getByRole('button', { name: /confirm revision/i }), { after: 500 });
  await page.locator('[data-testid="submission-confirmation"]').waitFor({ timeout: 180000 });
  await glideClick(page, page.getByRole('link', { name: /view my submissions/i }).first(), { after: 1500 });
  await caption(page, 'Revised submission under review, with the revision history on both entries', { hold: 5000 });
  await scrollBy(page, 500); await sleep(2500); await scrollBy(page, -500);

  await caption(page, 'The lecturer approves the revised topic…', { hold: 2500 });
  const list2 = await mine.call('GET', '/api/v1/submissions');
  const revision = (list2.body?.data?.submissions || []).find((x) => x.is_revision);
  await withProviderRetry('video approval', () => l1.call('PATCH', `/api/v1/lecturer/submissions/${revision.id}/status`, { status: 'approved' }));
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(800);
  await caption(page, 'Approved — the outcome, the history and the next step are all visible', { hold: 4500 });
  await caption(page, ''); await glideClick(page, nav(page, /^dashboard$/i), { after: 1500 });
  await caption(page, 'Dashboard reflects the approved topic', { hold: 3500 });
  await logout(page);
  await titleCard(page, 'End of student walkthrough', '', 2200);
}

async function lecturer(page) {
  const l1 = L('L1');
  // Use whichever seeded student still has a pending first submission, so a
  // re-record works even if an earlier partial run already acted on one.
  let s2 = null; let target = null; let s2api = null;
  for (const c of ['S2', 'S3', 'S6'].map(S)) {
    const api = apiSession(); await api.login(c.matric, c.password);
    const subs = await api.call('GET', '/api/v1/submissions');
    const t = (subs.body?.data?.submissions || []).find((x) => x.status === 'pending_review' && !x.is_revision);
    if (t) { s2 = c; target = t; s2api = api; break; }
  }
  if (!target) {
    // Every seeded candidate has been used by an earlier take: provision a
    // fresh synthetic student, activate the account and submit a proposal
    // through the product's own API so the queue has a first submission.
    const admin = apiSession(); await admin.login(ADMIN.email, ADMIN.password);
    const fresh = { name: 'Kelechi Adamu-Oyelola', matric: `PHD/24/6${TAG}`, password: 'Demo-Student-Fresh-2026!x' };
    forbid(fresh.password);
    const created = await admin.call('POST', '/api/v1/admin/users', { name: fresh.name, role: 'student', matricNumber: fresh.matric });
    if (created.status !== 201) throw new Error(`could not provision a fresh student for the lecturer walkthrough: ${created.status}`);
    const temp = created.body.data.temporaryPassword; forbid(temp);
    const api = apiSession(); await api.login(fresh.matric, temp);
    await api.call('POST', '/api/v1/auth/change-password', { currentPassword: temp, newPassword: fresh.password });
    await api.login(fresh.matric, fresh.password);
    const l1id = (await admin.call('GET', `/api/v1/admin/users?search=${encodeURIComponent(l1.name)}`)).body?.data?.items?.[0]?.id;
    if (l1id) await admin.call('POST', '/api/v1/admin/supervisee-assignments', { lecturerId: l1id, studentId: created.body.data.item.id });
    const submitted = await withProviderRetry('lecturer video seed submission', () => api.call('POST', '/api/v1/submissions', PROPOSALS.s3Pending));
    if (submitted.status !== 201) throw new Error(`could not seed a pending submission for the lecturer walkthrough: ${submitted.status}`);
    s2 = fresh; target = submitted.body.data.submission; s2api = api;
  }
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await titleCard(page, 'Lecturer walkthrough', 'Reviewing with similarity evidence · synthetic data');
  await login(page, l1.email, l1.password, 'a lecturer');
  await caption(page, 'Lecturer dashboard — the queue at a glance', { hold: 3500 });
  await caption(page, ''); await glideClick(page, nav(page, /^pending reviews$/i), { after: 1500 });
  await caption(page, 'Pending Reviews — each student is identified by name and matric number; an email appears only when one exists', { hold: 5500 });
  await scrollBy(page, 400); await sleep(2000); await scrollBy(page, -400);
  const row = page.locator('tr, article').filter({ hasText: s2.matric }).filter({ visible: true }).first();
  await glideClick(page, row.getByRole('button', { name: /open review/i }), { after: 1500 });
  await caption(page, 'Review detail — the submitted topic and its research context', { hold: 4000 });
  await checkUntilResults(page, async () => {
    await glideClick(page, page.getByRole('button', { name: /run similarity check/i }), { after: 500 });
    await caption(page, 'Running an advisory similarity check on the stored structured representation…', { hold: 500 });
  });
  await scrollBy(page, 600);
  await caption(page, 'Related stored topics with their context — evidence to judge, not a verdict', { hold: 5000 });
  await scrollBy(page, 900);
  await caption(page, 'A decision needs a rationale when it sends work back to the student', { hold: 3000 });
  await typeSlowly(page, page.getByLabel(/decision rationale/i), 'Please narrow the population to one clinic setting and state the study design and sampling approach.', { delay: 18 });
  await glideClick(page, page.getByRole('button', { name: /request revision/i }).first(), { after: 1200 });
  await caption(page, 'Confirm — the student is notified with the feedback', { hold: 2500 });
  await glideClick(page, page.getByRole('dialog').getByRole('button', { name: /request revision/i }), { after: 2000 });

  await caption(page, 'The student revises and resubmits (prepared between segments)…', { hold: 3000 });
  const revised = await withProviderRetry('video student revision', () => s2api.call('POST', `/api/v1/submissions/${target.id}/revision`, {
    title: 'Perceived barriers to routine immunisation among caregivers attending one primary health centre in Ede',
    population: 'Caregivers attending Ede primary health centre', location: 'Ede', studyFocus: 'Immunisation barriers and service factors', category: 'Maternal and Child Health', keywords: 'immunisation, barriers'
  }));
  await caption(page, ''); await glideClick(page, nav(page, /^pending reviews$/i), { after: 1500 });
  await caption(page, 'The revised submission returns to the queue, marked as a revision with the feedback that produced it', { hold: 5000 });
  const row2 = page.locator('tr, article').filter({ hasText: s2.matric }).filter({ visible: true }).first();
  await glideClick(page, row2.getByRole('button', { name: /open review/i }), { after: 1500 });
  await caption(page, 'Revision context — what was proposed before, the feedback given, and what is proposed now', { hold: 5500 });
  await scrollBy(page, 500); await sleep(2500);
  await scrollBy(page, 700);
  await glideClick(page, page.getByRole('button', { name: /^approve$/i }).first(), { after: 1200 });
  await caption(page, 'Approve — the topic joins the current-session repository', { hold: 2500 });
  await glideClick(page, page.getByRole('dialog').getByRole('button', { name: /^approve$/i }), { after: 2000 });

  await caption(page, ''); await glideClick(page, nav(page, /^my decisions$/i), { after: 1500 });
  await settled(page);
  await caption(page, 'My Decisions — history with rationale, filters and pagination', { hold: 4000 });
  await caption(page, ''); await glideClick(page, nav(page, /^check similarity$/i), { after: 1500 });
  await caption(page, 'Check Similarity — the same advisory checker, for any proposed topic', { hold: 2500 });
  await checkUntilResults(page, async () => {
    await fillCheck(page, { title: 'Hand hygiene practices among street food vendors in Ile-Ife markets', population: 'Street food vendors', location: 'Ile-Ife', studyFocus: 'Hand hygiene compliance' });
    await glideClick(page, page.getByRole('button', { name: /check similarity/i }), { after: 500 });
  });
  await scrollBy(page, 500);
  await caption(page, 'Results carry the stored session and supervisor when the record has them', { hold: 4500 });
  await caption(page, ''); await glideClick(page, nav(page, /^supervisees$/i), { after: 1500 });
  await settled(page);
  await caption(page, 'Supervisees — students assigned by the administrator', { hold: 3500 });
  await caption(page, ''); await glideClick(page, nav(page, /^research trends$/i), { after: 1500 });
  await settled(page);
  await caption(page, 'Research Trends — a read-only view of stored topics', { hold: 3500 });
  await logout(page);
  await titleCard(page, 'End of lecturer walkthrough', String(revised.status === 201 ? '' : ''), 2200);
}

async function adminWalk(page) {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await titleCard(page, 'Administrator walkthrough', 'Accounts, onboarding and records · synthetic data');
  await login(page, ADMIN.email, ADMIN.password, 'an administrator');
  await caption(page, 'Administrator dashboard — service health and key counts', { hold: 4000 });
  await caption(page, ''); await glideClick(page, nav(page, /^user management$/i), { after: 1500 });
  await caption(page, 'User Management — search, status, identity, credentials, assignments', { hold: 4000 });

  const form = page.locator('form').filter({ has: page.locator('select[name="role"]') }).first();
  await glide(page, form.locator('input[name="name"]'));
  await caption(page, 'Create an individual account: a student is identified by matric number; email is optional', { hold: 3500 });
  await form.locator('select[name="role"]').selectOption('student');
  await typeSlowly(page, form.locator('input[name="name"]'), VIDEO_STUDENT_NOEMAIL.name);
  await typeSlowly(page, form.locator('input[name="matricNumber"]'), VIDEO_STUDENT_NOEMAIL.matric);
  await glideClick(page, form.getByRole('button', { name: /create account/i }), { after: 1500 });
  await page.locator('section[aria-label="One-time temporary credential"]').waitFor({ timeout: 60000 });
  await maskNow(page);
  await glide(page, page.locator('section[aria-label="One-time temporary credential"]'));
  await caption(page, 'A one-time temporary password is shown once (masked here) — with no email, it is handed over directly', { hold: 6000 });
  await glideClick(page, page.getByRole('button', { name: /dismiss/i }).first(), { after: 1000 });

  await form.locator('select[name="role"]').selectOption('lecturer');
  await typeSlowly(page, form.locator('input[name="name"]'), VIDEO_LECTURER.name);
  await typeSlowly(page, form.locator('input[name="email"]'), VIDEO_LECTURER.email);
  await caption(page, 'A lecturer is identified by email', { hold: 2500 });
  await glideClick(page, form.getByRole('button', { name: /create account/i }), { after: 1500 });
  await page.locator('section[aria-label="One-time temporary credential"]').waitFor({ timeout: 60000 });
  await maskNow(page);
  await glide(page, page.locator('section[aria-label="One-time temporary credential"]'));
  await caption(page, 'Lecturer created — credential masked; an invitation email can be sent instead', { hold: 4000 });
  await glideClick(page, page.getByRole('button', { name: /dismiss/i }).first(), { after: 1000 });

  const cohort = await writeUsersWorkbook(path.join(FIX, 'video-cohort.xlsx'), VIDEO_BULK);
  await glide(page, page.locator('input[type="file"]').first());
  await caption(page, 'Bulk onboarding — upload a spreadsheet (name, email, role, matric number) and preview before anything is created', { hold: 4000 });
  await page.locator('input[type="file"]').first().setInputFiles(cohort);
  await sleep(800);
  await glideClick(page, page.getByRole('button', { name: /preview import/i }), { after: 1500 });
  await page.getByText(/preview only|conflict|will NOT be provisioned/i).first().waitFor({ timeout: 60000 });
  await caption(page, 'Preview: valid new accounts, one conflict with an existing matric, one lecturer without an email — nothing created yet', { hold: 6500 });
  await scrollBy(page, 600); await sleep(3000);
  await glideClick(page, page.getByRole('button', { name: /commit valid new accounts/i }), { after: 1000 });
  // The commit asks for confirmation ("Create N account(s)").
  const commitDialog = page.getByRole('dialog');
  await commitDialog.waitFor({ timeout: 10000 }).catch(() => {});
  if (await commitDialog.count()) {
    await caption(page, 'Confirm — only the valid new rows are created', { hold: 1500 });
    await glideClick(page, commitDialog.getByRole('button', { name: /create \d+ account/i }), { after: 1000 });
  }
  await page.getByText(/only copy/i).first().waitFor({ timeout: 180000 });
  await glide(page, page.locator('section[aria-label="One-time credential manifest"]'));
  await caption(page, 'Commit: accounts created; the one-time credential manifest is the only copy of their temporary passwords', { hold: 6000 });
  await glideClick(page, page.getByRole('button', { name: /dismiss/i }).first(), { after: 1000 });

  await searchUsers(page, 'Zainab');
  const rowOk = accountRows(page).filter({ hasText: `PHD/24/${TAG}2` }).first();
  await caption(page, 'Invitation: available for a new account that has an email', { hold: 2500 });
  await glideClick(page, rowOk.getByRole('button', { name: /invite|send invitation/i }).first(), { after: 1000 });
  await glideClick(page, page.getByRole('dialog').getByRole('button', { name: /send invitation|resend invitation/i }), { after: 2500 });
  await searchUsers(page, 'Temitope');
  const rowNo = accountRows(page).filter({ hasText: `PHD/24/${TAG}1` }).first();
  await caption(page, 'For a student without an email, the system refuses truthfully — the credential is handed over instead', { hold: 3000 });
  await glideClick(page, rowNo.getByRole('button', { name: /invite|send invitation/i }).first(), { after: 1000 });
  const dlg = page.getByRole('dialog');
  if (await dlg.count()) await glideClick(page, dlg.getByRole('button', { name: /send invitation|resend invitation/i }), { after: 2500 });
  await sleep(2500);

  await searchUsers(page, S('S5').name.split(' ')[0]);
  const rowReset = accountRows(page).filter({ hasText: S('S5').matric }).first();
  await caption(page, 'Credential reset: a lost credential is replaced with a new one-time password; previous sessions are signed out', { hold: 3500 });
  await glideClick(page, rowReset.getByRole('button', { name: /reset credential|new temporary password|reset/i }).first(), { after: 1000 });
  await glideClick(page, page.getByRole('dialog').getByRole('button', { name: /issue new temporary password/i }), { after: 2000 });
  await page.locator('section[aria-label="One-time temporary credential"]').waitFor({ timeout: 60000 });
  await maskNow(page);
  await glide(page, page.locator('section[aria-label="One-time temporary credential"]'));
  await caption(page, 'Shown once, masked here', { hold: 3000 });
  await glideClick(page, page.getByRole('button', { name: /dismiss/i }).first(), { after: 800 });

  await caption(page, ''); await glideClick(page, nav(page, /^topic repository$/i), { after: 1500 });
  await settled(page);
  await caption(page, 'Topic Repository — historical, current-session and under-review topics with their research context', { hold: 5000 });
  await scrollBy(page, 600); await sleep(2500);
  await caption(page, ''); await glideClick(page, nav(page, /^audit log$/i), { after: 1500 });
  await settled(page);
  await caption(page, 'Audit Log — provisioning, decisions, resets and imports, correlated by request', { hold: 4500 });
  await caption(page, ''); await glideClick(page, nav(page, /^reports$/i), { after: 1500 });
  await settled(page);
  await caption(page, 'Reports — summary counts and CSV exports', { hold: 3500 });
  await caption(page, ''); await glideClick(page, nav(page, /^system settings$/i), { after: 1500 });
  await caption(page, 'System Settings — effective non-secret configuration and capability status', { hold: 3500 });
  await logout(page);
  await titleCard(page, 'End of administrator walkthrough', '', 2200);
}

const only = process.argv.slice(2);
const plan = [
  ['01-system-overview', overview],
  ['02-student-walkthrough', student],
  ['03-lecturer-walkthrough', lecturer],
  ['04-admin-walkthrough', adminWalk]
].filter(([name]) => only.length === 0 || only.some((o) => name.includes(o)));

const results = [];
for (const [name, fn] of plan) {
  console.log(`\n=== recording ${name} ===`);
  const r = await record(name, VIDEO, fn);
  const duration = r.probe.match(/Duration:\s*([\d:.]+)/)?.[1] || 'unknown';
  const size = fs.statSync(r.mp4).size;
  results.push({ name: `${name}.mp4`, duration, bytes: size, failure: r.failure?.message || null });
  console.log(`${name}.mp4  duration=${duration}  size=${(size / 1e6).toFixed(1)} MB  ${r.failure ? 'INCOMPLETE: ' + r.failure.message.split('\n')[0] : 'ok'}`);
  // The WebM may still be held briefly by the recorder's encoder; a failed
  // cleanup must never abort the run (it is an intermediate in a temp dir).
  try { fs.rmSync(r.webm, { force: true }); } catch (error) { console.log(`  (intermediate not removed: ${error.code})`); }
}
// Merge with earlier runs so a partial re-record keeps every video's entry.
const logPath = path.join(EXPORT, 'recording-log.json');
let previous = [];
try { previous = JSON.parse(fs.readFileSync(logPath, 'utf8')).results || []; } catch { /* first run */ }
const merged = [...previous.filter((p) => !results.some((r) => r.name === p.name)), ...results].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(logPath, JSON.stringify({ recordedAt: new Date().toISOString(), results: merged, providerEvents }, null, 1));
console.log(`\nprovider-unavailable events during recording: ${providerEvents.length}`);
