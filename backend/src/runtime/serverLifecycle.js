const DEFAULT_SHUTDOWN_GRACE_PERIOD_MS = 300000;
const FORCED_DISCONNECT_TIMEOUT_MS = 5000;

function logSafely(log, level, message, metadata) {
  try {
    if (typeof log?.[level] === 'function') {
      log[level](message, metadata);
    }
  } catch {
    // Logging must not prevent a process from shutting down.
  }
}

function closeHttpServer(server) {
  return new Promise((resolve) => {
    if (!server || typeof server.close !== 'function') {
      resolve({ error: null });
      return;
    }

    let settled = false;
    const finish = (error = null) => {
      if (!settled) {
        settled = true;
        resolve({ error });
      }
    };

    try {
      // close() stops new connections immediately and resolves only after
      // active requests have drained.
      server.close((error) => {
        // A server that has already been closed is equivalent to a drained
        // server for shutdown purposes.
        if (error?.code === 'ERR_SERVER_NOT_RUNNING') {
          finish();
          return;
        }
        finish(error || null);
      });

      // Idle keep-alive sockets do not represent in-flight work and should
      // not consume the administrative drain window when Node exposes this
      // API (Node 18+).
      server.closeIdleConnections?.();
    } catch (error) {
      if (error?.code === 'ERR_SERVER_NOT_RUNNING') {
        finish();
        return;
      }
      finish(error);
    }
  });
}

function createServerLifecycle({
  server,
  prisma,
  log = console,
  gracePeriodMs = DEFAULT_SHUTDOWN_GRACE_PERIOD_MS,
  forcedDisconnectTimeoutMs = FORCED_DISCONNECT_TIMEOUT_MS,
  exit = (code) => process.exit(code),
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
} = {}) {
  if (!Number.isInteger(gracePeriodMs) || gracePeriodMs < 1) {
    throw new Error('gracePeriodMs must be a positive integer.');
  }
  if (!Number.isInteger(forcedDisconnectTimeoutMs) || forcedDisconnectTimeoutMs < 1) {
    throw new Error('forcedDisconnectTimeoutMs must be a positive integer.');
  }

  let shutdownPromise = null;
  let disconnectPromise = null;
  let forceTimer = null;
  let hasExited = false;
  let forced = false;

  const disconnectPrisma = () => {
    if (!disconnectPromise) {
      try {
        // Invoke $disconnect synchronously so even the forced-exit path makes
        // the clean-disconnect attempt before terminating the process.
        disconnectPromise = Promise.resolve(prisma?.$disconnect?.())
          .catch((error) => {
            logSafely(log, 'error', 'Prisma disconnect failed during shutdown.', {
              error: error?.message
            });
            throw error;
          });
      } catch (error) {
        logSafely(log, 'error', 'Prisma disconnect failed during shutdown.', {
          error: error?.message
        });
        disconnectPromise = Promise.reject(error);
      }
    }

    return disconnectPromise;
  };

  const exitOnce = (code) => {
    if (hasExited) {
      return;
    }
    hasExited = true;
    exit(code);
  };

  const forceCloseConnections = () => {
    try {
      server?.closeAllConnections?.();
    } catch (error) {
      logSafely(log, 'error', 'Unable to force-close remaining HTTP connections.', {
        error: error?.message
      });
    }
  };

  const disconnectWithinForcedWindow = () => new Promise((resolve) => {
    let settled = false;
    let timeout;
    const finish = (disconnected) => {
      if (!settled) {
        settled = true;
        if (timeout) {
          clearTimeoutImpl(timeout);
        }
        resolve(disconnected);
      }
    };
    timeout = setTimeoutImpl(() => finish(false), forcedDisconnectTimeoutMs);

    void disconnectPrisma()
      .then(() => finish(true))
      .catch(() => finish(false));
  });

  const shutdown = (signal = 'SIGTERM') => {
    if (shutdownPromise) {
      logSafely(log, 'info', 'Shutdown already in progress; ignoring duplicate signal.', { signal });
      return shutdownPromise;
    }

    logSafely(log, 'info', 'Graceful shutdown started.', {
      signal,
      gracePeriodMs
    });

    shutdownPromise = new Promise((resolve) => {
      let completed = false;
      const resolveOnce = (result) => {
        if (!completed) {
          completed = true;
          resolve(result);
        }
      };

      const finish = async ({ exitCode }) => {
        let finalExitCode = exitCode;
        try {
          await disconnectPrisma();
        } catch {
          finalExitCode = 1;
        }

        // The forced path owns process termination once the drain window has
        // elapsed. It may be racing this normal Prisma disconnect attempt.
        if (forced) {
          return;
        }

        if (forceTimer) {
          clearTimeoutImpl(forceTimer);
          forceTimer = null;
        }

        logSafely(log, 'info', 'Graceful shutdown completed.', { signal });
        exitOnce(finalExitCode);
        resolveOnce({ forced: false, exitCode: finalExitCode });
      };

      forceTimer = setTimeoutImpl(async () => {
        if (forced) {
          return;
        }
        forced = true;
        forceTimer = null;
        forceCloseConnections();
        // The normal path waits for Prisma cleanly. Once the drain window has
        // elapsed, retain only a short bounded window for that disconnect so a
        // stuck database cannot make process termination unbounded.
        const disconnected = await disconnectWithinForcedWindow();
        logSafely(log, 'warn', 'Graceful shutdown grace period elapsed; process is exiting after forced connection close.', {
          signal,
          gracePeriodMs,
          prismaDisconnected: disconnected
        });
        exitOnce(1);
        resolveOnce({ forced: true, exitCode: 1 });
      }, gracePeriodMs);

      void closeHttpServer(server).then(({ error }) => {
        if (forced) {
          return;
        }

        if (error) {
          logSafely(log, 'error', 'HTTP server reported an error while draining shutdown traffic.', {
            error: error.message
          });
          void finish({ exitCode: 1 });
          return;
        }

        void finish({ exitCode: 0 });
      });
    });

    return shutdownPromise;
  };

  const installSignalHandlers = (processRef = process) => {
    const handleSigterm = () => {
      void shutdown('SIGTERM');
    };
    const handleSigint = () => {
      void shutdown('SIGINT');
    };

    processRef.on('SIGTERM', handleSigterm);
    processRef.on('SIGINT', handleSigint);

    return () => {
      processRef.removeListener?.('SIGTERM', handleSigterm);
      processRef.removeListener?.('SIGINT', handleSigint);
    };
  };

  return {
    shutdown,
    installSignalHandlers
  };
}

module.exports = {
  DEFAULT_SHUTDOWN_GRACE_PERIOD_MS,
  FORCED_DISCONNECT_TIMEOUT_MS,
  closeHttpServer,
  createServerLifecycle
};
