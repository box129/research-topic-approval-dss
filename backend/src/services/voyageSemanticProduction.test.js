const { serialize, sourceHash } = require('./topicSemanticRepresentation.service');
const { embedQuery, embedDocument, validStoredEmbedding, documentMetadata } = require('./voyageEmbedding.service');
const { cosine, classify, retrieve, T1, T2 } = require('./voyageSemanticSimilarity.service');
const vector = Array(1024).fill(0).map((_, index) => index === 0 ? 1 : 0);
const topic = { id:1, title:'  Malaria prevention ', population:' Students ', location:' ', studyFocus:' Awareness ' };
function response(body, ok=true, status=200) { return { ok, status, json:async()=>body }; }
describe('Voyage semantic production contract', () => {
  test('serializes structured context deterministically without unrelated fields', () => { expect(serialize({...topic,email:'a@b',studentId:'x'})).toBe('Title: Malaria prevention\nPopulation: Students\nStudy focus: Awareness'); });
  test('uses query/document input types and safe semantic-only payload', async () => { let payload; await embedQuery(topic,{env:{VOYAGE_API_KEY:'test'},fetchImpl:async(_,options)=>{payload=JSON.parse(options.body);return response({data:[{embedding:vector}]});}}); expect(payload).toEqual({model:'voyage-4-large',input:['Title: Malaria prevention\nPopulation: Students\nStudy focus: Awareness'],input_type:'query',output_dtype:'float'}); await embedDocument(topic,{env:{VOYAGE_API_KEY:'test'},fetchImpl:async(_,options)=>{expect(JSON.parse(options.body).input_type).toBe('document');return response({data:[{embedding:vector}]});}}); });
  test('rejects malformed provider values and no fake fallback exists', async () => { await expect(embedQuery(topic,{env:{VOYAGE_API_KEY:'test'},fetchImpl:async()=>response({data:[{embedding:[1]}]})})).rejects.toThrow('malformed'); await expect(embedQuery(topic,{env:{},fetchImpl:jest.fn()})).rejects.toThrow('not configured'); });
  test('normalizes a successful non-JSON provider response into a provider error', async () => {
    const invalidJsonResponse = { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };

    await expect(embedQuery(topic, {
      env: { VOYAGE_API_KEY: 'test' },
      fetchImpl: async () => invalidJsonResponse
    })).rejects.toMatchObject({
      name: 'VoyageProviderError',
      code: 'VOYAGE_PROVIDER_ERROR',
      message: 'Voyage returned malformed embedding data.'
    });
  });
  test('normalizes a fetch transport rejection into VoyageProviderError without a vector', async () => { await expect(embedQuery(topic,{env:{VOYAGE_API_KEY:'test'},fetchImpl:async()=>{throw new TypeError('network reset');}})).rejects.toBeInstanceOf(require('./voyageEmbedding.service').VoyageProviderError); });
  test('aborts a hung Voyage request and exposes only the semantic-unavailable timeout category', async () => {
    const fetchImpl = jest.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      }, { once: true });
    }));

    await expect(embedQuery(topic, {
      env: { VOYAGE_API_KEY: 'test' },
      fetchImpl,
      timeoutMs: 5
    })).rejects.toMatchObject({
      name: 'VoyageProviderError',
      code: 'VOYAGE_TIMEOUT',
      message: 'Voyage embedding request timed out.'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  test('validates every persisted identity and reuses only valid 1024D Voyage vector', () => { const stored={...topic,...documentMetadata(topic,vector)}; expect(validStoredEmbedding(stored)).toBe(true); expect(validStoredEmbedding({...stored,embeddingModel:'other'})).toBe(false); expect(validStoredEmbedding({...stored,embeddingDimension:384})).toBe(false); expect(validStoredEmbedding({...stored,embeddingSourceHash:sourceHash({...topic,title:'Changed'})})).toBe(false); expect(retrieve(vector,[stored],5)).toHaveLength(1); });
  test('uses raw cosine and C1.5 full-precision boundary rules', () => {
    expect(cosine([1,0],[-1,0])).toBe(-1);
    expect(classify(T1 - Number.EPSILON)).toBe('LOW');
    expect(classify(T1)).toBe('MEDIUM'); expect(classify(T1 + Number.EPSILON)).toBe('MEDIUM');
    expect(classify(T2 - Number.EPSILON)).toBe('MEDIUM');
    expect(classify(T2)).toBe('HIGH'); expect(classify(T2 + Number.EPSILON)).toBe('HIGH');
    expect(classify(0.553)).toBe('LOW'); // C1.5, not the superseded C1.4 boundary.
  });
});
