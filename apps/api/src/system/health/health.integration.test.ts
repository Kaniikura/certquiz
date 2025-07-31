import { setupTestDatabase } from '@api/testing/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../../tests/setup/test-app-factory';
import { createIntegrationTestApp } from '../../../tests/setup/test-app-factory';

describe('Health check endpoints', () => {
  // Setup isolated test database
  setupTestDatabase();

  let testApp: TestApp;

  beforeEach(async () => {
    // Create integration test app using async DI container
    testApp = await createIntegrationTestApp();
  });

  describe('GET /health/live (liveness probe)', () => {
    it('returns healthy status with system information', async () => {
      const res = await testApp.request('/health/live');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      expect(res.headers.get('x-request-id')).toBeDefined();

      const body = await res.json();
      expect(body).toMatchObject({
        status: 'healthy',
        service: 'certquiz-api',
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        environment: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: {
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          rss: expect.any(Number),
        },
      });

      // Verify timestamp is valid ISO string
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('always returns 200 status', async () => {
      // Liveness should always succeed if the process is running
      const res = await testApp.request('/health/live');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /health/ready (readiness probe)', () => {
    it('returns health status with database connectivity', async () => {
      const res = await testApp.request('/health/ready');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      expect(res.headers.get('x-request-id')).toBeDefined();

      const body = await res.json();
      expect(body).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        services: {
          database: {
            status: expect.stringMatching(/^(healthy|unhealthy)$/),
          },
        },
      });

      // Verify timestamp is valid ISO string
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('includes request ID from middleware', async () => {
      const res = await testApp.request('/health/ready');

      const requestId = res.headers.get('x-request-id');
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('GET /health (legacy endpoint)', () => {
    it('returns readiness status for backward compatibility', async () => {
      const res = await testApp.request('/health');

      expect(res.status).toBe(200);

      const body = await res.json();
      // Should return the same structure as readiness endpoint
      expect(body).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        services: {
          database: {
            status: expect.stringMatching(/^(healthy|unhealthy)$/),
          },
        },
      });
    });
  });

  describe('Middleware integration', () => {
    it('all health endpoints include request ID', async () => {
      const endpoints = ['/health', '/health/live', '/health/ready'];

      for (const endpoint of endpoints) {
        const res = await testApp.request(endpoint);
        expect(res.headers.get('x-request-id')).toBeDefined();
      }
    });

    it('validates middleware chain works correctly', async () => {
      // Make multiple requests to ensure middleware state is isolated
      const res1 = await testApp.request('/health/live');
      const res2 = await testApp.request('/health/ready');

      const requestId1 = res1.headers.get('x-request-id');
      const requestId2 = res2.headers.get('x-request-id');

      // Each request should have a unique ID
      expect(requestId1).not.toBe(requestId2);
    });

    it('health endpoints respond quickly', async () => {
      const start = Date.now();
      const res = await testApp.request('/health/live');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500); // Liveness should be reasonably fast
    });
  });
});
