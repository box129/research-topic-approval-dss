import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('test-results/public-auth');

async function mockAuth(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (url.pathname.endsWith('/auth/login')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { user: { role: 'student' } } }) });
    if (url.pathname.endsWith('/auth/forgot-password')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: 'If that email exists, a password reset link has been sent.' }) });
    if (url.pathname.endsWith('/auth/reset-password')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: 'Password has been reset.' }) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
}

test('public authentication routes render their required states', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await mockAuth(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('UNIOSUN')).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'login-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expectNoOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'login-mobile.png') });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/forgot-password');
  await page.getByLabel('Email Address *').fill('student@example.edu');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/if that email exists/i)).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'forgot-success.png') });

  await page.goto('/reset-password');
  await expect(page.getByText(/password reset link is incomplete/i)).toBeVisible();
  await expect(page.getByLabel('New password *', { exact: true })).toBeDisabled();
  await page.screenshot({ path: path.join(evidenceDir, 'reset-missing-link.png') });

  await page.goto('/reset-password?token=test-token');
  await page.getByLabel('New password *', { exact: true }).fill('password123');
  await page.getByLabel('Confirm new password *').fill('password123');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Password has been reset.')).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'reset-success.png') });
});
