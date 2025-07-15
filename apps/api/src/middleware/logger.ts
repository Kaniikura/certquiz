import { createMiddleware } from 'hono/factory';
import { getRootLogger, type Logger, runWithCorrelationId } from '../infra/logger';
import type { RequestIdVariables } from './request-id';

// Type for logger variables in context
export type LoggerVariables = {
  logger: Logger;
  correlationId: string; // New: correlation ID for this request
};

/**
 * Creates logger middleware with AsyncLocalStorage support
 *
 * This middleware:
 * 1. Wraps the entire request in an AsyncLocalStorage context
 * 2. Uses the requestId as the correlationId for backward compatibility
 * 3. Creates a child logger for the request
 * 4. Logs request start and completion
 *
 * The correlation ID is automatically attached to all logs within the request,
 * even in deeply nested async operations.
 *
 * @param rootLogger - Optional root logger instance (defaults to singleton)
 * @returns Logger middleware that creates a child logger per request
 *
 * @example
 * ```typescript
 * const logger = c.get('logger');
 * logger.info('Processing user request');
 *
 * // Correlation ID is automatically included in logs
 * const correlationId = c.get('correlationId');
 * ```
 */
export function createLoggerMiddleware(rootLogger?: Logger) {
  const logger = rootLogger ?? getRootLogger();

  return createMiddleware<{
    Variables: LoggerVariables & RequestIdVariables;
  }>(async (c, next) => {
    // Get the request ID from the request-id middleware
    const requestId = c.get('requestId');

    // Use requestId as correlationId for backward compatibility
    const correlationId = requestId;

    // Run the entire request handler within the correlation context
    await runWithCorrelationId(correlationId, async () => {
      // Create a child logger for this request
      const requestLogger = logger.child({
        method: c.req.method,
        path: c.req.path,
        userAgent: c.req.header('user-agent'),
        // correlationId is automatically added by the formatter
      });

      // Set context variables
      c.set('logger', requestLogger);
      c.set('correlationId', correlationId);

      const start = performance.now();

      // Log request start
      requestLogger.info('request.start');

      // Continue with the request
      // Note: Hono catches all errors internally, so next() never throws
      await next();

      // Check response status to determine if request succeeded or failed
      const duration = Math.round(performance.now() - start);
      const status = c.res.status;

      if (status >= 400) {
        // Log failed request (4xx client errors, 5xx server errors)
        requestLogger.error(
          {
            status,
            duration,
            durationMs: `${duration}ms`,
          },
          'request.failed'
        );
      } else {
        // Log successful request (2xx, 3xx)
        requestLogger.info(
          {
            status,
            duration,
            durationMs: `${duration}ms`,
          },
          'request.completed'
        );
      }
    });
  });
}
