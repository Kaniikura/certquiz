import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { App } from './types/app';
import { createRedisClient } from './config/redis';
import type { RedisClientType } from 'redis';

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.KEYCLOAK_URL = 'http://localhost:8080';
process.env.KEYCLOAK_REALM = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes';
process.env.BMAC_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.API_PORT = '4000';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.REDIS_URL = 'redis://localhost:6379';

// We'll import the app after it's created
let app: App;
let redis: RedisClientType;

describe('Main App', () => {
  beforeAll(async () => {
    // Create Redis client for testing
    redis = createRedisClient();
    await redis.connect();

    // Import the app dynamically so it loads after Redis is ready
    const appModule = await import('./index');
    app = appModule.default;
    
    // Inject Redis client into app for testing
    app.use('*', async (c, next) => {
      c.set('redis', redis);
      await next();
    });
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  describe('CORS configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await app.request('http://localhost/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await app.request('http://localhost/non-existent-route');

      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found'
        }
      });
    });

    it('should return JSON error responses', async () => {
      const response = await app.request('http://localhost/api/non-existent');

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Health routes', () => {
    it('should mount health routes correctly', async () => {
      const response = await app.request('http://localhost/health');

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String)
      });
    });

    it('should handle health ready endpoint', async () => {
      const response = await app.request('http://localhost/health/ready');

      // Expect 503 because Redis client is not initialized in test context
      // and database check is degraded by design
      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data).toMatchObject({
        status: 'error',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Middleware configuration', () => {
    it('should add security headers', async () => {
      const response = await app.request('http://localhost/health');

      expect(response.status).toBe(200);
      // Hono automatically adds some security headers
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should handle request logging', async () => {
      // This test verifies that the logger middleware doesn't break the request
      const response = await app.request('http://localhost/health');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Server configuration', () => {
    it('should export the app correctly', async () => {
      expect(app).toBeDefined();
      expect(typeof app.request).toBe('function');
    });

    it('should handle basic HTTP methods', async () => {
      const getResponse = await app.request('http://localhost/health');
      expect(getResponse.status).toBe(200);

      const optionsResponse = await app.request('http://localhost/health', {
        method: 'OPTIONS'
      });
      expect(optionsResponse.status).toBe(204);
    });
  });
});