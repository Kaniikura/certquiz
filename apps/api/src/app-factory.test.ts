/**
 * App Factory Tests
 * @fileoverview Tests for app factory with fake dependencies
 */

import { describe, expect, it } from 'vitest';
import type { AppDependencies } from './app-factory';
import { buildApp } from './app-factory';
import { PremiumAccessService } from './features/question/domain/services/PremiumAccessService';
import { FakeAuthProvider } from './infra/auth/AuthProvider.fake';
import { InMemoryUnitOfWorkProvider } from './infra/db/InMemoryUnitOfWorkProvider';
import { getRootLogger } from './infra/logger/root-logger';
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
    premiumAccessService: new PremiumAccessService(),
    authProvider: new FakeAuthProvider(),
    unitOfWorkProvider: new InMemoryUnitOfWorkProvider(),
    ...overrides,
  };
}

describe('App Factory', () => {
  it('builds app with fake dependencies', async () => {
    const app = buildApp(createFakeAppDependencies());

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
    const app = buildApp(createFakeAppDependencies());

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
    const app = buildApp(createFakeAppDependencies());

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
