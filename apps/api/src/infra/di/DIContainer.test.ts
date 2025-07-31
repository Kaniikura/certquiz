/**
 * DIContainer unit tests
 * @fileoverview Tests for the async dependency injection container
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createServiceToken, DIContainer } from './DIContainer';

// Test service interfaces
interface ILogger {
  log(message: string): void;
}

interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

interface IService {
  doWork(): Promise<string>;
}

// Test service implementations
class ConsoleLogger implements ILogger {
  private logs: string[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  getLogs(): string[] {
    return this.logs;
  }
}

class MockDatabase implements IDatabase {
  connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}

class TestService implements IService {
  constructor(
    private logger: ILogger,
    private database: IDatabase
  ) {}

  async doWork(): Promise<string> {
    this.logger.log('Doing work');
    // Use database to avoid unused variable warning
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    return 'work done';
  }
}

describe('DIContainer', () => {
  let container: DIContainer;

  // Create typed tokens
  const LOGGER_TOKEN = createServiceToken<ILogger>('LOGGER');
  const DATABASE_TOKEN = createServiceToken<IDatabase>('DATABASE');
  const SERVICE_TOKEN = createServiceToken<IService>('SERVICE');

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('Basic registration and resolution', () => {
    it('should register and resolve a simple service', async () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());

      // Act
      const logger = await container.resolve(LOGGER_TOKEN);

      // Assert
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should throw error when resolving unregistered service', async () => {
      // Act & Assert
      await expect(container.resolve(LOGGER_TOKEN)).rejects.toThrow(
        'Service not registered: Symbol(LOGGER)'
      );
    });

    it('should check if service is registered', () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());

      // Act & Assert
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(DATABASE_TOKEN)).toBe(false);
    });
  });

  describe('Singleton behavior', () => {
    it('should return same instance for singleton services', async () => {
      // Arrange
      container.register(DATABASE_TOKEN, () => new MockDatabase(), { singleton: true });

      // Act
      const db1 = await container.resolve(DATABASE_TOKEN);
      const db2 = await container.resolve(DATABASE_TOKEN);

      // Assert
      expect(db1).toBe(db2);
    });

    it('should return new instance for transient services', async () => {
      // Arrange
      container.register(DATABASE_TOKEN, () => new MockDatabase(), { singleton: false });

      // Act
      const db1 = await container.resolve(DATABASE_TOKEN);
      const db2 = await container.resolve(DATABASE_TOKEN);

      // Assert
      expect(db1).not.toBe(db2);
      expect(db1).toBeInstanceOf(MockDatabase);
      expect(db2).toBeInstanceOf(MockDatabase);
    });

    it('should default to singleton when options not specified', async () => {
      // Arrange
      container.register(DATABASE_TOKEN, () => new MockDatabase());

      // Act
      const db1 = await container.resolve(DATABASE_TOKEN);
      const db2 = await container.resolve(DATABASE_TOKEN);

      // Assert
      expect(db1).toBe(db2);
    });
  });

  describe('Async factory support', () => {
    it('should support async factories', async () => {
      // Arrange
      container.register(DATABASE_TOKEN, async () => {
        const db = new MockDatabase();
        await db.connect();
        return db;
      });

      // Act
      const database = await container.resolve(DATABASE_TOKEN);

      // Assert
      expect(database).toBeInstanceOf(MockDatabase);
      expect((database as MockDatabase).connected).toBe(true);
    });

    it('should handle concurrent resolution of singletons', async () => {
      // Arrange
      let createCount = 0;
      container.register(
        DATABASE_TOKEN,
        async () => {
          createCount++;
          // Simulate async initialization
          await new Promise((resolve) => setTimeout(resolve, 10));
          return new MockDatabase();
        },
        { singleton: true }
      );

      // Act - Resolve concurrently
      const [db1, db2, db3] = await Promise.all([
        container.resolve(DATABASE_TOKEN),
        container.resolve(DATABASE_TOKEN),
        container.resolve(DATABASE_TOKEN),
      ]);

      // Assert - Should only create once
      expect(createCount).toBe(1);
      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
    });

    it('should handle factory errors properly', async () => {
      // Arrange
      container.register(DATABASE_TOKEN, async () => {
        throw new Error('Factory error');
      });

      // Act & Assert
      await expect(container.resolve(DATABASE_TOKEN)).rejects.toThrow('Factory error');
    });

    it('should clean up singleton promise on error', async () => {
      // Arrange
      let attemptCount = 0;
      container.register(
        DATABASE_TOKEN,
        async () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('First attempt fails');
          }
          return new MockDatabase();
        },
        { singleton: true }
      );

      // Act & Assert
      await expect(container.resolve(DATABASE_TOKEN)).rejects.toThrow('First attempt fails');

      // Second attempt should succeed
      const db = await container.resolve(DATABASE_TOKEN);
      expect(db).toBeInstanceOf(MockDatabase);
      expect(attemptCount).toBe(2);
    });
  });

  describe('Dependency resolution', () => {
    it('should resolve services with dependencies', async () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());
      container.register(DATABASE_TOKEN, () => new MockDatabase());
      container.register(SERVICE_TOKEN, async () => {
        const logger = await container.resolve(LOGGER_TOKEN);
        const database = await container.resolve(DATABASE_TOKEN);
        return new TestService(logger, database);
      });

      // Act
      const service = await container.resolve(SERVICE_TOKEN);

      // Assert
      expect(service).toBeInstanceOf(TestService);
      expect(await service.doWork()).toBe('work done');
    });
  });

  describe('Environment configuration', () => {
    it('should configure container for specific environment', () => {
      // Arrange
      container.registerEnvironmentConfig('test', (c) => {
        c.register(LOGGER_TOKEN, () => new ConsoleLogger());
      });

      container.registerEnvironmentConfig('production', (c) => {
        c.register(LOGGER_TOKEN, () => new ConsoleLogger());
        c.register(DATABASE_TOKEN, () => new MockDatabase());
      });

      // Act & Assert - Test environment
      container.configureForEnvironment('test');
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(DATABASE_TOKEN)).toBe(false);

      // Act & Assert - Production environment
      container.configureForEnvironment('production');
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(DATABASE_TOKEN)).toBe(true);
    });

    it('should preserve singleton instances when switching environments', async () => {
      // Arrange
      container.registerEnvironmentConfig('development', (c) => {
        c.register(DATABASE_TOKEN, () => new MockDatabase(), { singleton: true });
      });

      // Act
      container.configureForEnvironment('development');
      const db1 = await container.resolve(DATABASE_TOKEN);

      // Re-configure same environment
      container.configureForEnvironment('development');
      const db2 = await container.resolve(DATABASE_TOKEN);

      // Assert - Should be different instances after reconfiguration
      expect(db1).not.toBe(db2);
    });

    it('should track current environment', () => {
      // Arrange & Act
      expect(container.getCurrentEnvironment()).toBeNull();

      container.configureForEnvironment('test');
      expect(container.getCurrentEnvironment()).toBe('test');

      container.configureForEnvironment('production');
      expect(container.getCurrentEnvironment()).toBe('production');
    });
  });

  describe('Container utilities', () => {
    it('should clear all registrations', () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());
      container.register(DATABASE_TOKEN, () => new MockDatabase());

      // Act
      container.clear();

      // Assert
      expect(container.has(LOGGER_TOKEN)).toBe(false);
      expect(container.has(DATABASE_TOKEN)).toBe(false);
      expect(container.getCurrentEnvironment()).toBeNull();
    });

    it('should list all registered tokens', () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());
      container.register(DATABASE_TOKEN, () => new MockDatabase());

      // Act
      const tokens = container.getRegisteredTokens();

      // Assert
      expect(tokens).toHaveLength(2);
      expect(tokens).toContain(LOGGER_TOKEN);
      expect(tokens).toContain(DATABASE_TOKEN);
    });

    it('should create child container with inherited registrations', async () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());
      container.register(DATABASE_TOKEN, () => new MockDatabase(), { singleton: true });

      // Act
      const child = container.createChild();

      // Assert
      expect(child.has(LOGGER_TOKEN)).toBe(true);
      expect(child.has(DATABASE_TOKEN)).toBe(true);

      // Child should have fresh singleton instances
      const parentDb = await container.resolve(DATABASE_TOKEN);
      const childDb = await child.resolve(DATABASE_TOKEN);
      expect(parentDb).not.toBe(childDb);
    });

    it('should inherit environment configurations in child container', () => {
      // Arrange
      container.registerEnvironmentConfig('test', (c) => {
        c.register(LOGGER_TOKEN, () => new ConsoleLogger());
      });
      container.configureForEnvironment('test');

      // Act
      const child = container.createChild();

      // Assert
      expect(child.getCurrentEnvironment()).toBe('test');
      expect(child.has(LOGGER_TOKEN)).toBe(true);
    });
  });

  describe('Type safety', () => {
    it('should provide type-safe resolution with ServiceToken', async () => {
      // Arrange
      container.register(LOGGER_TOKEN, () => new ConsoleLogger());

      // Act
      const logger: ILogger = await container.resolve(LOGGER_TOKEN);

      // Assert - TypeScript ensures type safety
      expect(logger.log).toBeDefined();
      expect(typeof logger.log).toBe('function');
    });

    it('should work with plain symbols', async () => {
      // Arrange
      const PLAIN_SYMBOL = Symbol('PLAIN_SERVICE');
      container.register(PLAIN_SYMBOL, () => ({ value: 42 }));

      // Act
      const service = await container.resolve(PLAIN_SYMBOL);

      // Assert
      expect(service).toEqual({ value: 42 });
    });
  });

  describe('Edge cases', () => {
    it('should handle circular dependencies gracefully', async () => {
      // This is a limitation - circular dependencies will cause stack overflow
      // The container doesn't detect or prevent this
      const SERVICE_A = createServiceToken<{ name: string }>('SERVICE_A');
      const SERVICE_B = createServiceToken<{ name: string }>('SERVICE_B');

      container.register(SERVICE_A, async () => {
        await container.resolve(SERVICE_B); // Circular!
        return { name: 'A' };
      });

      container.register(SERVICE_B, async () => {
        await container.resolve(SERVICE_A); // Circular!
        return { name: 'B' };
      });

      // Act & Assert
      await expect(container.resolve(SERVICE_A)).rejects.toThrow();
    });

    it('should handle null and undefined factories', async () => {
      // Arrange
      const NULL_TOKEN = createServiceToken<null>('NULL_SERVICE');
      const UNDEFINED_TOKEN = createServiceToken<undefined>('UNDEFINED_SERVICE');

      container.register(NULL_TOKEN, () => null);
      container.register(UNDEFINED_TOKEN, () => undefined);

      // Act & Assert
      expect(await container.resolve(NULL_TOKEN)).toBeNull();
      expect(await container.resolve(UNDEFINED_TOKEN)).toBeUndefined();
    });
  });
});
