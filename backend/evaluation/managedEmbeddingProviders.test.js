const { requireKey, embedOpenAI, embedVoyage, embedGemini, geminiInstruction, cosineSimilarity } = require('./managedEmbeddingProviders');
const { formatStructuredContext } = require('./sbertInputRepresentation.helpers');

const response = body => ({ ok: true, json: async () => body });
describe('managed embedding evaluation adapters', () => {
  test('reuses structured formatter without metadata leakage', () => expect(formatStructuredContext({ title: 'Topic', population: 'Adults', tags: ['secret'], expected_class: 'HIGH' })).toBe('Title: Topic\nPopulation: Adults'));
  test('requires missing keys without exposing any value', () => expect(() => requireKey('OPENAI_API_KEY', {})).toThrow('OPENAI_API_KEY is required'));
  test('parses OpenAI indexed embeddings and usage', async () => expect(await embedOpenAI(['a', 'b'], { env: { OPENAI_API_KEY: 'test' }, fetchImpl: async () => response({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }], usage: { prompt_tokens: 3 } }) })).toEqual({ vectors: [[1, 0], [0, 1]], usage: { inputTokens: 3, raw: { prompt_tokens: 3 } } }));
  test('parses Voyage response with null input_type', async () => { let request; const result = await embedVoyage(['a'], { env: { VOYAGE_API_KEY: 'test' }, fetchImpl: async (_, options) => { request = JSON.parse(options.body); return response({ data: [{ index: 0, embedding: [1, 0] }], total_tokens: 2 }); } }); expect(request.input_type).toBeNull(); expect(result.usage.inputTokens).toBe(2); });
  test('parses Gemini values using symmetric instruction for each side', async () => { let body; const result = await embedGemini(['a'], { env: { GEMINI_API_KEY: 'test' }, fetchImpl: async (_, options) => { body = JSON.parse(options.body); return response({ embedding: { values: [1, 0] } }); } }); expect(body.content.parts[0].text).toBe(geminiInstruction('a')); expect(result.vectors).toEqual([[1, 0]]); });
  test('rejects malformed responses and computes cosine', async () => { await expect(embedOpenAI(['a'], { env: { OPENAI_API_KEY: 'test' }, fetchImpl: async () => response({ data: [] }) })).rejects.toThrow('malformed'); expect(cosineSimilarity([1, 0], [0, 1])).toBe(0); });
  test('surfaces sanitized provider HTTP errors', async () => await expect(embedVoyage(['a'], { env: { VOYAGE_API_KEY: 'test' }, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) })).rejects.toThrow('HTTP 429'));
});
