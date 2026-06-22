#!/usr/bin/env node

const checks = [
  {
    label: 'Backend liveness',
    url: process.env.FULLSTACK_BACKEND_HEALTH_URL || 'http://127.0.0.1:3000/api/v1/health',
    expectJson: true,
    validate: (body) => body?.status === 'OK'
  },
  {
    label: 'Backend readiness',
    url: process.env.FULLSTACK_BACKEND_READINESS_URL || 'http://127.0.0.1:3000/api/v1/readiness',
    expectJson: true,
    validate: (body) => body?.status === 'ready'
  },
  {
    label: 'SBERT health',
    url: process.env.FULLSTACK_SBERT_HEALTH_URL || 'http://127.0.0.1:8000/health',
    expectJson: true,
    validate: (body) => body?.status === 'healthy'
  },
  {
    label: 'Frontend static host',
    url: process.env.FULLSTACK_FRONTEND_URL || 'http://127.0.0.1:8080/',
    expectJson: false,
    validate: (body) => typeof body === 'string' && body.length > 0
  }
];

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck(check) {
  const response = await fetchWithTimeout(check.url);
  const body = check.expectJson ? await response.json() : await response.text();

  if (!response.ok || !check.validate(body)) {
    throw new Error(`${check.label} failed at ${check.url} with HTTP ${response.status}.`);
  }

  console.log(`PASS - ${check.label}: ${check.url}`);
}

async function main() {
  console.log('Full-stack Compose smoke check');
  for (const check of checks) {
    await runCheck(check);
  }
}

main().catch((error) => {
  console.error(`FAIL - ${error.message}`);
  process.exit(1);
});
