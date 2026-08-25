const bcrypt = require('bcryptjs');
const {
  hashPasswordsBounded,
  resolvePoolSize,
  PRODUCTION_BCRYPT_COST
} = require('./credentialHashing.service');

describe('credentialHashing.service', () => {
  test('production cost factor stays at the Phase-2 bcrypt strength', () => {
    expect(PRODUCTION_BCRYPT_COST).toBe(12);
  });

  test('hashes a batch in workers, preserving order and verifiability', async () => {
    const passwords = ['Alpha1234Alpha12', 'Bravo1234Bravo12', 'Charlie123Charl1', 'Delta1234Delta12', 'Echo12345Echo123'];
    const hashes = await hashPasswordsBounded(passwords, { cost: 4, concurrency: 2 });

    expect(hashes).toHaveLength(passwords.length);
    for (const [index, password] of passwords.entries()) {
      expect(hashes[index]).toMatch(/^\$2/);
      expect(hashes[index]).not.toBe(password);
      expect(await bcrypt.compare(password, hashes[index])).toBe(true);
      // A different credential must not verify against this hash.
      expect(await bcrypt.compare(passwords[(index + 1) % passwords.length], hashes[index])).toBe(false);
    }
  }, 30000);

  test('returns an empty array for an empty batch and rejects non-arrays', async () => {
    await expect(hashPasswordsBounded([])).resolves.toEqual([]);
    await expect(hashPasswordsBounded('nope')).rejects.toThrow(TypeError);
  });

  test('pool size is always bounded between 1 and 8', () => {
    expect(resolvePoolSize(0)).toBeGreaterThanOrEqual(1);
    expect(resolvePoolSize(999)).toBeLessThanOrEqual(8);
    expect(resolvePoolSize(3)).toBe(3);
    expect(resolvePoolSize()).toBeGreaterThanOrEqual(1);
    expect(resolvePoolSize()).toBeLessThanOrEqual(8);
  });

  test('sizes the default pool to physical cores, not hyperthreads', () => {
    // A 4-core / 8-thread host: one worker per physical core, never per thread.
    const size = resolvePoolSize(undefined, {
      env: {},
      cpuCount: () => 8,
      physicalCores: () => 4,
      cpuQuota: () => null
    });
    expect(size).toBe(4);
  });

  test('assumes hyperthreading when CPU topology is unavailable', () => {
    const size = resolvePoolSize(undefined, {
      env: {},
      cpuCount: () => 8,
      physicalCores: () => null,
      cpuQuota: () => null
    });
    expect(size).toBe(4);
  });

  test('never exceeds the container CPU quota, whatever the host reports', () => {
    // The host has 16 physical cores but the container is capped at 2 CPUs.
    const size = resolvePoolSize(undefined, {
      env: {},
      cpuCount: () => 32,
      physicalCores: () => 16,
      cpuQuota: () => 2
    });
    expect(size).toBe(2);
  });

  test('always yields at least one worker on a single-CPU container', () => {
    const size = resolvePoolSize(undefined, {
      env: {},
      cpuCount: () => 1,
      physicalCores: () => 1,
      cpuQuota: () => 1
    });
    expect(size).toBe(1);
  });

  test('keeps the reviewed deployment override authoritative over detection', () => {
    const size = resolvePoolSize(undefined, {
      env: { BULK_HASH_CONCURRENCY: '3' },
      cpuCount: () => 32,
      physicalCores: () => 16,
      cpuQuota: () => null
    });
    expect(size).toBe(3);
  });

  test('reads physical cores and CPU quota defensively', () => {
    const { readPhysicalCoreCount, readCpuQuota } = require('./credentialHashing.service');

    const cpuinfo = [
      'processor\t: 0\nphysical id\t: 0\ncore id\t\t: 0',
      'processor\t: 1\nphysical id\t: 0\ncore id\t\t: 0',
      'processor\t: 2\nphysical id\t: 0\ncore id\t\t: 1',
      'processor\t: 3\nphysical id\t: 0\ncore id\t\t: 1'
    ].join('\n\n');
    expect(readPhysicalCoreCount(() => cpuinfo)).toBe(2);
    // Unreadable or topology-free input must not throw; it returns null so the
    // caller falls back rather than guessing.
    expect(readPhysicalCoreCount(() => { throw new Error('no /proc'); })).toBeNull();
    expect(readPhysicalCoreCount(() => 'processor\t: 0')).toBeNull();

    expect(readCpuQuota(() => '200000 100000')).toBe(2);
    expect(readCpuQuota(() => 'max 100000')).toBeNull();
    expect(readCpuQuota(() => { throw new Error('no cgroup'); })).toBeNull();
    // A fractional hosted allowance must still mean one worker, not the host's
    // core count.
    expect(readCpuQuota(() => '50000 100000')).toBe(1);
  });

  test('honours the BULK_HASH_CONCURRENCY environment override within bounds', () => {
    const previous = process.env.BULK_HASH_CONCURRENCY;
    try {
      process.env.BULK_HASH_CONCURRENCY = '2';
      expect(resolvePoolSize()).toBe(2);
      process.env.BULK_HASH_CONCURRENCY = '99';
      expect(resolvePoolSize()).toBe(8);
    } finally {
      if (previous === undefined) {
        delete process.env.BULK_HASH_CONCURRENCY;
      } else {
        process.env.BULK_HASH_CONCURRENCY = previous;
      }
    }
  });
});
