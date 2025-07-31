/**
 * App factory tests
 * @fileoverview Tests for app factory with DI container integration
 */

import { InMemoryDatabaseContext } from '@api/testing/domain/fakes';
import { nanoid } from 'nanoid';
import { describe, expect, it } from 'vitest';
import type { AppDependencies } from './app-factory';
import { buildApp, buildAppWithContainer } from './app-factory';
import type { IPremiumAccessService } from './features/question/domain';
import type { AuthToken, AuthUserInfo, IAuthProvider } from './infra/auth/AuthProvider';
import { createConfiguredContainer } from './infra/di/container-config';
import type { Logger } from './infra/logger';
import { Result } from './shared/result';

describe('App Factory', () => {
  describe('buildApp', () => {
    it('should create app with manual dependencies', () => {
      // Arrange
      // Create a minimal logger mock that satisfies the Logger interface
      const mockLogger = {
        level: 'info',
        debug: () => {
          /* noop */
        },
        info: () => {
          /* noop */
        },
        warn: () => {
          /* noop */
        },
        error: () => {
          /* noop */
        },
        fatal: () => {
          /* noop */
        },
        trace: () => {
          /* noop */
        },
        silent: () => {
          /* noop */
        },
        child: () => mockLogger,
        bindings: () => ({}),
      } as unknown as Logger;

      const mockDeps: AppDependencies = {
        logger: mockLogger,
        clock: {
          now: () => new Date(),
        },
        idGenerator: { generate: () => nanoid() },
        ping: async () => {
          /* noop */
        },
        premiumAccessService: {
          shouldIncludePremiumContent: (
            _isAuthenticated: boolean,
            _requestedPremiumAccess: boolean
          ) => true,
          validatePremiumAccess: (_isAuthenticated: boolean, _isPremiumContent: boolean) =>
            Result.ok<void>(undefined),
          validateQuestionPremiumAccess: (
            _isAuthenticated: boolean,
            _isPremiumContent: boolean,
            _questionId: string
          ) => Result.ok<void>(undefined),
        } satisfies IPremiumAccessService,
        authProvider: {
          name: 'MockAuthProvider',
          authenticate: async (_email: string, _password: string) =>
            Result.ok<AuthToken>({
              accessToken: 'mock-token',
              tokenType: 'Bearer',
              expiresIn: 3600,
              refreshToken: 'mock-refresh',
            } satisfies AuthToken),
          validateToken: async (_token: string) =>
            Result.ok<AuthUserInfo>({
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser',
              isActive: true,
            } satisfies AuthUserInfo),
          refreshToken: async (_refreshToken: string) =>
            Result.ok<AuthToken>({
              accessToken: 'new-mock-token',
              tokenType: 'Bearer',
              expiresIn: 3600,
              refreshToken: 'new-mock-refresh',
            } satisfies AuthToken),
        } satisfies IAuthProvider,
        databaseContext: new InMemoryDatabaseContext(),
      };

      // Act
      const app = buildApp(mockDeps);

      // Assert
      expect(app).toBeDefined();
      expect(app.router).toBeDefined();
    });
  });

  describe('buildAppWithContainer', () => {
    it('should create app using test container', () => {
      // Arrange
      const container = createConfiguredContainer('test');

      // Act
      const app = buildAppWithContainer(container);

      // Assert
      expect(app).toBeDefined();
      expect(app.router).toBeDefined();
    });

    it('should create app using development container', () => {
      // Arrange
      const container = createConfiguredContainer('development');

      // Act
      const app = buildAppWithContainer(container);

      // Assert
      expect(app).toBeDefined();
      expect(app.router).toBeDefined();
    });

    it('should handle basic health check request', async () => {
      // Arrange
      const container = createConfiguredContainer('test');
      const app = buildAppWithContainer(container);

      // Act
      const response = await app.request('/health');

      // Assert
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('status', 'healthy');
    });

    it('should handle root API request', async () => {
      // Arrange
      const container = createConfiguredContainer('test');
      const app = buildAppWithContainer(container);

      // Act
      const response = await app.request('/');

      // Assert
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('message', 'CertQuiz API - VSA Architecture');
      expect(body).toHaveProperty('status', 'ready');
    });

    it('should handle 404 for unknown routes', async () => {
      // Arrange
      const container = createConfiguredContainer('test');
      const app = buildAppWithContainer(container);

      // Act
      const response = await app.request('/api/unknown');

      // Assert
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
