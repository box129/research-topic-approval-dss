const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const smokeScript = path.join(__dirname, 'fullstack-compose-smoke.js');
const spaDocument = '<!doctype html><html><body><div id="root"></div></body></html>';

function runSmoke(environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [smokeScript], {
      cwd: path.resolve(__dirname, '..', '..'),
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('deployment smoke waits for the asynchronous Voyage readiness probe', async () => {
  let readinessCalls = 0;
  const server = http.createServer((request, response) => {
    const sendJson = (status, body) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (['/', '/login', '/accept-invitation', '/reset-password'].includes(request.url)) {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(spaDocument);
      return;
    }

    if (request.url === '/api/v1/health') {
      sendJson(200, { status: 'OK' });
      return;
    }

    if (request.url === '/api/v1/readiness') {
      readinessCalls += 1;
      sendJson(readinessCalls === 1 ? 503 : 200, {
        status: readinessCalls === 1 ? 'degraded' : 'ready'
      });
      return;
    }

    if (request.url === '/api/v1/auth/me' || request.url === '/api/similarity/check') {
      sendJson(401, { status: 'error' });
      return;
    }

    sendJson(404, { status: 'error' });
  });

  const port = await listen(server);
  try {
    const result = await runSmoke({
      FULLSTACK_FRONTEND_URL: `http://127.0.0.1:${port}/`,
      FULLSTACK_SMOKE_TIMEOUT_MS: '5000'
    });

    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(readinessCalls >= 2, 'readiness should be retried after configured_not_yet_verified/degraded state');
    assert.match(result.stdout, /PASS - Same-origin backend readiness/);
  } finally {
    await close(server);
  }
});

test('deployment smoke rejects a credential-bearing frontend URL without echoing it', async () => {
  const result = await runSmoke({
    FULLSTACK_FRONTEND_URL: 'https://smoke-user:smoke-password@example.test/'
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /FULLSTACK_FRONTEND_URL must be a bare http\(s\) origin/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /smoke-password/);
});

test('deployment smoke does not echo credentials from a malformed frontend URL', async () => {
  const result = await runSmoke({
    FULLSTACK_FRONTEND_URL: 'https://smoke-user:malformed-smoke-password@[broken'
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /FULLSTACK_FRONTEND_URL must be a bare http\(s\) origin/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /malformed-smoke-password/);
});
