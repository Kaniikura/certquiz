/**
 * Auth routes factory tests
 * @fileoverview Tests for auth routes creation with dependency injection
 */

import { StubAuthProvider } from '@api/infra/auth/AuthProvider.stub';
import { getRootLogger } from '@api/infra/logger/root-logger';
import { createDatabaseContextMiddleware, createLoggerMiddleware } from '@api/middleware';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { InMemoryDatabaseContext } from '@/test-support/fakes';
import { createAuthRoutes } from './routes-factory';

describe('Auth Routes Factory', () => {
  describe('Route Creation', () => {
    it('should create auth routes with dependencies', () => {
      // Arrange
      const stubAuthProvider = new StubAuthProvider();
      const databaseContext = new InMemoryDatabaseContext();

      // Act
      const authRoutes = createAuthRoutes(stubAuthProvider, databaseContext);

      // Assert - Should be a valid Hono instance
      expect(authRoutes).toBeDefined();
      expect(typeof authRoutes.fetch).toBe('function');
    });
  });

  describe('Health Check Route', () => {
    it('should return healthy status', async () => {
      // Arrange
      const stubAuthProvider = new StubAuthProvider();
      const databaseContext = new InMemoryDatabaseContext();
      const authRoutes = createAuthRoutes(stubAuthProvider, databaseContext);

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
      const testApp = new Hono();

      // Add logger middleware
      const logger = getRootLogger();
      testApp.use('*', createLoggerMiddleware(logger));

      // Add database context middleware
      const databaseContext = new InMemoryDatabaseContext();
      testApp.use('*', createDatabaseContextMiddleware(databaseContext));

      // Mount auth routes
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(stubAuthProvider, databaseContext);
      testApp.route('/', authRoutes);

      // Act - Test that the login route is mounted
      const req = new Request('http://localhost/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await testApp.fetch(req);

      // Assert - Should not return 404 (route exists)
      // Will return 400 due to validation issues, but that's expected
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400); // Validation error for empty body
    });

    it('should handle malformed JSON gracefully', async () => {
      // Arrange
      const testApp = new Hono();

      // Add logger middleware
      const logger = getRootLogger();
      testApp.use('*', createLoggerMiddleware(logger));

      // Add database context middleware
      const databaseContext = new InMemoryDatabaseContext();
      testApp.use('*', createDatabaseContextMiddleware(databaseContext));

      // Mount auth routes
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(stubAuthProvider, databaseContext);
      testApp.route('/', authRoutes);

      // Act
      const req = new Request('http://localhost/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await testApp.fetch(req);

      // Assert - Should handle gracefully
      expect(res.status).toBe(400);
    });
  });
});
