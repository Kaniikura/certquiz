import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { rateLimiter } from './index';
import { InMemoryStore } from './stores/in-memory';
import type { ConsumeResult, RateLimiterOptions, RateLimiterStore } from './types';

describe('rateLimiter middleware', () => {
  // Helper to create a test app
  function createTestApp(options: RateLimiterOptions) {
    const app = new Hono();
    app.use('*', rateLimiter(options));
    app.get('/', (c) => c.text('OK'));
    return app;
  }

  // Mock store for controlled testing
  class MockStore implements RateLimiterStore {
    private consumeResults: ConsumeResult[] = [];
    private callCount = 0;

    setResults(...results: ConsumeResult[]) {
      this.consumeResults = results;
      this.callCount = 0;
    }

    async consume(_key: string): Promise<ConsumeResult> {
      const result = this.consumeResults[this.callCount] || {
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      };
      this.callCount++;
      return result;
    }
  }

  describe('Basic Functionality', () => {
    it('should allow requests within rate limit', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 2 });
      const app = createTestApp({
        store,
        windowMs: 60000,
        limit: 2,
        keyGenerator: 'ip',
      });

      const res1 = await app.request('/');
      expect(res1.status).toBe(200);
      expect(await res1.text()).toBe('OK');

      const res2 = await app.request('/');
      expect(res2.status).toBe(200);
    });

    it('should block requests exceeding rate limit', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 2 });
      const app = createTestApp({
        store,
        windowMs: 60000,
        limit: 2,
        keyGenerator: 'ip',
      });

      // First two requests should succeed
      await app.request('/');
      await app.request('/');

      // Third request should be blocked
      const res3 = await app.request('/');
      expect(res3.status).toBe(429);
    });

    it('should reset rate limit after window expires', async () => {
      const store = new InMemoryStore({ windowMs: 100, limit: 1 }); // 100ms window for testing
      const app = createTestApp({
        store,
        windowMs: 100,
        limit: 1,
        keyGenerator: 'ip',
      });

      // First request should succeed
      const res1 = await app.request('/');
      expect(res1.status).toBe(200);

      // Second request should be blocked
      const res2 = await app.request('/');
      expect(res2.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Third request should succeed
      const res3 = await app.request('/');
      expect(res3.status).toBe(200);
    });

    it('should isolate rate limits by key', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 1 });
      const app = createTestApp({
        store,
        windowMs: 60000,
        limit: 1,
        keyGenerator: (c) => c.req.header('x-client-id') || 'unknown',
      });

      // Request from client1 should succeed
      const res1 = await app.request('/', {
        headers: { 'x-client-id': 'client1' },
      });
      expect(res1.status).toBe(200);

      // Second request from client1 should be blocked
      const res2 = await app.request('/', {
        headers: { 'x-client-id': 'client1' },
      });
      expect(res2.status).toBe(429);

      // Request from client2 should succeed
      const res3 = await app.request('/', {
        headers: { 'x-client-id': 'client2' },
      });
      expect(res3.status).toBe(200);
    });

    it('should handle store consume correctly', async () => {
      const mockStore = new MockStore();
      mockStore.setResults(
        { success: true, remaining: 99, resetTime: Date.now() + 60000 },
        { success: true, remaining: 98, resetTime: Date.now() + 60000 },
        { success: false, remaining: 0, resetTime: Date.now() + 60000, retryAfter: 30 }
      );

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res1 = await app.request('/');
      expect(res1.status).toBe(200);

      const res2 = await app.request('/');
      expect(res2.status).toBe(200);

      const res3 = await app.request('/');
      expect(res3.status).toBe(429);
    });
  });

  describe('Response Headers', () => {
    it('should set RateLimit-Limit header', async () => {
      const mockStore = new MockStore();
      mockStore.setResults({ success: true, remaining: 99, resetTime: Date.now() + 60000 });

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.headers.get('RateLimit-Limit')).toBe('100');
    });

    it('should set RateLimit-Remaining header', async () => {
      const mockStore = new MockStore();
      mockStore.setResults(
        { success: true, remaining: 99, resetTime: Date.now() + 60000 },
        { success: true, remaining: 98, resetTime: Date.now() + 60000 }
      );

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res1 = await app.request('/');
      expect(res1.headers.get('RateLimit-Remaining')).toBe('99');

      const res2 = await app.request('/');
      expect(res2.headers.get('RateLimit-Remaining')).toBe('98');
    });

    it('should set RateLimit-Reset header with Unix timestamp in seconds', async () => {
      const resetTimeMs = Date.now() + 60000;
      const resetTimeSec = Math.ceil(resetTimeMs / 1000);

      const mockStore = new MockStore();
      mockStore.setResults({ success: true, remaining: 99, resetTime: resetTimeMs });

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.headers.get('RateLimit-Reset')).toBe(resetTimeSec.toString());
    });

    it('should set Retry-After header only on 429 responses', async () => {
      const mockStore = new MockStore();
      mockStore.setResults(
        { success: true, remaining: 1, resetTime: Date.now() + 60000 },
        { success: false, remaining: 0, resetTime: Date.now() + 60000, retryAfter: 45 }
      );

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res1 = await app.request('/');
      expect(res1.status).toBe(200);
      expect(res1.headers.get('Retry-After')).toBeNull();

      const res2 = await app.request('/');
      expect(res2.status).toBe(429);
      expect(res2.headers.get('Retry-After')).toBe('45');
    });

    it('should set headers even on rate limited requests', async () => {
      const resetTimeMs = Date.now() + 60000;
      const mockStore = new MockStore();
      mockStore.setResults({
        success: false,
        remaining: 0,
        resetTime: resetTimeMs,
        retryAfter: 30,
      });

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.status).toBe(429);
      expect(res.headers.get('RateLimit-Limit')).toBe('100');
      expect(res.headers.get('RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('RateLimit-Reset')).toBe(Math.ceil(resetTimeMs / 1000).toString());
      expect(res.headers.get('Retry-After')).toBe('30');
    });
  });

  describe('Key Generation', () => {
    it('should use IP key generator when specified as string', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 1 });
      const app = createTestApp({
        store,
        windowMs: 60000,
        limit: 1,
        keyGenerator: 'ip',
      });

      // Simulate request with X-Forwarded-For header
      const res = await app.request('/', {
        headers: { 'x-forwarded-for': '192.168.1.100' },
      });
      expect(res.status).toBe(200);

      // Second request from same IP should be blocked
      const res2 = await app.request('/', {
        headers: { 'x-forwarded-for': '192.168.1.100' },
      });
      expect(res2.status).toBe(429);

      // Request from different IP should succeed
      const res3 = await app.request('/', {
        headers: { 'x-forwarded-for': '192.168.1.101' },
      });
      expect(res3.status).toBe(200);
    });

    it('should use user key generator when specified as string', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 1 });
      const app = new Hono();

      // Simulate auth middleware setting user
      app.use('*', async (c, next) => {
        const userId = c.req.header('x-user-id');
        if (userId) {
          c.set('user', { sub: userId, email: 'test@example.com', roles: ['user'] });
        }
        await next();
      });

      app.use(
        '*',
        rateLimiter({
          store,
          windowMs: 60000,
          limit: 1,
          keyGenerator: 'user',
        })
      );

      app.get('/', (c) => c.text('OK'));

      // Request from user1 should succeed
      const res1 = await app.request('/', {
        headers: { 'x-user-id': 'user-123' },
      });
      expect(res1.status).toBe(200);

      // Second request from user1 should be blocked
      const res2 = await app.request('/', {
        headers: { 'x-user-id': 'user-123' },
      });
      expect(res2.status).toBe(429);

      // Request from user2 should succeed
      const res3 = await app.request('/', {
        headers: { 'x-user-id': 'user-456' },
      });
      expect(res3.status).toBe(200);
    });

    it('should use custom key generator function', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 1 });
      const customKeyGen = vi.fn((c) => `custom:${c.req.header('x-api-key') || 'none'}`);

      const app = createTestApp({
        store,
        windowMs: 60000,
        limit: 1,
        keyGenerator: customKeyGen,
      });

      const res1 = await app.request('/', {
        headers: { 'x-api-key': 'key123' },
      });
      expect(res1.status).toBe(200);
      expect(customKeyGen).toHaveBeenCalled();

      const res2 = await app.request('/', {
        headers: { 'x-api-key': 'key123' },
      });
      expect(res2.status).toBe(429);
    });

    it('should throw error for invalid key generator type', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 1 });

      expect(() => {
        createTestApp({
          store,
          windowMs: 60000,
          limit: 1,
          keyGenerator: 'invalid',
        });
      }).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw RateLimitError with correct message', async () => {
      const mockStore = new MockStore();
      mockStore.setResults({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 30,
      });

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('message', 'Too many requests');
      expect(body.error).toHaveProperty('code', 'RATE_LIMIT');
    });

    it('should include retryAfter in error response', async () => {
      const mockStore = new MockStore();
      mockStore.setResults({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 45,
      });

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
    });

    it('should handle store failures gracefully', async () => {
      const failingStore: RateLimiterStore = {
        consume: vi.fn().mockRejectedValue(new Error('Store unavailable')),
      };

      const app = createTestApp({
        store: failingStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      // Should fail open (allow request) or return 503
      const res = await app.request('/');
      expect([200, 503]).toContain(res.status);
    });

    it('should handle missing retryAfter gracefully', async () => {
      const mockStore = new MockStore();
      mockStore.setResults({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        // No retryAfter provided
      });

      const app = createTestApp({
        store: mockStore,
        windowMs: 60000,
        limit: 100,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should validate required options', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        rateLimiter({});
      }).toThrow();

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        rateLimiter({ store: new InMemoryStore({ windowMs: 60000, limit: 100 }) });
      }).toThrow();
    });

    it('should use provided configuration values', async () => {
      const mockStore = new MockStore();
      mockStore.setResults({ success: true, remaining: 49, resetTime: Date.now() + 30000 });

      const app = createTestApp({
        store: mockStore,
        windowMs: 30000,
        limit: 50,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.headers.get('RateLimit-Limit')).toBe('50');
      expect(res.headers.get('RateLimit-Remaining')).toBe('49');
    });

    it('should handle zero limit configuration', async () => {
      const store = new InMemoryStore({ windowMs: 60000, limit: 0 });
      const app = createTestApp({
        store,
        windowMs: 60000,
        limit: 0,
        keyGenerator: 'ip',
      });

      const res = await app.request('/');
      expect(res.status).toBe(429);
    });
  });
});
