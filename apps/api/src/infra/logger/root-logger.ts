/**
 * Root logger module with AsyncLocalStorage support
 * @fileoverview Creates the singleton root logger instance with correlation tracking
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger as PinoLogger } from 'pino';

// Re-export type for the rest of the codebase
export type Logger = PinoLogger;

// AsyncLocalStorage for correlation context
const als = new AsyncLocalStorage<Map<string, unknown>>();

// Re-export ALS for middleware and adapters
export const ALS = als;

// Singleton instance
let rootLogger: Logger | null = null;

/**
 * Gets the singleton root logger instance with automatic correlation ID injection
 * @returns The root logger instance
 */
export function getRootLogger(): Logger {
  if (rootLogger) return rootLogger;

  const isTest = process.env.NODE_ENV === 'test';

  rootLogger = pino({
    level: isTest ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
    base: undefined, // Don't add pid/hostname; we set our own context
    // Automatically attach correlationId from AsyncLocalStorage
    formatters: {
      log: (obj) => {
        const store = als.getStore();
        const correlationId = store?.get('correlationId');
        return correlationId ? { ...obj, correlationId } : obj;
      },
    },
  });

  return rootLogger;
}

/**
 * Runs a function with a correlation context
 * @param correlationId - The correlation ID for this context
 * @param fn - The function to run within the context
 * @returns The result of the function
 */
export function runWithCorrelationId<T>(
  correlationId: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const store = new Map<string, unknown>();
  store.set('correlationId', correlationId);
  return als.run(store, fn);
}

/**
 * Gets the current correlation ID from AsyncLocalStorage
 * @returns The correlation ID or undefined if not in a context
 */
export function getCorrelationId(): string | undefined {
  const store = als.getStore();
  return store?.get('correlationId') as string | undefined;
}
