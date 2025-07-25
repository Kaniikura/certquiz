/**
 * Auth routes factory tests
 * @fileoverview Tests for auth routes creation with dependency injection
 */

import { InMemoryUnitOfWorkProvider } from '@api/infra/db/InMemoryUnitOfWorkProvider';
import { getRootLogger } from '@api/infra/logger/root-logger';
import { createLoggerMiddleware, createTransactionMiddleware } from '@api/middleware';
import { StubAuthProvider } from '@api/testing/domain';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createAuthRoutes } from './routes-factory';

describe('Auth Routes Factory', () => {
  describe('Route Creation', () => {
    it('should create auth routes with dependencies', () => {
      // Arrange
      const stubAuthProvider = new StubAuthProvider();
      const unitOfWorkProvider = new InMemoryUnitOfWorkProvider();

      // Act
      const authRoutes = createAuthRoutes(stubAuthProvider, unitOfWorkProvider);

      // Assert - Should be a valid Hono instance
      expect(authRoutes).toBeDefined();
      expect(typeof authRoutes.fetch).toBe('function');
    });
  });

  describe('Health Check Route', () => {
    it('should return healthy status', async () => {
      // Arrange
      const stubAuthProvider = new StubAuthProvider();
      const unitOfWorkProvider = new InMemoryUnitOfWorkProvider();
      const authRoutes = createAuthRoutes(stubAuthProvider, unitOfWorkProvider);

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

      // Add transaction middleware
      const unitOfWorkProvider = new InMemoryUnitOfWorkProvider();
      testApp.use('*', createTransactionMiddleware(unitOfWorkProvider));

      // Mount auth routes
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(stubAuthProvider, unitOfWorkProvider);
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

      // Add transaction middleware
      const unitOfWorkProvider = new InMemoryUnitOfWorkProvider();
      testApp.use('*', createTransactionMiddleware(unitOfWorkProvider));

      // Mount auth routes
      const stubAuthProvider = new StubAuthProvider();
      const authRoutes = createAuthRoutes(stubAuthProvider, unitOfWorkProvider);
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
