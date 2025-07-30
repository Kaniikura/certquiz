/**
 * Unified Test App Factory
 * @fileoverview Provides consistent app creation patterns for different test scenarios
 */

import type { AppDependencies } from '@api/app-factory';
import { buildApp } from '@api/app-factory';
import type { IPremiumAccessService } from '@api/features/question/domain';
import { QuestionAccessDeniedError } from '@api/features/question/shared/errors';
import { DrizzleUnitOfWorkProvider } from '@api/infra/db/DrizzleUnitOfWorkProvider';
import { InMemoryUnitOfWorkProvider } from '@api/infra/db/InMemoryUnitOfWorkProvider';
import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';
import { getRootLogger } from '@api/infra/logger/root-logger';
import { SystemClock } from '@api/shared/clock';
import { CryptoIdGenerator } from '@api/shared/id-generator';
import { Result } from '@api/shared/result';
import type { Hono } from 'hono';
import { fakeAuthProvider, fakeLogger } from '../helpers/app';

/**
 * Configuration options for test app creation
 */
export interface TestConfig {
  /** Override unit of work provider */
  unitOfWorkProvider?: IUnitOfWorkProvider;
  /** Override logger (defaults to fake logger for testing) */
  logger?: AppDependencies['logger'];
  /** Override auth provider (defaults to fake auth provider) */
  authProvider?: AppDependencies['authProvider'];
  /** Override premium access service (defaults to fake service) */
  premiumAccessService?: IPremiumAccessService;
  /** Override clock function */
  clock?: AppDependencies['clock'];
  /** Override ID generator */
  idGenerator?: AppDependencies['idGenerator'];
  /** Custom ping function for health checks */
  ping?: AppDependencies['ping'];
}

/**
 * Create a fake premium access service for testing
 */
function fakePremiumAccessService(): IPremiumAccessService {
  return {
    shouldIncludePremiumContent: (isAuthenticated: boolean, requestedPremiumAccess: boolean) => {
      return isAuthenticated && requestedPremiumAccess;
    },
    validatePremiumAccess: (isAuthenticated: boolean, isPremiumContent: boolean) => {
      if (!isPremiumContent || isAuthenticated) {
        return Result.ok(undefined);
      }
      return Result.err(new Error('Premium access denied'));
    },
    validateQuestionPremiumAccess: (
      isAuthenticated: boolean,
      isPremiumContent: boolean,
      questionId: string
    ) => {
      if (!isPremiumContent || isAuthenticated) {
        return Result.ok(undefined);
      }
      // Create a proper QuestionAccessDeniedError
      return Result.err(new QuestionAccessDeniedError(questionId, 'Premium access required'));
    },
  };
}

/**
 * Test app wrapper with cleanup capabilities
 */
export interface TestApp {
  /** Make HTTP requests like a Hono app */
  request: Hono['request'];
  /** Clean up test data and resources */
  cleanup?: () => Promise<void>;
  /** Get the underlying unit of work provider for assertions */
  getUnitOfWorkProvider?: () => IUnitOfWorkProvider;
}

/**
 * Create integration test app with real database connections
 *
 * Use this for tests that need to verify database behavior, transactions,
 * and data persistence. Requires a real database connection via DATABASE_URL.
 *
 * @param config Optional configuration overrides
 * @returns Test app instance with real database connections
 *
 * @example
 * ```typescript
 * describe('Integration Test', () => {
 *   setupTestDatabase(); // Sets up isolated test database
 *
 *   let testApp: TestApp;
 *
 *   beforeAll(async () => {
 *     testApp = createIntegrationTestApp();
 *   });
 *
 *   it('should persist data to database', async () => {
 *     const res = await testApp.request('/api/users', { ... });
 *     expect(res.status).toBe(201);
 *   });
 * });
 * ```
 */
export function createIntegrationTestApp(config?: TestConfig): TestApp {
  // Use real logger or fallback to fake for testing
  const logger = config?.logger ?? fakeLogger();

  // Create real database unit of work provider
  const unitOfWorkProvider = config?.unitOfWorkProvider ?? new DrizzleUnitOfWorkProvider(logger);

  // Create default dependencies with real database connections
  const deps: AppDependencies = {
    logger,
    clock: config?.clock ?? (() => new SystemClock().now()),
    idGenerator: config?.idGenerator ?? new CryptoIdGenerator(),
    ping:
      config?.ping ??
      (async () => {
        // Health check for integration tests - could verify database connectivity
      }),
    premiumAccessService: config?.premiumAccessService ?? fakePremiumAccessService(),
    authProvider: config?.authProvider ?? fakeAuthProvider(),
    unitOfWorkProvider,
  };

  // Build the app with real dependencies
  const app = buildApp(deps);

  // Create TestApp wrapper
  const testApp: TestApp = {
    request: app.request.bind(app),
    cleanup: async () => {
      // Cleanup logic for integration tests
      // Database cleanup is typically handled by setupTestDatabase()
    },
    getUnitOfWorkProvider: () => unitOfWorkProvider,
  };

  return testApp;
}

/**
 * Create HTTP layer test app with in-memory providers
 *
 * Use this for fast HTTP layer testing that doesn't require database persistence.
 * All data is stored in memory and automatically cleaned up between tests.
 *
 * @param config Optional configuration overrides
 * @returns Test app instance with in-memory providers
 *
 * @example
 * ```typescript
 * describe('HTTP Layer Test', () => {
 *   let testApp: TestApp;
 *
 *   beforeEach(async () => {
 *     testApp = createHttpTestApp();
 *   });
 *
 *   afterEach(async () => {
 *     await testApp.cleanup?.();
 *   });
 *
 *   it('should validate request format', async () => {
 *     const res = await testApp.request('/api/users', { ... });
 *     expect(res.status).toBe(400);
 *   });
 * });
 * ```
 */
export function createHttpTestApp(config?: TestConfig): TestApp {
  // Always use fake logger for HTTP tests (fast and lightweight)
  const logger = config?.logger ?? fakeLogger();

  // Create in-memory unit of work provider for fast testing
  const unitOfWorkProvider = config?.unitOfWorkProvider ?? new InMemoryUnitOfWorkProvider();

  // Create dependencies optimized for HTTP testing
  const deps: AppDependencies = {
    logger,
    clock: config?.clock ?? (() => new Date()),
    idGenerator: config?.idGenerator ?? new CryptoIdGenerator(),
    ping:
      config?.ping ??
      (async () => {
        // No-op ping for HTTP tests
      }),
    premiumAccessService: config?.premiumAccessService ?? fakePremiumAccessService(),
    authProvider: config?.authProvider ?? fakeAuthProvider(),
    unitOfWorkProvider,
  };

  // Build the app with in-memory dependencies
  const app = buildApp(deps);

  // Create TestApp wrapper
  const testApp: TestApp = {
    request: app.request.bind(app),
    cleanup: async () => {
      // Clear in-memory data between tests
      if (unitOfWorkProvider instanceof InMemoryUnitOfWorkProvider) {
        unitOfWorkProvider.clear();
      }
    },
    getUnitOfWorkProvider: () => unitOfWorkProvider,
  };

  return testApp;
}

/**
 * Create test unit of work provider for integration tests
 *
 * Helper function to create a properly configured DrizzleUnitOfWorkProvider
 * for integration testing scenarios.
 *
 * @returns Configured DrizzleUnitOfWorkProvider for testing
 */
export function createTestUnitOfWorkProvider(): DrizzleUnitOfWorkProvider {
  const logger = getRootLogger();
  return new DrizzleUnitOfWorkProvider(logger);
}
