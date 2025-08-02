/**
 * Database health check integration tests
 * @fileoverview Tests the actual database connectivity verification of health endpoints
 */

import { setupTestDatabase } from '@api/testing/domain';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TestApp } from '../setup/test-app-factory';
import { createIntegrationTestApp } from '../setup/test-app-factory';

describe('Database Health Check Integration', () => {
  setupTestDatabase();

  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createIntegrationTestApp();
  });

  afterAll(async () => {
    await testApp.cleanup?.();
  });

  describe('Database connectivity verification', () => {
    it('should execute SELECT 1 query for readiness check', async () => {
      // Spy on console to capture the SQL query log
      const consoleSpy = vi.spyOn(console, 'log');

      const res = await testApp.request('/health/ready');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        status: 'healthy',
        services: {
          database: {
            status: 'healthy',
          },
        },
      });

      // Verify SELECT 1 query was executed
      const selectOneQueryExecuted = consoleSpy.mock.calls.some((call) =>
        call[0]?.toString().includes('SELECT 1 as health_check')
      );
      expect(selectOneQueryExecuted).toBe(true);

      consoleSpy.mockRestore();
    });

    // Note: Testing timeout behavior in integration tests is complex due to the way
    // the test app is set up. The actual timeout logic is implemented and tested
    // in the unit tests. The integration test verifies the happy path.

    it('should return healthy for legacy health endpoint', async () => {
      const res = await testApp.request('/health');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        status: 'healthy',
        services: {
          database: {
            status: 'healthy',
          },
        },
      });
    });

    it('should not check database for liveness probe', async () => {
      // Liveness probe should not execute database queries
      const consoleSpy = vi.spyOn(console, 'log');

      const res = await testApp.request('/health/live');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        status: 'healthy',
        service: 'certquiz-api',
      });

      // Verify no SELECT 1 query was executed for liveness
      const selectOneQueryExecuted = consoleSpy.mock.calls.some((call) =>
        call[0]?.toString().includes('SELECT 1 as health_check')
      );
      expect(selectOneQueryExecuted).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('Error scenarios', () => {
    it('should verify endpoint availability and HTTP response handling', async () => {
      // This integration test verifies that the health check endpoints are properly
      // wired up and return valid HTTP responses. Actual database error handling
      // is thoroughly tested at the unit level in handler.test.ts where the db.ping
      // function can be properly mocked to simulate errors.

      const res = await testApp.request('/health/ready');

      // Verify the endpoint is available and returns a valid HTTP response
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);

      // In the integration environment with a healthy database, expect 200
      expect(res.status).toBe(200);
    });
  });
});
