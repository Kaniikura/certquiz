/**
 * Async DI Container configuration for different environments
 * @fileoverview Configures service registrations using async container for environments requiring async initialization
 */

// The async database provider is used as the default for all environments requiring asynchronous initialization.

import type { Environment } from '@api/config/env';
import { PremiumAccessService } from '@api/features/question/domain/services/PremiumAccessService';
import { StubQuestionDetailsService } from '@api/features/quiz/domain/value-objects/QuestionDetailsService';
import { StubQuestionService } from '@api/features/quiz/start-quiz/QuestionService';
import { systemClock } from '@api/shared/clock';
import { FakePremiumAccessService } from '@/test-support/fakes';
import { FakeAuthProvider } from '../auth/AuthProvider.fake';
import { StubAuthProvider } from '../auth/AuthProvider.stub';
import { createAuthProvider as createProductionAuthProvider } from '../auth/AuthProviderFactory.prod';
import { AsyncDatabaseContext } from '../db/AsyncDatabaseContext';
import { ProductionDatabaseProvider } from '../db/ProductionDatabaseProvider';
import { validateDatabaseUrl } from '../db/shared';
import { TestDatabaseProvider } from '../db/TestDatabaseProvider';
import { getRootLogger } from '../logger/root-logger';
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
    // Infrastructure
    c.register(LOGGER_TOKEN, () => getRootLogger());
    c.register(CLOCK_TOKEN, () => systemClock);
    c.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

    // Database configuration with async provider
    c.register(
      DATABASE_PROVIDER_TOKEN,
      async () => {
        const logger = await c.resolve(LOGGER_TOKEN);
        return new TestDatabaseProvider(logger);
      },
      { singleton: true }
    );

    // Register database client from provider
    c.register(
      DATABASE_CLIENT_TOKEN,
      async () => {
        const provider = await c.resolve(DATABASE_PROVIDER_TOKEN);
        // TestDatabaseProvider will handle async initialization internally
        return provider.getDatabase();
      },
      { singleton: false } // New instance per test for isolation
    );

    c.register(
      DATABASE_CONTEXT_TOKEN,
      async () => {
        const logger = await c.resolve(LOGGER_TOKEN);
        const databaseProvider = await c.resolve(DATABASE_PROVIDER_TOKEN);
        // Create context with auto-initialization disabled for manual control.
        // autoInitialize is set to false in tests to allow explicit, manual initialization of the database context.
        // This ensures that each test can control when and how initialization occurs, improving test isolation and reliability.
        // In production or other environments, autoInitialize should be enabled to allow the context to set up automatically.
        const context = new AsyncDatabaseContext(logger, databaseProvider, {
          autoInitialize: false,
        });
        // Initialize it explicitly for tests
        await context.initialize();
        return context;
      },
      { singleton: false } // New instance per test for isolation
    );

    // Auth - Use stub for predictable testing
    c.register(AUTH_PROVIDER_TOKEN, () => new StubAuthProvider(), { singleton: true });

    // Premium Access - Use fake for testing
    c.register(PREMIUM_ACCESS_SERVICE_TOKEN, () => new FakePremiumAccessService(), {
      singleton: true,
    });

    // Quiz Services - Use stubs
    c.register(QUESTION_SERVICE_TOKEN, () => new StubQuestionService(), { singleton: true });
    c.register(QUESTION_DETAILS_SERVICE_TOKEN, () => new StubQuestionDetailsService(), {
      singleton: true,
    });
  });
}

/**
 * Configure container for development environment
 * Uses real database but fake auth for local development
 * @internal
 */
function configureDevelopmentContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('development', (c) => {
    // Infrastructure
    c.register(LOGGER_TOKEN, () => getRootLogger());
    c.register(CLOCK_TOKEN, () => systemClock);
    c.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

    // Database configuration with async provider
    c.register(
      DATABASE_PROVIDER_TOKEN,
      async () => {
        const logger = await c.resolve(LOGGER_TOKEN);
        const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
        const config = {
          databaseUrl,
          enableLogging: true,
          environment: 'development',
        };
        return new ProductionDatabaseProvider(logger, config);
      },
      { singleton: true }
    );

    // Register database client from provider
    c.register(
      DATABASE_CLIENT_TOKEN,
      async () => {
        const provider = await c.resolve(DATABASE_PROVIDER_TOKEN);
        return provider.getDatabase();
      },
      { singleton: true }
    );

    c.register(
      DATABASE_CONTEXT_TOKEN,
      async () => {
        const logger = await c.resolve(LOGGER_TOKEN);
        const databaseProvider = await c.resolve(DATABASE_PROVIDER_TOKEN);
        return new AsyncDatabaseContext(logger, databaseProvider);
      },
      { singleton: true }
    );

    // Auth - Use fake provider for local development
    c.register(
      AUTH_PROVIDER_TOKEN,
      () => {
        const fakeAuth = new FakeAuthProvider();
        // Configure fake auth to succeed by default for development
        fakeAuth.givenAuthenticationSucceeds();
        fakeAuth.givenTokenValidationSucceeds();
        return fakeAuth;
      },
      { singleton: true }
    );

    // Premium Access - Use real implementation for development (needed for integration tests)
    c.register(PREMIUM_ACCESS_SERVICE_TOKEN, () => new PremiumAccessService(), {
      singleton: true,
    });

    // Quiz Services - Use stubs for now (TODO: implement real services)
    c.register(QUESTION_SERVICE_TOKEN, () => new StubQuestionService(), { singleton: true });
    c.register(QUESTION_DETAILS_SERVICE_TOKEN, () => new StubQuestionDetailsService(), {
      singleton: true,
    });
  });
}

/**
 * Configure container for production environment
 * Uses real implementations for all services
 * @internal
 */
function configureProductionContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('production', (c) => {
    // Infrastructure
    c.register(LOGGER_TOKEN, () => getRootLogger());
    c.register(CLOCK_TOKEN, () => systemClock);
    c.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

    // Database configuration with async provider
    c.register(
      DATABASE_PROVIDER_TOKEN,
      async () => {
        const logger = await c.resolve(LOGGER_TOKEN);
        const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
        const config = {
          databaseUrl,
          enableLogging: false,
          environment: 'production',
          defaultPoolConfig: {
            max: parseInt(process.env.DB_POOL_MAX || DEFAULT_DB_POOL_MAX.toString(), 10),
          },
        };
        return new ProductionDatabaseProvider(logger, config);
      },
      { singleton: true }
    );

    // Register database client from provider
    c.register(
      DATABASE_CLIENT_TOKEN,
      async () => {
        const provider = await c.resolve(DATABASE_PROVIDER_TOKEN);
        return provider.getDatabase();
      },
      { singleton: true }
    );

    c.register(
      DATABASE_CONTEXT_TOKEN,
      async () => {
        const logger = await c.resolve(LOGGER_TOKEN);
        const databaseProvider = await c.resolve(DATABASE_PROVIDER_TOKEN);
        return new AsyncDatabaseContext(logger, databaseProvider);
      },
      { singleton: true }
    );

    // Auth - Use real KeyCloak provider
    c.register(AUTH_PROVIDER_TOKEN, () => createProductionAuthProvider(), {
      singleton: true,
    });

    // Premium Access - Use real implementation
    c.register(PREMIUM_ACCESS_SERVICE_TOKEN, () => new PremiumAccessService(), { singleton: true });

    // Quiz Services - Use stubs for now (TODO: implement real services)
    c.register(QUESTION_SERVICE_TOKEN, () => new StubQuestionService(), { singleton: true });
    c.register(QUESTION_DETAILS_SERVICE_TOKEN, () => new StubQuestionDetailsService(), {
      singleton: true,
    });
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
