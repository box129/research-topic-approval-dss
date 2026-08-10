const PROVIDERS = {
  openai: { name: 'OpenAI', model: 'text-embedding-3-large', keyEnv: 'OPENAI_API_KEY', pricePerMillionTokens: 0.13 },
  voyage: { name: 'Voyage AI', model: 'voyage-4-large', keyEnv: 'VOYAGE_API_KEY', pricePerMillionTokens: 0.12 },
  gemini: { name: 'Google Gemini', model: 'gemini-embedding-2', keyEnv: 'GEMINI_API_KEY', pricePerMillionTokens: 0.20 }
};

function requireKey(name, env = process.env) {
  if (!env[name]) throw new Error(`${name} is required for this evaluation.`);
  return env[name];
}

function finiteVector(value, provider) {
  if (!Array.isArray(value) || !value.length || !value.every(Number.isFinite)) throw new Error(`${provider} returned a malformed embedding response.`);
  return value;
}

async function requestJson(url, options, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Provider HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function embedOpenAI(texts, { env = process.env, fetchImpl = fetch } = {}) {
  const key = requireKey('OPENAI_API_KEY', env);
  const body = await requestJson('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: PROVIDERS.openai.model, input: texts, encoding_format: 'float' }) }, fetchImpl);
  const data = body?.data;
  if (!Array.isArray(data) || data.length !== texts.length) throw new Error('OpenAI returned a malformed embedding response.');
  return { vectors: data.sort((a, b) => a.index - b.index).map(item => finiteVector(item?.embedding, 'OpenAI')), usage: { inputTokens: body?.usage?.prompt_tokens ?? null, raw: body?.usage || null } };
}

async function embedVoyage(texts, { env = process.env, fetchImpl = fetch } = {}) {
  const key = requireKey('VOYAGE_API_KEY', env);
  const body = await requestJson('https://api.voyageai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: PROVIDERS.voyage.model, input: texts, input_type: null, output_dtype: 'float' }) }, fetchImpl);
  if (!Array.isArray(body?.data) || body.data.length !== texts.length) throw new Error('Voyage returned a malformed embedding response.');
  return { vectors: body.data.sort((a, b) => a.index - b.index).map(item => finiteVector(item?.embedding, 'Voyage')), usage: { inputTokens: body?.usage?.total_tokens ?? body?.total_tokens ?? null, raw: body?.usage || (body?.total_tokens === undefined ? null : { total_tokens: body.total_tokens }) } };
}

function geminiInstruction(text) { return `task: sentence similarity | query: ${text}`; }

async function embedGemini(texts, { env = process.env, fetchImpl = fetch } = {}) {
  const key = requireKey('GEMINI_API_KEY', env);
  const vectors = [];
  const usages = [];
  for (const text of texts) {
    const body = await requestJson('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent', { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: { parts: [{ text: geminiInstruction(text) }] } }) }, fetchImpl);
    vectors.push(finiteVector(body?.embedding?.values, 'Gemini'));
    usages.push(body?.usageMetadata || null);
  }
  const knownTokens = usages.reduce((sum, usage) => sum + (Number.isFinite(usage?.promptTokenCount) ? usage.promptTokenCount : 0), 0);
  return { vectors, usage: { inputTokens: usages.every(Boolean) ? knownTokens : null, raw: usages } };
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) throw new Error('Cosine vectors must be equal-length arrays.');
  let dot = 0; let aMagnitude = 0; let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; aMagnitude += a[index] ** 2; bMagnitude += b[index] ** 2; }
  if (!aMagnitude || !bMagnitude) throw new Error('Cosine vectors must be non-zero.');
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

const ADAPTERS = { openai: embedOpenAI, voyage: embedVoyage, gemini: embedGemini };
module.exports = { PROVIDERS, requireKey, finiteVector, requestJson, embedOpenAI, embedVoyage, embedGemini, geminiInstruction, cosineSimilarity, ADAPTERS };
