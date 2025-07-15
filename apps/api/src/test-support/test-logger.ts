/**
 * Test logger utilities
 * @fileoverview Logger utilities for testing
 */

import type { Logger } from '@api/infra/logger';
import type { LoggerPort } from '@api/shared/logger';
import { NoopLogger } from '@api/shared/logger';
import pino from 'pino';

/**
 * Creates a silent Pino logger for tests
 *
 * This is useful when testing code that uses the Pino Logger type directly
 * rather than the LoggerPort interface.
 *
 * @returns A silent Pino logger instance
 */
export function createTestLogger(): Logger {
  return pino({
    level: 'silent',
  });
}

/**
 * Creates a no-op logger for domain tests
 *
 * This is the preferred logger for domain unit tests that use LoggerPort.
 *
 * @returns A no-op logger instance
 */
export function createNoopLogger(): LoggerPort {
  return new NoopLogger();
}

/**
 * Creates a spy logger for testing log output
 *
 * This logger captures all log calls for assertion in tests.
 *
 * @example
 * ```typescript
 * const logger = createSpyLogger();
 * const service = new QuizService(logger);
 *
 * service.startQuiz('user123');
 *
 * expect(logger.logs.info).toContainEqual({
 *   message: 'Starting quiz',
 *   meta: { userId: 'user123' }
 * });
 * ```
 */
export function createSpyLogger() {
  const logs = {
    info: [] as Array<{ message: string; meta?: Record<string, unknown> }>,
    warn: [] as Array<{ message: string; meta?: Record<string, unknown> }>,
    error: [] as Array<{ message: string; meta?: Record<string, unknown> }>,
    debug: [] as Array<{ message: string; meta?: Record<string, unknown> }>,
  };

  const logger: LoggerPort = {
    info(message: string, meta?: Record<string, unknown>) {
      logs.info.push({ message, meta });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      logs.warn.push({ message, meta });
    },
    error(message: string, meta?: Record<string, unknown>) {
      logs.error.push({ message, meta });
    },
    debug(message: string, meta?: Record<string, unknown>) {
      logs.debug.push({ message, meta });
    },
  };

  return { logger, logs };
}
