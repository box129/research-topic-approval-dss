import { expect, test } from '@playwright/test';

const evidenceDirectory = 'test-results/student-check-topic-approved-target';
const validTopic = 'Machine learning methods for public health surveillance systems';
const validPopulation = 'Undergraduate students';
const validLocation = 'Osogbo, Osun State';
const validStudyFocus = 'Barriers to preventive-health information access';
const observations = new WeakMap();

test.beforeEach(async ({ page }) => {
  const state = { consoleErrors: [], pageErrors: [], mutations: [] };
  observations.set(page, state);
  page.on('console', message => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => state.pageErrors.push(error.message));
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      state.mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  const state = observations.get(page);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations.every(item => item === 'POST /api/similarity/check')).toBe(true);
});

async function mockAuthenticatedStudent(page) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { user: { id: 7, name: 'Student Evidence', role: 'student' } } })
  }));
  await page.route('**/api/v1/notifications**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [] }, meta: { unreadCount: 0 } })
  }));
}

async function assertPageBasics(page) {
  await expect(page.locator('h1:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText(/appears unique|proceed with approval|safe to submit|cleared/i)).toHaveCount(0);
}

async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function expectInViewport(locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  })).toBe(true);
}

async function expectDesktopControlsDoNotOverlap(page) {
  const boxes = await Promise.all([
    page.getByTestId('student-account').boundingBox(),
    page.getByRole('button', { name: 'Open notifications' }).boundingBox(),
    page.getByTestId('student-logout').boundingBox()
  ]);
  const overlaps = (first, second) => first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
  expect(boxes.every(Boolean)).toBe(true);
  expect(overlaps(boxes[0], boxes[1])).toBe(false);
  expect(overlaps(boxes[0], boxes[2])).toBe(false);
  expect(overlaps(boxes[1], boxes[2])).toBe(false);
}

async function openChecker(page, viewport) {
  await page.setViewportSize(viewport);
  await mockAuthenticatedStudent(page);
  await page.goto('/student/check-my-topic');
  await expect(page.getByRole('heading', { level: 1, name: 'Check My Topic' })).toBeVisible();
  await assertPageBasics(page);
}

async function completeForm(page) {
  await page.getByRole('textbox', { name: /research topic/i }).fill(validTopic);
  await page.getByLabel(/population/i).fill(validPopulation);
  await page.getByLabel(/location/i).fill(validLocation);
  await page.getByLabel(/study focus/i).fill(validStudyFocus);
}

function record(id, title, extra = {}) {
  return { id, title, semantic_score: 0.88, similarity_class: 'HIGH', ...extra };
}

function response({ risk = 'HIGH', maxSimilarity = 0.88, matches = true } = {}) {
  return {
    status: 'success',
    semanticAvailable: true,
    semanticProvider: 'voyage',
    semanticModel: 'voyage-4-large',
    data: {
      overall_risk: risk,
      max_similarity: maxSimilarity,
      recommendation: risk === 'LOW'
        ? 'No high-similarity records were identified by this check. Review the proposal and its context before making a submission or approval decision.'
        : 'High similarity detected. Review flagged topics before deciding.',
      matches: matches ? [
        record(1, 'Public health surveillance systems in regional hospitals', { collection: 'HISTORICAL', supervisor_name: 'Dr. Evidence', session_year: '2024/2025' }),
        record(2, 'Machine learning surveillance for community health', { collection: 'CURRENT_SESSION', supervisor_name: 'Dr. Current', session_year: '2025-06-12' }),
        record(3, 'Predictive surveillance across public hospitals', { collection: 'UNDER_REVIEW', supervisor_name: 'Dr. Review', session_year: '2026-08-01' })
      ] : []
    }
  };
}

test('captures approved default and responsive navigation evidence', async ({ page }) => {
  await openChecker(page, { width: 1440, height: 1000 });
  await expect(page.getByRole('textbox', { name: /research topic/i })).toBeVisible();
  await expectDesktopControlsDoNotOverlap(page);
  await scrollToTop(page);
  await page.screenshot({ path: `${evidenceDirectory}/desktop-default.png` });

  await page.setViewportSize({ width: 1280, height: 800 });
  await expectDesktopControlsDoNotOverlap(page);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByText('Account and session')).toBeVisible();
  await expect(page.getByLabel('Student mobile navigation').getByText(/student evidence · student/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await scrollToTop(page);
  await page.screenshot({ path: `${evidenceDirectory}/tablet-menu-open.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.getByRole('link', { name: 'Research Topic Approval DSS home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await scrollToTop(page);
  await page.screenshot({ path: `${evidenceDirectory}/mobile-default.png` });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByText('Account and session')).toBeVisible();
  await scrollToTop(page);
  await page.screenshot({ path: `${evidenceDirectory}/mobile-menu-open.png` });
  await assertPageBasics(page);
});

test('captures deterministic mobile validation evidence', async ({ page }) => {
  await openChecker(page, { width: 390, height: 844 });
  await page.getByRole('textbox', { name: /research topic/i }).fill('Too few words');
  await expect(page.getByTestId('word-count')).toContainText('3 / 7-24 words');
  await expect(page.getByRole('textbox', { name: /research topic/i })).toHaveAttribute('aria-invalid', 'true');
  await scrollToTop(page);
  await page.screenshot({ path: `${evidenceDirectory}/mobile-validation.png` });
});

test('captures deterministic desktop loading evidence', async ({ page }) => {
  await openChecker(page, { width: 1280, height: 800 });
  let releaseRequest;
  await page.route('**/api/similarity/check', async route => {
    await new Promise(resolve => { releaseRequest = resolve; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response()) });
  });
  await completeForm(page);
  await page.getByRole('button', { name: 'Check Similarity' }).click();
  await expect(page.getByRole('button', { name: 'Checking Similarity' })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: /research topic/i })).toHaveValue(validTopic);
  await expect(page.getByLabel(/population/i)).toHaveValue(validPopulation);
  await expect(page.getByLabel(/location/i)).toHaveValue(validLocation);
  await expect(page.getByLabel(/study focus/i)).toHaveValue(validStudyFocus);
  await page.getByText('Checking similarity', { exact: true }).scrollIntoViewIfNeeded();
  await expectInViewport(page.getByText('Checking similarity', { exact: true }));
  await expectInViewport(page.getByLabel(/study focus/i));
  await page.screenshot({ path: `${evidenceDirectory}/desktop-loading.png` });
  releaseRequest();
  await expect(page.getByTestId('student-results-container')).toBeVisible();
});

for (const scenario of [
  { name: 'success-high', payload: response(), viewport: { width: 1440, height: 1000 }, fullPage: true },
  { name: 'no-matches', payload: response({ risk: 'LOW', maxSimilarity: 0, matches: false }), viewport: { width: 1440, height: 1000 } },
  { name: 'mobile-success-high', payload: response(), viewport: { width: 390, height: 844 }, fullPage: true }
]) {
  test(`captures ${scenario.name} evidence`, async ({ page }) => {
    await openChecker(page, scenario.viewport);
    await page.route('**/api/similarity/check', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scenario.payload) }));
    await completeForm(page);
    await page.getByRole('button', { name: 'Check Similarity' }).click();
    await expect(page.getByTestId('student-results-container')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /research topic/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Check Another Topic' })).toBeVisible();
    await expect(page.getByTestId('max-similarity')).toBeVisible();
    await expect(page.getByTestId('risk-banner')).toBeVisible();

    if (scenario.payload.data.matches.length) {
      await expect(page.getByText('Historical topics')).toBeVisible();
      await expect(page.getByText('Current-session topics')).toBeVisible();
      await expect(page.getByText('Under-review topics')).toBeVisible();
    } else {
      await expect(page.getByTestId('no-matches')).toBeVisible();
    }
    await expect(page.getByText(/highest semantic similarity returned by the checker/i)).toBeVisible();

    if (!scenario.fullPage) {
      const scrollTarget = scenario.name === 'no-matches'
        ? page.getByTestId('no-matches')
        : page.getByText('Checked proposal');
      await scrollTarget.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 12));
      await expectInViewport(scrollTarget);
    }

    await assertPageBasics(page);
    expect(observations.get(page).mutations).toEqual(['POST /api/similarity/check']);
    await page.screenshot({ path: `${evidenceDirectory}/${scenario.name}.png`, fullPage: scenario.fullPage || false });
  });
}

test('captures mobile request-error evidence and preserves input', async ({ page }) => {
  await openChecker(page, { width: 390, height: 844 });
  await page.route('**/api/similarity/check', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await completeForm(page);
  await page.getByRole('button', { name: 'Check Similarity' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid similarity response format from server');
  await expect(page.getByRole('textbox', { name: /research topic/i })).toHaveValue(validTopic);
  await expect(page.getByLabel(/population/i)).toHaveValue(validPopulation);
  await expect(page.getByLabel(/location/i)).toHaveValue(validLocation);
  await expect(page.getByLabel(/study focus/i)).toHaveValue(validStudyFocus);
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Check Similarity' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Check Similarity' })).toBeEnabled();
  await page.getByRole('alert').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 8));
  await expectInViewport(page.getByRole('alert'));
  await expectInViewport(page.getByRole('button', { name: 'Check Similarity' }));
  expect(observations.get(page).mutations).toEqual(['POST /api/similarity/check']);
  await assertPageBasics(page);
  await page.screenshot({ path: `${evidenceDirectory}/mobile-error.png` });
});
