/**
 * Async Container Isolation Test
 * @fileoverview Validates that the async DI container provides proper test isolation
 */

// Async DI container is now the default

import { DATABASE_PROVIDER_TOKEN } from '@api/infra/di/tokens';
import { beforeAll, describe, expect, it } from 'vitest';
import { createHttpTestApp, type TestApp } from '../setup/test-app-factory';

describe('Async Container Test Isolation', () => {
  let app1: TestApp;
  let app2: TestApp;

  beforeAll(async () => {
    // Create two test apps in parallel to test isolation
    [app1, app2] = await Promise.all([createHttpTestApp(), createHttpTestApp()]);
  });

  it('should provide isolated database contexts for each test app', async () => {
    // Get database contexts from both apps
    const getDatabaseContext1 = app1.getDatabaseContext;
    const getDatabaseContext2 = app2.getDatabaseContext;
    if (!getDatabaseContext1 || !getDatabaseContext2) {
      throw new Error('getDatabaseContext method not available');
    }
    const [dbContext1, dbContext2] = await Promise.all([
      getDatabaseContext1(),
      getDatabaseContext2(),
    ]);

    // Verify they are different instances
    expect(dbContext1).not.toBe(dbContext2);
  });

  it('should use different database connections for each test app', async () => {
    // Get containers to inspect their configuration
    const getContainer1 = app1.getContainer;
    const getContainer2 = app2.getContainer;
    if (!getContainer1 || !getContainer2) {
      throw new Error('getContainer method not available');
    }
    const container1 = getContainer1();
    const container2 = getContainer2();

    // Verify they are different container instances
    expect(container1).not.toBe(container2);

    // Each container should have its own isolated database provider
    const [provider1, provider2] = await Promise.all([
      container1.resolve(DATABASE_PROVIDER_TOKEN),
      container2.resolve(DATABASE_PROVIDER_TOKEN),
    ]);

    // In test environment, providers should be different instances
    expect(provider1).not.toBe(provider2);
  });

  it('should handle concurrent requests without interference', async () => {
    // Make concurrent requests to both apps
    const [res1, res2] = await Promise.all([app1.request('/'), app2.request('/')]);

    // Both should succeed independently
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Verify response content
    const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

    expect(json1).toHaveProperty('message', 'CertQuiz API - VSA Architecture');
    expect(json2).toHaveProperty('message', 'CertQuiz API - VSA Architecture');
  });
});

describe('Async Container Database Connection Stats', () => {
  it('should track connection stats independently for each test', async () => {
    const app = await createHttpTestApp();
    const getContainer = app.getContainer;
    if (!getContainer) {
      throw new Error('getContainer method not available');
    }
    const container = getContainer();

    const provider = await container.resolve(DATABASE_PROVIDER_TOKEN);

    // TestDatabaseProvider should have connection stats
    if ('getConnectionStats' in provider) {
      const stats = provider.getConnectionStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    }
  });
});
