import { type RequestIdVariables, requestId } from 'hono/request-id';

/**
 * Request ID middleware for request correlation
 *
 * Adds a unique request ID to each request for tracing and logging.
 * The ID is available downstream with `c.get('requestId')`.
 *
 * @example
 * ```typescript
 * const requestId = c.get('requestId');
 * logger.info({ requestId }, 'Processing request');
 * ```
 */
export const requestIdMiddleware = () => requestId();

// Export the type for use in other middleware
export type { RequestIdVariables };
