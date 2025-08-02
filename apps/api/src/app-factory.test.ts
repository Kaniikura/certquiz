/**
 * App factory tests
 * @fileoverview Tests for app factory with DI container integration
 */

import { nanoid } from 'nanoid';
import { describe, expect, it } from 'vitest';
import { InMemoryDatabaseContext } from '@/test-support/fakes';
import type { AppDependencies } from './app-factory';
import { buildApp, buildAppWithContainer } from './app-factory';
import type { IPremiumAccessService } from './features/question/domain';
import type { AuthToken, AuthUserInfo, IAuthProvider } from './infra/auth/AuthProvider';
import { createConfiguredContainer } from './infra/di/container-config';
import { LOGGER_TOKEN } from './infra/di/tokens';
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
    it('should create app with async DI container (test environment)', async () => {
      // Arrange
      const container = createConfiguredContainer('test');

      // Act
      const app = await buildAppWithContainer(container);

      // Assert
      expect(app).toBeDefined();
      expect(app.router).toBeDefined();
    });

    it('should create app with async DI container (development environment)', async () => {
      // Arrange
      const container = createConfiguredContainer('development');

      // Act
      const app = await buildAppWithContainer(container);

      // Assert
      expect(app).toBeDefined();
      expect(app.router).toBeDefined();
    });

    it('should have all routes accessible', async () => {
      // Arrange
      const container = createConfiguredContainer('test');

      // Act
      const app = await buildAppWithContainer(container);

      // Assert - Test that routes are accessible by making requests
      const rootResponse = await app.request('/');
      expect(rootResponse.status).toBe(200);

      const healthResponse = await app.request('/health/live');
      expect(healthResponse.status).toBe(200);

      // Auth routes should be accessible (even if they return errors without proper data)
      const authResponse = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });
      expect(authResponse.status).toBeLessThan(500); // Should not be a server error

      // Other routes should return 404 or valid responses, not server errors
      const questionsResponse = await app.request('/api/questions');
      expect(questionsResponse.status).toBeLessThan(500);

      const quizResponse = await app.request('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examTypes: ['CCNA'] }),
      });
      expect(quizResponse.status).toBeLessThan(500);
    });

    it('should handle errors during container resolution', async () => {
      // Arrange
      const container = createConfiguredContainer('test');
      // Override a service to throw an error
      container.register(
        LOGGER_TOKEN,
        async () => {
          throw new Error('Failed to create logger');
        },
        { singleton: true }
      );

      // Act & Assert
      await expect(buildAppWithContainer(container)).rejects.toThrow('Failed to create logger');
    });
  });
});
