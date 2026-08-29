// Targeted refresh of the visual baseline after the pre-pilot identity/visual
// polish pass. Re-captures only the screenshots whose screens changed, on the
// existing synthetic demo database, and writes throwaway desktop/mobile check
// images (never into the repository) with a horizontal-overflow assertion.
//
// Usage (stack up on VB_ORIGIN, demo DB already seeded by capture-screenshots):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 VB_CHECK_DIR=<tmp> node recapture-polish.mjs
import os from 'node:os';
import path from 'node:path';
import {
  REPO, ORIGIN, DESKTOP, MOBILE, sleep, writeUsersWorkbook, launch, newPage, uiLogin,
  forbid, shot, captureLog, ensureDir
} from './lib.mjs';
import { ADMIN, LECTURERS, STUDENTS, PROPOSALS, BULK_ROWS } from './synthetic-dataset.mjs';

const OUT = ensureDir(path.join(REPO, 'docs', 'product', 'visual-baseline', 'screenshots'));
const CHECK = ensureDir(process.env.VB_CHECK_DIR || path.join(os.tmpdir(), 'vb-polish-check'));
const FIX = ensureDir(path.join(os.tmpdir(), 'vb-fixtures'));
const byKey = (list, key) => list.find((x) => x.key === key);
const S = (k) => byKey(STUDENTS, k);
const L = (k) => byKey(LECTURERS, k);
[ADMIN, ...LECTURERS, ...STUDENTS].forEach((u) => forbid(u.password));

const overflow = [];
async function overflowCheck(page, label) {
  const r = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  const ok = r.scrollWidth <= r.innerWidth;
  overflow.push({ label, ...r, ok });
  console.log(`${ok ? 'OK   ' : 'WIDE '} ${label.padEnd(44)} scrollWidth=${r.scrollWidth} innerWidth=${r.innerWidth}`);
}

async function waitForResults(page) {
  await Promise.race([
    page.locator('[data-testid="student-results-container"], [data-testid="results-display"]').first().waitFor({ timeout: 120000 }),
    page.getByText(/semantic analysis is currently unavailable/i).first().waitFor({ timeout: 120000 })
  ]).catch(() => {});
  await sleep(600);
}

async function runChecker(page) {
  await page.goto(`${ORIGIN}/lecturer/check-similarity`, { waitUntil: 'networkidle' });
  const p = PROPOSALS.precheckHigh;
  await page.locator('#topic').fill(p.title);
  await page.locator('#population').fill(p.population);
  await page.locator('#location').fill(p.location);
  await page.locator('#studyFocus').fill(p.studyFocus);
  await page.getByRole('button', { name: /check similarity/i }).click();
  await waitForResults(page);
}

async function capture(browser, viewport, dir, suffix) {
  const s1 = S('S1'); const l1 = L('L1');

  // Student: My Submissions (VB-3 copy on the superseded card).
  {
    const { context, page } = await newPage(browser, { viewport });
    await uiLogin(page, s1.matric, s1.password);
    await page.goto(`${ORIGIN}/student/my-submissions`, { waitUntil: 'networkidle' });
    await overflowCheck(page, `my-submissions${suffix}`);
    await shot(page, dir, `20-student-my-submissions${suffix}.png`, { fullPage: true });
    await context.close();
  }

  // Lecturer: dashboard preview, decisions, supervisees, checker (VB-5a, VB-4, VB-5b, VB-1).
  {
    const { context, page } = await newPage(browser, { viewport, actionTimeout: 60000 });
    await uiLogin(page, l1.email, l1.password);
    await page.goto(`${ORIGIN}/lecturer/dashboard`, { waitUntil: 'networkidle' });
    await overflowCheck(page, `lecturer-dashboard${suffix}`);
    await shot(page, dir, `30-lecturer-dashboard${suffix}.png`);
    await page.goto(`${ORIGIN}/lecturer/my-decisions`, { waitUntil: 'networkidle' });
    await overflowCheck(page, `my-decisions${suffix}`);
    await shot(page, dir, `37-lecturer-my-decisions${suffix}.png`);
    await page.goto(`${ORIGIN}/lecturer/supervisees`, { waitUntil: 'networkidle' });
    await overflowCheck(page, `supervisees${suffix}`);
    await shot(page, dir, `38-lecturer-supervisees${suffix}.png`);
    await runChecker(page);
    await overflowCheck(page, `similarity-checker${suffix}`);
    await shot(page, dir, `39-lecturer-similarity-checker${suffix}.png`, { scrollTo: '[data-testid="results-display"]' });
    if (suffix) {
      // On the narrow viewport the match cards sit below the form; keep a
      // second frame of the cards themselves for the label-collision check.
      await shot(page, dir, `39b-lecturer-similarity-cards${suffix}.png`, { scrollTo: '[data-testid="topic-match-0"]' });
    }
    await context.close();
  }

  // Admin: bulk import section with the cohort selected + assignment cards (VB-5c).
  {
    const { context, page } = await newPage(browser, { viewport });
    await uiLogin(page, ADMIN.email, ADMIN.password);
    await page.goto(`${ORIGIN}/admin/user-management`, { waitUntil: 'networkidle' });
    const cohort = await writeUsersWorkbook(path.join(FIX, 'cohort.xlsx'), BULK_ROWS);
    await page.locator('input[type="file"]').first().setInputFiles(cohort);
    await sleep(400);
    await overflowCheck(page, `admin-user-management${suffix}`);
    await shot(page, dir, `54-admin-bulk-import${suffix}.png`, { scrollTo: 'input[type="file"]' });
    if (suffix) {
      await shot(page, dir, `54b-admin-assignment-cards${suffix}.png`, { scrollTo: 'text=Lecturer-supervisee assignments' });
    }
    await context.close();
  }
}

async function main() {
  const browser = await launch();
  try {
    await capture(browser, DESKTOP, OUT, '');          // the six refreshed baseline files
    await capture(browser, MOBILE, CHECK, '-mobile');  // throwaway narrow-width checks
  } finally {
    await browser.close();
  }
  const misses = captureLog.filter((c) => !c.ok);
  const wide = overflow.filter((o) => !o.ok);
  console.log(`\ncaptures: ${captureLog.length - misses.length}/${captureLog.length} ok; horizontal overflow: ${wide.length === 0 ? 'none' : wide.map((w) => w.label).join(', ')}`);
  if (misses.length || wide.length) process.exitCode = 1;
}

main().catch((e) => { console.error('!! ' + (e.stack || e.message)); process.exitCode = 1; });