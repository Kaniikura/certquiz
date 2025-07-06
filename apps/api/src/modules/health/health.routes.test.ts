import type { AppEnv } from '@api/types/app';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { healthRoutes } from './health.routes';

describe('Health routes', () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    // Mount health routes
    app.route('/health', healthRoutes);
  });

  it('GET /health should return basic health info', async () => {
    const res = await app.request('/health');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('version');
  });

  it('GET /health/live should return live status', async () => {
    const res = await app.request('/health/live');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
  });

  it('GET /health/ready should check service readiness', async () => {
    const res = await app.request('/health/ready');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('status', 'degraded'); // degraded due to DB check not implemented
    expect(data).toHaveProperty('services');
    expect(data.services.database).toMatchObject({
      status: 'degraded',
      latency: 0,
      details: {
        note: 'Database health check not yet implemented',
      },
    });
  });

  it('GET /health/metrics should return system metrics', async () => {
    const res = await app.request('/health/metrics');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('cpu');
    expect(data).toHaveProperty('system');
    expect(data.memory).toHaveProperty('used');
    expect(data.memory).toHaveProperty('total');
    expect(data.memory).toHaveProperty('percentage');
    expect(data.cpu).toHaveProperty('cores');
    expect(data.cpu).toHaveProperty('loadAverage');
    expect(data.cpu).toHaveProperty('loadPercentage');
  });
});
