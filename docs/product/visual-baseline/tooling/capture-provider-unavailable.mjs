// Captures the "semantic provider unavailable" state honestly.
//
// This state cannot be reached by the UI alone; it appears when the Voyage
// provider rejects or throttles a request. To reproduce it without touching
// application code, the operator restarts the DISPOSABLE demo backend with an
// invalid provider key (a runtime environment override on the local stack),
// runs this script, then restarts the backend with the real key:
//
//   VOYAGE_API_KEY=documentation-invalid-key docker compose --env-file <env> -p ts-closure \
//     -f docker-compose.yml -f docker-compose.acceptance.yml up -d backend
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/product/visual-baseline/tooling/capture-provider-unavailable.mjs
//   docker compose --env-file <env> -p ts-closure -f docker-compose.yml -f docker-compose.acceptance.yml up -d backend
//
// The application fails closed: the checker reports that semantic analysis is
// unavailable and never substitutes a fallback result.
import path from 'node:path';
import { REPO, ORIGIN, sleep, launch, newPage, uiLogin, forbid, shot, captureLog, ensureDir } from './lib.mjs';
import { STUDENTS, PROPOSALS } from './synthetic-dataset.mjs';

const OUT = ensureDir(path.join(REPO, 'docs', 'product', 'visual-baseline', 'screenshots'));
const student = STUDENTS.find((s) => s.key === 'S2');
forbid(student.password);

const browser = await launch();
const { context, page } = await newPage(browser);
await uiLogin(page, student.matric, student.password);
await page.goto(`${ORIGIN}/student/check-my-topic`, { waitUntil: 'networkidle' });
const p = PROPOSALS.precheckHigh;
await page.locator('#topic').fill(p.title);
await page.locator('#population').fill(p.population);
await page.locator('#location').fill(p.location);
await page.locator('#studyFocus').fill(p.studyFocus);
await page.getByRole('button', { name: /check similarity/i }).click();
await page.getByText(/semantic analysis is currently unavailable|unavailable/i).first().waitFor({ timeout: 120000 });
await sleep(600);
await shot(page, OUT, '71-semantic-provider-unavailable.png', { scrollTo: '[role="alert"], [data-testid="student-results-container"]' });
await context.close();
await browser.close();
console.log(JSON.stringify(captureLog));
