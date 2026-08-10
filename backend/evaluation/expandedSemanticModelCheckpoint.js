const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CHECKPOINT_SCHEMA_VERSION = 1;
const REPRESENTATION_ID = 'structured-context-v1';
const CHECKPOINT_DIR = path.join(os.tmpdir(), 'topic-similarity-semantic-eval-checkpoints');
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const inputHashes = inputs => inputs.map(digest);

function identityFor({ benchmarkSha256, canonicalInputs, provider, model, configuration, dimension }) {
  return { schemaVersion: CHECKPOINT_SCHEMA_VERSION, benchmarkSha256, canonicalInputSha256: digest(canonicalInputs), representation: REPRESENTATION_ID, provider, model, configuration, dimension, uniqueInputCount: canonicalInputs.length };
}

function checkpointPath(identity) { return path.join(CHECKPOINT_DIR, `${identity.provider}-${digest(identity)}.json`); }
function normalizedKey(key) { return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function secretFree(value) {
  const forbiddenKey = /^(apikey|authorization|cookie|setcookie|accesstoken|refreshtoken|idtoken|authtoken|clientsecret|password|secret|bearer)$/;
  if (Array.isArray(value)) return value.every(secretFree);
  if (value && typeof value === 'object') return Object.entries(value).every(([key, child]) => !forbiddenKey.test(normalizedKey(key)) && secretFree(child));
  return typeof value !== 'string' || !/(bearer\s|sk-[a-z0-9]|AIza-|pa-[a-z0-9])/i.test(value);
}

function normalizeUsage(usage) {
  if (usage === null || usage === undefined) return null;
  const allowed = new Set(['inputTokens', 'outputTokens', 'totalTokens', 'requestCount', 'successfulRequests']);
  if (!usage || typeof usage !== 'object' || Array.isArray(usage) || !secretFree(usage)) throw new Error('Unsafe checkpoint usage metadata.');
  const normalized = {};
  for (const [key, value] of Object.entries(usage)) {
    if (!allowed.has(key) || !Number.isFinite(value)) throw new Error('Unsafe checkpoint usage metadata.');
    normalized[key] = value;
  }
  return normalized;
}

function validatePayload(payload, identity, canonicalInputs) {
  if (!payload || payload.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) return 'schema_version';
  if (JSON.stringify(payload.identity) !== JSON.stringify(identity)) return 'identity';
  if (!Array.isArray(payload.inputHashes) || JSON.stringify(payload.inputHashes) !== JSON.stringify(inputHashes(canonicalInputs))) return 'input_mapping';
  if (!Array.isArray(payload.vectors) || payload.vectors.length !== canonicalInputs.length || payload.vectors.length !== identity.uniqueInputCount) return 'vector_count';
  if (payload.vectors.some(vector => !Array.isArray(vector) || vector.length !== identity.dimension || !vector.every(Number.isFinite))) return 'vector_integrity';
  if (!secretFree(payload)) return 'secret_material';
  try { normalizeUsage(payload.usage); } catch { return 'usage_metadata'; }
  return null;
}

function saveCheckpoint(identity, canonicalInputs, vectors, { usage = null, runtime = null, retryEvents = [] } = {}) {
  const payload = { schemaVersion: CHECKPOINT_SCHEMA_VERSION, createdAt: new Date().toISOString(), identity, inputHashes: inputHashes(canonicalInputs), vectors, usage: normalizeUsage(usage), runtime, retryEvents };
  const reason = validatePayload(payload, identity, canonicalInputs);
  if (reason) throw new Error(`Refusing to save invalid checkpoint: ${reason}`);
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const target = checkpointPath(identity); const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(payload));
  fs.renameSync(temporary, target);
  return { path: target, createdAt: payload.createdAt };
}

function loadCheckpoint(identity, canonicalInputs) {
  const target = checkpointPath(identity);
  if (!fs.existsSync(target)) return { valid: false, reason: 'missing' };
  try {
    const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
    const reason = validatePayload(payload, identity, canonicalInputs);
    return reason ? { valid: false, reason } : { valid: true, payload };
  } catch { return { valid: false, reason: 'malformed_file' }; }
}

module.exports = { CHECKPOINT_SCHEMA_VERSION, REPRESENTATION_ID, CHECKPOINT_DIR, digest, inputHashes, identityFor, checkpointPath, validatePayload, saveCheckpoint, loadCheckpoint, secretFree, normalizeUsage };
