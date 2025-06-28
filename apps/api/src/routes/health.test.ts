import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Cache, createCache } from '../config/redis';
import type { AppEnv } from '../types/app';
import { healthRoutes } from './health';

describe('Health routes', () => {
  describe('with memory cache driver', () => {
    let app: Hono<AppEnv>;
    let cache: Cache;
    let originalCacheDriver: string | undefined;

    beforeEach(async () => {
      // Save and set environment
      originalCacheDriver = process.env.CACHE_DRIVER;
      process.env.CACHE_DRIVER = 'memory';

      // Create cache and app
      cache = createCache();
      await cache.init();

      app = new Hono<AppEnv>();

      // Inject cache into context
      app.use('*', async (c, next) => {
        c.set('cache', cache);
        await next();
      });

      // Mount health routes
      app.route('/health', healthRoutes);
    });

    afterEach(async () => {
      // Cleanup
      await cache.close();

      // Restore environment
      if (originalCacheDriver !== undefined) {
        process.env.CACHE_DRIVER = originalCacheDriver;
      } else {
        delete process.env.CACHE_DRIVER;
      }
    });

    it('GET /health should return basic health info', async () => {
      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('version');
    });

    it('GET /health/live should return live status', async () => {
      const res = await app.request('/health/live');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
    });

    it('GET /health/ready should check memory cache', async () => {
      const res = await app.request('/health/ready');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('status', 'degraded'); // degraded due to DB check not implemented
      expect(data).toHaveProperty('services');
      expect(data.services.cache).toMatchObject({
        status: 'ok',
        details: {
          pingResult: 'PONG',
          type: 'MemoryCache',
        },
      });
      expect(data.services.cache.latency).toBeGreaterThanOrEqual(0);
    });

    it('GET /health/metrics should include memory cache metrics', async () => {
      const res = await app.request('/health/metrics');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('cache');
      expect(data.cache).toMatchObject({
        connected: true,
        type: 'MemoryCache',
        healthy: true,
      });
    });
  });

  describe('with redis cache driver', () => {
    let app: Hono<AppEnv>;
    let cache: Cache;
    let originalCacheDriver: string | undefined;
    let originalRedisUrl: string | undefined;

    beforeEach(async () => {
      // Save environment
      originalCacheDriver = process.env.CACHE_DRIVER;
      originalRedisUrl = process.env.REDIS_URL;

      // Set Redis configuration
      process.env.CACHE_DRIVER = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      // Create a mock RedisCache
      class MockRedisCache implements Cache {
        async init() {
          // Mock initialization
        }
        async get(_key: string): Promise<string | null> {
          return null;
        }
        async set(_key: string, _value: string, _ttlSeconds?: number): Promise<void> {
          // Mock set operation
        }
        async del(_key: string): Promise<void> {
          // Mock delete operation
        }
        async close(): Promise<void> {
          // Mock close operation
        }
        async ping(): Promise<string> {
          return 'PONG';
        }
      }

      // Override constructor name to match RedisCache
      Object.defineProperty(MockRedisCache, 'name', { value: 'RedisCache' });

      cache = new MockRedisCache();

      app = new Hono<AppEnv>();

      // Inject cache into context
      app.use('*', async (c, next) => {
        c.set('cache', cache);
        await next();
      });

      // Mount health routes
      app.route('/health', healthRoutes);
    });

    afterEach(() => {
      // Restore environment
      if (originalCacheDriver !== undefined) {
        process.env.CACHE_DRIVER = originalCacheDriver;
      } else {
        delete process.env.CACHE_DRIVER;
      }

      if (originalRedisUrl !== undefined) {
        process.env.REDIS_URL = originalRedisUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('GET /health/ready should check redis cache', async () => {
      const res = await app.request('/health/ready');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.services.cache).toMatchObject({
        status: 'ok',
        details: {
          pingResult: 'PONG',
          type: 'RedisCache',
        },
      });
    });

    it('GET /health/ready should handle redis errors gracefully', async () => {
      // Mock a failing Redis ping
      cache.ping = async () => {
        throw new Error('Redis connection failed');
      };

      const res = await app.request('/health/ready');
      const data = await res.json();

      expect(res.status).toBe(503); // Service unavailable
      expect(data).toHaveProperty('status', 'error');
      expect(data.services.cache).toMatchObject({
        status: 'error',
        error: 'Redis connection failed',
      });
    });

    it('GET /health/metrics should include redis cache type', async () => {
      const res = await app.request('/health/metrics');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.cache).toMatchObject({
        connected: true,
        type: 'RedisCache',
        healthy: true,
      });
    });

    it('GET /health/metrics should handle redis errors in metrics', async () => {
      // Mock a failing Redis ping
      cache.ping = async () => {
        throw new Error('Redis metrics error');
      };

      const res = await app.request('/health/metrics');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.cache).toMatchObject({
        connected: false,
        type: 'RedisCache',
        error: 'Redis metrics error',
        errorType: 'Error',
      });
    });
  });

  describe('cache driver fallback scenarios', () => {
    let originalCacheDriver: string | undefined;
    let originalRedisUrl: string | undefined;

    beforeEach(() => {
      originalCacheDriver = process.env.CACHE_DRIVER;
      originalRedisUrl = process.env.REDIS_URL;
    });

    afterEach(() => {
      if (originalCacheDriver !== undefined) {
        process.env.CACHE_DRIVER = originalCacheDriver;
      } else {
        delete process.env.CACHE_DRIVER;
      }

      if (originalRedisUrl !== undefined) {
        process.env.REDIS_URL = originalRedisUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('should fallback to memory cache when REDIS_URL is missing', async () => {
      process.env.CACHE_DRIVER = 'redis';
      delete process.env.REDIS_URL;

      const cache = createCache();
      await cache.init();

      const app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.set('cache', cache);
        await next();
      });
      app.route('/health', healthRoutes);

      const res = await app.request('/health/ready');
      const data = await res.json();

      expect(data.services.cache.details.type).toBe('MemoryCache');

      await cache.close();
    });
  });
});
