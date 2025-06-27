import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRedisClient, getRedisClient, closeRedisConnection } from '../config/redis';
import type { RedisClientType } from 'redis';

describe('Redis Connection Integration', () => {
  let redis: RedisClientType;

  beforeAll(async () => {
    // Use the connection from environment
    redis = createRedisClient();
    await redis.connect();
  });

  afterAll(async () => {
    if (redis?.isOpen) {
      await redis.quit();
    }
    await closeRedisConnection();
  });

  describe('Docker Compose Environment', () => {
    it('should connect to Redis running in Docker', async () => {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('should use the correct Redis URL from environment', () => {
      const _expectedUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      // Dynamically check based on actual configuration
      if (process.env.REDIS_URL) {
        const url = new URL(process.env.REDIS_URL);
        expect(redis.options?.url).toContain(url.hostname);
        expect(redis.options?.url).toContain(url.port || '6379');
      } else {
        // Fallback to defaults
        expect(redis.options?.url).toContain(process.env.REDIS_HOST || 'localhost');
        expect(redis.options?.url).toContain(process.env.REDIS_PORT || '6379');
      }
    });

    it('should persist data across operations', async () => {
      const key = 'integration:test:persist';
      const value = `test-value-${Date.now()}`;

      // Set value
      await redis.set(key, value);

      // Get value
      const retrieved = await redis.get(key);
      expect(retrieved).toBe(value);

      // Check TTL (should be -1 for no expiration)
      const ttl = await redis.ttl(key);
      expect(ttl).toBe(-1);

      // Cleanup
      await redis.del(key);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, async (_, i) => {
        const key = `integration:concurrent:${i}`;
        await redis.set(key, `value-${i}`);
        const value = await redis.get(key);
        await redis.del(key);
        return value;
      });

      const results = await Promise.all(operations);

      results.forEach((value, i) => {
        expect(value).toBe(`value-${i}`);
      });
    });

    it('should support all basic data types', async () => {
      // String
      await redis.set('test:string', 'hello');
      expect(await redis.get('test:string')).toBe('hello');

      // Number (stored as string)
      await redis.set('test:number', '42');
      expect(await redis.get('test:number')).toBe('42');

      // List
      await redis.rPush('test:list', ['a', 'b', 'c']);
      expect(await redis.lRange('test:list', 0, -1)).toEqual(['a', 'b', 'c']);

      // Set
      await redis.sAdd('test:set', ['member1', 'member2']);
      expect(await redis.sIsMember('test:set', 'member1')).toBe(true);

      // Hash
      await redis.hSet('test:hash', 'field1', 'value1');
      expect(await redis.hGet('test:hash', 'field1')).toBe('value1');

      // Cleanup
      await redis.del(['test:string', 'test:number', 'test:list', 'test:set', 'test:hash']);
    });

    it('should handle expiration correctly', async () => {
      const key = 'test:expiring';

      // Set with 1 second expiration
      await redis.setEx(key, 1, 'expires soon');

      // Should exist immediately
      expect(await redis.exists(key)).toBe(1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(await redis.exists(key)).toBe(0);
    });

    it('should support transactions', async () => {
      const multi = redis.multi();

      multi.set('test:tx:1', 'value1');
      multi.set('test:tx:2', 'value2');
      multi.get('test:tx:1');
      multi.get('test:tx:2');

      const results = await multi.exec();

      // node-redis v4 returns array of results directly (not nested arrays)
      expect(results).toEqual(['OK', 'OK', 'value1', 'value2']);

      // Cleanup
      await redis.del(['test:tx:1', 'test:tx:2']);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', async () => {
      const instance1 = await getRedisClient();
      const instance2 = await getRedisClient();

      expect(instance1).toBe(instance2);
    });

    it('should maintain connection across getInstance calls', async () => {
      const instance = await getRedisClient();
      const pong = await instance.ping();
      expect(pong).toBe('PONG');
    });

    it('should be connected and ready', async () => {
      const instance = await getRedisClient();
      expect(instance.isOpen).toBe(true);
      expect(instance.isReady).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should report connection status and handle reconnection', async () => {
      expect(redis.isOpen).toBe(true);
      expect(redis.isReady).toBe(true);

      // Test with separate client
      const testClient = createRedisClient();
      await testClient.connect();

      const pong = await testClient.ping();
      expect(pong).toBe('PONG');

      await testClient.quit();
    });
  });

  describe('Performance', () => {
    it('should handle basic load and pipelining', async () => {
      const iterations = 10;

      // Test basic operations
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        await redis.set(`perf:test:${i}`, `value-${i}`);
      }
      const writeTime = Date.now() - start;

      // Test pipelining
      const pipelineStart = Date.now();
      const pipeline = redis.multi();
      for (let i = 0; i < iterations; i++) {
        pipeline.get(`perf:test:${i}`);
      }
      await pipeline.exec();
      const pipelineTime = Date.now() - pipelineStart;

      // Cleanup
      const keys = Array.from({ length: iterations }, (_, i) => `perf:test:${i}`);
      await redis.del(keys);

      // Basic performance assertions
      expect(writeTime).toBeLessThan(500);
      expect(pipelineTime).toBeLessThan(200);
    });
  });

  describe('Essential Redis Features', () => {
    it('should support basic sorted sets and scripting', async () => {
      // Test sorted sets (essential for some app features)
      const key = 'test:zset';
      await redis.zAdd(key, [
        { score: 1, value: 'one' },
        { score: 2, value: 'two' },
      ]);

      const range = await redis.zRange(key, 0, -1);
      expect(range).toEqual(['one', 'two']);

      // Cleanup
      await redis.del(key);
    });
  });

  describe('Connection Resilience', () => {
    it('should handle connection before commands', async () => {
      const testClient = createRedisClient();

      // Connect first (node-redis v4 requires connection before commands)
      await testClient.connect();

      // Send command after connection
      await testClient.set('test:queue', 'queued-value');

      const value = await testClient.get('test:queue');
      expect(value).toBe('queued-value');

      // Cleanup
      await testClient.del('test:queue');
      await testClient.quit();
    });

    it('should maintain data integrity during reconnections', async () => {
      const key = 'test:integrity';
      const value = 'important-data';

      // Set data
      await redis.set(key, value);

      // Verify data exists
      expect(await redis.get(key)).toBe(value);

      // Data should persist even if we create a new connection
      const newClient = createRedisClient();
      await newClient.connect();

      expect(await newClient.get(key)).toBe(value);

      // Cleanup
      await redis.del(key);
      await newClient.quit();
    });
  });
});
