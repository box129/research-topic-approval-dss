const { EventEmitter } = require('events');
const {
  DEFAULT_SHUTDOWN_GRACE_PERIOD_MS,
  createServerLifecycle
} = require('./serverLifecycle');

function createPendingServer() {
  let closeCallback;
  const server = {
    close: jest.fn((callback) => {
      closeCallback = callback;
    }),
    closeIdleConnections: jest.fn(),
    closeAllConnections: jest.fn()
  };

  return {
    server,
    finishDrain(error) {
      closeCallback(error);
    }
  };
}

function createLog() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

describe('server lifecycle', () => {
  test.each(['SIGTERM', 'SIGINT'])('drains requests and disconnects Prisma after %s', async (signal) => {
    const { server, finishDrain } = createPendingServer();
    const prisma = { $disconnect: jest.fn().mockResolvedValue(undefined) };
    const exit = jest.fn();
    const lifecycle = createServerLifecycle({
      server,
      prisma,
      log: createLog(),
      exit
    });

    const result = lifecycle.shutdown(signal);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(prisma.$disconnect).not.toHaveBeenCalled();

    finishDrain();

    await expect(result).resolves.toEqual({ forced: false, exitCode: 0 });
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('installs both signal handlers and handles duplicate signals idempotently', async () => {
    const { server, finishDrain } = createPendingServer();
    const prisma = { $disconnect: jest.fn().mockResolvedValue(undefined) };
    const exit = jest.fn();
    const signalProcess = new EventEmitter();
    const lifecycle = createServerLifecycle({
      server,
      prisma,
      log: createLog(),
      exit
    });
    const removeSignalHandlers = lifecycle.installSignalHandlers(signalProcess);

    signalProcess.emit('SIGTERM');
    signalProcess.emit('SIGINT');
    const result = lifecycle.shutdown('SIGTERM');

    expect(server.close).toHaveBeenCalledTimes(1);

    finishDrain();
    await expect(result).resolves.toEqual({ forced: false, exitCode: 0 });

    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    removeSignalHandlers();
    expect(signalProcess.listenerCount('SIGTERM')).toBe(0);
    expect(signalProcess.listenerCount('SIGINT')).toBe(0);
  });

  test('force-closes remaining requests only after the configured bound and still starts Prisma disconnect', async () => {
    const { server } = createPendingServer();
    const prisma = { $disconnect: jest.fn().mockResolvedValue(undefined) };
    const exit = jest.fn();
    const timers = [];
    const setTimeoutImpl = jest.fn((callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    });
    const clearTimeoutImpl = jest.fn();
    const lifecycle = createServerLifecycle({
      server,
      prisma,
      log: createLog(),
      exit,
      gracePeriodMs: DEFAULT_SHUTDOWN_GRACE_PERIOD_MS,
      setTimeoutImpl,
      clearTimeoutImpl
    });

    const result = lifecycle.shutdown('SIGTERM');

    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(300000);
    await timers[0].callback();

    await expect(result).resolves.toEqual({ forced: true, exitCode: 1 });
    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(timers[1].delay).toBe(5000);
    expect(clearTimeoutImpl).toHaveBeenCalledWith(timers[1]);
  });

  test('bounds the forced Prisma disconnect attempt before exiting', async () => {
    const { server } = createPendingServer();
    const prisma = { $disconnect: jest.fn(() => new Promise(() => {})) };
    const exit = jest.fn();
    const timers = [];
    const setTimeoutImpl = jest.fn((callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    });
    const lifecycle = createServerLifecycle({
      server,
      prisma,
      log: createLog(),
      exit,
      setTimeoutImpl,
      clearTimeoutImpl: jest.fn()
    });

    const result = lifecycle.shutdown('SIGINT');
    void timers[0].callback();
    await Promise.resolve();
    await Promise.resolve();

    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(timers[1].delay).toBe(5000);

    timers[1].callback();

    await expect(result).resolves.toEqual({ forced: true, exitCode: 1 });
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  describe('fatal failure policy', () => {
    function createFatalHarness() {
      const { server, finishDrain } = createPendingServer();
      const prisma = { $disconnect: jest.fn().mockResolvedValue(undefined) };
      const log = createLog();
      const exit = jest.fn();
      const processRef = new EventEmitter();
      const lifecycle = createServerLifecycle({ server, prisma, log, exit });
      const removeFatalHandlers = lifecycle.installFatalHandlers(processRef);
      return { server, finishDrain, prisma, log, exit, processRef, removeFatalHandlers };
    }

    test.each(['uncaughtException', 'unhandledRejection'])('%s logs one redacted fatal event and exits through bounded shutdown', async (kind) => {
      const { finishDrain, prisma, log, exit, processRef } = createFatalHarness();

      processRef.emit(kind, new Error('simulated fatal failure'));

      const [message, entry] = log.error.mock.calls[0];
      expect(message).toMatch(/Fatal uncaught failure/);
      expect(entry).toMatchObject({ kind, error: 'simulated fatal failure' });

      finishDrain();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
      // Fatal failures never exit 0: the process state was untrusted.
      expect(exit).toHaveBeenCalledWith(1);
      expect(exit).toHaveBeenCalledTimes(1);
    });

    test('non-error rejection reasons are handled safely', async () => {
      const { finishDrain, log, exit, processRef } = createFatalHarness();

      processRef.emit('unhandledRejection', 'string-reason');

      expect(log.error.mock.calls[0][1].error).toBe('string-reason');
      finishDrain();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(exit).toHaveBeenCalledWith(1);
    });

    test('handlers can be removed', () => {
      const { log, processRef, removeFatalHandlers } = createFatalHarness();
      removeFatalHandlers();
      expect(processRef.listenerCount('uncaughtException')).toBe(0);
      expect(processRef.listenerCount('unhandledRejection')).toBe(0);
      expect(log.error).not.toHaveBeenCalled();
    });
  });
});
