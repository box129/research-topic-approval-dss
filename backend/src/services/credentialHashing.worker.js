const { parentPort } = require('worker_threads');
const bcrypt = require('bcryptjs');

// Hashes one credential per message. Receives only the plaintext to hash and
// the cost factor; posts back the bcrypt hash. Nothing is logged or persisted.
parentPort.on('message', async ({ jobId, password, cost }) => {
  try {
    const hash = await bcrypt.hash(password, cost);
    parentPort.postMessage({ jobId, hash });
  } catch (error) {
    parentPort.postMessage({ jobId, error: error.message || 'hashing failed' });
  }
});
