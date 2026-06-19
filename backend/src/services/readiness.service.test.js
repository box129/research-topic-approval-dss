jest.mock('../config/database', () => ({
  $queryRaw: jest.fn()
}));

jest.mock('./sbert.service', () => ({
  checkHealth: jest.fn()
}));

const prisma = require('../config/database');
const sbertService = require('./sbert.service');
const readinessService = require('./readiness.service');

describe('readiness service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reports ready when database and SBERT are available', async () => {
    prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    sbertService.checkHealth.mockResolvedValue(true);

    const result = await readinessService.getReadiness();

    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({
      status: 'ready',
      checks: {
        api: 'available',
        database: 'available',
        sbert: 'available'
      }
    });
  });

  test('reports degraded when database is available but SBERT is unavailable', async () => {
    prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    sbertService.checkHealth.mockResolvedValue(false);

    const result = await readinessService.getReadiness();

    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: 'degraded',
      checks: {
        api: 'available',
        database: 'available',
        sbert: 'unavailable'
      }
    });
    expect(result.body.details.sbert.message).toMatch(/degraded lexical fallback/);
  });

  test('reports not ready when database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection failed'));
    sbertService.checkHealth.mockResolvedValue(true);

    const result = await readinessService.getReadiness();

    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: 'not_ready',
      checks: {
        api: 'available',
        database: 'unavailable',
        sbert: 'available'
      }
    });
    expect(result.body.details.database.message).toBe('Database connectivity check failed.');
  });

  test('reports not ready when database readiness check times out', async () => {
    jest.useFakeTimers();
    prisma.$queryRaw.mockReturnValue(new Promise(() => {}));
    sbertService.checkHealth.mockResolvedValue(true);

    const readinessPromise = readinessService.getReadiness();
    await jest.advanceTimersByTimeAsync(readinessService.DATABASE_READINESS_TIMEOUT_MS);
    const result = await readinessPromise;

    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: 'not_ready',
      checks: {
        database: 'unavailable'
      }
    });

    jest.useRealTimers();
  });
});
