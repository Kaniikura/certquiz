import { createMiddleware } from 'hono/factory';
import type { Logger } from '../infra/logger/root-logger';
import type { RequestIdVariables } from './request-id';

// Type for logger variables in context
export type LoggerVariables = { logger: Logger };

/**
 * Creates logger middleware with injected root logger
 *
 * @param rootLogger - The root logger instance to use
 * @returns Logger middleware that creates a child logger per request
 *
 * @example
 * ```typescript
 * const logger = c.get('logger');
 * logger.info('Processing user request');
 * ```
 */
export function createLoggerMiddleware(rootLogger: Logger) {
  return createMiddleware<{
    Variables: LoggerVariables & RequestIdVariables;
  }>(async (c, next) => {
    const requestId = c.get('requestId');
    const child = rootLogger.child({
      requestId,
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header('user-agent'),
    });

    c.set('logger', child);

    const start = performance.now();

    // Log request start
    child.info('Request started');

    await next();

    // Log request completion
    const duration = Math.round(performance.now() - start);
    child.info(
      {
        status: c.res.status,
        duration: `${duration}ms`,
      },
      'Request completed'
    );
  });
}
