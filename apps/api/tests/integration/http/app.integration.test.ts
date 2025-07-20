import { app } from '@api/index';
import { setupTestDatabase } from '@api/test-utils/integration-helpers';
import { describe, expect, it } from 'vitest';

describe('App Integration Tests', () => {
  // Setup isolated test database
  setupTestDatabase();

  describe('Error handling', () => {
    it('returns 404 for non-existent endpoints', async () => {
      const res = await app.request('/non-existent');

      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.any(String),
        },
      });
    });

    it('returns proper error format with request ID', async () => {
      const res = await app.request('/this-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.headers.get('x-request-id')).toBeDefined();

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('Root endpoint', () => {
    it('returns API information', async () => {
      const res = await app.request('/');

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        message: 'CertQuiz API - VSA Architecture',
        status: 'ready',
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      });
    });
  });
});
