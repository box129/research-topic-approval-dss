const { serialize, REPRESENTATION_ID, sourceHash } = require('./topicSemanticRepresentation.service');
const MODEL = 'voyage-4-large'; const DIMENSION = 1024;
class VoyageProviderError extends Error { constructor(message, status) { super(message); this.status = status; } }
function validVector(vector) { return Array.isArray(vector) && vector.length === DIMENSION && vector.every(Number.isFinite); }
async function embed(topic, inputType, { fetchImpl = fetch, env = process.env } = {}) {
  if (!env.VOYAGE_API_KEY) throw new VoyageProviderError('Voyage semantic service is not configured.');
  let response;
  try {
    response = await fetchImpl('https://api.voyageai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, input: [serialize(topic)], input_type: inputType, output_dtype: 'float' }) });
  } catch (error) {
    throw new VoyageProviderError('Voyage embedding request could not be completed.', error?.status);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new VoyageProviderError(`Voyage embedding request failed (${response.status}).`, response.status);
  const vector = body?.data?.[0]?.embedding;
  if (!validVector(vector) || body.data.length !== 1) throw new VoyageProviderError('Voyage returned malformed embedding data.');
  return vector;
}
function validStoredEmbedding(topic) { return validVector(topic.embedding) && topic.embeddingProvider === 'voyage' && topic.embeddingModel === MODEL && topic.embeddingDimension === DIMENSION && topic.embeddingRepresentation === REPRESENTATION_ID && topic.embeddingSourceHash === sourceHash(topic); }
function documentMetadata(topic, embedding) { return { embedding, embeddingProvider: 'voyage', embeddingModel: MODEL, embeddingDimension: DIMENSION, embeddingRepresentation: REPRESENTATION_ID, embeddingSourceHash: sourceHash(topic), embeddedAt: new Date() }; }
module.exports = { MODEL, DIMENSION, REPRESENTATION_ID, VoyageProviderError, embedQuery: (topic, options) => embed(topic, 'query', options), embedDocument: (topic, options) => embed(topic, 'document', options), validStoredEmbedding, documentMetadata, validVector };
