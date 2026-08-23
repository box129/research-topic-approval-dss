jest.mock('../config/database', () => ({ $queryRaw: jest.fn() }));
const prisma = require('../config/database');
const readinessService = require('./readiness.service');

describe('Voyage readiness service', () => {
  const originalKey = process.env.VOYAGE_API_KEY;
  beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });
  afterEach(() => { process.env.VOYAGE_API_KEY = originalKey; jest.useRealTimers(); });
  test('reports configured-but-unverified Voyage honestly before a probe completes', async () => {
    process.env.VOYAGE_API_KEY = 'test'; prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    const result = await readinessService.getReadiness();
    expect(result.httpStatus).toBe(503); expect(result.body).toMatchObject({ status:'degraded', checks:{api:'available',database:'available',semanticProvider:'configured_not_yet_verified'}, details:{semanticProvider:{provider:'voyage',model:'voyage-4-large',mode:'semantic-only'}} });
  });
  test('reports degraded when Voyage is not configured, without lexical fallback', async () => {
    delete process.env.VOYAGE_API_KEY; prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    const result = await readinessService.getReadiness();
    expect(result.httpStatus).toBe(503); expect(result.body.details.semanticProvider.message).toMatch(/VOYAGE_API_KEY/);
  });
  test('reports not ready when database is unavailable', async () => {
    process.env.VOYAGE_API_KEY = 'test'; prisma.$queryRaw.mockRejectedValue(new Error('connection failed'));
    const result = await readinessService.getReadiness(); expect(result.httpStatus).toBe(503); expect(result.body.checks.database).toBe('unavailable');
  });
});
