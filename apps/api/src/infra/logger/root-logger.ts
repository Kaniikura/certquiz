/**
 * Root logger module
 * @fileoverview Creates the root logger instance for the application
 */

import pino, { type Logger as PinoLogger } from 'pino';

// Re-export type for the rest of the codebase
export type Logger = PinoLogger;

/**
 * Creates the root logger instance with environment-specific configuration
 */
export function createRootLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              ignore: 'pid,hostname',
              translateTime: 'HH:MM:ss.l',
            },
          }
        : undefined,
  });
}
