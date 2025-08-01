/**
 * Async Test App Factory
 * @fileoverview Provides async app creation patterns for tests using async DI container
 */

import { buildAppWithContainer } from '@api/app-factory';
import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';
import { createConfiguredContainer } from '@api/infra/di/container-config';
import type { DIContainer } from '@api/infra/di/DIContainer';
import { DATABASE_CONTEXT_TOKEN, UNIT_OF_WORK_PROVIDER_TOKEN } from '@api/infra/di/tokens';
import type { Hono } from 'hono';

/**
 * Async test app wrapper with cleanup capabilities
 */
export interface TestApp {
  /** Make HTTP requests like a Hono app */
  request: Hono['request'];
  /** Clean up test data and resources */
  cleanup?: () => Promise<void>;
  /** Get the underlying unit of work provider for assertions (deprecated) */
  getUnitOfWorkProvider?: () => Promise<IUnitOfWorkProvider>;
  /** Get the database context for assertions */
  getDatabaseContext?: () => Promise<IDatabaseContext>;
  /** Get the DI container for advanced testing */
  getContainer?: () => DIContainer;
}

/**
 * Create async integration test app using async DI container
 *
 * Uses development environment configuration with real database connections.
 * Supports async initialization of database connections.
 *
 * @param container Optional pre-configured async container (defaults to development container)
 * @returns Promise of test app instance with real database connections
 *
 * @example
 * ```typescript
 * describe('Async Integration Test', () => {
 *   setupTestDatabase();
 *
 *   let testApp: TestApp;
 *
 *   beforeAll(async () => {
 *     testApp = await createIntegrationTestApp();
 *   });
 *
 *   it('should persist data to database', async () => {
 *     const res = await testApp.request('/api/users', { ... });
 *     expect(res.status).toBe(201);
 *   });
 * });
 * ```
 */
export async function createIntegrationTestApp(container?: DIContainer): Promise<TestApp> {
  // Use development container for integration tests (real database)
  const diContainer = container ?? createConfiguredContainer('development');

  // Build app using async container
  const app = await buildAppWithContainer(diContainer);

  // Note: Database context initialization is handled by the container configuration

  // Create TestApp wrapper
  const testApp: TestApp = {
    request: app.request.bind(app),
    cleanup: async () => {
      // Cleanup logic for integration tests
      // Database cleanup is typically handled by setupTestDatabase()
    },
    getUnitOfWorkProvider: async () => {
      // Extract unit of work provider from container for assertions (deprecated)
      return diContainer.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
    },
    getDatabaseContext: async () => {
      // Extract database context from container for assertions
      return diContainer.resolve(DATABASE_CONTEXT_TOKEN);
    },
    getContainer: () => diContainer,
  };

  return testApp;
}

/**
 * Create async HTTP layer test app using async DI container
 *
 * Uses test environment configuration with async test database providers.
 * Each test gets its own isolated database connection.
 *
 * @param container Optional pre-configured async container (defaults to test container)
 * @returns Promise of test app instance with isolated test database
 *
 * @example
 * ```typescript
 * describe('Async HTTP Layer Test', () => {
 *   let testApp: TestApp;
 *
 *   beforeEach(async () => {
 *     testApp = await createHttpTestApp();
 *   });
 *
 *   afterEach(async () => {
 *     await testApp.cleanup?.();
 *   });
 *
 *   it('should validate request', async () => {
 *     const res = await testApp.request('/api/auth/login', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ email: 'invalid' })
 *     });
 *
 *     expect(res.status).toBe(400);
 *   });
 * });
 * ```
 */
export async function createHttpTestApp(container?: DIContainer): Promise<TestApp> {
  // Use test container for HTTP tests (async test database)
  const diContainer = container ?? createConfiguredContainer('test');

  // Build app using async container
  const app = await buildAppWithContainer(diContainer);

  // Note: Database context initialization is handled by the container configuration

  // Create TestApp wrapper
  const testApp: TestApp = {
    request: app.request.bind(app),
    cleanup: async () => {
      // Cleanup logic for HTTP tests
      // Database cleanup is handled by test isolation at container level
    },
    getUnitOfWorkProvider: async () => {
      // Extract unit of work provider from container for assertions (deprecated)
      return diContainer.resolve(UNIT_OF_WORK_PROVIDER_TOKEN);
    },
    getDatabaseContext: async () => {
      // Extract database context from container for assertions
      return diContainer.resolve(DATABASE_CONTEXT_TOKEN);
    },
    getContainer: () => diContainer,
  };

  return testApp;
}
