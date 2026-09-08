const winston = require('winston');
const { createLoggerInstance, buildTransports } = require('./logger');

// Deterministic construction proof (not a filesystem probe): production
// logging is stdout/stderr-only so the hosting collector is the persistence
// layer, while development keeps its local file convenience copies.
describe('logger transports', () => {
  test('production constructs the Console transport only — no file transports', () => {
    const instance = createLoggerInstance({ production: true });

    expect(instance.transports).toHaveLength(1);
    expect(instance.transports[0]).toBeInstanceOf(winston.transports.Console);
    expect(instance.transports.some((transport) => transport instanceof winston.transports.File)).toBe(false);
  });

  test('development keeps the console plus the two local file convenience copies', () => {
    const transports = buildTransports({ production: false });

    expect(transports[0]).toBeInstanceOf(winston.transports.Console);
    expect(transports.filter((transport) => transport instanceof winston.transports.File)).toHaveLength(2);
  });

  test('production format stays one machine-readable JSON line with redaction intact', () => {
    const instance = createLoggerInstance({ production: true });

    const info = instance.format.transform({
      level: 'error',
      message: 'probe event',
      temporaryPassword: 'SENTINEL-TRANSPORT-PROBE',
      requestId: 'req-123'
    });
    const line = info[Symbol.for('message')];
    const parsed = JSON.parse(line);

    expect(parsed).toMatchObject({
      level: 'error',
      message: 'probe event',
      temporaryPassword: '[redacted]',
      requestId: 'req-123'
    });
    expect(typeof parsed.timestamp).toBe('string');
    expect(line).not.toContain('SENTINEL-TRANSPORT-PROBE');
  });
});
