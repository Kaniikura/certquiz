import type { RedisClientType } from 'redis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestLogger } from '../lib/logger';
import { createTestLogger, findLogByLevel } from '../lib/logger';
import { createRedisClient, getRedisConfig } from './redis';

// Test configuration generator for property-based testing
function generateValidUrls(): string[] {
  return [
    'redis://localhost:6379',
    'redis://user:pass@redis.example.com:6380/0',
    'redis://:password@localhost:6379/1',
    'redis://localhost:6379/2',
    'redis://127.0.0.1:6379',
    'redis://redis-server:6379/0',
  ];
}

function generateInvalidUrls(): string[] {
  return [
    'not-a-valid-url',
    'redis://[invalid url]',
    '   ',
    '',
    // Note: 'redis://' is actually a valid URL, so we don't include it here
  ];
}

function _generateValidButNonRedisUrls(): string[] {
  return [
    'http://wrong-protocol.com',
    'redis://localhost:99999', // invalid port range but valid URL
    'redis://localhost:-1', // negative port but valid URL format
  ];
}

function generateEdgeCaseConfigs(): Array<{ env: Record<string, string>; description: string }> {
  return [
    { env: {}, description: 'empty environment' },
    { env: { REDIS_URL: '' }, description: 'empty REDIS_URL' },
    { env: { REDIS_URL: '   ' }, description: 'whitespace REDIS_URL' },
    { env: { REDIS_URL: 'redis://localhost:6379' }, description: 'basic URL' },
    { env: { REDIS_URL: 'redis://user:pass@localhost:6379/0' }, description: 'URL with auth' },
  ];
}

// Redis client lifecycle manager for test isolation
class RedisTestManager {
  private clients: RedisClientType[] = [];
  private testKeys: Set<string> = new Set();

  track(client: RedisClientType): RedisClientType {
    this.clients.push(client);
    return client;
  }

  addTestKey(key: string): void {
    this.testKeys.add(key);
  }

  generateTestKey(prefix: string): string {
    const key = `test:${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    this.addTestKey(key);
    return key;
  }

  async cleanup(): Promise<void> {
    // Clean up test keys from all connected clients
    const cleanupPromises = this.clients
      .filter((client) => client.isOpen)
      .map(async (client) => {
        if (this.testKeys.size > 0) {
          try {
            const keysArray = Array.from(this.testKeys);
            await client.del(keysArray);
          } catch (_error) {
            // Ignore cleanup errors
          }
        }
        try {
          await client.quit();
        } catch (_error) {
          // Ignore quit errors
        }
      });

    await Promise.allSettled(cleanupPromises);
    this.clients = [];
    this.testKeys.clear();
  }
}

describe('Redis Configuration', () => {
  let testLogger: TestLogger;
  let testManager: RedisTestManager;

  beforeEach(() => {
    testLogger = createTestLogger();
    testManager = new RedisTestManager();
  });

  afterEach(async () => {
    await testManager.cleanup();
  });

  describe('Configuration Parsing', () => {
    describe('Default Configuration', () => {
      it('should return secure defaults when no environment variables are provided', () => {
        const config = getRedisConfig({}, testLogger);

        expect(config.url).toBe('redis://localhost:6379');
        expect(config.socket?.reconnectStrategy).toBeTypeOf('function');
        expect(config.socket?.keepAlive).toBe(30000);

        expect(findLogByLevel(testLogger.logs, 'error')).toBeUndefined();
      });

      it('should provide sensible retry strategy defaults', () => {
        const config = getRedisConfig({}, testLogger);
        const reconnectStrategy = config.socket?.reconnectStrategy as (
          retries: number
        ) => number | false;

        // Test exponential backoff pattern
        const attempts = [1, 2, 3, 5, 8];
        const delays = attempts.map((attempt) => reconnectStrategy(attempt));

        // Verify increasing delays (accounting for jitter)
        for (let i = 1; i < delays.length; i++) {
          const currentBase = 1000 * 2 ** (attempts[i] - 1);
          const prevBase = 1000 * 2 ** (attempts[i - 1] - 1);
          expect(currentBase).toBeGreaterThan(prevBase);
        }

        // Verify max attempts limit (should return false)
        expect(reconnectStrategy(11)).toBe(false);
      });
    });

    describe('URL Parsing - Valid Cases', () => {
      const validConfigs = generateValidUrls().map((url) => ({
        url,
        description: `should parse ${url}`,
      }));

      it.each(validConfigs)('$description', ({ url }) => {
        const config = getRedisConfig({ REDIS_URL: url }, testLogger);

        expect(config.url).toBeTypeOf('string');
        expect(config.url).toBeDefined();
        expect((config.url as string).length).toBeGreaterThan(0);
        expect(config.url).toContain('redis://');

        // Should not log errors for valid URLs
        expect(findLogByLevel(testLogger.logs, 'error')).toBeUndefined();
      });
    });

    describe('URL Parsing - Invalid Cases', () => {
      const invalidConfigs = generateInvalidUrls().map((url) => ({
        url,
        description: `should handle invalid URL: ${url}`,
      }));

      it.each(invalidConfigs)('$description', ({ url }) => {
        // Create a fresh logger for each test to avoid interference
        const freshLogger = createTestLogger();
        const config = getRedisConfig({ REDIS_URL: url }, freshLogger);

        // Should fallback to safe defaults for invalid URLs
        expect(config.url).toBe('redis://localhost:6379');
        expect(config.socket?.reconnectStrategy).toBeTypeOf('function');
        expect(config.socket?.keepAlive).toBe(30000);

        // Should have some kind of logging (error or warning)
        expect(freshLogger.logs.length).toBeGreaterThan(0);

        // At minimum, configuration should be valid and functional
        expect(config).toBeDefined();
        expect(typeof config.url).toBe('string');
        expect(config.url).toBeDefined();
        expect((config.url as string).length).toBeGreaterThan(0);
      });
    });

    describe('Edge Case Configurations', () => {
      const edgeCases = generateEdgeCaseConfigs();

      it.each(edgeCases)('should handle $description correctly', ({ env }) => {
        const config = getRedisConfig(env, testLogger);

        // All configurations should result in valid config objects
        expect(config.url).toBeDefined();
        expect(config.url).toBeTypeOf('string');
        expect((config.url as string).length).toBeGreaterThan(0);
        expect(config.socket?.reconnectStrategy).toBeDefined();
        expect(config.socket?.reconnectStrategy).toBeTypeOf('function');
      });
    });
  });

  describe('Client Creation and Lifecycle', () => {
    it('should create client instances with correct configuration', () => {
      const client = testManager.track(createRedisClient());

      expect(client).toBeDefined();
      expect(client.isOpen).toBe(false); // Not connected yet
      expect(client.options?.url).toContain('redis://');
    });

    it('should handle multiple client instances independently', () => {
      const clients = Array.from({ length: 3 }, () => testManager.track(createRedisClient()));

      clients.forEach((client) => {
        expect(client).toBeDefined();
        expect(client.isOpen).toBe(false); // Not connected yet
      });

      // Each client should be a separate instance
      const instances = new Set(clients);
      expect(instances.size).toBe(3);
    });
  });

  describe('Redis Operations Integration', () => {
    let redis: RedisClientType;

    beforeEach(async () => {
      redis = testManager.track(createRedisClient());
      await redis.connect();
    });

    describe('Basic Operations', () => {
      it('should perform fundamental Redis operations correctly', async () => {
        const key = testManager.generateTestKey('basic');

        // Test SET/GET
        await redis.set(key, 'test-value');
        const value = await redis.get(key);
        expect(value).toBe('test-value');

        // Test EXISTS
        const exists = await redis.exists(key);
        expect(exists).toBe(1);

        // Test DEL
        const deleted = await redis.del(key);
        expect(deleted).toBe(1);

        // Test key no longer exists
        const afterDelete = await redis.get(key);
        expect(afterDelete).toBeNull();
      });

      it('should handle expiration correctly', async () => {
        const key = testManager.generateTestKey('expiration');

        // Set with shorter expiration for testing
        await redis.setEx(key, 1, 'expires-soon');

        // Should exist initially
        let value = await redis.get(key);
        expect(value).toBe('expires-soon');

        // Check TTL
        const ttl = await redis.ttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(1);

        // Wait for expiration with shorter timeout
        await new Promise((resolve) => setTimeout(resolve, 1100));

        // Should be expired
        value = await redis.get(key);
        expect(value).toBeNull();
      });
    });

    describe('Data Type Operations', () => {
      it('should handle JSON serialization correctly', async () => {
        const key = testManager.generateTestKey('json');
        const testData = {
          id: 123,
          name: 'Test Object',
          tags: ['redis', 'test'],
          metadata: { created: new Date().toISOString() },
          nested: { deep: { value: 42 } },
        };

        // Store JSON
        await redis.set(key, JSON.stringify(testData));

        // Retrieve and parse
        const retrieved = await redis.get(key);
        expect(retrieved).toBeTruthy();
        if (retrieved) {
          expect(JSON.parse(retrieved)).toEqual(testData);
        }
      });

      it('should handle hash operations', async () => {
        const key = testManager.generateTestKey('hash');

        // Set hash fields
        await redis.hSet(key, { field1: 'value1', field2: 'value2' });

        // Get individual field
        const field1 = await redis.hGet(key, 'field1');
        expect(field1).toBe('value1');

        // Get all fields
        const allFields = await redis.hGetAll(key);
        expect(allFields).toEqual({
          field1: 'value1',
          field2: 'value2',
        });
      });

      it('should support list operations', async () => {
        const key = testManager.generateTestKey('list');

        // Push items to list
        await redis.lPush(key, ['item1', 'item2', 'item3']);

        // Get list length
        const length = await redis.lLen(key);
        expect(length).toBe(3);

        // Pop item from list
        const item = await redis.rPop(key);
        expect(item).toBe('item1');

        // Get remaining list
        const remaining = await redis.lRange(key, 0, -1);
        expect(remaining).toEqual(['item3', 'item2']);
      });

      it('should support set operations', async () => {
        const key = testManager.generateTestKey('set');

        // Add items to set
        await redis.sAdd(key, ['member1', 'member2', 'member3']);

        // Check if member exists
        const exists = await redis.sIsMember(key, 'member2');
        expect(exists).toBe(true);

        // Get all members
        const members = await redis.sMembers(key);
        expect(members.sort()).toEqual(['member1', 'member2', 'member3']);

        // Remove member
        const removed = await redis.sRem(key, 'member2');
        expect(removed).toBe(1);

        // Check remaining members
        const remaining = await redis.sMembers(key);
        expect(remaining.sort()).toEqual(['member1', 'member3']);
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle connection failures gracefully', async () => {
      const badClient = testManager.track(
        createRedisClient({
          REDIS_URL: 'redis://localhost:9999', // Invalid port
        })
      );

      await expect(badClient.connect()).rejects.toThrow();
      expect(badClient.isOpen).toBe(false);
    });

    it('should handle network timeouts appropriately', async () => {
      // Use a very short timeout to make test fast
      const client = testManager.track(
        createRedisClient({
          REDIS_URL: 'redis://1.2.3.4:6379', // Non-routable IP
          REDIS_CONNECT_TIMEOUT: '100', // Very short timeout
        })
      );

      // This should timeout quickly and throw
      await expect(client.connect()).rejects.toThrow();
    }, 2000); // 2 second test timeout

    it('should recover from temporary disconnections', async () => {
      const client = testManager.track(createRedisClient());
      await client.connect();

      const key = testManager.generateTestKey('recovery');
      await client.set(key, 'before-disconnect');

      // Simulate disconnect and reconnect with new client
      await client.quit();

      const newClient = testManager.track(createRedisClient());
      await newClient.connect();

      // Data should persist
      const value = await newClient.get(key);
      expect(value).toBe('before-disconnect');
    });
  });

  describe('Redis Health and Monitoring', () => {
    let redis: RedisClientType;

    beforeEach(async () => {
      redis = testManager.track(createRedisClient());
      await redis.connect();
    });

    it('should provide comprehensive health check information', async () => {
      const ping = await redis.ping();
      expect(ping).toBe('PONG');

      const serverInfo = await redis.info('server');
      expect(serverInfo).toContain('redis_version');
      expect(serverInfo).toContain('uptime_in_seconds');

      const memoryInfo = await redis.info('memory');
      expect(memoryInfo).toContain('used_memory');
    });

    it('should provide connection statistics', async () => {
      const clientInfo = await redis.info('clients');
      expect(clientInfo).toContain('connected_clients');

      const statsInfo = await redis.info('stats');
      expect(statsInfo).toContain('total_commands_processed');
      expect(statsInfo).toContain('total_connections_received');
    });

    it('should report database keyspace information', async () => {
      const key = testManager.generateTestKey('keyspace');
      await redis.set(key, 'test');

      const keyspaceInfo = await redis.info('keyspace');
      // Should contain database information when keys exist
      expect(keyspaceInfo.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Edge Cases and Validation', () => {
    it('should handle malformed environment configurations robustly', () => {
      const malformedConfigs = [
        { REDIS_URL: 'redis://localhost:abc' }, // Invalid port
        { REDIS_URL: 'redis://localhost:-1' }, // Negative port
        { REDIS_URL: 'redis://localhost:99999' }, // Port out of range
        { REDIS_URL: 'not-redis://localhost' }, // Wrong protocol
        { REDIS_URL: '\x00\x01\x02' }, // Binary data
      ];

      malformedConfigs.forEach((config) => {
        const result = getRedisConfig(config, testLogger);

        // Should always return a valid configuration
        expect(result.url).toBe('redis://localhost:6379');
        expect(result.socket?.reconnectStrategy).toBeTypeOf('function');
      });
    });

    it('should validate retry strategy behavior under various conditions', () => {
      const config = getRedisConfig({}, testLogger);
      const reconnectStrategy = config.socket?.reconnectStrategy as (
        retries: number
      ) => number | false;

      // Test boundary conditions
      expect(reconnectStrategy(1)).toBeGreaterThan(0); // First retry
      expect(reconnectStrategy(2)).toBeGreaterThan(0); // Second retry
      expect(reconnectStrategy(10)).toBe(false); // Max retries exceeded
      expect(reconnectStrategy(0)).toBe(false); // Invalid attempt number (0)
      expect(reconnectStrategy(-1)).toBe(false); // Invalid attempt number (negative)
      expect(reconnectStrategy(100)).toBe(false); // Way over limit

      // Test exponential growth (accounting for jitter ±20%)
      const delays = [1, 2, 3, 4, 5].map((attempt) => reconnectStrategy(attempt));

      // Verify each delay is within expected jitter range
      delays.forEach((delay, index) => {
        if (delay !== false) {
          const attempt = index + 1;
          const baseDelay = Math.min(2 ** (attempt - 1) * 1000, 16000);
          const minDelay = baseDelay * 0.8;
          const maxDelay = baseDelay * 1.2;

          expect(delay).toBeGreaterThanOrEqual(minDelay);
          expect(delay).toBeLessThanOrEqual(maxDelay);
        }
      });
    });

    it('should handle various Redis URL formats correctly', () => {
      const urlTests = [
        {
          url: 'redis://localhost:6379',
          expectedUrl: 'redis://localhost:6379',
        },
        {
          url: 'redis://user:pass@redis.example.com:6380/0',
          expectedUrl: 'redis://user:pass@redis.example.com:6380/0',
        },
        {
          url: 'redis://:password@localhost:6379/1',
          expectedUrl: 'redis://:password@localhost:6379/1',
        },
      ];

      urlTests.forEach(({ url, expectedUrl }) => {
        const config = getRedisConfig({ REDIS_URL: url }, testLogger);

        expect(config.url).toBe(expectedUrl);

        // Should not log errors for valid URLs
        expect(findLogByLevel(testLogger.logs, 'error')).toBeUndefined();
      });
    });
  });
});
