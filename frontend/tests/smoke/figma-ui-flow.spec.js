import { expect, test } from '@playwright/test';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getCredentials(role) {
  const prefix = `SMOKE_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];

  return email && password ? { email, password } : null;
}

function getPathname(page) {
  return new URL(page.url()).pathname;
}

async function clearSession(page, context) {
  await context.clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function loginAs(page, context, role, expectedPath) {
  const credentials = getCredentials(role);

  test.skip(
    !credentials,
    `Set SMOKE_${role.toUpperCase()}_EMAIL and SMOKE_${role.toUpperCase()}_PASSWORD to run ${role} smoke checks.`
  );

  await clearSession(page, context);
  await page.getByLabel(/email/i).fill(credentials.email);
  await page.getByLabel(/password/i).fill(credentials.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect.poll(() => getPathname(page)).toBe(expectedPath);
}

function startReadOnlyRequestMonitor(page) {
  const unexpectedMutations = [];

  const onRequest = (request) => {
    const method = request.method();

    if (!mutatingMethods.has(method)) {
      return;
    }

    let pathname = request.url();

    try {
      pathname = new URL(request.url()).pathname;
    } catch {
      // Keep the original URL for diagnostics if parsing fails.
    }

    if (/\/api\/v1\/auth\/(login|logout)$/.test(pathname) || /\/api\/auth\/(login|logout)$/.test(pathname)) {
      return;
    }

    unexpectedMutations.push(`${method} ${pathname}`);
  };

  page.on('request', onRequest);

  return {
    assertClean() {
      expect(unexpectedMutations).toEqual([]);
    },
    stop() {
      page.off('request', onRequest);
    }
  };
}

async function expectRenderedRoute(page, path, heading) {
  await page.goto(path);
  await expect.poll(() => getPathname(page)).toBe(path);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);
}

test('login page renders the Figma-informed auth shell', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password');
  await expect(page.getByText('No role selector', { exact: true })).toBeVisible();
  await expect(page.locator('select[name*="role" i], [role="combobox"][name*="role" i]')).toHaveCount(0);
});

test('student Figma UI routes render read-only smoke states', async ({ page, context }) => {
  await loginAs(page, context, 'student', '/student/dashboard');
  const monitor = startReadOnlyRequestMonitor(page);

  try {
    await expectRenderedRoute(page, '/student/dashboard', /student dashboard/i);
    await expect(page.getByText(/not available yet|not connected yet/i).first()).toBeVisible();

    await expectRenderedRoute(page, '/student/submit-topic', /submit topic/i);
    await expect(page.getByRole('button', { name: /submit for review/i })).toBeVisible();

    await expectRenderedRoute(page, '/student/my-submissions', /my submissions/i);

    await expectRenderedRoute(page, '/student/check-my-topic', /check my topic/i);
    await expect(page.getByText(/pre-check only|lecturer-controlled/i).first()).toBeVisible();

    await expectRenderedRoute(page, '/student/research-explorer', /research explorer/i);
    await expect(page.getByText(/no approved topic explorer data is available yet/i)).toBeVisible();
    await expect(page.getByText(/no approved-topic browsing endpoint is currently connected/i)).toBeVisible();
    await expect(page.getByLabel(/search approved topics/i)).toBeDisabled();
    await expect(page.getByLabel(/category/i)).toBeDisabled();
    await expect(page.getByText(/sample approved topic|fake approved topic/i)).toHaveCount(0);

    monitor.assertClean();
  } finally {
    monitor.stop();
  }
});

test('lecturer Figma UI routes render read-only smoke states', async ({ page, context }) => {
  await loginAs(page, context, 'lecturer', '/lecturer/dashboard');
  const monitor = startReadOnlyRequestMonitor(page);

  try {
    await expectRenderedRoute(page, '/lecturer/dashboard', /lecturer dashboard/i);
    await expect(page.getByText(/not available yet|not connected yet/i).first()).toBeVisible();
    await expect(page.getByText(/similarity risk, activity, workload, and trend analytics are shown as unavailable/i)).toBeVisible();

    await expectRenderedRoute(page, '/lecturer/pending-reviews', /pending reviews/i);
    await expect(page.getByText(/read-only queue/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^reject$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /request revision/i })).toHaveCount(0);

    const detailLink = page.locator('a[href^="/lecturer/pending-reviews/"], button:has-text("Open Review")').first();
    const detailLinkCount = await detailLink.count();

    if (detailLinkCount > 0) {
      await detailLink.click();
      await expect(page.getByRole('heading', { name: /submission details/i })).toBeVisible();
      expect(getPathname(page)).toMatch(/^\/lecturer\/pending-reviews\/[^/]+$/);
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No pending review detail link was available in the current smoke dataset.'
      });
    }

    await expectRenderedRoute(page, '/lecturer/check-similarity', /check similarity/i);
    await expect(page.getByText(/similarity evidence is advisory/i)).toBeVisible();
    await expect(page.getByText(/does not approve, reject, block, or save a topic/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^reject$/i })).toHaveCount(0);

    monitor.assertClean();
  } finally {
    monitor.stop();
  }
});

test('admin Figma UI route renders honest dashboard shell', async ({ page, context }) => {
  await loginAs(page, context, 'admin', '/admin/dashboard');
  const monitor = startReadOnlyRequestMonitor(page);

  try {
    await expectRenderedRoute(page, '/admin/dashboard', /admin dashboard/i);
    await expect(page.getByText(/^API$/i)).toBeVisible();
    await expect(page.getByText(/^Database$/i)).toBeVisible();
    await expect(page.getByText(/^SBERT$/i)).toBeVisible();

    expect(await page.getByText('Not connected yet', { exact: true }).count()).toBeGreaterThanOrEqual(3);
    expect(await page.getByText('Not available yet', { exact: true }).count()).toBeGreaterThanOrEqual(4);
    await expect(page.getByText(/not live system status/i)).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\bUsers\s+\d+\b/i);
    expect(bodyText).not.toMatch(/\bTopics\s+\d+\b/i);
    expect(bodyText).not.toMatch(/\bHigh-risk Topics\s+\d+\b/i);
    expect(bodyText).not.toMatch(/\bReports\s+\d+\b/i);
    expect(bodyText).not.toMatch(/\bAudit Events\s+\d+\b/i);
    expect(bodyText).not.toMatch(/lecturer\.demo@|student\.demo@/i);

    monitor.assertClean();
  } finally {
    monitor.stop();
  }
});
