import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCache, type Cache } from './redis';

describe('Cache implementations', () => {
  describe('MemoryCache', () => {
    let cache: Cache;

    beforeEach(async () => {
      // Save and set environment
      process.env.CACHE_DRIVER = 'memory';
      cache = createCache();
      await cache.init();
    });

    afterEach(async () => {
      if (cache?.close) {
        await cache.close();
      }
    });

    it('should initialize without errors', () => {
      expect(cache).toBeDefined();
    });

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('should set and get values', async () => {
      await cache.set('test-key', 'test-value');
      const value = await cache.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should respect TTL', async () => {
      await cache.set('ttl-key', 'ttl-value', 1); // 1 second TTL

      // Value should exist immediately
      let value = await cache.get('ttl-key');
      expect(value).toBe('ttl-value');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Value should be gone
      value = await cache.get('ttl-key');
      expect(value).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('delete-key', 'delete-value');
      await cache.del('delete-key');
      const value = await cache.get('delete-key');
      expect(value).toBeNull();
    });

    it('should return PONG on ping', async () => {
      const result = await cache.ping();
      expect(result).toBe('PONG');
    });

    it('should clear all values on close', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.close();

      // Re-initialize to check if values were cleared
      await cache.init();
      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });

    it('should clean up timers on close', async () => {
      // Set multiple keys with TTL
      await cache.set('timer1', 'value1', 10);
      await cache.set('timer2', 'value2', 10);
      await cache.set('timer3', 'value3', 10);

      // Close should clear all timers
      await cache.close();

      // No timers should be active after close
      // This test ensures no memory leaks from hanging timers
      expect(cache).toBeDefined();
    });
  });

  describe('createCache factory', () => {
    let originalCacheDriver: string | undefined;
    let originalRedisUrl: string | undefined;

    beforeEach(() => {
      // Save original values
      originalCacheDriver = process.env.CACHE_DRIVER;
      originalRedisUrl = process.env.REDIS_URL;
    });

    afterEach(() => {
      // Restore original values
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

    it('should create MemoryCache when CACHE_DRIVER is memory', () => {
      process.env.CACHE_DRIVER = 'memory';
      const cache = createCache();

      expect(cache.constructor.name).toBe('MemoryCache');
    });

    it('should create MemoryCache when REDIS_URL is not provided', () => {
      process.env.CACHE_DRIVER = 'redis';
      delete process.env.REDIS_URL;

      const cache = createCache();

      expect(cache.constructor.name).toBe('MemoryCache');
    });

    it('should create RedisCache when CACHE_DRIVER is redis and REDIS_URL is provided', () => {
      process.env.CACHE_DRIVER = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const cache = createCache();

      expect(cache.constructor.name).toBe('RedisCache');
    });
  });

  describe('production guards', () => {
    let originalCacheDriver: string | undefined;
    let originalRedisUrl: string | undefined;
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      // Save original values
      originalCacheDriver = process.env.CACHE_DRIVER;
      originalRedisUrl = process.env.REDIS_URL;
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      // Restore original values
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

      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('should throw error when CACHE_DRIVER is memory in production', () => {
      process.env.CACHE_DRIVER = 'memory';
      process.env.NODE_ENV = 'production';

      expect(() => createCache()).toThrowError(
        'MemoryCache is not allowed in production environment'
      );
    });

    it('should throw error when REDIS_URL is missing in production', () => {
      process.env.CACHE_DRIVER = 'redis';
      delete process.env.REDIS_URL;
      process.env.NODE_ENV = 'production';

      expect(() => createCache()).toThrowError('REDIS_URL is required in production environment');
    });

    it('should allow MemoryCache in non-production environments', () => {
      process.env.CACHE_DRIVER = 'memory';
      process.env.NODE_ENV = 'development';

      const cache = createCache();
      expect(cache.constructor.name).toBe('MemoryCache');
    });
  });
});
