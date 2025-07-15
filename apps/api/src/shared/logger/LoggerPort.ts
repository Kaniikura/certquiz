/**
 * Logger port interface for domain layer
 * @fileoverview Pure interface for logging without framework dependencies
 *
 * This interface follows the hexagonal architecture port pattern,
 * allowing the domain layer to log without depending on any specific
 * logging implementation.
 */

/**
 * Logger port interface that domain services can depend on
 *
 * @example
 * ```typescript
 * class QuizService {
 *   constructor(private readonly logger: LoggerPort) {}
 *
 *   startQuiz(userId: string) {
 *     this.logger.info('Starting quiz', { userId });
 *     // ... business logic
 *   }
 * }
 * ```
 */
export interface LoggerPort {
  /**
   * Log an informational message
   * @param message - The message to log
   * @param meta - Optional metadata to attach to the log entry
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log a warning message
   * @param message - The message to log
   * @param meta - Optional metadata to attach to the log entry
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log an error message
   * @param message - The message to log
   * @param meta - Optional metadata to attach to the log entry
   */
  error(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log a debug message
   * @param message - The message to log
   * @param meta - Optional metadata to attach to the log entry
   */
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * No-op logger implementation for testing
 *
 * @example
 * ```typescript
 * const service = new QuizService(new NoopLogger());
 * ```
 */
export class NoopLogger implements LoggerPort {
  info(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }

  warn(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }

  error(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }

  debug(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }
}
