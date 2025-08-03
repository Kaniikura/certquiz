import { createMiddleware } from 'hono/factory';
import type { KeyGeneratorType } from './key-generators';
import { getKeyGenerator } from './key-generators';
import type { RateLimiterOptions } from './types';

/**
 * Creates a rate limiting middleware for Hono applications.
 *
 * This middleware implements the token bucket algorithm to limit
 * the number of requests from a client within a specified time window.
 *
 * @param options - Configuration options for the rate limiter
 * @param options.store - Storage backend for rate limit data
 * @param options.windowMs - Time window in milliseconds
 * @param options.limit - Maximum number of requests per window
 * @param options.keyGenerator - Strategy for generating rate limit keys ('ip', 'user', or custom function)
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { rateLimiter } from '@api/middleware/rate-limit';
 * import { InMemoryStore } from '@api/middleware/rate-limit/stores';
 *
 * app.use('/api/*', rateLimiter({
 *   store: new InMemoryStore({ windowMs: 60000, limit: 100 }),
 *   windowMs: 60000,
 *   limit: 100,
 *   keyGenerator: 'ip',
 * }));
 * ```
 */
export function rateLimiter(options: RateLimiterOptions) {
  // Validate required options
  if (!options?.store) {
    throw new Error('Rate limiter requires a store');
  }
  if (typeof options.windowMs !== 'number' || options.windowMs <= 0) {
    throw new Error('Rate limiter requires a positive windowMs');
  }
  if (typeof options.limit !== 'number' || options.limit < 0) {
    throw new Error('Rate limiter requires a non-negative limit');
  }
  if (!options.keyGenerator) {
    throw new Error('Rate limiter requires a keyGenerator');
  }

  // Resolve key generator
  const keyGen =
    typeof options.keyGenerator === 'string'
      ? getKeyGenerator(options.keyGenerator as KeyGeneratorType)
      : options.keyGenerator;

  return createMiddleware(async (c, next) => {
    try {
      // Generate key for this request
      const key = keyGen(c);

      // Try to consume from store
      const result = await options.store.consume(key);

      // Always set rate limit headers (draft-7 standard)
      c.header('RateLimit-Limit', options.limit.toString());
      c.header('RateLimit-Remaining', result.remaining.toString());
      c.header('RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

      // Handle rate limit exceeded
      if (!result.success) {
        // Set Retry-After header if available
        if (result.retryAfter !== undefined) {
          c.header('Retry-After', result.retryAfter.toString());
        }

        // Return rate limit error response
        return c.json(
          {
            error: {
              message: 'Too many requests',
              code: 'RATE_LIMIT',
            },
          },
          429
        );
      }

      // Request allowed, continue to next middleware
      await next();
    } catch (error) {
      // Handle store failures gracefully - fail open
      // This prevents the rate limiter from blocking all requests if the store fails
      const logger = c.get('logger') ?? console;
      logger.error('Rate limiter store error:', error);

      // Allow request to proceed (fail open)
      await next();
    }
  });
}
