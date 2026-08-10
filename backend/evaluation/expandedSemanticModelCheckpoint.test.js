const { ADAPTERS } = require('./managedEmbeddingProviders');
const { identityFor, saveCheckpoint, loadCheckpoint, validatePayload, secretFree } = require('./expandedSemanticModelCheckpoint');
const { managed } = require('../scripts/run-expanded-semantic-model-evaluation');

const inputs = Array.from({ length: 229 }, (_, index) => `Title: ${index}`);
const identity = overrides => identityFor({ benchmarkSha256: 'benchmark-a', canonicalInputs: inputs, provider: 'test-provider', model: 'test-model', configuration: { mode: 'test' }, dimension: 2, ...overrides });
const vectors = Array.from({ length: 229 }, (_, index) => [index, index + 1]);

test('accepts only a complete exact-identity checkpoint', () => {
  const id = identity(); saveCheckpoint(id, inputs, vectors, { retryEvents: [] });
  expect(loadCheckpoint(id, inputs)).toMatchObject({ valid: true });
  expect(loadCheckpoint(identity({ benchmarkSha256: 'benchmark-b' }), inputs).valid).toBe(false);
  expect(loadCheckpoint(identity({ configuration: { mode: 'changed' } }), inputs).valid).toBe(false);
  expect(loadCheckpoint(id, [...inputs].reverse()).valid).toBe(false);
});

test('rejects schema, mapping, malformed, non-finite, and incomplete vectors', () => {
  const id = identity({ provider: 'validation-provider' });
  const base = { schemaVersion: 1, identity: id, inputHashes: inputs.map(require('./expandedSemanticModelCheckpoint').digest), vectors };
  expect(validatePayload({ ...base, schemaVersion: 999 }, id, inputs)).toBe('schema_version');
  expect(validatePayload({ ...base, inputHashes: [] }, id, inputs)).toBe('input_mapping');
  expect(validatePayload({ ...base, vectors: vectors.slice(0, -1) }, id, inputs)).toBe('vector_count');
  expect(validatePayload({ ...base, vectors: [[NaN, 1], ...vectors.slice(1)] }, id, inputs)).toBe('vector_integrity');
});

test('refuses secret material and incomplete checkpoint writes', () => {
  expect(secretFree({ Authorization: 'Bearer sentinel-secret' })).toBe(false);
  expect(() => saveCheckpoint(identity({ provider: 'secret-provider' }), inputs, vectors, { usage: { apiKey: 'sentinel-secret' } })).toThrow(/Unsafe checkpoint usage metadata/);
  expect(() => saveCheckpoint(identity({ provider: 'incomplete-provider' }), inputs, vectors.slice(0, -1))).toThrow(/vector_count/);
});

test('accepts normalized numeric usage counts and persists them safely', () => {
  const id = identity({ provider: 'usage-provider' });
  saveCheckpoint(id, inputs, vectors, { usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10, requestCount: 1, successfulRequests: 1 } });
  expect(loadCheckpoint(id, inputs)).toMatchObject({ valid: true, payload: { usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 } } });
});

test('rejects credential key variants and credential-like values', () => {
  const unsafeKeys = ['apiKey', 'API_KEY', 'authorization', 'Authorization', 'accessToken', 'access_token', 'refreshToken', 'refresh_token', 'authToken', 'clientSecret', 'client_secret', 'password', 'cookie'];
  unsafeKeys.forEach((key, index) => expect(() => saveCheckpoint(identity({ provider: `unsafe-${index}` }), inputs, vectors, { usage: { [key]: 'fake' } })).toThrow(/Unsafe checkpoint usage metadata/));
  ['sk-test-secret', 'Bearer FAKE_SECRET', 'AIza-FAKE-SECRET', 'pa-FAKE-SECRET'].forEach((value, index) => expect(() => saveCheckpoint(identity({ provider: `unsafe-value-${index}` }), inputs, vectors, { usage: { inputTokens: value } })).toThrow(/Unsafe checkpoint usage metadata/));
});

test('reuses a validated provider checkpoint without invoking its adapter', async () => {
  const original = ADAPTERS.openai; const checkpoint = identityFor({ benchmarkSha256: 'managed-checkpoint', canonicalInputs: inputs, provider: 'openai', model: 'text-embedding-3-large', configuration: {}, dimension: 3072 });
  saveCheckpoint(checkpoint, inputs, inputs.map(() => Array(3072).fill(1)), { retryEvents: [{ attempt: 1 }] });
  ADAPTERS.openai = async () => { throw new Error('adapter must not run'); };
  try { const result = await managed('openai', inputs, { checkpoint, sleep: async () => {} }); expect(result.usage.embeddingSource).toBe('validated_checkpoint'); expect(result.usage.checkpointRetryEvents).toEqual([{ attempt: 1 }]); expect(result.usage.inputTokens).toBeNull(); } finally { ADAPTERS.openai = original; }
});
