const os = require('os');
const fs = require('fs');
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

/**
 * Counts distinct physical cores from the Linux CPU topology.
 *
 * bcrypt is CPU- and memory-hard, so hyperthread siblings contend for the same
 * execution units instead of adding throughput. `os.cpus()` reports LOGICAL
 * processors, so sizing the pool from it oversubscribes a hyperthreaded host.
 * Measured on a 4-core/8-thread container host at cost 12, throughput peaked at
 * one worker per physical core and fell about 24% at 6 workers and 30% at 8.
 *
 * Returns null when the topology is unavailable (non-Linux, or a kernel that
 * does not publish the fields), so the caller can fall back safely.
 */
function readPhysicalCoreCount(readFileSync = fs.readFileSync) {
  try {
    const blocks = String(readFileSync('/proc/cpuinfo', 'utf8')).split(/\n\s*\n/);
    const cores = new Set();
    for (const block of blocks) {
      const physicalId = (block.match(/^physical id\s*:\s*(\S+)/m) || [])[1];
      const coreId = (block.match(/^core id\s*:\s*(\S+)/m) || [])[1];
      if (physicalId !== undefined && coreId !== undefined) {
        cores.add(`${physicalId}/${coreId}`);
      }
    }
    return cores.size > 0 ? cores.size : null;
  } catch {
    return null;
  }
}

/**
 * Reads the container's effective CPU quota in whole CPUs.
 *
 * The CPU topology describes the HOST. A hosted platform commonly caps a
 * container well below that, and starting one bcrypt worker per host core
 * inside a one-CPU container simply thrashes. Returns null when the cgroup
 * reports no quota.
 */
function readCpuQuota(readFileSync = fs.readFileSync) {
  const toWholeCpus = (quota, period) => {
    const cpus = Number(quota) / Number(period);
    if (!Number.isFinite(cpus) || cpus <= 0) {
      return null;
    }
    // A fractional allowance (hosted platforms commonly grant 0.5 CPU) still
    // means one worker, never the host's core count.
    return Math.max(1, Math.floor(cpus));
  };

  try {
    const [quota, period] = String(readFileSync('/sys/fs/cgroup/cpu.max', 'utf8')).trim().split(/\s+/);
    if (quota && quota !== 'max' && period) {
      return toWholeCpus(quota, period);
    }
    return null;
  } catch {
    // Not cgroup v2; fall through to the v1 layout.
  }

  try {
    const quota = String(readFileSync('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', 'utf8')).trim();
    const period = String(readFileSync('/sys/fs/cgroup/cpu/cpu.cfs_period_us', 'utf8')).trim();
    if (Number(quota) > 0 && Number(period) > 0) {
      return toWholeCpus(quota, period);
    }
  } catch {
    // No readable CPU quota.
  }

  return null;
}

function defaultPoolSize({ cpuCount, physicalCores, cpuQuota }) {
  const logical = Math.max(1, cpuCount());
  const physical = physicalCores();
  // When topology is unavailable, assume the common hyperthreaded ratio rather
  // than treating every logical processor as an independent core.
  const cores = Number.isInteger(physical) && physical > 0
    ? physical
    : Math.max(1, Math.floor(logical / 2));
  const quota = cpuQuota();
  const budget = Number.isInteger(quota) && quota > 0 ? Math.min(cores, quota) : cores;
  return Math.max(1, Math.min(budget, MAX_POOL_SIZE));
}

function resolvePoolSize(requested, overrides = {}) {
  const deps = {
    cpuCount: () => os.cpus().length,
    physicalCores: () => readPhysicalCoreCount(),
    cpuQuota: () => readCpuQuota(),
    env: process.env,
    ...overrides
  };

  // An explicit caller argument, then the reviewed deployment setting, then the
  // measured-hardware default. Deployments should still set
  // BULK_HASH_CONCURRENCY explicitly once the target host has been measured.
  const fromEnv = Number.parseInt(deps.env.BULK_HASH_CONCURRENCY || '', 10);
  const candidate = Number.isInteger(requested) && requested > 0
    ? requested
    : (Number.isInteger(fromEnv) && fromEnv > 0
      ? fromEnv
      : defaultPoolSize(deps));

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
  readPhysicalCoreCount,
  readCpuQuota,
  PRODUCTION_BCRYPT_COST,
  MAX_POOL_SIZE
};
