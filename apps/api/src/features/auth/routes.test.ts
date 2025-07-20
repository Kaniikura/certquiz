/**
 * Auth routes factory tests
 * @fileoverview Tests for auth routes creation with dependency injection
 */

import { describe, expect, FakeUserRepository, it, StubAuthProvider } from '@api/testkit';
import { createAuthRoutes } from './routes-factory';

describe('Auth Routes Factory', () => {
  describe('Route Creation', () => {
    it('should create auth routes with dependencies', () => {
      // Arrange
      const fakeUserRepo = new FakeUserRepository();
      const stubAuthProvider = new StubAuthProvider();

      // Act
      const authRoutes = createAuthRoutes(fakeUserRepo, stubAuthProvider);

      // Assert - Should be a valid Hono instance
      expect(authRoutes).toBeDefined();
      expect(typeof authRoutes.fetch).toBe('function');
    });
  });

  describe('Health Check Route', () => {
    it('should return healthy status', async () => {
      // Arrange
      const fakeUserRepo = new FakeUserRepository();
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(fakeUserRepo, stubAuthProvider);

      // Act
      const req = new Request('http://localhost/health');
      const res = await authRoutes.fetch(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        service: 'auth',
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Login Route Behavior', () => {
    it('should handle login route path', async () => {
      // Arrange
      const fakeUserRepo = new FakeUserRepository();
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(fakeUserRepo, stubAuthProvider);

      // Act - Test that the login route is mounted
      const req = new Request('http://localhost/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await authRoutes.fetch(req);

      // Assert - Should not return 404 (route exists)
      // Will return 400 due to validation issues, but that's expected
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400); // Validation error for empty body
    });

    it('should handle malformed JSON gracefully', async () => {
      // Arrange
      const fakeUserRepo = new FakeUserRepository();
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(fakeUserRepo, stubAuthProvider);

      // Act
      const req = new Request('http://localhost/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await authRoutes.fetch(req);

      // Assert - Should handle gracefully
      expect(res.status).toBe(400);
    });
  });
});
