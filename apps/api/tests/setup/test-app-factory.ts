/**
 * Unified Test App Factory
 * @fileoverview Provides consistent app creation patterns for different test scenarios
 */

import { buildAppWithContainer } from '@api/app-factory';
import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import { InMemoryUnitOfWorkProvider } from '@api/infra/db/InMemoryUnitOfWorkProvider';
import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';
import { createConfiguredContainer } from '@api/infra/di/container-config';
import type { DIContainer } from '@api/infra/di/DIContainer';
import { DATABASE_CONTEXT_TOKEN, UNIT_OF_WORK_PROVIDER_TOKEN } from '@api/infra/di/tokens';
import { InMemoryDatabaseContext } from '@api/testing/domain/fakes';
import type { Hono } from 'hono';

/**
 * Test app wrapper with cleanup capabilities
 */
export interface TestApp {
  /** Make HTTP requests like a Hono app */
  request: Hono['request'];
  /** Clean up test data and resources */
  cleanup?: () => Promise<void>;
  /** Get the underlying unit of work provider for assertions (deprecated) */
  getUnitOfWorkProvider?: () => IUnitOfWorkProvider;
  /** Get the database context for assertions */
  getDatabaseContext?: () => IDatabaseContext;
}

/**
 * Create integration test app using DI container
 *
 * Uses development environment configuration with real database connections.
 *
 * @param container Optional pre-configured container (defaults to development container)
 * @returns Test app instance with real database connections
 *
 * @example
 * ```typescript
 * describe('Integration Test', () => {
 *   setupTestDatabase();
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
export function createIntegrationTestApp(container?: DIContainer): TestApp {
  // Use development container for integration tests (real database)
  const diContainer = container ?? createConfiguredContainer('development');

  // Build app using container
  const app = buildAppWithContainer(diContainer);

  // Create TestApp wrapper
  const testApp: TestApp = {
    request: app.request.bind(app),
    cleanup: async () => {
      // Cleanup logic for integration tests
      // Database cleanup is typically handled by setupTestDatabase()
    },
    getUnitOfWorkProvider: () => {
      // Extract unit of work provider from container for assertions (deprecated)
      return diContainer.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
    },
    getDatabaseContext: () => {
      // Extract database context from container for assertions
      return diContainer.resolve(DATABASE_CONTEXT_TOKEN);
    },
  };

  return testApp;
}

/**
 * Create HTTP layer test app using DI container
 *
 * Uses test environment configuration with in-memory providers.
 *
 * @param container Optional pre-configured container (defaults to test container)
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
export function createHttpTestApp(container?: DIContainer): TestApp {
  // Use test container for HTTP tests (in-memory)
  const diContainer = container ?? createConfiguredContainer('test');

  // Build app using container
  const app = buildAppWithContainer(diContainer);

  // Create TestApp wrapper
  const testApp: TestApp = {
    request: app.request.bind(app),
    cleanup: async () => {
      // Clear both UnitOfWork provider and DatabaseContext for comprehensive cleanup
      const unitOfWorkProvider = diContainer.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
      if (unitOfWorkProvider instanceof InMemoryUnitOfWorkProvider) {
        unitOfWorkProvider.clear();
      }

      const databaseContext = diContainer.resolve(DATABASE_CONTEXT_TOKEN);
      if (databaseContext instanceof InMemoryDatabaseContext) {
        databaseContext.clear();
      }
    },
    getUnitOfWorkProvider: () => {
      // Extract unit of work provider from container for assertions (deprecated)
      return diContainer.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
    },
    getDatabaseContext: () => {
      // Extract database context from container for assertions
      return diContainer.resolve(DATABASE_CONTEXT_TOKEN);
    },
  };

  return testApp;
}
