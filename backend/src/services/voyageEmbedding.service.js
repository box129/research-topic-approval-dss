const { serialize, REPRESENTATION_ID, sourceHash } = require('./topicSemanticRepresentation.service');
const config = require('../config/env');
const MODEL = 'voyage-4-large'; const DIMENSION = 1024;
class VoyageProviderError extends Error {
  constructor(message, status, code = 'VOYAGE_PROVIDER_ERROR') {
    super(message);
    this.name = 'VoyageProviderError';
    this.status = status;
    this.code = code;
  }
}
function validVector(vector) { return Array.isArray(vector) && vector.length === DIMENSION && vector.every(Number.isFinite); }
function timeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

async function embed(topic, inputType, {
  fetchImpl = fetch,
  env = process.env,
  timeoutMs = config.voyage.requestTimeoutMs
} = {}) {
  if (!env.VOYAGE_API_KEY) throw new VoyageProviderError('Voyage semantic service is not configured.');
  const signal = timeoutSignal(timeoutMs);
  let response;
  try {
    response = await fetchImpl('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        input: [serialize(topic)],
        input_type: inputType,
        output_dtype: 'float'
      }),
      signal
    });
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError') {
      throw new VoyageProviderError('Voyage embedding request timed out.', undefined, 'VOYAGE_TIMEOUT');
    }
    throw new VoyageProviderError('Voyage embedding request could not be completed.', error?.status);
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError') {
      throw new VoyageProviderError('Voyage embedding request timed out.', undefined, 'VOYAGE_TIMEOUT');
    }
    body = null;
  }
  if (!response.ok) throw new VoyageProviderError(`Voyage embedding request failed (${response.status}).`, response.status);
  const embeddings = body?.data;
  const vector = embeddings?.[0]?.embedding;
  if (!Array.isArray(embeddings) || !validVector(vector) || embeddings.length !== 1) {
    throw new VoyageProviderError('Voyage returned malformed embedding data.');
  }
  return vector;
}
function validStoredEmbedding(topic) { return validVector(topic.embedding) && topic.embeddingProvider === 'voyage' && topic.embeddingModel === MODEL && topic.embeddingDimension === DIMENSION && topic.embeddingRepresentation === REPRESENTATION_ID && topic.embeddingSourceHash === sourceHash(topic); }
function documentMetadata(topic, embedding) { return { embedding, embeddingProvider: 'voyage', embeddingModel: MODEL, embeddingDimension: DIMENSION, embeddingRepresentation: REPRESENTATION_ID, embeddingSourceHash: sourceHash(topic), embeddedAt: new Date() }; }
module.exports = { MODEL, DIMENSION, REPRESENTATION_ID, VoyageProviderError, embedQuery: (topic, options) => embed(topic, 'query', options), embedDocument: (topic, options) => embed(topic, 'document', options), validStoredEmbedding, documentMetadata, validVector, timeoutSignal };
