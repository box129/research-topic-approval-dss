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
