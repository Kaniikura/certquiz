import { getRootLogger } from '@api/infra/logger/root-logger';
import type { ConsumeResult, RateLimiterStore } from '../types';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface InMemoryStoreOptions {
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum number of requests per window */
  limit: number;
  /** Cleanup interval in milliseconds (default: 10 minutes) */
  cleanupIntervalMs?: number;
}

export class InMemoryStore implements RateLimiterStore {
  private buckets = new Map<string, TokenBucket>();
  private readonly refillRate: number;
  private cleanupTimer: NodeJS.Timeout;
  private readonly logger = getRootLogger().child({ module: 'rate-limit' });

  constructor(private options: InMemoryStoreOptions) {
    // Calculate tokens per millisecond for refill rate
    this.refillRate = options.limit / options.windowMs;

    // Start automatic cleanup timer (default: every 10 minutes)
    const cleanupInterval = options.cleanupIntervalMs ?? 10 * 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => {
        // Log error but don't throw - cleanup failures shouldn't crash the app
        this.logger.error({ error }, 'Rate limiter cleanup failed');
      });
    }, cleanupInterval);
  }

  async consume(key: string): Promise<ConsumeResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // Initialize new bucket with full tokens
      bucket = {
        tokens: this.options.limit,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
    }

    // Calculate token refill based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.options.limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Try to consume a token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        success: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: now + this.options.windowMs,
      };
    }

    // Rate limited - calculate retry after
    const tokensNeeded = 1 - bucket.tokens;
    const timeToWait = tokensNeeded / this.refillRate;

    return {
      success: false,
      remaining: 0,
      resetTime: now + this.options.windowMs,
      retryAfter: Math.ceil(timeToWait / 1000), // Convert to seconds
    };
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const ttl = this.options.windowMs * 2; // Keep entries for 2 windows

    // Remove entries that haven't been accessed in a while
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > ttl) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Gracefully shutdown the store by stopping the cleanup timer.
   * Call this before terminating the application to prevent memory leaks.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
