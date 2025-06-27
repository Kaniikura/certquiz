import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types/app';
import { healthRoutes } from './health';
import { createRedisClient } from '../config/redis';
import type { RedisClientType } from 'redis';

describe('Health Check Routes', () => {
  let app: Hono<AppEnv>;
  let redis: RedisClientType;

  beforeAll(async () => {
    // Create Redis client
    redis = createRedisClient();
    
    await redis.connect();

    // Create app with health routes
    app = new Hono<AppEnv>()
      .use('*', async (c, next) => {
        c.set('redis', redis);
        await next();
      })
      .route('/health', healthRoutes);
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await app.request('http://localhost/health');

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String)
      });
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness probe status', async () => {
      const response = await app.request('http://localhost/health/live');

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness probe with all service statuses', async () => {
      const response = await app.request('http://localhost/health/ready');

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        status: 'degraded', // Database is degraded, so overall status is degraded
        timestamp: expect.any(String),
        services: {
          database: {
            status: 'degraded',
            latency: expect.any(Number)
          },
          redis: {
            status: 'ok',
            latency: expect.any(Number)
          }
        }
      });
    });

    it('should report redis status correctly', async () => {
      const response = await app.request('http://localhost/health/ready');

      const data = await response.json();
      expect(data.services.redis.status).toBe('ok');
      expect(data.services.redis.latency).toBeGreaterThanOrEqual(0);
      expect(data.services.redis.latency).toBeLessThan(100); // Should be fast
    });

    it('should handle redis connection failure gracefully', async () => {
      // Create a new app instance without Redis client (simulates failure)
      const testApp = new Hono<AppEnv>()
        .use('*', async (c, next) => {
          // Don't set redis client to simulate unavailable Redis
          await next();
        })
        .route('/health', healthRoutes);

      const response = await testApp.request('http://localhost/health/ready');

      expect(response.status).toBe(503); // Service Unavailable
      
      const data = await response.json();
      expect(data.status).toBe('error');
      expect(data.services.redis.status).toBe('error');
      expect(data.services.redis.error).toBeDefined();
    });
  });

  describe('GET /health/metrics', () => {
    it('should return basic metrics', async () => {
      const response = await app.request('http://localhost/health/metrics');

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toMatchObject({
        uptime: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number)
        },
        cpu: {
          cores: expect.any(Number),
          loadAverage: {
            '1min': expect.any(Number),
            '5min': expect.any(Number),
            '15min': expect.any(Number)
          },
          loadPercentage: {
            '1min': expect.any(Number),
            '5min': expect.any(Number),
            '15min': expect.any(Number)
          }
        },
        system: {
          platform: expect.any(String),
          release: expect.any(String),
          architecture: expect.any(String)
        },
        redis: expect.objectContaining({
          connected: true,
          connections: expect.objectContaining({
            current: expect.any(Number),
            blocked: expect.any(Number)
          }),
          memory: expect.objectContaining({
            used: expect.any(Number),
            peak: expect.any(Number)
          }),
          stats: expect.objectContaining({
            totalCommands: expect.any(Number),
            instantaneousOps: expect.any(Number)
          })
        })
      });
    });
  });
});