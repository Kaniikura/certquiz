/**
 * Middleware exports
 *
 * Order of middleware application matters:
 * 1. Request ID (for correlation)
 * 2. Logger (uses request ID)
 * 3. Security (CORS and headers)
 * 4. Routes
 * 5. Error handler (catches all errors)
 */

export { auth } from './auth';
export type { LoggerVariables } from './logger';
export { createLoggerMiddleware } from './logger';
export { errorHandler } from './on-error';
export type { RequestIdVariables } from './request-id';
export { requestIdMiddleware } from './request-id';
export { securityMiddleware } from './security';
export type { TransactionVariables } from './transaction';
export { createTransactionMiddleware } from './transaction';
