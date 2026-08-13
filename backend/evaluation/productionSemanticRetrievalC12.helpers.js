const fs = require('fs');

function limiter({ maxRequests, maxTokens, windowMs = 60000, now = () => Date.now() }) {
  const attempts = [];

  function prune() {
    const current = now();
    while (attempts.length && attempts[0].at <= current - windowMs) attempts.shift();
  }

  function usage() {
    prune();
    return { requests: attempts.length, tokens: attempts.reduce((sum, item) => sum + item.tokens, 0) };
  }

  function waitMs(tokens) {
    prune();
    if (tokens > maxTokens) return Infinity;
    const current = now();
    let requests = attempts.length;
    let usedTokens = attempts.reduce((sum, item) => sum + item.tokens, 0);
    if (requests < maxRequests && usedTokens + tokens <= maxTokens) return 0;
    for (const item of attempts) {
      requests -= 1;
      usedTokens -= item.tokens;
      if (requests < maxRequests && usedTokens + tokens <= maxTokens) return item.at + windowMs - current + 1;
    }
    return Infinity;
  }

  return {
    admit(tokens) {
      if (waitMs(tokens) !== 0) return false;
      attempts.push({ at: now(), tokens });
      return true;
    },
    usage,
    waitMs
  };
}

function identity(entry) {
  return [entry.provider, entry.model, entry.dimension, entry.dtype, entry.role,
    entry.representationId, entry.configurationId, entry.sourceHash, entry.canonicalTopicId].join('|');
}

function safeEntries(entries) {
  return entries.every(entry => !Object.keys(entry).some(key => /key|authorization|cookie|jwt|password/i.test(key)));
}

function atomicWrite(file, value, { fsOps = fs } = {}) {
  const temporary = `${file}.tmp`;
  fsOps.writeFileSync(temporary, JSON.stringify(value));
  try {
    fsOps.renameSync(temporary, file);
  } catch (error) {
    try { fsOps.unlinkSync(temporary); } catch (_) { /* best-effort cleanup */ }
    throw error;
  }
}

function loadCheckpoint(file) {
  if (!fs.existsSync(file)) return { entries: [] };
  const value = JSON.parse(fs.readFileSync(file));
  if (!Array.isArray(value.entries) || !safeEntries(value.entries)) throw new Error('Malformed or unsafe checkpoint');
  return value;
}

function valid(entry, expected) {
  return identity(entry) === identity(expected)
    && Array.isArray(entry.embedding)
    && entry.embedding.length === expected.dimension
    && entry.embedding.every(Number.isFinite);
}

function missing(expected, checkpoint) {
  return expected.filter(item => !checkpoint.entries.some(entry => valid(entry, item)));
}

function validateBatch(vectors, expectedDimension, count) {
  if (!Array.isArray(vectors) || vectors.length !== count) throw new Error('Batch response count mismatch');
  if (vectors.some(vector => !Array.isArray(vector) || vector.length !== expectedDimension || vector.some(value => !Number.isFinite(value)))) {
    throw new Error('Invalid returned embedding');
  }
  return vectors;
}

function retryable(error) {
  return !error.dailyQuota && ([429, 500, 502, 503].includes(error.status)
    || ['ETIMEDOUT', 'ECONNRESET', 'ETEMPORARY'].includes(error.code));
}

async function execute({ items, expectedDimension, checkpoint, limit, transport, write, now = () => Date.now(), sleep = async () => {}, jitter = () => 0 }) {
  const state = { entries: [...checkpoint.entries] };
  const completed = [];
  for (const batch of items) {
    const tokens = batch.reduce((sum, item) => sum + item.estimatedTokens, 0);
    let result;
    let attempt = 0;
    for (;;) {
      const wait = limit.waitMs(tokens);
      if (wait === Infinity) throw new Error('Batch exceeds rolling token ceiling.');
      if (wait > 0) { await sleep(wait); continue; }
      limit.admit(tokens);
      try {
        result = await transport(batch, attempt);
        validateBatch(result, expectedDimension, batch.length);
        break;
      } catch (error) {
        if (!retryable(error) || attempt >= 5) return { status: 'VALIDATION_INCOMPLETE', checkpoint: state, completed, error };
        const delay = (error.retryAfter ?? Math.min(60, 5 * 2 ** attempt)) + jitter(attempt);
        attempt += 1;
        await sleep(delay);
      }
    }
    batch.forEach((item, index) => state.entries.push({ ...item, embedding: result[index], completedAt: now() }));
    try { write(state); } catch (error) { return { status: 'CHECKPOINT_PERSISTENCE_FAILURE', checkpoint: state, completed, error }; }
    completed.push(batch.length);
  }
  return { status: 'COMPLETE', checkpoint: state, completed };
}

module.exports = { limiter, identity, safeEntries, atomicWrite, loadCheckpoint, valid, missing, validateBatch, retryable, execute };
