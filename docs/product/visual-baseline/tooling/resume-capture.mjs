// Resumes the screenshot baseline from the first missing artifact on an
// ALREADY-SEEDED demo database (accounts, corpus, submissions and decisions in
// place). Documentation-only. It never reseeds and never changes the app.
//
// Covers: re-capture of the two similarity-result screenshots that hit a
// transient provider outage (12, 33) with bounded retry, and the admin section
// from the bulk commit onward (56–63, 74, 75), including the commit
// confirmation dialog that the first pass did not click.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REPO, ORIGIN, sleep, apiSession, writeUsersWorkbook, launch, newPage, uiLogin,
  forbid, maskCredentials, shot, captureLog, providerEvents, ensureDir
} from './lib.mjs';
import { ADMIN, LECTURERS, STUDENTS, PROPOSALS, BULK_ROWS } from './synthetic-dataset.mjs';

const OUT = ensureDir(path.join(REPO, 'docs', 'product', 'visual-baseline', 'screenshots'));
const FIX = ensureDir(path.join(os.tmpdir(), 'vb-fixtures'));
const S = (k) => STUDENTS.find((x) => x.key === k);
const L = (k) => LECTURERS.find((x) => x.key === k);
[ADMIN, ...LECTURERS, ...STUDENTS].forEach((u) => forbid(u.password));
const only = new Set(process.argv.slice(2));
const want = (name) => only.size === 0 || only.has(name);

async function readTempCredential(page) {
  const value = await page.locator('section[aria-label="One-time temporary credential"] code').first().textContent({ timeout: 20000 });
  forbid(value.trim());
  return value.trim();
}
async function dismiss(page) {
  const b = page.getByRole('button', { name: /dismiss/i }).first();
  if (await b.count()) await b.click();
  await sleep(300);
}
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

// Runs a checker until real results render; a transient provider outage is
// recorded and retried after a bounded wait, never hidden.
async function runCheckUntilResults(page, label, trigger, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await trigger();
    const outcome = await Promise.race([
      page.locator('[data-testid="results-display"]').first().waitFor({ timeout: 150000 }).then(() => 'results'),
      page.getByText(/semantic analysis is currently unavailable/i).first().waitFor({ timeout: 150000 }).then(() => 'unavailable')
    ]).catch(() => 'timeout');
    if (outcome === 'results') { await sleep(600); return true; }
    providerEvents.push({ label, attempt, outcome, at: new Date().toISOString() });
    console.log(`      [${label}: ${outcome} on attempt ${attempt}; waiting ${attempt * 30}s]`);
    await sleep(attempt * 30000);
    const again = page.getByRole('button', { name: /check another topic|try again/i }).first();
    if (await again.count()) { await again.click(); await sleep(500); }
  }
  return false;
}

async function main() {
  const browser = await launch();
  try {
    // ---- 12: student checker results (S1) ----
    if (want('12')) {
      const { context, page } = await newPage(browser);
      const s1 = S('S1');
      await uiLogin(page, s1.matric, s1.password);
      await page.goto(`${ORIGIN}/student/check-my-topic`, { waitUntil: 'networkidle' });
      const p = PROPOSALS.precheckHigh;
      const ok = await runCheckUntilResults(page, 'student checker', async () => {
        await page.locator('#topic').fill(p.title);
        await page.locator('#population').fill(p.population);
        await page.locator('#location').fill(p.location);
        await page.locator('#studyFocus').fill(p.studyFocus);
        await page.getByRole('button', { name: /check similarity/i }).click();
      });
      if (ok) await shot(page, OUT, '12-student-check-topic-results.png', { scrollTo: '[data-testid="results-display"]' });
      else console.log('MISS  12-student-check-topic-results.png             provider unavailable after retries');
      await context.close();
    }

    // ---- 33: lecturer similarity context on a PENDING submission with context (S3) ----
    if (want('33')) {
      const { context, page } = await newPage(browser);
      const l1 = L('L1');
      const api = apiSession(); await api.login(l1.email, l1.password);
      const queue = await api.call('GET', '/api/v1/lecturer/submissions');
      const target = (queue.body?.data?.submissions || []).find((x) => x.student_matric_number === S('S3').matric)
        || (queue.body?.data?.submissions || []).find((x) => x.population);
      if (!target) throw new Error('no pending submission with context found for 33');
      await uiLogin(page, l1.email, l1.password);
      await page.goto(`${ORIGIN}/lecturer/pending-reviews/${target.id}`, { waitUntil: 'networkidle' });
      const ok = await runCheckUntilResults(page, 'lecturer similarity check', async () => {
        await page.getByRole('button', { name: /run similarity check/i }).click();
      });
      if (ok) await shot(page, OUT, '33-lecturer-review-similarity-context.png', { scrollTo: '[data-testid="results-display"]' });
      else console.log('MISS  33-lecturer-review-similarity-context.png     provider unavailable after retries');
      await context.close();
    }

    // ---- admin section from the bulk commit onward ----
    if (want('admin')) {
      const { context, page } = await newPage(browser);
      await uiLogin(page, ADMIN.email, ADMIN.password);
      await page.goto(`${ORIGIN}/admin/user-management`, { waitUntil: 'networkidle' });
      const cohort = await writeUsersWorkbook(path.join(FIX, 'cohort.xlsx'), BULK_ROWS);
      await page.locator('input[type="file"]').first().setInputFiles(cohort);
      await sleep(400);
      await page.getByRole('button', { name: /preview import/i }).click();
      await page.getByText(/preview only|will NOT be provisioned|conflict/i).first().waitFor({ timeout: 60000 });
      await sleep(400);
      await page.getByRole('button', { name: /commit valid new accounts/i }).click();
      // The commit asks for confirmation ("Create N account(s)").
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 10000 }).catch(() => {});
      if (await dialog.count()) await dialog.getByRole('button', { name: /create \d+ account/i }).click();
      await page.getByText(/only copy/i).first().waitFor({ timeout: 600000 });
      await sleep(600);
      await shot(page, OUT, '56-admin-bulk-result.png');
      await shot(page, OUT, '57-admin-credential-manifest-state.png', { scrollTo: 'section[aria-label="One-time credential manifest"]' });
      await dismiss(page);

      // Replay: every row now already exists.
      await page.locator('input[type="file"]').first().setInputFiles(cohort);
      await page.getByRole('button', { name: /preview import/i }).click();
      await page.getByText(/preview only|already/i).first().waitFor({ timeout: 60000 });
      await sleep(400);
      await shot(page, OUT, '74-import-conflict.png', { scrollTo: 'text=/Preview only/i' });

      // Invitations: eligible (has email, not yet activated) and refused (no email).
      await page.goto(`${ORIGIN}/admin/user-management`, { waitUntil: 'networkidle' });
      const rowOk = await findRow(page, 'Yusuf', 'PHD/24/0203');
      await rowOk.getByRole('button', { name: /invite|send invitation/i }).first().click();
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      await page.getByRole('dialog').getByRole('button', { name: /send invitation|resend invitation/i }).click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await sleep(1500);
      await shot(page, OUT, '58-admin-invitation-action.png', { scrollTo: 'text=PHD/24/0203' });
      const rowNo = await findRow(page, 'Kehinde', 'PHD/24/0201');
      await rowNo.getByRole('button', { name: /invite|send invitation/i }).first().click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor({ timeout: 5000 }).catch(() => {});
      if (await dlg.count()) await dlg.getByRole('button', { name: /send invitation|resend invitation/i }).click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await sleep(1500);
      await shot(page, OUT, '75-no-email-invitation-skip.png', { scrollTo: 'text=PHD/24/0201' });

      // Credential reset for a no-email student (masked before capture).
      const s3 = S('S3');
      const rowS3 = await findRow(page, s3.name.split(' ')[0], s3.matric);
      await rowS3.getByRole('button', { name: /reset credential|new temporary password|reset/i }).first().click();
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      await page.getByRole('dialog').getByRole('button', { name: /issue new temporary password/i }).click();
      await readTempCredential(page);
      await maskCredentials(page);
      await shot(page, OUT, '59-admin-credential-reset.png', { scrollTo: 'section[aria-label="One-time temporary credential"]' });
      await dismiss(page);

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
  } finally {
    await browser.close().catch(() => {});
  }
  fs.writeFileSync(path.join(OUT, '..', 'tooling', 'last-capture-log.json'), JSON.stringify({ resumedAt: new Date().toISOString(), captures: captureLog, providerEvents }, null, 1));
  const missed = captureLog.filter((c) => !c.ok);
  console.log(`\nresume: captured ${captureLog.length - missed.length}/${captureLog.length}; provider events: ${providerEvents.length}`);
  if (missed.length) missed.forEach((m) => console.log(`  - ${m.name}: ${m.error}`));
}

main().catch((error) => { console.error('RESUME ABORTED:', error.message.split('\n')[0]); process.exitCode = 1; });
