import { createMiddleware } from 'hono/factory';
import pino from 'pino';
import type { RequestIdVariables } from './request-id';

// Type for logger variables in context
export type LoggerVariables = { logger: pino.Logger };

// Create root logger
const rootLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
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

/**
 * Logger middleware that creates a child logger per request
 *
 * Creates a Pino child logger with request ID and path, then logs
 * request completion with status and duration.
 *
 * @example
 * ```typescript
 * const logger = c.get('logger');
 * logger.info('Processing user request');
 * ```
 */
export const loggerMiddleware = createMiddleware<{
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
