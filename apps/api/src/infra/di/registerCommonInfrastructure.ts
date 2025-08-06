/**
 * Common infrastructure registration for DI container
 * @fileoverview Extracts common service registrations to eliminate duplication across environment configurations
 */

import type { Environment } from '@api/config/env';
import { PremiumAccessService } from '@api/features/question/domain/services/PremiumAccessService';
import { QuizCompletionService } from '@api/features/quiz/application/QuizCompletionService';

import { StubQuestionService } from '@api/features/quiz/start-quiz/QuestionService';
import { systemClock } from '@api/shared/clock';
import { FakePremiumAccessService } from '@api/test-support/fakes/services/FakePremiumAccessService';
import { FakeAuthProvider } from '../auth/AuthProvider.fake';
import { StubAuthProvider } from '../auth/AuthProvider.stub';
import { createAuthProvider as createProductionAuthProvider } from '../auth/AuthProviderFactory.prod';
import { AsyncDatabaseContext } from '../db/AsyncDatabaseContext';
import { DrizzleUnitOfWorkProvider } from '../db/DrizzleUnitOfWorkProvider';
import { ProductionDatabaseProvider } from '../db/ProductionDatabaseProvider';
import { validateDatabaseUrl } from '../db/shared';
import { TestDatabaseProvider } from '../db/TestDatabaseProvider';
import { getRootLogger } from '../logger/root-logger';
import type { DIContainer } from './DIContainer';
import {
  AUTH_PROVIDER_TOKEN,
  CLOCK_TOKEN,
  DATABASE_CLIENT_TOKEN,
  DATABASE_CONTEXT_TOKEN,
  DATABASE_PROVIDER_TOKEN,
  ID_GENERATOR_TOKEN,
  LOGGER_TOKEN,
  PREMIUM_ACCESS_SERVICE_TOKEN,
  QUESTION_SERVICE_TOKEN,
  QUIZ_COMPLETION_SERVICE_TOKEN,
  UNIT_OF_WORK_PROVIDER_TOKEN,
} from './tokens';

/**
 * Determines if DI services should use singleton behavior based on environment
 * Test environments require new instances for proper test isolation
 *
 * @param environment - The target environment
 * @returns true for singleton behavior (non-test), false for new instances (test)
 */
function shouldUseSingleton(environment: Environment): boolean {
  return environment !== 'test';
}

/**
 * Configuration options for environment-specific service registration
 */
interface EnvironmentConfig {
  /** Whether to enable database query logging */
  enableLogging: boolean;
  /** Target environment */
  environment: Environment;
  /** Database connection pool configuration */
  poolConfig?: {
    max?: number;
    min?: number;
    idleTimeoutMillis?: number;
  };
  /** Auth provider selection */
  authProvider: 'stub' | 'fake' | 'production';
  /** Premium access service selection */
  premiumAccessProvider: 'fake' | 'real';
}

/**
 * Registers common infrastructure services across all environments
 *
 * @param container - The DI container to register services in
 * @param config - Environment-specific configuration options
 */
export function registerCommonInfrastructure(
  container: DIContainer,
  config: EnvironmentConfig
): void {
  // Common infrastructure registrations - identical across all environments
  container.register(LOGGER_TOKEN, () => getRootLogger());
  container.register(CLOCK_TOKEN, () => systemClock);
  container.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

  // Database provider configuration with environment-specific selection
  container.register(
    DATABASE_PROVIDER_TOKEN,
    async () => {
      const logger = await container.resolve(LOGGER_TOKEN);

      // Environment-specific database provider selection
      if (config.environment === 'test') {
        return new TestDatabaseProvider(logger);
      } else {
        const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
        const dbConfig = {
          databaseUrl,
          enableLogging: config.enableLogging,
          environment: config.environment,
          ...(config.poolConfig && { defaultPoolConfig: config.poolConfig }),
        };
        return new ProductionDatabaseProvider(logger, dbConfig);
      }
    },
    { singleton: true }
  );

  // Database client registration with environment-specific singleton behavior
  container.register(
    DATABASE_CLIENT_TOKEN,
    async () => {
      const provider = await container.resolve(DATABASE_PROVIDER_TOKEN);
      return provider.getDatabase();
    },
    { singleton: shouldUseSingleton(config.environment) } // Test isolation requires new instances
  );

  // Unit of Work Provider with environment-specific singleton behavior
  container.register(
    UNIT_OF_WORK_PROVIDER_TOKEN,
    async () => {
      const logger = await container.resolve(LOGGER_TOKEN);
      return new DrizzleUnitOfWorkProvider(logger);
    },
    { singleton: shouldUseSingleton(config.environment) } // Test isolation requires new instances
  );

  // Database context with environment-specific initialization
  container.register(
    DATABASE_CONTEXT_TOKEN,
    async () => {
      const logger = await container.resolve(LOGGER_TOKEN);
      const databaseProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);
      const unitOfWorkProvider = await container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);

      if (config.environment === 'test') {
        // Test environment: manual initialization for precise control
        const context = new AsyncDatabaseContext(
          logger,
          databaseProvider,
          { autoInitialize: false },
          unitOfWorkProvider
        );
        await context.initialize();
        return context;
      } else {
        // Development/Production: automatic initialization
        return new AsyncDatabaseContext(logger, databaseProvider, {}, unitOfWorkProvider);
      }
    },
    { singleton: shouldUseSingleton(config.environment) } // Test isolation requires new instances
  );

  // Auth provider selection based on configuration
  switch (config.authProvider) {
    case 'stub':
      container.register(AUTH_PROVIDER_TOKEN, () => new StubAuthProvider(), { singleton: true });
      break;
    case 'fake':
      container.register(
        AUTH_PROVIDER_TOKEN,
        () => {
          const fakeAuth = new FakeAuthProvider();
          fakeAuth.givenAuthenticationSucceeds();
          fakeAuth.givenTokenValidationSucceeds();
          return fakeAuth;
        },
        { singleton: true }
      );
      break;
    case 'production':
      container.register(AUTH_PROVIDER_TOKEN, () => createProductionAuthProvider(), {
        singleton: true,
      });
      break;
  }

  // Premium access service selection
  if (config.premiumAccessProvider === 'fake') {
    container.register(PREMIUM_ACCESS_SERVICE_TOKEN, () => new FakePremiumAccessService(), {
      singleton: true,
    });
  } else {
    container.register(PREMIUM_ACCESS_SERVICE_TOKEN, () => new PremiumAccessService(), {
      singleton: true,
    });
  }

  // Quiz services - currently use stubs across all environments
  // TODO: Implement real services for production
  container.register(QUESTION_SERVICE_TOKEN, () => new StubQuestionService(), { singleton: true });
  // Question Details Service is now created per transaction context in UnitOfWork/DatabaseContext

  // Quiz application services
  container.register(
    QUIZ_COMPLETION_SERVICE_TOKEN,
    async () => {
      const unitOfWorkProvider = await container.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
      const clock = await container.resolve(CLOCK_TOKEN);
      return new QuizCompletionService(unitOfWorkProvider, clock);
    },
    { singleton: true }
  );
}
