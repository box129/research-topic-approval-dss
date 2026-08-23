#!/usr/bin/env node

function parseFrontendOrigin(value) {
  try {
    return new URL(value);
  } catch {
    // Do not relay the rejected input: URLs can contain user-info credentials.
    throw new Error('FULLSTACK_FRONTEND_URL must be a bare http(s) origin without credentials, path, query, or fragment.');
  }
}

const frontendOrigin = parseFrontendOrigin(process.env.FULLSTACK_FRONTEND_URL || 'http://127.0.0.1:8080/');
const timeoutMs = Number.parseInt(process.env.FULLSTACK_SMOKE_TIMEOUT_MS || '30000', 10);
const readinessRetryDelayMs = 1000;

if (!['http:', 'https:'].includes(frontendOrigin.protocol)
  || frontendOrigin.username
  || frontendOrigin.password
  || frontendOrigin.pathname !== '/'
  || frontendOrigin.search
  || frontendOrigin.hash) {
  throw new Error('FULLSTACK_FRONTEND_URL must be a bare http(s) origin without credentials, path, query, or fragment.');
}

if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) {
  throw new Error('FULLSTACK_SMOKE_TIMEOUT_MS must be an integer between 1000 and 300000.');
}

function sameOriginUrl(pathname) {
  return new URL(pathname, frontendOrigin).toString();
}

function isSpaDocument(body) {
  return typeof body === 'string'
    && /<!doctype html>/i.test(body)
    && /<div id="root"><\/div>/i.test(body);
}

const checks = [
  {
    label: 'Frontend entry',
    url: sameOriginUrl('/'),
    expectedStatus: 200,
    responseType: 'text',
    validate: isSpaDocument
  },
  {
    label: 'Frontend SPA login route',
    url: sameOriginUrl('/login'),
    expectedStatus: 200,
    responseType: 'text',
    validate: isSpaDocument
  },
  {
    label: 'Frontend SPA invitation route',
    url: sameOriginUrl('/accept-invitation'),
    expectedStatus: 200,
    responseType: 'text',
    validate: isSpaDocument
  },
  {
    label: 'Frontend SPA password-reset route',
    url: sameOriginUrl('/reset-password'),
    expectedStatus: 200,
    responseType: 'text',
    validate: isSpaDocument
  },
  {
    label: 'Same-origin backend liveness',
    url: sameOriginUrl('/api/v1/health'),
    expectedStatus: 200,
    responseType: 'json',
    validate: (body) => body?.status === 'OK'
  },
  {
    label: 'Same-origin backend readiness',
    url: sameOriginUrl('/api/v1/readiness'),
    expectedStatus: 200,
    responseType: 'json',
    // The first Voyage readiness call deliberately begins an asynchronous
    // provider probe and may report configured_not_yet_verified. Poll within
    // the bounded smoke deadline instead of treating that honest transient
    // state as a deployment failure.
    retryUntilReady: true,
    validate: (body) => body?.status === 'ready'
  },
  {
    label: 'Authentication route is protected',
    url: sameOriginUrl('/api/v1/auth/me'),
    expectedStatus: 401,
    responseType: 'json',
    validate: (body) => body?.status === 'error'
  },
  {
    label: 'Anonymous similarity is denied',
    url: sameOriginUrl('/api/similarity/check'),
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: 'Anonymous deployment smoke check' }),
    expectedStatus: 401,
    responseType: 'json',
    validate: (body) => body?.status === 'error'
  }
];

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchWithTimeout(url, options = {}, requestTimeoutMs = timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck(check) {
  const deadline = Date.now() + timeoutMs;
  let lastFailure;

  do {
    const remainingMs = Math.max(1, deadline - Date.now());
    try {
      const response = await fetchWithTimeout(check.url, {
        method: check.method || 'GET',
        headers: check.headers,
        body: check.body
      }, Math.min(timeoutMs, remainingMs));
      const body = check.responseType === 'json' ? await response.json() : await response.text();

      if (response.status === check.expectedStatus && check.validate(body)) {
        console.log(`PASS - ${check.label}: ${check.url}`);
        return;
      }

      lastFailure = new Error(`${check.label} failed at ${check.url} with HTTP ${response.status}.`);
    } catch (error) {
      lastFailure = error;
    }

    if (!check.retryUntilReady || Date.now() >= deadline) {
      break;
    }

    await sleep(Math.min(readinessRetryDelayMs, Math.max(0, deadline - Date.now())));
  } while (Date.now() < deadline);

  if (check.retryUntilReady) {
    throw new Error(`${check.label} did not become ready within ${timeoutMs}ms: ${lastFailure?.message || 'unknown failure'}`);
  }

  throw lastFailure || new Error(`${check.label} failed at ${check.url}.`);
}

async function main() {
  console.log(`Full-stack same-origin Compose smoke check: ${frontendOrigin.origin}`);
  for (const check of checks) {
    await runCheck(check);
  }
}

main().catch((error) => {
  console.error(`FAIL - ${error.message}`);
  process.exit(1);
});
