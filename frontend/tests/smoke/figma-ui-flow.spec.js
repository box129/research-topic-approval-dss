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

function makeSnippet(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
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

  const deadline = Date.now() + 15000;
  let currentPath = getPathname(page);
  let loginPageText = '';

  while (Date.now() < deadline) {
    currentPath = getPathname(page);

    if (currentPath === expectedPath) {
      return;
    }

    if (currentPath !== '/login') {
      throw new Error(
        `Login for ${role} reached an unexpected route. Expected ${expectedPath}, current path is ${currentPath}. ` +
        'Check that the provided smoke credentials match the expected role.'
      );
    }

    loginPageText = await page.locator('body').innerText();

    if (
      /unable to sign in|invalid|credential|locked|disabled|inactive|incorrect|not found|failed/i.test(loginPageText) &&
      await page.getByRole('button', { name: /^sign in$/i }).isEnabled().catch(() => false)
    ) {
      break;
    }

    await page.waitForTimeout(250);
  }

  currentPath = getPathname(page);
  loginPageText = loginPageText || await page.locator('body').innerText();

  throw new Error(
    `Login for ${role} did not reach ${expectedPath}. Current path is ${currentPath}. ` +
    `Login page text: "${makeSnippet(loginPageText)}". ` +
    `Credentials may be invalid or the ${role} demo user may not be seeded.`
  );
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

  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
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

    await expectRenderedRoute(page, '/student/submit-topic', /submit your research topic/i);
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

    await expectRenderedRoute(page, '/lecturer/my-decisions', /my decisions/i);
    await expect(page.getByText(/real decision data only/i)).toBeVisible();
    await expect(page.getByText(/does not fabricate decision rows/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^reject$/i })).toHaveCount(0);

    await expectRenderedRoute(page, '/lecturer/supervisees', /supervisees/i);
    await expect(page.getByText(/no explicit assignment model is available yet/i)).toBeVisible();
    await expect(page.getByText(/reviewed submissions are not treated as supervisees/i)).toBeVisible();
    await expect(page.getByText(/sample supervisee|fake progress/i)).toHaveCount(0);

    await expectRenderedRoute(page, '/lecturer/research-trends', /research trends/i);
    await expect(page.getByText(/real aggregate data/i)).toBeVisible();
    await expect(page.getByText(/no fake analytics/i)).toBeVisible();
    await expect(page.getByText(/keyword trends deferred/i)).toBeVisible();
    await expect(page.getByText(/recommendations deferred/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toHaveCount(0);

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

    await expect(page.getByText(/admin metrics use a read-only summary endpoint/i)).toBeVisible();
    await expect(page.getByText(/No fake values/i)).toBeVisible();
    await expect(page.getByText(/SBERT health is not checked by this dashboard endpoint yet/i)).toBeVisible();
    await expect(page.getByText(/recent activity is not displayed on this dashboard yet/i)).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\bReports\s+\d+\b/i);
    expect(bodyText).not.toMatch(/\bAudit Events\s+\d+\b/i);
    expect(bodyText).not.toMatch(/\bHigh-risk Topics\s+\d+\b/i);
    expect(bodyText).not.toMatch(/lecturer\.demo@|student\.demo@/i);

    await page.goto('/admin/topic-repository');
    await expect.poll(() => getPathname(page)).toBe('/admin/topic-repository');
    await expect(page.getByRole('heading', { exact: true, level: 1, name: 'Topic Repository' })).toBeVisible();
    await expect(page.getByText(/Read-only repository data/i)).toBeVisible();
    await expect(page.getByText(/No fake repository rows/i)).toBeVisible();
    await expect(page.getByText(/No import UI, exports, edits, deletes, or fabricated topic rows/i)).toBeVisible();

    await page.goto('/admin/user-management');
    await expect.poll(() => getPathname(page)).toBe('/admin/user-management');
    await expect(page.getByRole('heading', { exact: true, level: 1, name: 'User Management' })).toBeVisible();
    await expect(page.getByText(/Real account records/i)).toBeVisible();
    await expect(page.getByText(/No privileged account workflow is invented/i)).toBeVisible();
    await expect(page.getByText(/does not create users, change roles, reset passwords, invite accounts, delete records/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add user/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /reset password/i })).toHaveCount(0);

    await page.goto('/admin/system-settings');
    await expect.poll(() => getPathname(page)).toBe('/admin/system-settings');
    await expect(page.getByRole('heading', { exact: true, level: 1, name: 'System Settings' })).toBeVisible();
    await expect(page.getByText(/Read-only settings data/i)).toBeVisible();
    await expect(page.getByText(/Settings updates remain deferred/i).first()).toBeVisible();
    await expect(page.getByText(/No PATCH or save workflow is connected/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /edit/i })).toHaveCount(0);

    await page.goto('/admin/audit-log');
    await expect.poll(() => getPathname(page)).toBe('/admin/audit-log');
    await expect(page.getByRole('heading', { exact: true, level: 1, name: 'Audit Log' })).toBeVisible();
    await expect(page.getByText(/Real audit records/i)).toBeVisible();
    await expect(page.getByText(/No fake audit activity/i)).toBeVisible();
    await expect(page.getByText(/No audit export endpoint is connected/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /purge/i })).toHaveCount(0);

    await page.goto('/admin/reports');
    await expect.poll(() => getPathname(page)).toBe('/admin/reports');
    await expect(page.getByRole('heading', { exact: true, level: 1, name: 'Reports' })).toBeVisible();
    await expect(page.getByText(/Real aggregate data/i)).toBeVisible();
    await expect(page.getByText(/No fake reports or exports/i)).toBeVisible();
    await expect(page.getByText(/Exports deferred/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /download/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /generate report/i })).toHaveCount(0);

    monitor.assertClean();
  } finally {
    monitor.stop();
  }
});
