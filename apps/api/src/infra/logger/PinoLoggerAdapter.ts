import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { getRootLogger, type Logger } from './root-logger';

/**
 * Adapts Pino logger to the domain LoggerPort interface
 *
 * This adapter automatically includes correlation IDs from AsyncLocalStorage
 * and creates child loggers with specific scopes for better log organization.
 *
 * @example
 * ```typescript
 * // In dependency injection container
 * container.bind(LoggerPort).toFactory(() =>
 *   new PinoLoggerAdapter('quiz-service')
 * );
 * ```
 */
export class PinoLoggerAdapter implements LoggerPort {
  private readonly logger: Logger;

  /**
   * Creates a new Pino logger adapter
   * @param scope - Optional scope to add to all log entries (e.g., 'quiz-service', 'auth')
   */
  constructor(scope?: string) {
    const rootLogger = getRootLogger();

    // Create a child logger with scope and correlation ID
    const bindings: Record<string, unknown> = {};
    if (scope) {
      bindings.scope = scope;
    }

    // Correlation ID will be automatically added by the formatter

    this.logger = Object.keys(bindings).length > 0 ? rootLogger.child(bindings) : rootLogger;
  }

  /**
   * Log an informational message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.info(meta, message);
    } else {
      this.logger.info(message);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.warn(meta, message);
    } else {
      this.logger.warn(message);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.error(meta, message);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.debug(meta, message);
    } else {
      this.logger.debug(message);
    }
  }
}

/**
 * Creates a domain logger with a specific scope
 *
 * This is a convenience function for creating scoped loggers for domain services.
 *
 * @param scope - The scope for this logger (e.g., 'quiz.start', 'auth.login')
 * @returns A logger instance that implements LoggerPort
 *
 * @example
 * ```typescript
 * // In a use case handler
 * const logger = createDomainLogger('quiz.start');
 * logger.info('Starting quiz', { userId, questionCount });
 * ```
 */
export function createDomainLogger(scope: string): LoggerPort {
  return new PinoLoggerAdapter(scope);
}
