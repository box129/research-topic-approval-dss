const { retry, retryCategory, retryDelayMilliseconds } = require('../scripts/run-expanded-semantic-model-evaluation');

const transient = status => Object.assign(new Error('transient'), status ? { status } : {});
const context = { provider: 'Voyage AI', model: 'voyage-4-large', batchIndex: 2 };

test('uses deterministic 429 fallback delays and honors Retry-After', () => {
  expect(retryCategory(transient(429))).toBe('http_429');
  expect([1, 2, 3].map(attempt => retryDelayMilliseconds(transient(429), attempt))).toEqual([15137, 30023, 60160]);
  const hinted = transient(429); hinted.retryAfterMilliseconds = 12345;
  expect(retryDelayMilliseconds(hinted, 1)).toBe(12345);
});

test('retries network, 408, and 5xx with short bounded delays', async () => {
  expect(retryCategory(transient())).toBe('temporary_network');
  expect(retryCategory(transient(408))).toBe('http_408');
  expect(retryCategory(transient(503))).toBe('http_5xx');
  expect([1, 2, 3].map(attempt => retryDelayMilliseconds(transient(503), attempt))).toEqual([1137, 2023, 4160]);
  const usage = { failures: 0, retries: 0, retryEvents: [] }; const sleeps = []; let calls = 0;
  await expect(retry(async () => { calls += 1; if (calls < 3) throw transient(); return 'ok'; }, usage, context, async delay => sleeps.push(delay))).resolves.toBe('ok');
  expect(calls).toBe(3); expect(sleeps).toEqual([1137, 2023]); expect(usage.retryEvents).toHaveLength(2);
});

test('does not retry permanent errors and retains safe exhausted events', async () => {
  const usage = { failures: 0, retries: 0, retryEvents: [] }; let calls = 0;
  await expect(retry(async () => { calls += 1; throw transient(401); }, usage, context, async () => {})).rejects.toMatchObject({ provider: 'Voyage AI', model: 'voyage-4-large', attemptCount: 1 });
  expect(calls).toBe(1); expect(usage.retryEvents).toEqual([expect.objectContaining({ errorCategory: 'permanent_http', outcome: 'failed', delayMilliseconds: null })]);
});

test('stops after four attempts without leaking credentials', async () => {
  const usage = { failures: 0, retries: 0, retryEvents: [] }; let calls = 0;
  await expect(retry(async () => { calls += 1; throw transient(429); }, usage, context, async () => {})).rejects.toMatchObject({ attemptCount: 4 });
  expect(calls).toBe(4); expect(usage.retries).toBe(3); expect(usage.retryEvents).toHaveLength(4);
  expect(JSON.stringify(usage.retryEvents)).not.toMatch(/authorization|api[_-]?key|bearer/i);
});
