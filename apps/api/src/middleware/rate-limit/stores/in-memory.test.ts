import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from './in-memory';

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Token Consumption', () => {
    beforeEach(() => {
      store = new InMemoryStore({
        windowMs: 60000, // 1 minute
        limit: 100,
      });
    });

    it('should allow first request and consume one token', async () => {
      const result = await store.consume('test-key');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should track tokens separately for different keys', async () => {
      const result1 = await store.consume('key-1');
      const result2 = await store.consume('key-2');

      expect(result1.remaining).toBe(99);
      expect(result2.remaining).toBe(99);
    });

    it('should decrease remaining tokens with each request', async () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await store.consume('test-key'));
      }

      expect(results[0].remaining).toBe(99);
      expect(results[1].remaining).toBe(98);
      expect(results[2].remaining).toBe(97);
      expect(results[3].remaining).toBe(96);
      expect(results[4].remaining).toBe(95);
    });
  });

  describe('Rate Limit Enforcement', () => {
    beforeEach(() => {
      store = new InMemoryStore({
        windowMs: 60000,
        limit: 3, // Small limit for testing
      });
    });

    it('should reject requests when limit is reached', async () => {
      // Consume all tokens
      await store.consume('test-key');
      await store.consume('test-key');
      await store.consume('test-key');

      // Fourth request should be rejected
      const result = await store.consume('test-key');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should calculate resetTime correctly', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const result = await store.consume('test-key');

      expect(result.resetTime).toBe(now + 60000);
    });
  });

  describe('Token Refill Logic', () => {
    beforeEach(() => {
      store = new InMemoryStore({
        windowMs: 60000, // 1 minute
        limit: 10, // 10 tokens per minute
      });
    });

    it('should refill tokens over time', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Consume 5 tokens
      for (let i = 0; i < 5; i++) {
        await store.consume('test-key');
      }

      // Advance time by 30 seconds (half the window)
      vi.setSystemTime(now + 30000);

      // Should have refilled ~5 tokens
      const result = await store.consume('test-key');
      expect(result.remaining).toBeCloseTo(9, 0); // One just consumed
    });

    it('should not exceed the limit when refilling', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Don't consume any tokens

      // Advance time by 2 minutes
      vi.setSystemTime(now + 120000);

      // Should still have only the limit amount
      const result = await store.consume('test-key');
      expect(result.remaining).toBe(9); // limit - 1
    });

    it('should calculate retryAfter correctly when rate limited', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await store.consume('test-key');
      }

      // Next request should fail with retryAfter
      const result = await store.consume('test-key');

      expect(result.success).toBe(false);
      expect(result.retryAfter).toBeCloseTo(6, 0); // ~6 seconds to get 1 token back
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      store = new InMemoryStore({
        windowMs: 60000,
        limit: 10,
        maxKeys: 100, // Limit number of keys stored
      });
    });

    it('should have cleanup method', () => {
      expect(store.cleanup).toBeDefined();
      expect(typeof store.cleanup).toBe('function');
    });

    it('should remove expired entries when cleanup is called', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Create entries for different keys
      await store.consume('key-1');
      await store.consume('key-2');

      // Advance time past the window
      vi.setSystemTime(now + 120000); // 2 minutes later

      // Add a new entry
      await store.consume('key-3');

      // Run cleanup
      await store.cleanup();

      // Old keys should be gone, but we can't directly inspect
      // We'll test by trying to consume from old keys
      const result1 = await store.consume('key-1');
      const result3 = await store.consume('key-3');

      // Key-1 should act like a fresh key (full tokens minus one)
      expect(result1.remaining).toBe(9);
      // Key-3 should have one less token
      expect(result3.remaining).toBe(8);
    });
  });
});
