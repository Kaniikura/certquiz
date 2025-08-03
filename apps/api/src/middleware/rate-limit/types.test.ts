import type { Context } from 'hono';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ConsumeResult, RateLimiterOptions, RateLimiterStore } from './types';

describe('RateLimiterStore Interface', () => {
  it('should define consume method signature', () => {
    const mockStore: RateLimiterStore = {
      consume: async (_key: string) => ({
        success: true,
        remaining: 99,
        resetTime: Date.now() + 60000,
      }),
    };

    expect(mockStore.consume).toBeDefined();
    expect(typeof mockStore.consume).toBe('function');
    expectTypeOf(mockStore.consume).toBeFunction();
    expectTypeOf(mockStore.consume).parameters.toMatchTypeOf<[string]>();
    expectTypeOf(mockStore.consume).returns.toMatchTypeOf<Promise<ConsumeResult>>();
  });

  it('should optionally define cleanup method', () => {
    const mockStore: RateLimiterStore = {
      consume: async () => ({ success: true, remaining: 0, resetTime: 0 }),
      cleanup: async () => undefined,
    };

    expect(mockStore.cleanup).toBeDefined();
    if (mockStore.cleanup) {
      expectTypeOf(mockStore.cleanup).toBeFunction();
      expectTypeOf(mockStore.cleanup).returns.toMatchTypeOf<Promise<void>>();
    }
  });
});

describe('ConsumeResult Type', () => {
  it('should have required properties', () => {
    const result: ConsumeResult = {
      success: true,
      remaining: 50,
      resetTime: 1234567890,
    };

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('resetTime');
    expectTypeOf(result.success).toBeBoolean();
    expectTypeOf(result.remaining).toBeNumber();
    expectTypeOf(result.resetTime).toBeNumber();
  });

  it('should have optional retryAfter property', () => {
    const result: ConsumeResult = {
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
      retryAfter: 30,
    };

    expect(result.retryAfter).toBe(30);
    expectTypeOf(result.retryAfter).toMatchTypeOf<number | undefined>();
  });
});

describe('RateLimiterOptions Type', () => {
  it('should have required properties', () => {
    const options: RateLimiterOptions = {
      store: {
        consume: async () => ({ success: true, remaining: 0, resetTime: 0 }),
      },
      windowMs: 60000,
      limit: 100,
      keyGenerator: 'ip',
    };

    expect(options).toHaveProperty('store');
    expect(options).toHaveProperty('windowMs');
    expect(options).toHaveProperty('limit');
    expect(options).toHaveProperty('keyGenerator');
  });

  it('should accept function as keyGenerator', () => {
    const options: RateLimiterOptions = {
      store: {
        consume: async () => ({ success: true, remaining: 0, resetTime: 0 }),
      },
      windowMs: 60000,
      limit: 100,
      keyGenerator: (c) => `custom:${c.req.path}`,
    };

    expectTypeOf(options.keyGenerator).toMatchTypeOf<string | ((c: Context) => string)>();
  });
});
