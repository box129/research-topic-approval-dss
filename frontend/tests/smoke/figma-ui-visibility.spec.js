import { expect, test } from '@playwright/test';

test('renders the login page without crashing', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);

  if (process.env.PLAYWRIGHT_CAPTURE_SMOKE === '1') {
    await page.screenshot({
      path: testInfo.outputPath('login-page.png'),
      fullPage: true
    });
  }
});
