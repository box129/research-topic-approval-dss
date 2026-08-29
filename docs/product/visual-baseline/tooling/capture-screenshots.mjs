// Screenshot baseline capture. Documentation-only; drives the built container
// stack through its public HTTPS edge with synthetic data and writes PNGs to
// docs/product/visual-baseline/screenshots/.
//
// Seeding and capture are interleaved on purpose: empty states are captured
// before data exists, then the corpus and submissions are created through the
// product's own API and UI, then the populated states are captured.
//
// Prerequisites: the local acceptance stack is up on VB_ORIGIN, the demo
// database is freshly migrated and bootstrapped, and the administrator in
// synthetic-dataset.mjs has completed the forced password change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REPO, ORIGIN, DESKTOP, MOBILE, sleep, apiSession, withProviderRetry, providerEvents,
  writeUsersWorkbook, writeTopicsWorkbook, launch, newPage, uiLogin, uiLogout,
  forbid, maskCredentials, shot, captureLog, ensureDir
} from './lib.mjs';
import { ADMIN, LECTURERS, STUDENTS, HISTORICAL_TOPICS, PROPOSALS, FEEDBACK, BULK_ROWS } from './synthetic-dataset.mjs';

const OUT = ensureDir(path.join(REPO, 'docs', 'product', 'visual-baseline', 'screenshots'));
const FIX = ensureDir(path.join(os.tmpdir(), 'vb-fixtures'));
const byKey = (list, key) => list.find((x) => x.key === key);
const S = (k) => byKey(STUDENTS, k);
const L = (k) => byKey(LECTURERS, k);
[ADMIN, ...LECTURERS, ...STUDENTS].forEach((u) => forbid(u.password));

async function readTempCredential(page) {
  const value = await page.locator('section[aria-label="One-time temporary credential"] code').first().textContent({ timeout: 20000 });
  forbid(value.trim());
  return value.trim();
}

async function dismissCredential(page) {
  const b = page.getByRole('button', { name: /dismiss/i }).first();
  if (await b.count()) await b.click();
  await sleep(300);
}

async function provisionViaUi(page, { role, name, email, matric }) {
  await page.goto(`${ORIGIN}/admin/user-management`, { waitUntil: 'networkidle' });
  // The matric/email inputs render conditionally by role, so the form is
  // anchored on its role select and inputs are addressed by name.
  const form = page.locator('form').filter({ has: page.locator('select[name="role"]') }).first();
  await form.locator('select[name="role"]').selectOption(role);
  await sleep(200);
  await form.locator('input[name="name"]').fill(name);
  if (email) await form.locator('input[name="email"]').fill(email);
  if (matric) await form.locator('input[name="matricNumber"]').fill(matric);
  return form;
}

async function activate(api, identifier, temp, password) {
  const login = await api.login(identifier, temp);
  if (login.status !== 200) throw new Error(`temp login failed for ${identifier}: ${login.status}`);
  const change = await api.call('POST', '/api/v1/auth/change-password', { currentPassword: temp, newPassword: password });
  if (change.status !== 200) throw new Error(`password change failed for ${identifier}: ${change.status}`);
}

async function submitViaApi(student, proposal) {
  const api = apiSession();
  await api.login(student.matric, student.password);
  const r = await withProviderRetry(`submission ${student.key}`, () => api.call('POST', '/api/v1/submissions', proposal));
  if (r.status !== 201) throw new Error(`submission for ${student.key} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
  return r.body.data.submission;
}

async function decideViaApi(lecturer, submissionId, status, reason) {
  const api = apiSession();
  await api.login(lecturer.email, lecturer.password);
  const r = await withProviderRetry(`decision ${status} #${submissionId}`, () => api.call('PATCH', `/api/v1/lecturer/submissions/${submissionId}/status`, { status, reason }));
  if (r.status !== 200) throw new Error(`decision ${status} on #${submissionId} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
  return r.body.data.submission;
}

// Locates a user's row in the (possibly filtered/paginated) admin list by
// typing the identifier into the page's search control first.
async function findRow(page, searchTerm, rowText) {
  const search = page.getByRole('searchbox').first();
  if (await search.count()) {
    await search.fill(searchTerm);
    const apply = page.getByRole('button', { name: /apply filters/i }).first();
    if (await apply.count()) await apply.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(800);
  }
  const row = page.locator('[aria-label="User summary"] article, article, tr, li').filter({ hasText: rowText }).first();
  await row.waitFor({ timeout: 20000 });
  return row;
}

async function waitForResults(page) {
  await Promise.race([
    page.locator('[data-testid="student-results-container"], [data-testid="results-display"]').first().waitFor({ timeout: 120000 }),
    page.getByText(/semantic analysis is currently unavailable/i).first().waitFor({ timeout: 120000 })
  ]).catch(() => {});
  await sleep(600);
}

async function main() {
  const admin = apiSession();
  const adminLogin = await admin.login(ADMIN.email, ADMIN.password);
  if (adminLogin.status !== 200) throw new Error('admin login failed — run the reset/activate step first');
  const ids = {};
  const browser = await launch();
  try {
    await run({ admin, ids, browser });
  } finally {
    await browser.close().catch(() => {});
  }
}

async function run({ admin, ids, browser }) {

  // ------------------------------------------------------------- PUBLIC ----
  {
    const { context, page } = await newPage(browser);
    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '01-landing-desktop.png');
    await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '03-login.png');
    await page.goto(`${ORIGIN}/forgot-password`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '04-forgot-password.png');
    await context.close();
    const m = await newPage(browser, { viewport: MOBILE });
    await m.page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await shot(m.page, OUT, '02-landing-mobile.png');
    await m.context.close();
  }

  // --------------------------------------------- ADMIN provisions via UI ----
  const temps = {};
  {
    const { context, page } = await newPage(browser);
    await uiLogin(page, ADMIN.email, ADMIN.password);

    // Student with matric and NO email.
    const s1 = S('S1');
    const form = await provisionViaUi(page, { role: 'student', name: s1.name, matric: s1.matric });
    await form.getByRole('button', { name: /create account/i }).click();
    temps.S1 = await readTempCredential(page);
    await maskCredentials(page);
    await shot(page, OUT, '52-admin-create-student-no-email.png', { scrollTo: 'section[aria-label="One-time temporary credential"]' });
    await dismissCredential(page);

    // Lecturer with email — captured before submission to show the form.
    const l1 = L('L1');
    const form2 = await provisionViaUi(page, { role: 'lecturer', name: l1.name, email: l1.email });
    await shot(page, OUT, '53-admin-create-lecturer.png', { scrollTo: '#provision-email' });
    await form2.getByRole('button', { name: /create account/i }).click();
    temps.L1 = await readTempCredential(page);
    await maskCredentials(page);
    await dismissCredential(page);
    await context.close();
  }

  // ----------------------------------------- remaining accounts via API ----
  for (const u of [L('L2'), ...STUDENTS.filter((s) => s.key !== 'S1')]) {
    const r = await admin.call('POST', '/api/v1/admin/users', {
      name: u.name, role: u.matric ? 'student' : 'lecturer', ...(u.email ? { email: u.email } : {}), ...(u.matric ? { matricNumber: u.matric } : {})
    });
    if (r.status !== 201) throw new Error(`provision ${u.key} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
    ids[u.key] = r.body.data.item.id;
    temps[u.key] = r.body.data.temporaryPassword;
    forbid(temps[u.key]);
  }
  // ids for the UI-created accounts
  for (const [key, u] of [['S1', S('S1')], ['L1', L('L1')]]) {
    const list = await admin.call('GET', `/api/v1/admin/users?search=${encodeURIComponent(u.name)}`);
    const item = (list.body?.data?.items || list.body?.data?.users || []).find((x) => (u.matric ? x.matricNumber === u.matric : x.email === u.email));
    ids[key] = item?.id;
  }
  // Activate everyone except S1 (S1 goes through the forced change in the UI).
  for (const u of [L('L1'), L('L2'), ...STUDENTS.filter((s) => s.key !== 'S1')]) {
    await activate(apiSession(), u.matric || u.email, temps[u.key], u.password);
  }

  // ------------------------------- S1 first login + empty states (UI) ----
  {
    const { context, page } = await newPage(browser);
    const s1 = S('S1');
    await uiLogin(page, s1.matric, temps.S1);
    await page.waitForURL(/change-password/, { timeout: 20000 }).catch(() => {});
    await shot(page, OUT, '05-forced-password-change.png');
    await page.locator('#change-current-password').fill(temps.S1);
    await page.locator('#change-new-password').fill(s1.password);
    await page.locator('#change-confirm-password').fill(s1.password);
    await page.locator('form button[type="submit"]').first().click();
    // The change is asynchronous; wait until the app leaves the forced-change
    // route before navigating, or the guard sends us straight back here.
    await page.waitForURL((u) => !u.pathname.startsWith('/change-password'), { timeout: 30000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(800);
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '73-no-submissions.png');
    await page.goto(`${ORIGIN}/student/check-my-topic`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '11-student-check-topic-empty.png');
    const p = PROPOSALS.precheckHigh;
    await page.locator('#topic').fill(p.title);
    await page.locator('#population').fill(p.population);
    await page.locator('#location').fill(p.location);
    await page.locator('#studyFocus').fill(p.studyFocus);
    await page.getByRole('button', { name: /check similarity/i }).click();
    await waitForResults(page);
    await shot(page, OUT, '70-empty-corpus-honesty.png', { scrollTo: '[data-testid="student-results-container"]' });
    await context.close();
  }

  // ------------------------------------ L1 empty queue (UI) ----
  {
    const { context, page } = await newPage(browser);
    await uiLogin(page, L('L1').email, L('L1').password);
    await page.goto(`${ORIGIN}/lecturer/pending-reviews`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '72-no-pending-reviews.png');
    await context.close();
  }

  // ------------------------------------------- corpus + assignments (API) ----
  {
    const file = await writeTopicsWorkbook(path.join(FIX, 'historical-topics.xlsx'), HISTORICAL_TOPICS, 'historical');
    const preview = await admin.upload('/api/v1/admin/import/topics/preview', file);
    if (preview.status !== 200) throw new Error(`topic preview failed: ${preview.status} ${JSON.stringify(preview.body).slice(0, 200)}`);
    const commit = await withProviderRetry('historical import commit', () => admin.upload('/api/v1/admin/import/topics/commit', file));
    if (commit.status !== 200 && commit.status !== 201) throw new Error(`topic commit failed: ${commit.status} ${JSON.stringify(commit.body).slice(0, 200)}`);
    console.log(`corpus: imported historical topics (HTTP ${commit.status})`);
    for (const [lk, sks] of [['L1', ['S1', 'S2', 'S6']], ['L2', ['S3', 'S4', 'S5']]]) {
      for (const sk of sks) {
        const r = await admin.call('POST', '/api/v1/admin/supervisee-assignments', { lecturerId: ids[lk], studentId: ids[sk] });
        if (r.status !== 201 && r.status !== 200) console.log(`  assignment ${lk}<-${sk}: HTTP ${r.status}`);
      }
    }
  }

  // ------------------------------------------- S1 pre-check + submit (UI) ----
  {
    const { context, page } = await newPage(browser);
    const s1 = S('S1');
    await uiLogin(page, s1.matric, s1.password);
    await page.goto(`${ORIGIN}/student/check-my-topic`, { waitUntil: 'networkidle' });
    const p = PROPOSALS.precheckHigh;
    await page.locator('#topic').fill(p.title);
    await page.locator('#population').fill(p.population);
    await page.locator('#location').fill(p.location);
    await page.locator('#studyFocus').fill(p.studyFocus);
    await page.getByRole('button', { name: /check similarity/i }).click();
    await waitForResults(page);
    await shot(page, OUT, '12-student-check-topic-results.png', { scrollTo: '[data-testid="results-display"]' });

    const sub = PROPOSALS.s1Submission;
    await page.goto(`${ORIGIN}/student/submit-topic`, { waitUntil: 'networkidle' });
    await page.locator('#submission-title').fill(sub.title);
    await page.locator('#submission-population').fill(sub.population);
    await page.locator('#submission-location').fill(sub.location);
    await page.locator('#submission-study-focus').fill(sub.studyFocus);
    await page.locator('#submission-category').fill(sub.category);
    await page.locator('#submission-keywords').fill(sub.keywords);
    await shot(page, OUT, '13-student-submit-topic.png');
    await page.getByRole('button', { name: /review and submit/i }).click();
    await sleep(500);
    await shot(page, OUT, '14-student-submit-review.png', { scrollTo: '[aria-labelledby="review-title"]' });
    await page.getByRole('button', { name: /confirm submission/i }).click();
    await page.locator('[data-testid="submission-confirmation"]').waitFor({ timeout: 180000 });
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '15-student-submission-pending.png');
    await context.close();
  }

  // --------------------------------------- other submissions + decisions ----
  const subs = {};
  subs.S2 = await submitViaApi(S('S2'), PROPOSALS.s2Pending);
  subs.S3 = await submitViaApi(S('S3'), PROPOSALS.s3Pending);
  subs.S6 = await submitViaApi(S('S6'), PROPOSALS.s6Unrelated);
  subs.S4 = await submitViaApi(S('S4'), PROPOSALS.s4Approved);
  subs.S5 = await submitViaApi(S('S5'), PROPOSALS.s5Rejected);
  await decideViaApi(L('L2'), subs.S4.id, 'approved');
  await decideViaApi(L('L2'), subs.S5.id, 'rejected', FEEDBACK.s5Reject);
  {
    const s1api = apiSession(); await s1api.login(S('S1').matric, S('S1').password);
    const mine = await s1api.call('GET', '/api/v1/submissions');
    subs.S1 = (mine.body?.data?.submissions || [])[0];
  }

  // ------------------------------------------------- L1 review (UI) ----
  {
    const { context, page } = await newPage(browser);
    await uiLogin(page, L('L1').email, L('L1').password);
    await page.goto(`${ORIGIN}/lecturer/dashboard`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '30-lecturer-dashboard.png');
    await page.goto(`${ORIGIN}/lecturer/pending-reviews`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '31-lecturer-pending-reviews.png');
    await page.goto(`${ORIGIN}/lecturer/pending-reviews/${subs.S1.id}`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '32-lecturer-review-detail.png');
    await page.getByRole('button', { name: /run similarity check/i }).click();
    await waitForResults(page);
    await shot(page, OUT, '33-lecturer-review-similarity-context.png', { scrollTo: '[data-testid="results-display"]' });
    await page.getByLabel(/decision rationale/i).fill(FEEDBACK.s1Revision);
    await page.getByRole('button', { name: /request revision/i }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 10000 });
    await shot(page, OUT, '34-lecturer-request-revision.png');
    await page.getByRole('dialog').getByRole('button', { name: /request revision/i }).click();
    await page.waitForLoadState('networkidle');
    await sleep(800);
    await context.close();
  }

  // --------------------------------------------- S1 revises (UI) ----
  {
    const { context, page } = await newPage(browser);
    const s1 = S('S1');
    await uiLogin(page, s1.matric, s1.password);
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '16-student-submission-revision-required.png');
    await page.getByRole('button', { name: /revise and resubmit/i }).first().click();
    await page.waitForURL(/\/revise$/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await sleep(600);
    await shot(page, OUT, '17-student-revise-prefilled.png');
    const rev = PROPOSALS.s1Revision;
    await page.locator('#submission-title').fill(rev.title);
    await page.locator('#submission-population').fill(rev.population);
    await page.locator('#submission-study-focus').fill(rev.studyFocus);
    await page.locator('#submission-keywords').fill(rev.keywords);
    await page.getByRole('button', { name: /review and resubmit/i }).click();
    await sleep(400);
    await page.getByRole('button', { name: /confirm revision/i }).click();
    await page.locator('[data-testid="submission-confirmation"]').waitFor({ timeout: 180000 });
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '18-student-revised-submission.png');
    const s1api = apiSession(); await s1api.login(s1.matric, s1.password);
    const mine = await s1api.call('GET', '/api/v1/submissions');
    subs.S1rev = (mine.body?.data?.submissions || []).find((x) => x.is_revision);
    await context.close();
  }

  // ----------------------------------------- L1 approves revision (UI) ----
  {
    const { context, page } = await newPage(browser);
    await uiLogin(page, L('L1').email, L('L1').password);
    await page.goto(`${ORIGIN}/lecturer/pending-reviews/${subs.S1rev.id}`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '35-lecturer-revised-submission.png', { scrollTo: '[data-testid="lecturer-revision-context"]' });
    await page.getByRole('button', { name: /^approve$/i }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 10000 });
    await shot(page, OUT, '36-lecturer-approve.png');
    await page.getByRole('dialog').getByRole('button', { name: /^approve$/i }).click();
    await page.waitForLoadState('networkidle');
    await sleep(800);
    await page.goto(`${ORIGIN}/lecturer/my-decisions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '37-lecturer-my-decisions.png');
    await page.goto(`${ORIGIN}/lecturer/supervisees`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '38-lecturer-supervisees.png');
    await page.goto(`${ORIGIN}/lecturer/check-similarity`, { waitUntil: 'networkidle' });
    const p = PROPOSALS.precheckHigh;
    await page.locator('#topic').fill(p.title);
    await page.locator('#population').fill(p.population);
    await page.locator('#location').fill(p.location);
    await page.locator('#studyFocus').fill(p.studyFocus);
    await page.getByRole('button', { name: /check similarity/i }).click();
    await waitForResults(page);
    await shot(page, OUT, '39-lecturer-similarity-checker.png', { scrollTo: '[data-testid="results-display"]' });
    await page.goto(`${ORIGIN}/lecturer/research-trends`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '40-lecturer-research-trends.png');
    await context.close();
  }

  // ------------------------------------------ S1 approved states (UI) ----
  {
    const { context, page } = await newPage(browser);
    const s1 = S('S1');
    await uiLogin(page, s1.matric, s1.password);
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '19-student-approved-submission.png');
    await page.goto(`${ORIGIN}/student/dashboard`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '10-student-dashboard.png');
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '20-student-my-submissions.png', { fullPage: true });
    await context.close();
  }

  // ------------------------------------------------------ ADMIN (UI) ----
  {
    const { context, page } = await newPage(browser);
    await uiLogin(page, ADMIN.email, ADMIN.password);
    await page.goto(`${ORIGIN}/admin/dashboard`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '50-admin-dashboard.png');
    await page.goto(`${ORIGIN}/admin/user-management`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '51-admin-user-management.png');

    // Bulk onboarding: preview shows valid rows, one conflict, one invalid.
    const cohort = await writeUsersWorkbook(path.join(FIX, 'cohort.xlsx'), BULK_ROWS);
    await page.locator('input[type="file"]').first().setInputFiles(cohort);
    await sleep(400);
    await shot(page, OUT, '54-admin-bulk-import.png', { scrollTo: 'input[type="file"]' });
    await page.getByRole('button', { name: /preview import/i }).click();
    await page.getByText(/preview only|will NOT be provisioned|conflict/i).first().waitFor({ timeout: 60000 });
    await shot(page, OUT, '55-admin-bulk-preview.png', { scrollTo: 'text=/Preview only/i' });
    await page.getByRole('button', { name: /commit valid new accounts|create \d+ account/i }).click();
    await page.getByText(/only copy/i).first().waitFor({ timeout: 600000 });
    await shot(page, OUT, '56-admin-bulk-result.png');
    await shot(page, OUT, '57-admin-credential-manifest-state.png', { scrollTo: 'section[aria-label="One-time credential manifest"]' });
    const dismiss = page.getByRole('button', { name: /dismiss/i }).first();
    if (await dismiss.count()) await dismiss.click();
    // Replay the same file: every row now conflicts.
    await page.locator('input[type="file"]').first().setInputFiles(cohort);
    await page.getByRole('button', { name: /preview import/i }).click();
    await page.getByText(/preview only|already/i).first().waitFor({ timeout: 60000 });
    await shot(page, OUT, '74-import-conflict.png', { scrollTo: 'text=/Preview only/i' });

    // Invitation is offered only to accounts that have not yet completed their
    // first sign-in, so the two bulk-created accounts are used: one with an
    // email (eligible) and one without (refused truthfully).
    const INVITE_OK = 'PHD/24/0203';
    const INVITE_NO_EMAIL = 'PHD/24/0201';
    await page.goto(`${ORIGIN}/admin/user-management`, { waitUntil: 'networkidle' });
    const rowOk = await findRow(page, 'Yusuf', INVITE_OK);
    await rowOk.getByRole('button', { name: /invite|send invitation/i }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 10000 });
    await page.getByRole('dialog').getByRole('button', { name: /send invitation|resend invitation/i }).click();
    await page.waitForLoadState('networkidle');
    await sleep(1200);
    await shot(page, OUT, '58-admin-invitation-action.png', { scrollTo: `text=${INVITE_OK}` });
    const rowNoEmail = await findRow(page, 'Kehinde', INVITE_NO_EMAIL);
    await rowNoEmail.getByRole('button', { name: /invite|send invitation/i }).first().click();
    const dlg = page.getByRole('dialog');
    if (await dlg.count()) { await dlg.getByRole('button', { name: /send invitation|resend invitation/i }).click(); }
    await page.waitForLoadState('networkidle');
    await sleep(1200);
    await shot(page, OUT, '75-no-email-invitation-skip.png', { scrollTo: `text=${INVITE_NO_EMAIL}` });

    // Credential reset for a no-email student (masked before capture).
    const s3 = S('S3');
    const rowS3 = await findRow(page, s3.name.split(' ')[0], s3.matric);
    await rowS3.getByRole('button', { name: /reset credential|new temporary password|reset/i }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 10000 });
    await page.getByRole('dialog').getByRole('button', { name: /issue new temporary password/i }).click();
    await readTempCredential(page);
    await maskCredentials(page);
    await shot(page, OUT, '59-admin-credential-reset.png', { scrollTo: 'section[aria-label="One-time temporary credential"]' });
    await dismissCredential(page);

    await page.goto(`${ORIGIN}/admin/topic-repository`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '60-admin-topic-repository.png');
    await page.goto(`${ORIGIN}/admin/system-settings`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '61-admin-settings.png');
    await page.goto(`${ORIGIN}/admin/audit-log`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '62-admin-audit-log.png');
    await page.goto(`${ORIGIN}/admin/reports`, { waitUntil: 'networkidle' });
    await shot(page, OUT, '63-admin-reports.png');
    await context.close();
  }

  fs.writeFileSync(path.join(OUT, '..', 'tooling', 'last-capture-log.json'), JSON.stringify({ capturedAt: new Date().toISOString(), captures: captureLog, providerEvents, submissionIds: subs }, null, 1));
  const missed = captureLog.filter((c) => !c.ok);
  console.log(`\ncaptured ${captureLog.length - missed.length}/${captureLog.length}; provider-unavailable events: ${providerEvents.length}`);
  if (missed.length) { console.log('MISSED:'); missed.forEach((m) => console.log(`  - ${m.name}: ${m.error}`)); }
}

main().catch((error) => { console.error('CAPTURE ABORTED:', error.message); process.exitCode = 1; });
