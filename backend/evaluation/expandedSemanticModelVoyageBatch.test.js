const { ADAPTERS, PROVIDERS } = require('./managedEmbeddingProviders');
const { managed, planManagedBatches, VOYAGE_MAX_TEXTS_PER_REQUEST } = require('../scripts/run-expanded-semantic-model-evaluation');

const inputs = Array.from({ length: 229 }, (_, index) => `Title: Topic ${index + 1}`);

test('plans one complete Voyage batch while retaining OpenAI and Gemini transport plans', () => {
  const voyage = planManagedBatches('voyage', inputs);
  expect(voyage).toHaveLength(1); expect(voyage[0]).toEqual(inputs);
  expect(planManagedBatches('openai', inputs).map(batch => batch.length)).toEqual([64, 64, 64, 37]);
  expect(planManagedBatches('gemini', inputs).map(batch => batch.length)).toEqual([32, 32, 32, 32, 32, 32, 32, 5]);
});

test('rejects a future Voyage request above the documented text limit', () => {
  expect(() => planManagedBatches('voyage', Array.from({ length: VOYAGE_MAX_TEXTS_PER_REQUEST + 1 }, (_, index) => String(index)))).toThrow(/1000-text limit/);
});

test('invokes Voyage once and preserves returned input order', async () => {
  const original = ADAPTERS.voyage; const calls = [];
  ADAPTERS.voyage = async batch => { calls.push(batch); return { vectors: batch.map((_, index) => Array(1024).fill(index + 1)), usage: { inputTokens: null } }; };
  try {
    const result = await managed('voyage', inputs);
    expect(calls).toEqual([inputs]); expect(result.vectors).toHaveLength(229); expect(result.vectors[0][0]).toBe(1); expect(result.vectors[228][0]).toBe(229); expect(PROVIDERS.voyage.model).toBe('voyage-4-large');
  } finally { ADAPTERS.voyage = original; }
});

test('rejects Voyage response count and dimension mismatches', async () => {
  const original = ADAPTERS.voyage;
  ADAPTERS.voyage = async () => ({ vectors: [], usage: { inputTokens: null } });
  await expect(managed('voyage', inputs)).rejects.toThrow(/embedding count/);
  ADAPTERS.voyage = async batch => ({ vectors: batch.map(() => [1, 2]), usage: { inputTokens: null } });
  await expect(managed('voyage', inputs)).rejects.toThrow(/embedding dimension/);
  ADAPTERS.voyage = original;
});
