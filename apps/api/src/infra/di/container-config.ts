/**
 * Async DI Container configuration for different environments
 * @fileoverview Configures service registrations using async container for environments requiring async initialization
 */

// The async database provider is used as the default for all environments requiring asynchronous initialization.

import type { Environment } from '@api/config/env';
import { DIContainer } from './DIContainer';
import { registerCommonInfrastructure } from './registerCommonInfrastructure';

/**
 * Default maximum connections for database pool
 */
const DEFAULT_DB_POOL_MAX = 20;

/**
 * Configure container for test environment
 * Uses in-memory implementations and stubs for fast testing
 * @internal
 */
function configureTestContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('test', (c) => {
    registerCommonInfrastructure(c, {
      enableLogging: false,
      environment: 'test',
      authProvider: 'stub',
      premiumAccessProvider: 'fake',
    });
    // No test-specific overrides needed - all test configuration is handled by registerCommonInfrastructure
  });
}

/**
 * Configure container for development environment
 * Uses real database but fake auth for local development
 * @internal
 */
function configureDevelopmentContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('development', (c) => {
    registerCommonInfrastructure(c, {
      enableLogging: true,
      environment: 'development',
      authProvider: 'fake',
      premiumAccessProvider: 'real',
    });
    // No development-specific overrides needed - all configuration is handled by registerCommonInfrastructure
  });
}

/**
 * Configure container for production environment
 * Uses real implementations for all services
 * @internal
 */
function configureProductionContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('production', (c) => {
    registerCommonInfrastructure(c, {
      enableLogging: false,
      environment: 'production',
      poolConfig: {
        max: parseInt(process.env.DB_POOL_MAX || DEFAULT_DB_POOL_MAX.toString(), 10),
      },
      authProvider: 'production',
      premiumAccessProvider: 'real',
    });
    // No production-specific overrides needed - all configuration is handled by registerCommonInfrastructure
  });
}

/**
 * Configure all environments in the container
 */
export function configureAllEnvironments(container: DIContainer): void {
  configureTestContainer(container);
  configureDevelopmentContainer(container);
  configureProductionContainer(container);
}

/**
 * Create and configure a new async container
 * @param environment - Target environment
 * @returns Configured async DI container
 */
export function createConfiguredContainer(environment: Environment): DIContainer {
  const container = new DIContainer();
  configureAllEnvironments(container);
  container.configureForEnvironment(environment);
  return container;
}
