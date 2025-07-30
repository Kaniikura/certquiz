/**
 * DI Container configuration for different environments
 * @fileoverview Configures service registrations for test, development, and production environments
 */

import type { IPremiumAccessService } from '@api/features/question/domain/services/IPremiumAccessService';
import { PremiumAccessService } from '@api/features/question/domain/services/PremiumAccessService';
import type { QuestionAccessDeniedError } from '@api/features/question/shared/errors';
import { StubQuestionDetailsService } from '@api/features/quiz/domain/value-objects/QuestionDetailsService';
import { StubQuestionService } from '@api/features/quiz/start-quiz/QuestionService';
import { systemClock } from '@api/shared/clock';
import { Result } from '@api/shared/result';
import { FakeAuthProvider } from '../auth/AuthProvider.fake';
import { StubAuthProvider } from '../auth/AuthProvider.stub';
import { createAuthProvider as createProductionAuthProvider } from '../auth/AuthProviderFactory.prod';
import { getDb } from '../db/client';
import { DrizzleUnitOfWorkProvider } from '../db/DrizzleUnitOfWorkProvider';
import { InMemoryUnitOfWorkProvider } from '../db/InMemoryUnitOfWorkProvider';
import { getRootLogger } from '../logger/root-logger';
import { DIContainer, type Environment } from './DIContainer';
import {
  AUTH_PROVIDER_TOKEN,
  CLOCK_TOKEN,
  DATABASE_CLIENT_TOKEN,
  ID_GENERATOR_TOKEN,
  LOGGER_TOKEN,
  PREMIUM_ACCESS_SERVICE_TOKEN,
  QUESTION_DETAILS_SERVICE_TOKEN,
  QUESTION_SERVICE_TOKEN,
  UNIT_OF_WORK_PROVIDER_TOKEN,
} from './tokens';

/**
 * Fake implementation of IPremiumAccessService for testing
 * Always allows access to premium content
 */
class FakePremiumAccessService implements IPremiumAccessService {
  shouldIncludePremiumContent(
    _isAuthenticated: boolean,
    _requestedPremiumAccess: boolean
  ): boolean {
    // In tests, always include premium content
    return true;
  }

  validatePremiumAccess(
    _isAuthenticated: boolean,
    _isPremiumContent: boolean
  ): Result<void, Error> {
    // In tests, always allow access
    return Result.ok(undefined);
  }

  validateQuestionPremiumAccess(
    _isAuthenticated: boolean,
    _isPremiumContent: boolean,
    _questionId: string
  ): Result<void, QuestionAccessDeniedError> {
    // In tests, always allow access
    return Result.ok(undefined);
  }
}

/**
 * Configure container for test environment
 * Uses in-memory implementations and stubs for fast testing
 */
export function configureTestContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('test', (c) => {
    // Infrastructure
    c.register(LOGGER_TOKEN, () => getRootLogger());
    c.register(CLOCK_TOKEN, () => systemClock);
    c.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

    // Database - Use in-memory for unit tests
    c.register(UNIT_OF_WORK_PROVIDER_TOKEN, () => new InMemoryUnitOfWorkProvider(), {
      singleton: true,
    });

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
 */
export function configureDevelopmentContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('development', (c) => {
    // Infrastructure
    c.register(LOGGER_TOKEN, () => getRootLogger());
    c.register(CLOCK_TOKEN, () => systemClock);
    c.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

    // Database - Use real database connection
    c.register(DATABASE_CLIENT_TOKEN, () => getDb(), { singleton: true });
    c.register(
      UNIT_OF_WORK_PROVIDER_TOKEN,
      () => {
        const logger = c.resolve(LOGGER_TOKEN);
        return new DrizzleUnitOfWorkProvider(logger);
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
 */
export function configureProductionContainer(container: DIContainer): void {
  container.registerEnvironmentConfig('production', (c) => {
    // Infrastructure
    c.register(LOGGER_TOKEN, () => getRootLogger());
    c.register(CLOCK_TOKEN, () => systemClock);
    c.register(ID_GENERATOR_TOKEN, () => ({ generate: () => crypto.randomUUID() }));

    // Database - Use real database connection
    c.register(DATABASE_CLIENT_TOKEN, () => getDb(), { singleton: true });
    c.register(
      UNIT_OF_WORK_PROVIDER_TOKEN,
      () => {
        const logger = c.resolve(LOGGER_TOKEN);
        return new DrizzleUnitOfWorkProvider(logger);
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
 * Create and configure a new container
 * @param environment - Target environment
 * @returns Configured DI container
 */
export function createConfiguredContainer(environment: Environment): DIContainer {
  const container = new DIContainer();
  configureAllEnvironments(container);
  container.configureForEnvironment(environment);
  return container;
}

/**
 * Helper to get environment from NODE_ENV
 */
export function getEnvironmentFromNodeEnv(): Environment {
  const nodeEnv = process.env.NODE_ENV;

  switch (nodeEnv) {
    case 'test':
      return 'test';
    case 'production':
      return 'production';
    default:
      return 'development';
  }
}
