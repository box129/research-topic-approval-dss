// Documentation-only capture library for the visual baseline.
//
// Runs OUTSIDE the application runtime. It drives the already-built container
// stack through its public HTTPS edge, exactly as a browser would, using the
// frontend's existing Playwright dev dependency. It changes no application
// code, no schema and no configuration.
//
// Everything captured is synthetic. Before every screenshot the visible page
// text is scanned for anything that must never appear (credentials, keys,
// database URLs, tokens), and one-time credentials are masked in the DOM
// first — so no unsafe capture is ever written to disk.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
export const { chromium } = require(path.join(REPO, 'frontend', 'node_modules', 'playwright'));
export const ExcelJS = require(path.join(REPO, 'backend', 'node_modules', 'exceljs'));

export const ORIGIN = process.env.VB_ORIGIN || 'https://localhost:8444';
export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };
export const VIDEO = { width: 1920, height: 1080 };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Viewer pacing for recordings: multiplies caption holds and post-action
// pauses (VB_PACE=1.5 slows every reading pause by half). Never affects
// screenshots.
export const PACE = Math.max(0.5, Number(process.env.VB_PACE) || 1);

// ------------------------------------------------------------------ API ----
export function apiSession() {
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  async function call(method, p, body) {
    const h = { origin: ORIGIN };
    if (body !== undefined) h['content-type'] = 'application/json';
    if (jar.size) h.cookie = cookieHeader();
    const res = await fetch(`${ORIGIN}${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of (res.headers.getSetCookie?.() || [])) {
      const [pair] = line.split(';'); const i = pair.indexOf('=');
      const n = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
      if (v === '') jar.delete(n); else jar.set(n, v);
    }
    const t = await res.text();
    let b; try { b = JSON.parse(t); } catch { b = { _raw: t.slice(0, 200) }; }
    return { status: res.status, body: b };
  }
  async function upload(p, filePath) {
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(filePath));
    const res = await fetch(`${ORIGIN}${p}`, { method: 'POST', headers: { cookie: cookieHeader(), origin: ORIGIN }, body: fd });
    const t = await res.text();
    let b; try { b = JSON.parse(t); } catch { b = { _raw: t.slice(0, 300) }; }
    return { status: res.status, body: b };
  }
  async function login(identifier, password) {
    jar.clear();
    return call('POST', '/api/v1/auth/login', { identifier, password });
  }
  return { call, upload, login, cookies: () => new Map(jar) };
}

// The provider is rate-limited on this account. A semantic_unavailable answer
// is the honest fail-closed response; callers wait and retry a bounded number
// of times. Every occurrence is recorded so it can be reported.
export const providerEvents = [];
export async function withProviderRetry(label, fn, attempts = 6) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const r = await fn();
    const throttled = r.status === 503 && (r.body?.status === 'semantic_unavailable' || r.body?.details?.error_code === 'SEMANTIC_SYNC_UNAVAILABLE' || r.body?.details?.error_code === 'SEMANTIC_PROVIDER_UNAVAILABLE');
    if (!throttled) return r;
    providerEvents.push({ label, attempt, at: new Date().toISOString() });
    console.log(`      [provider unavailable during "${label}" (attempt ${attempt}); waiting ${attempt * 20}s]`);
    await sleep(attempt * 20000);
  }
  return { status: 503, body: { status: 'semantic_unavailable', exhausted: true } };
}

// ------------------------------------------------------------- fixtures ----
export async function writeUsersWorkbook(filePath, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('users');
  ws.addRow(['name', 'email', 'role', 'matric_number']);
  rows.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

export async function writeTopicsWorkbook(filePath, topics, lifecycle = 'historical') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('topics');
  ws.addRow(['Topic Title', 'keywords', 'population', 'location', 'study_focus', 'lifecycle_bucket', 'status', 'session_year', 'supervisor_name', 'category']);
  topics.forEach((t) => ws.addRow([t.title, t.keywords || '', t.population, t.location, t.study_focus, lifecycle, 'approved', t.session_year, t.supervisor_name, t.category || '']));
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

// -------------------------------------------------------------- browser ----
export async function launch() {
  return chromium.launch({ headless: true });
}

export async function newPage(browser, { viewport = DESKTOP, video = null, actionTimeout = 30000 } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'Africa/Lagos',
    ...(video ? { recordVideo: { dir: video.dir, size: video.size || VIDEO } } : {})
  });
  const page = await context.newPage();
  page.setDefaultTimeout(actionTimeout);
  return { context, page };
}

export async function uiLogin(page, identifier, password) {
  await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-identifier').fill(identifier);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  // The sign-in request is asynchronous; wait until the app has actually left
  // the login route (dashboard or forced password change) before continuing.
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(300);
}

export async function uiLogout(page) {
  const button = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
  if (await button.count()) { await button.click(); await page.waitForLoadState('networkidle'); }
}

// ----------------------------------------------------- privacy safeguards ----
// Values that must never be visible in a capture. Synthetic passwords are
// included so a screenshot of a form never carries one, and every one-time
// credential seen during a run is added as soon as it is issued.
export const forbidden = new Set(['postgresql://', 'eyJhbGci', 'pa-', 'Bearer ', 'uniosun.edu.ng', 'gmail.com', 'JWT_SECRET', 'VOYAGE_API_KEY']);
export function forbid(value) { if (value && String(value).length >= 6) forbidden.add(String(value)); }

const MASK = '••••••••••••••••';
export async function maskCredentials(page) {
  await page.evaluate((mask) => {
    for (const code of document.querySelectorAll('section[aria-label="One-time temporary credential"] code')) {
      code.textContent = mask;
      code.setAttribute('data-masked', 'documentation');
    }
  }, MASK);
}

// Paint-level credential mask for recordings. Init scripts run before the
// document exists, so everything is deferred until documentElement is present;
// the credential text is made transparent and dots are painted over it by CSS,
// and a DOM observer rewrites the text as a second layer.
export function credentialMaskInit() {
  const MASK = '••••••••••••••••';
  const css = 'section[aria-label="One-time temporary credential"] code{color:transparent !important;text-shadow:none !important;user-select:none;position:relative;}'
    + 'section[aria-label="One-time temporary credential"] code::after{content:"' + MASK + '";color:#3b2f00;position:absolute;left:0.5rem;top:0;bottom:0;display:flex;align-items:center;letter-spacing:.1em;}';
  const inject = () => {
    if (!document.documentElement || document.getElementById('vb-mask-style')) return;
    const el = document.createElement('style'); el.id = 'vb-mask-style'; el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  };
  const rewrite = () => { for (const c of document.querySelectorAll('section[aria-label="One-time temporary credential"] code')) { if (c.textContent !== MASK) c.textContent = MASK; } };
  const arm = () => {
    if (!document.documentElement) { setTimeout(arm, 0); return; }
    inject();
    new MutationObserver(() => { inject(); rewrite(); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    document.addEventListener('DOMContentLoaded', () => { inject(); rewrite(); });
  };
  arm();
}

export async function installCredentialMask(page) {
  await page.addInitScript(credentialMaskInit);
}

// Explicit post-render mask for the moment a credential panel appears.
export async function maskNow(page) {
  await page.evaluate(credentialMaskInit);
  await maskCredentials(page);
}

export async function assertClean(page, label) {
  const text = await page.evaluate(() => document.body.innerText);
  const hits = [...forbidden].filter((v) => text.includes(v));
  if (hits.length) throw new Error(`capture "${label}" would expose forbidden content: ${hits.map((h) => h.slice(0, 4) + '…').join(', ')}`);
}

// ------------------------------------------------------------- capture ----
export const captureLog = [];
export async function shot(page, dir, name, { scrollTo = null, fullPage = false, settle = 500 } = {}) {
  try {
    if (scrollTo) { const el = page.locator(scrollTo).first(); if (await el.count()) await el.scrollIntoViewIfNeeded(); }
    else await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(settle);
    await maskCredentials(page);
    await assertClean(page, name);
    const file = path.join(dir, name);
    await page.screenshot({ path: file, fullPage, type: 'png' });
    captureLog.push({ name, ok: true, url: page.url() });
    console.log(`SHOT  ${name.padEnd(48)} ${page.url().replace(ORIGIN, '')}`);
  } catch (error) {
    captureLog.push({ name, ok: false, url: page.url(), error: error.message });
    console.log(`MISS  ${name.padEnd(48)} ${error.message.split('\n')[0].slice(0, 120)}`);
  }
}

// --------------------------------------------------------- video helpers ----
// A visible pointer and caption cards are drawn as DOM overlays inside the
// page for the recording only; nothing in the application changes.
export async function installOverlay(page) {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('vb-cursor')) return;
      const c = document.createElement('div'); c.id = 'vb-cursor';
      c.style.cssText = 'position:fixed;z-index:2147483646;left:-40px;top:-40px;width:22px;height:22px;pointer-events:none;transform:translate(-3px,-2px);';
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.6 L12 14 L19 14 Z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
      document.body.appendChild(c);
      const cap = document.createElement('div'); cap.id = 'vb-caption';
      cap.style.cssText = 'position:fixed;z-index:2147483645;left:50%;bottom:34px;transform:translateX(-50%);max-width:70%;padding:12px 22px;border-radius:10px;background:rgba(17,24,39,.88);color:#fff;font:500 22px/1.35 system-ui,Segoe UI,Roboto,sans-serif;letter-spacing:.2px;opacity:0;transition:opacity .35s;pointer-events:none;text-align:center;';
      document.body.appendChild(cap);
    });
  });
}

export async function caption(page, text, { hold = 0 } = {}) {
  await page.evaluate((t) => { const el = document.getElementById('vb-caption'); if (el) { el.textContent = t; el.style.opacity = t ? '1' : '0'; } }, text || '');
  if (hold) await sleep(hold * PACE);
}

export async function titleCard(page, title, subtitle = '', hold = 3200) {
  await page.evaluate(({ title, subtitle }) => {
    let card = document.getElementById('vb-title');
    if (!card) { card = document.createElement('div'); card.id = 'vb-title'; document.body.appendChild(card); }
    card.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f3d2e;color:#fff;font-family:system-ui,Segoe UI,Roboto,sans-serif;opacity:1;transition:opacity .5s;';
    card.innerHTML = `<div style="font-size:54px;font-weight:700;letter-spacing:.3px">${title}</div><div style="margin-top:18px;font-size:26px;opacity:.85">${subtitle}</div><div style="margin-top:46px;font-size:18px;opacity:.6">Synthetic demonstration data · Research Topic Approval DSS</div>`;
  }, { title, subtitle });
  await sleep(hold);
  await page.evaluate(() => { const card = document.getElementById('vb-title'); if (card) { card.style.opacity = '0'; setTimeout(() => card.remove(), 600); } });
  await sleep(700);
}

let cursorPos = { x: 40, y: 40 };
export async function glide(page, locator, { steps = 28, pause = 350 } = {}) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) return null;
  const target = { x: box.x + Math.min(box.width / 2, 160), y: box.y + box.height / 2 };
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps; const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const x = cursorPos.x + (target.x - cursorPos.x) * ease; const y = cursorPos.y + (target.y - cursorPos.y) * ease;
    await page.mouse.move(x, y);
    await page.evaluate(({ x, y }) => { const c = document.getElementById('vb-cursor'); if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; } }, { x, y });
    await sleep(14);
  }
  cursorPos = target;
  await sleep(pause);
  return el;
}

export async function glideClick(page, locator, opts = {}) {
  const el = await glide(page, locator, opts);
  if (el) { await el.click(); await page.waitForLoadState('networkidle').catch(() => {}); }
  await sleep((opts.after ?? 900) * PACE);
  return el;
}

export async function typeSlowly(page, locator, text, { delay = 28 } = {}) {
  const el = await glide(page, locator, { pause: 200 });
  if (!el) return;
  await el.click();
  await el.fill('');
  await el.type(text, { delay });
  await sleep(400);
}

export async function scrollBy(page, dy, { steps = 20 } = {}) {
  for (let i = 0; i < steps; i += 1) { await page.mouse.wheel(0, dy / steps); await sleep(22); }
  await sleep(500);
}

export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }
