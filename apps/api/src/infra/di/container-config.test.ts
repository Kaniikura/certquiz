/**
 * Container configuration tests
 * @fileoverview Tests for environment-specific DI container configurations
 */

import type { IPremiumAccessService } from '@api/features/question/domain';
import { describe, expect, it } from 'vitest';
import {
  configureAllEnvironments,
  createConfiguredContainer,
  getEnvironmentFromNodeEnv,
} from './container-config';
import { DIContainer } from './DIContainer';
import {
  AUTH_PROVIDER_TOKEN,
  CLOCK_TOKEN,
  ID_GENERATOR_TOKEN,
  LOGGER_TOKEN,
  PREMIUM_ACCESS_SERVICE_TOKEN,
  QUESTION_DETAILS_SERVICE_TOKEN,
  QUESTION_SERVICE_TOKEN,
  UNIT_OF_WORK_PROVIDER_TOKEN,
} from './tokens';

describe('Container Configuration', () => {
  describe('Test environment configuration', () => {
    it('should configure test environment with in-memory implementations', () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');

      // Assert - All services should be registered
      expect(container.has(LOGGER_TOKEN)).toBe(true);
      expect(container.has(CLOCK_TOKEN)).toBe(true);
      expect(container.has(ID_GENERATOR_TOKEN)).toBe(true);
      expect(container.has(UNIT_OF_WORK_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(AUTH_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(PREMIUM_ACCESS_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_DETAILS_SERVICE_TOKEN)).toBe(true);
    });

    it('should use InMemoryUnitOfWorkProvider in test environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const uowProvider = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      // Assert
      expect(uowProvider.constructor.name).toBe('InMemoryUnitOfWorkProvider');
    });

    it('should use stub auth provider in test environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const authProvider = container.resolve(AUTH_PROVIDER_TOKEN);

      // Assert
      expect(authProvider).toBeDefined();
      // Stub auth provider accepts any non-empty password
      const result = await authProvider.authenticate('test@example.com', 'password');
      expect(result.success).toBe(true);
    });

    it('should use fake premium access service in test environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const premiumService = container.resolve<IPremiumAccessService>(PREMIUM_ACCESS_SERVICE_TOKEN);

      // Assert
      expect(premiumService).toBeDefined();
      // Fake service always allows access
      expect(premiumService.shouldIncludePremiumContent(false, false)).toBe(true);
      const result = premiumService.validatePremiumAccess(false, true);
      expect(result.success).toBe(true);
    });

    it('should use UUID generator in test environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('test');
      const idGenerator = container.resolve(ID_GENERATOR_TOKEN);

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
      expect(container.has(UNIT_OF_WORK_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(AUTH_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(PREMIUM_ACCESS_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_DETAILS_SERVICE_TOKEN)).toBe(true);
    });

    it('should use DrizzleUnitOfWorkProvider in development environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const uowProvider = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      // Assert
      expect(uowProvider.constructor.name).toBe('DrizzleUnitOfWorkProvider');
    });

    it('should use fake auth provider in development environment', async () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const authProvider = container.resolve(AUTH_PROVIDER_TOKEN);

      // Assert
      expect(authProvider).toBeDefined();
      // Fake auth provider is configured to succeed by default
      const result = await authProvider.authenticate('test@example.com', 'password');
      expect(result.success).toBe(true);
    });

    it('should use real premium access service in development environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const premiumService = container.resolve<IPremiumAccessService>(PREMIUM_ACCESS_SERVICE_TOKEN);

      // Assert
      expect(premiumService).toBeDefined();
      expect(premiumService.constructor.name).toBe('PremiumAccessService');
      // Real service denies access to unauthenticated users
      expect(premiumService.shouldIncludePremiumContent(false, false)).toBe(false);
      const result = premiumService.validatePremiumAccess(false, true);
      expect(result.success).toBe(false);
    });

    it('should use UUID generator in development environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('development');
      const idGenerator = container.resolve(ID_GENERATOR_TOKEN);

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
      expect(container.has(UNIT_OF_WORK_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(AUTH_PROVIDER_TOKEN)).toBe(true);
      expect(container.has(PREMIUM_ACCESS_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_SERVICE_TOKEN)).toBe(true);
      expect(container.has(QUESTION_DETAILS_SERVICE_TOKEN)).toBe(true);
    });

    it('should use DrizzleUnitOfWorkProvider in production environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('production');
      const uowProvider = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      // Assert
      expect(uowProvider.constructor.name).toBe('DrizzleUnitOfWorkProvider');
    });

    it('should use real premium access service in production environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('production');
      const premiumService = container.resolve<IPremiumAccessService>(PREMIUM_ACCESS_SERVICE_TOKEN);

      // Assert
      expect(premiumService).toBeDefined();
      expect(premiumService.constructor.name).toBe('PremiumAccessService');
      // Real service denies access to unauthenticated users
      expect(premiumService.shouldIncludePremiumContent(false, true)).toBe(false);
      const result = premiumService.validatePremiumAccess(false, true);
      expect(result.success).toBe(false);
    });

    it('should use UUID generator in production environment', () => {
      // Arrange & Act
      const container = createConfiguredContainer('production');
      const idGenerator = container.resolve(ID_GENERATOR_TOKEN);

      // Assert
      expect(idGenerator).toBeDefined();
      const id = idGenerator.generate();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Environment detection', () => {
    it('should detect test environment from NODE_ENV', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Act
      const env = getEnvironmentFromNodeEnv();

      // Assert
      expect(env).toBe('test');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect production environment from NODE_ENV', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Act
      const env = getEnvironmentFromNodeEnv();

      // Assert
      expect(env).toBe('production');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should default to development for unknown NODE_ENV', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'staging';

      // Act
      const env = getEnvironmentFromNodeEnv();

      // Assert
      expect(env).toBe('development');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should default to development when NODE_ENV is not set', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      // Act
      const env = getEnvironmentFromNodeEnv();

      // Assert
      expect(env).toBe('development');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Service singleton behavior', () => {
    it('should maintain singleton instances within same environment', () => {
      // Arrange
      const container = createConfiguredContainer('test');

      // Act
      const logger1 = container.resolve(LOGGER_TOKEN);
      const logger2 = container.resolve(LOGGER_TOKEN);
      const uow1 = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
      const uow2 = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      // Assert
      expect(logger1).toBe(logger2);
      expect(uow1).toBe(uow2);
    });

    it('should create new instances when switching environments', () => {
      // Arrange
      const container = new DIContainer();
      configureAllEnvironments(container);

      // Act
      container.configureForEnvironment('test');
      const testUow = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      container.configureForEnvironment('development');
      const devUow = container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      // Assert - Different instances for different environments
      // Note: Logger is a singleton, but UnitOfWork providers should be different
      expect(testUow).not.toBe(devUow);
      expect(testUow.constructor.name).toBe('InMemoryUnitOfWorkProvider');
      expect(devUow.constructor.name).toBe('DrizzleUnitOfWorkProvider');
    });
  });
});
