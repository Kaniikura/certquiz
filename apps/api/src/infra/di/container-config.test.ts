import type { IPremiumAccessService } from '@api/features/question/domain/services/IPremiumAccessService';
import { describe, expect, it } from 'vitest';
import { configureAllEnvironments, createConfiguredContainer } from './container-config';
import { DIContainer } from './DIContainer';
import {
  AUTH_PROVIDER_TOKEN,
  CLOCK_TOKEN,
  DATABASE_CLIENT_TOKEN,
  DATABASE_CONTEXT_TOKEN,
  DATABASE_PROVIDER_TOKEN,
  ID_GENERATOR_TOKEN,
  LOGGER_TOKEN,
  PREMIUM_ACCESS_SERVICE_TOKEN,
  QUESTION_DETAILS_SERVICE_TOKEN,
  QUESTION_SERVICE_TOKEN,
} from './tokens';

describe('Async Container Configuration', () => {
  describe('Test environment configuration', () => {
    it('should configure test environment with test implementations', () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');

      // Assert - All services should be registered
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(CLOCK_TOKEN)).toBe(true);
      expect(container.has(ID_GENERATOR_TOKEN)).toBe(true);
      expect(container.has(DATABASE_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(DATABASE_CLIENT_TOKEN)).toBe(true);
      expect(container.has(DATABASE_CONTEXT_TOKEN)).toBe(true);
      expect(container.has(AUTH_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(PREMIUM_ACCESS_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_DETAILS_SERVICE_TOKEN)).toBe(true);
    });

    it('should use TestDatabaseProvider in test environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const databaseProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

      // Assert
      expect(databaseProvider.constructor.name).toBe('TestDatabaseProvider');
    });

    it('should use AsyncDatabaseContext in test environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const databaseContext = await container.resolve(DATABASE_CONTEXT_TOKEN);

      // Assert
      expect(databaseContext.constructor.name).toBe('AsyncDatabaseContext');
    });

    it('should use same database client instance per worker in test', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const db1 = await container.resolve(DATABASE_CLIENT_TOKEN);
      const db2 = await container.resolve(DATABASE_CLIENT_TOKEN);

      // Assert - TestDatabaseProvider returns same instance per worker for efficiency
      expect(db1).toBe(db2);
    });

    it('should create different database instances for different worker IDs', async () => {
      // Arrange
      const container = createConfiguredContainer('test');
      const provider = await container.resolve(DATABASE_PROVIDER_TOKEN);

      // Act - Get databases for different worker IDs
      const dbWorker1 = await provider.getDatabase({ workerId: 'worker-1' });
      const dbWorker2 = await provider.getDatabase({ workerId: 'worker-2' });
      const dbWorker1Again = await provider.getDatabase({ workerId: 'worker-1' });

      // Assert
      expect(dbWorker1).not.toBe(dbWorker2); // Different workers get different instances
      expect(dbWorker1).toBe(dbWorker1Again); // Same worker gets same instance
    });

    it('should use stub auth provider in test environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const authProvider = await container.resolve(AUTH_PROVIDER_TOKEN);

      // Assert
      expect(authProvider).toBeDefined();
      expect(authProvider.constructor.name).toBe('StubAuthProvider');
      // Stub auth provider accepts any non-empty password
      const result = await authProvider.authenticate('test@example.com', 'password');
      expect(result.success).toBe(true);
    });

    it('should use fake premium access service in test environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const premiumService = await container.resolve<IPremiumAccessService>(
        PREMIUM_ACCESS_SERVICE_TOKEN
      );

      // Assert
      expect(premiumService).toBeDefined();
      // Fake service always allows access
      expect(premiumService.shouldIncludePremiumContent(false, false)).toBe(true);
      const result = premiumService.validatePremiumAccess(false, true);
      expect(result.success).toBe(true);
    });

    it('should use UUID generator in test environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const idGenerator = await container.resolve(ID_GENERATOR_TOKEN);

      // Assert
      expect(idGenerator).toBeDefined();
      const id = idGenerator.generate();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Development environment configuration', () => {
    it('should configure development environment with mixed implementations', () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');

      // Assert - All services should be registered
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(CLOCK_TOKEN)).toBe(true);
      expect(container.has(ID_GENERATOR_TOKEN)).toBe(true);
      expect(container.has(DATABASE_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(DATABASE_CLIENT_TOKEN)).toBe(true);
      expect(container.has(DATABASE_CONTEXT_TOKEN)).toBe(true);
      expect(container.has(AUTH_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(PREMIUM_ACCESS_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_DETAILS_SERVICE_TOKEN)).toBe(true);
    });

    it('should use ProductionDatabaseProvider in development environment', async () => {
      // Arrange
      // Mock DATABASE_URL to avoid environment dependency in tests
      const originalDatabaseUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

      try {
        // Act
        const container = createConfiguredContainer('development');
        const databaseProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

        // Assert
        expect(databaseProvider.constructor.name).toBe('ProductionDatabaseProvider');
      } finally {
        // Cleanup
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        } else {
          delete process.env.DATABASE_URL;
        }
      }
    });

    it('should throw error if DATABASE_URL is not set in development', async () => {
      // Arrange
      const originalDatabaseUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        // Act
        const container = createConfiguredContainer('development');

        // Assert
        await expect(container.resolve(DATABASE_PROVIDER_TOKEN)).rejects.toThrow(
          'DATABASE_URL environment variable is required'
        );
      } finally {
        // Cleanup
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        }
      }
    });

    it('should use fake auth provider in development environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const authProvider = await container.resolve(AUTH_PROVIDER_TOKEN);

      // Assert
      expect(authProvider).toBeDefined();
      expect(authProvider.constructor.name).toBe('FakeAuthProvider');
      // Fake auth provider is configured to succeed by default
      const result = await authProvider.authenticate('test@example.com', 'password');
      expect(result.success).toBe(true);
    });

    it('should use real premium access service in development environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const premiumService = await container.resolve<IPremiumAccessService>(
        PREMIUM_ACCESS_SERVICE_TOKEN
      );

      // Assert
      expect(premiumService).toBeDefined();
      expect(premiumService.constructor.name).toBe('PremiumAccessService');
      // Real service denies access to unauthenticated users
      expect(premiumService.shouldIncludePremiumContent(false, false)).toBe(false);
      const result = premiumService.validatePremiumAccess(false, true);
      expect(result.success).toBe(false);
    });

    it('should use UUID generator in development environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const idGenerator = await container.resolve(ID_GENERATOR_TOKEN);

      // Assert
      expect(idGenerator).toBeDefined();
      const id = idGenerator.generate();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Production environment configuration', () => {
    it('should configure production environment with real implementations', () => {
      // Arrange & Act
      const container = createConfiguredContainer('production');

      // Assert - All services should be registered
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(CLOCK_TOKEN)).toBe(true);
      expect(container.has(ID_GENERATOR_TOKEN)).toBe(true);
      expect(container.has(DATABASE_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(DATABASE_CLIENT_TOKEN)).toBe(true);
      expect(container.has(DATABASE_CONTEXT_TOKEN)).toBe(true);
      expect(container.has(AUTH_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(PREMIUM_ACCESS_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_DETAILS_SERVICE_TOKEN)).toBe(true);
    });

    it('should use ProductionDatabaseProvider in production environment', async () => {
      // Arrange
      // Mock DATABASE_URL to avoid environment dependency in tests
      const originalDatabaseUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

      try {
        // Act
        const container = createConfiguredContainer('production');
        const databaseProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

        // Assert
        expect(databaseProvider.constructor.name).toBe('ProductionDatabaseProvider');
      } finally {
        // Cleanup
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        } else {
          delete process.env.DATABASE_URL;
        }
      }
    });

    it('should throw error if DATABASE_URL is not set in production', async () => {
      // Arrange
      const originalDatabaseUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        // Act
        const container = createConfiguredContainer('production');

        // Assert
        await expect(container.resolve(DATABASE_PROVIDER_TOKEN)).rejects.toThrow(
          'DATABASE_URL environment variable is required'
        );
      } finally {
        // Cleanup
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        }
      }
    });

    it('should use real premium access service in production environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('production');
      const premiumService = await container.resolve<IPremiumAccessService>(
        PREMIUM_ACCESS_SERVICE_TOKEN
      );

      // Assert
      expect(premiumService).toBeDefined();
      expect(premiumService.constructor.name).toBe('PremiumAccessService');
      // Real service denies access to unauthenticated users
      expect(premiumService.shouldIncludePremiumContent(false, true)).toBe(false);
      const result = premiumService.validatePremiumAccess(false, true);
      expect(result.success).toBe(false);
    });

    it('should use UUID generator in production environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('production');
      const idGenerator = await container.resolve(ID_GENERATOR_TOKEN);

      // Assert
      expect(idGenerator).toBeDefined();
      const id = idGenerator.generate();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should use pool configuration from environment in production', async () => {
      // Arrange
      const originalDatabaseUrl = process.env.DATABASE_URL;
      const originalPoolMax = process.env.DB_POOL_MAX;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.DB_POOL_MAX = '50';

      try {
        // Act
        const container = createConfiguredContainer('production');
        const databaseProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

        // Assert
        expect(databaseProvider).toBeDefined();
        // Note: We can't directly verify the pool config, but we can verify the provider was created
        expect(databaseProvider.constructor.name).toBe('ProductionDatabaseProvider');
      } finally {
        // Cleanup
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        } else {
          delete process.env.DATABASE_URL;
        }
        if (originalPoolMax) {
          process.env.DB_POOL_MAX = originalPoolMax;
        } else {
          delete process.env.DB_POOL_MAX;
        }
      }
    });
  });

  describe('Service singleton behavior', () => {
    it('should maintain singleton instances within same environment', async () => {
      // Arrange
      const container = createConfiguredContainer('test');

      // Act
      const logger1 = await container.resolve(LOGGER_TOKEN);
      const logger2 = await container.resolve(LOGGER_TOKEN);
      const provider1 = await container.resolve(DATABASE_PROVIDER_TOKEN);
      const provider2 = await container.resolve(DATABASE_PROVIDER_TOKEN);

      // Assert
      expect(logger1).toBe(logger2);
      expect(provider1).toBe(provider2);
    });

    it('should create new instances when switching environments', async () => {
      // Arrange
      const container = new DIContainer();
      configureAllEnvironments(container);

      // Mock DATABASE_URL for development/production
      const originalDatabaseUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

      try {
        // Act
        container.configureForEnvironment('test');
        const testProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

        container.configureForEnvironment('development');
        const devProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

        // Assert - Different instances for different environments
        expect(testProvider).not.toBe(devProvider);
        expect(testProvider.constructor.name).toBe('TestDatabaseProvider');
        expect(devProvider.constructor.name).toBe('ProductionDatabaseProvider');
      } finally {
        // Cleanup
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        } else {
          delete process.env.DATABASE_URL;
        }
      }
    });

    it('should handle async factory functions correctly', async () => {
      // Arrange
      const container = createConfiguredContainer('test');

      // Act - Resolve multiple async services concurrently
      const [provider, context, auth] = await Promise.all([
        container.resolve(DATABASE_PROVIDER_TOKEN),
        container.resolve(DATABASE_CONTEXT_TOKEN),
        container.resolve(AUTH_PROVIDER_TOKEN),
      ]);

      // Assert
      expect(provider).toBeDefined();
      expect(context).toBeDefined();
      expect(auth).toBeDefined();
      expect(provider.constructor.name).toBe('TestDatabaseProvider');
      expect(context.constructor.name).toBe('AsyncDatabaseContext');
      expect(auth.constructor.name).toBe('StubAuthProvider');
    });
  });

  describe('Question services configuration', () => {
    it('should use stub question services in all environments', async () => {
      // Arrange
      const environments: Array<'test' | 'development' | 'production'> = [
        'test',
        'development',
        'production',
      ];

      for (const env of environments) {
        // Mock DATABASE_URL for development/production
        if (env !== 'test') {
          process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
        }

        // Act
        const container = createConfiguredContainer(env);
        const questionService = await container.resolve(QUESTION_SERVICE_TOKEN);
        const questionDetailsService = await container.resolve(QUESTION_DETAILS_SERVICE_TOKEN);

        // Assert
        expect(questionService.constructor.name).toBe('StubQuestionService');
        expect(questionDetailsService.constructor.name).toBe('StubQuestionDetailsService');

        // Cleanup
        if (env !== 'test') {
          delete process.env.DATABASE_URL;
        }
      }
    });
  });
});
