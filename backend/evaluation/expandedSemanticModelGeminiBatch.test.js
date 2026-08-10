const { ADAPTERS } = require('./managedEmbeddingProviders');
const { managed, planManagedBatches, GEMINI_DEFAULT_BATCH_SIZE, GEMINI_INTER_BATCH_PACING_MS } = require('../scripts/run-expanded-semantic-model-evaluation');

const inputs = Array.from({ length: 229 }, (_, index) => `Title: Topic ${index + 1}`);
const vector = value => Array(3072).fill(value);

test('plans eight sequential Gemini batches at the evaluation-runner default', () => {
  expect(GEMINI_DEFAULT_BATCH_SIZE).toBe(32);
  expect(planManagedBatches('gemini', inputs).map(batch => batch.length)).toEqual([32, 32, 32, 32, 32, 32, 32, 5]);
});

test('preserves request order and paces only between successful Gemini batches', async () => {
  const original = ADAPTERS.gemini; const calls = []; const sleeps = [];
  ADAPTERS.gemini = async batch => { calls.push(batch); return { vectors: batch.map(text => vector(Number(text.match(/(\d+)$/)[1]))), usage: { inputTokens: null } }; };
  try {
    const result = await managed('gemini', inputs, { sleep: async delay => sleeps.push(delay) });
    expect(calls).toHaveLength(8); expect(result.vectors).toHaveLength(229); expect(result.vectors[0][0]).toBe(1); expect(result.vectors[228][0]).toBe(229); expect(sleeps).toEqual(Array(7).fill(GEMINI_INTER_BATCH_PACING_MS));
  } finally { ADAPTERS.gemini = original; }
});

test('retries only a failed current Gemini batch and preserves earlier batch work', async () => {
  const original = ADAPTERS.gemini; const calls = []; const sleeps = []; let failed = false;
  ADAPTERS.gemini = async batch => { calls.push(batch); if (calls.length === 2 && !failed) { failed = true; const error = new Error('rate limited'); error.status = 429; throw error; } return { vectors: batch.map(() => vector(1)), usage: { inputTokens: null } }; };
  try {
    const result = await managed('gemini', inputs, { sleep: async delay => sleeps.push(delay) });
    expect(result.usage.retryEvents).toEqual([expect.objectContaining({ batchIndex: 2, errorCategory: 'http_429', outcome: 'retrying' })]); expect(calls).toHaveLength(9); expect(calls[0]).toEqual(inputs.slice(0, 32)); expect(calls[1]).toEqual(inputs.slice(32, 64)); expect(calls[2]).toEqual(inputs.slice(32, 64));
  } finally { ADAPTERS.gemini = original; }
});

test('rejects malformed Gemini counts and dimensions', async () => {
  const original = ADAPTERS.gemini;
  ADAPTERS.gemini = async () => ({ vectors: [], usage: { inputTokens: null } });
  await expect(managed('gemini', inputs, { sleep: async () => {} })).rejects.toThrow(/embedding count/);
  ADAPTERS.gemini = async batch => ({ vectors: batch.map(() => [1]), usage: { inputTokens: null } });
  await expect(managed('gemini', inputs, { sleep: async () => {} })).rejects.toThrow(/embedding dimension/);
  ADAPTERS.gemini = original;
});
