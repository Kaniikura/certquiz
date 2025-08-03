import type { Context } from 'hono';

/**
 * Result of attempting to consume a token from the rate limiter
 */
export interface ConsumeResult {
  /** Whether the request is allowed (token was available) */
  success: boolean;
  /** Number of tokens remaining in the current window */
  remaining: number;
  /** UNIX timestamp (ms) when the rate limit window resets */
  resetTime: number;
  /** Optional retry after duration in seconds */
  retryAfter?: number;
}

/**
 * Storage backend interface for rate limiter
 */
export interface RateLimiterStore {
  /**
   * Attempts to consume a token for the given key
   * @param key - Unique identifier for the client
   * @returns Promise resolving to consumption result
   */
  consume(key: string): Promise<ConsumeResult>;

  /**
   * Optional: Clear expired entries
   */
  cleanup?(): Promise<void>;
}

/**
 * Configuration options for the rate limiter
 */
export interface RateLimiterOptions {
  /** Storage backend for rate limit data */
  store: RateLimiterStore;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum number of requests per window */
  limit: number;
  /** Strategy for generating rate limit keys */
  keyGenerator: string | ((c: Context) => string);
}
