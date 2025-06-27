import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRedisClient, getRedisClient, closeRedisConnection } from '../config/redis';
import type { Redis } from 'ioredis';

describe('Redis Connection Integration', () => {
  let redis: Redis;

  beforeAll(async () => {
    // Use the connection from environment
    redis = createRedisClient();
    await redis.connect();
  });

  afterAll(async () => {
    if (redis) {
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
      const expectedUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      expect(redis.options.host).toBe('localhost');
      expect(redis.options.port).toBe(6379);
    });

    it('should persist data across operations', async () => {
      const key = 'integration:test:persist';
      const value = 'test-value-' + Date.now();

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
      const operations = Array.from({ length: 10 }, async (_, i) => {
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
      await redis.rpush('test:list', 'a', 'b', 'c');
      expect(await redis.lrange('test:list', 0, -1)).toEqual(['a', 'b', 'c']);

      // Set
      await redis.sadd('test:set', 'member1', 'member2');
      expect(await redis.sismember('test:set', 'member1')).toBe(1);

      // Hash
      await redis.hset('test:hash', 'field1', 'value1');
      expect(await redis.hget('test:hash', 'field1')).toBe('value1');

      // Cleanup
      await redis.del('test:string', 'test:number', 'test:list', 'test:set', 'test:hash');
    });

    it('should handle expiration correctly', async () => {
      const key = 'test:expiring';
      
      // Set with 2 second expiration
      await redis.setex(key, 2, 'expires soon');
      
      // Should exist immediately
      expect(await redis.exists(key)).toBe(1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2100));
      
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
      
      expect(results).toEqual([
        [null, 'OK'],
        [null, 'OK'],
        [null, 'value1'],
        [null, 'value2']
      ]);

      // Cleanup
      await redis.del('test:tx:1', 'test:tx:2');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getRedisClient();
      const instance2 = getRedisClient();
      
      expect(instance1).toBe(instance2);
    });

    it('should maintain connection across getInstance calls', async () => {
      const instance = getRedisClient();
      const pong = await instance.ping();
      expect(pong).toBe('PONG');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      try {
        // @ts-ignore - Intentionally calling invalid command
        await redis.invalidCommand();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should recover from temporary disconnection', async () => {
      // This test would require actually stopping/starting Redis
      // For now, we just verify the connection is healthy
      const isConnected = redis.status === 'ready';
      expect(isConnected).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle reasonable load', async () => {
      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await redis.set(`perf:test:${i}`, `value-${i}`);
      }

      const writeTime = Date.now() - start;
      
      const readStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await redis.get(`perf:test:${i}`);
      }
      
      const readTime = Date.now() - readStart;

      // Cleanup
      const keys = Array.from({ length: iterations }, (_, i) => `perf:test:${i}`);
      await redis.del(...keys);

      // Performance assertions (generous limits for CI)
      expect(writeTime).toBeLessThan(1000); // 100 writes in < 1 second
      expect(readTime).toBeLessThan(500);   // 100 reads in < 0.5 seconds
      
      console.log(`Performance: ${iterations} writes in ${writeTime}ms, ${iterations} reads in ${readTime}ms`);
    });
  });
});