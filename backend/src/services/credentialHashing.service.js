const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

// bcryptjs is pure JavaScript, so hashing runs on the invoking thread. At the
// production cost factor a single hash takes on the order of a second, which
// makes serially hashing a ~650-account cohort impractical and would occupy
// the event loop. Bulk onboarding therefore pre-computes hashes in a small
// worker_threads pool: real parallelism across cores, bounded so a large
// cohort cannot saturate the host, and no reduction of the bcrypt cost.
const PRODUCTION_BCRYPT_COST = 12;
const MAX_POOL_SIZE = 8;
const WORKER_SCRIPT = path.join(__dirname, 'credentialHashing.worker.js');

function resolvePoolSize(requested) {
  const fromEnv = Number.parseInt(process.env.BULK_HASH_CONCURRENCY || '', 10);
  const candidate = Number.isInteger(requested) && requested > 0
    ? requested
    : (Number.isInteger(fromEnv) && fromEnv > 0
      ? fromEnv
      : Math.max(1, Math.min(os.cpus().length - 2, 6)));

  return Math.max(1, Math.min(candidate, MAX_POOL_SIZE));
}

function hashWithWorkerPool(passwords, cost, poolSize) {
  // Lazily required so environments without worker_threads fall back cleanly.
  const { Worker } = require('worker_threads');

  return new Promise((resolve, reject) => {
    const hashes = new Array(passwords.length);
    const workers = [];
    let nextJob = 0;
    let completed = 0;
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      for (const worker of workers) {
        worker.terminate().catch(() => {});
      }
      if (error) {
        reject(error);
      } else {
        resolve(hashes);
      }
    };

    const assignJob = (worker) => {
      if (settled) {
        return;
      }
      if (nextJob >= passwords.length) {
        return;
      }
      const jobId = nextJob;
      nextJob += 1;
      worker.postMessage({ jobId, password: passwords[jobId], cost });
    };

    for (let index = 0; index < poolSize; index += 1) {
      let worker;
      try {
        worker = new Worker(WORKER_SCRIPT);
      } catch (error) {
        finish(error);
        return;
      }

      worker.on('message', ({ jobId, hash, error }) => {
        if (error) {
          finish(new Error(error));
          return;
        }
        hashes[jobId] = hash;
        completed += 1;
        if (completed === passwords.length) {
          finish(null);
          return;
        }
        assignJob(worker);
      });
      worker.on('error', (error) => finish(error));
      workers.push(worker);
    }

    for (const worker of workers) {
      assignJob(worker);
    }
  });
}

async function hashSequentially(passwords, cost) {
  const hashes = [];
  for (const password of passwords) {
    // eslint-disable-next-line no-await-in-loop
    hashes.push(await bcrypt.hash(password, cost));
  }
  return hashes;
}

/**
 * Hashes an array of plaintext credentials with bcrypt at the production cost
 * factor using a bounded worker pool. Order of results matches the input.
 * Falls back to in-process sequential hashing if workers cannot be started.
 */
async function hashPasswordsBounded(passwords, { cost = PRODUCTION_BCRYPT_COST, concurrency } = {}) {
  if (!Array.isArray(passwords)) {
    throw new TypeError('passwords must be an array');
  }
  if (passwords.length === 0) {
    return [];
  }

  const poolSize = Math.min(resolvePoolSize(concurrency), passwords.length);
  try {
    return await hashWithWorkerPool(passwords, cost, poolSize);
  } catch {
    return hashSequentially(passwords, cost);
  }
}

module.exports = {
  hashPasswordsBounded,
  resolvePoolSize,
  PRODUCTION_BCRYPT_COST
};
