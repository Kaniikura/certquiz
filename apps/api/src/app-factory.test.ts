/**
 * App Factory Tests
 * @fileoverview Tests for app factory with fake dependencies
 */

import type { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppDependencies } from './app-factory';
import { buildApp } from './app-factory';
import type { IUserRepository } from './features/auth/domain/repositories/IUserRepository';
import type { IQuestionRepository } from './features/question/domain/repositories/IQuestionRepository';
import { PremiumAccessService } from './features/question/domain/services/PremiumAccessService';
import type { IQuizRepository } from './features/quiz/domain/repositories/IQuizRepository';
import { FakeAuthProvider } from './infra/auth/AuthProvider.fake';
import { getRootLogger } from './infra/logger/root-logger';
import type { LoggerVariables, RequestIdVariables } from './middleware';
import type { UnitOfWorkVariables } from './middleware/unit-of-work';
import { CryptoIdGenerator } from './shared/id-generator';

/**
 * Creates fake app dependencies for testing
 * Provides all required dependencies with minimal implementations
 */
function createFakeAppDependencies(overrides?: Partial<AppDependencies>): AppDependencies {
  return {
    logger: getRootLogger(),
    clock: () => new Date(),
    idGenerator: new CryptoIdGenerator(),
    ping: async () => {
      /* no-op */
    },
    userRepository: {} as IUserRepository,
    quizRepository: {} as IQuizRepository,
    questionRepository: {} as IQuestionRepository,
    premiumAccessService: new PremiumAccessService(),
    authProvider: new FakeAuthProvider(),
    ...overrides,
  };
}

/**
 * Creates a test app instance with fake dependencies
 * Encapsulates the common setup pattern used across tests
 */
function createTestApp(
  overrides?: Partial<AppDependencies>
): Hono<{ Variables: LoggerVariables & RequestIdVariables & UnitOfWorkVariables }> {
  const dependencies = createFakeAppDependencies(overrides);
  return buildApp(dependencies);
}

describe('App Factory', () => {
  it('builds app with fake dependencies', async () => {
    const app = createTestApp();

    // Test root endpoint
    const res = await app.request('/');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      message: 'CertQuiz API - VSA Architecture',
      status: 'ready',
      version: expect.any(String),
    });
  });

  it('returns 404 for non-existent endpoints', async () => {
    const app = createTestApp();

    // Test non-existent endpoint
    const res = await app.request('/non-existent');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('not found'),
      },
    });
  });

  it('health endpoint responds without database', async () => {
    const app = createTestApp();

    // Test health endpoint
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
    });
  });
});
