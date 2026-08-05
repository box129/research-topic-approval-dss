import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('test-results/approved-public-landing');
const workflowStages = [
  'Proposed topic',
  'Jaccard, TF-IDF/Cosine and SBERT',
  'Historical, current-session and under-review records',
  'Advisory similarity evidence',
  'Lecturer-controlled decision'
];

function isExpectedSessionDiscovery(url) {
  return /\/api\/(?:v1\/)?auth\/me(?:\?|$)/.test(new URL(url).pathname);
}

function monitorPage(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const unexpectedResponses = [];
  const unexpectedMutations = [];
  let expectedSessionResponses = 0;

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 401 \(Unauthorized\)/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && isExpectedSessionDiscovery(response.url())) {
      expectedSessionResponses += 1;
    } else if (response.status() >= 400) {
      unexpectedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      unexpectedMutations.push(`${request.method()} ${request.url()}`);
    }
  });

  return { consoleErrors, pageErrors, unexpectedMutations, unexpectedResponses, get expectedSessionResponses() { return expectedSessionResponses; } };
}

async function verifyFoundation(page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Better research topics begin with better evidence.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /research topic approval dss home/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^sign in$/i })).toBeVisible();
  await expect(page.locator('h1:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
}

async function capture(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage });
}

test('approved public landing page matches required responsive states', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const findings = monitorPage(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await verifyFoundation(page);
  await capture(page, 'landing-desktop-first.png');
  await capture(page, 'landing-desktop-full.png', true);

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#landing-main')).toBeFocused();

  await page.goto('/');
  const governanceLink = page.getByRole('link', { name: 'Governance' });
  for (let index = 0; index < 12; index += 1) {
    if (await governanceLink.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(governanceLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#governance$/);
  await expect(page.locator('#governance')).toBeFocused();
  const governanceOutline = await page.locator('#governance').evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(governanceOutline.style).not.toBe('none');
  expect(governanceOutline.width).toBeGreaterThan(0);

  const methodology = page.getByText('How the methods complement one another');
  await methodology.click();
  await expect(methodology.locator('..')).toHaveAttribute('open', '');
  await methodology.click();

  const architecture = page.getByText('View technical architecture');
  await architecture.click();
  await expect(architecture.locator('..')).toHaveAttribute('open', '');
  await architecture.click();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await verifyFoundation(page);
  await capture(page, 'landing-desktop-1280x800.png');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await verifyFoundation(page);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await capture(page, 'landing-tablet-768x1024.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await verifyFoundation(page);
  const closedToggle = page.getByRole('button', { name: 'Open navigation' });
  await expect(closedToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: 'Landing page' })).toBeHidden();
  for (const stage of workflowStages) await expect(page.getByText(stage, { exact: true })).toBeVisible();
  await capture(page, 'landing-mobile-first.png');
  await capture(page, 'landing-mobile-full.png', true);

  await page.goto('/?menu=open');
  const openToggle = page.getByRole('button', { name: 'Close navigation' });
  await expect(openToggle).toBeVisible();
  await expect(openToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'Landing page' })).toBeVisible();
  await capture(page, 'landing-mobile-menu-open.png');
  await openToggle.click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');

  expect(findings.pageErrors).toEqual([]);
  expect(findings.consoleErrors).toEqual([]);
  expect(findings.unexpectedResponses).toEqual([]);
  expect(findings.unexpectedMutations).toEqual([]);
  expect(findings.expectedSessionResponses).toBeGreaterThan(0);
});
