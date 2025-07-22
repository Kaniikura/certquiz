/**
 * App Factory Tests
 * @fileoverview Tests for app factory with fake dependencies
 */

import { createNoopTxRunner } from '@api/testing/infra';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app-factory';
import type { IUserRepository } from './features/auth/domain/repositories/IUserRepository';
import type { IQuestionRepository } from './features/question/domain/repositories/IQuestionRepository';
import type { IPremiumAccessService } from './features/question/domain/services/IPremiumAccessService';
import { PremiumAccessService } from './features/question/domain/services/PremiumAccessService';
import type { IQuizRepository } from './features/quiz/domain/repositories/IQuizRepository';
import type { IUserRepository as IUserDomainRepository } from './features/user/domain/repositories/IUserRepository';
import { FakeAuthProvider } from './infra/auth/AuthProvider.fake';
import { getRootLogger } from './infra/logger/root-logger';
import type { IdGenerator } from './shared/id-generator';
import { CryptoIdGenerator } from './shared/id-generator';

describe('App Factory', () => {
  it('builds app with fake dependencies', async () => {
    // Create fake dependencies
    const logger = getRootLogger();
    const clock = () => new Date();
    const idGenerator: IdGenerator = new CryptoIdGenerator();
    const ping = async () => {
      /* no-op */
    };

    // Create minimal fake repositories
    const userRepository = {} as IUserRepository;
    const quizRepository = {} as IQuizRepository;
    const questionRepository = {} as IQuestionRepository;
    const premiumAccessService: IPremiumAccessService = new PremiumAccessService();

    // Create auth provider and noop tx runner
    const authProvider = new FakeAuthProvider();
    const txRunner = createNoopTxRunner();

    // Build app with fake dependencies
    const app = buildApp({
      logger,
      clock,
      idGenerator,
      ping,
      userRepository,
      userDomainRepository: {} as IUserDomainRepository,
      quizRepository,
      questionRepository,
      premiumAccessService,
      authProvider,
      txRunner,
    });

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
    // Create fake dependencies
    const logger = getRootLogger();
    const clock = () => new Date();
    const idGenerator: IdGenerator = new CryptoIdGenerator();
    const ping = async () => {
      /* no-op */
    };

    // Create minimal fake repositories
    const userRepository = {} as IUserRepository;
    const quizRepository = {} as IQuizRepository;
    const questionRepository = {} as IQuestionRepository;
    const premiumAccessService: IPremiumAccessService = new PremiumAccessService();

    // Create auth provider and noop tx runner
    const authProvider = new FakeAuthProvider();
    const txRunner = createNoopTxRunner();

    // Build app with fake dependencies
    const app = buildApp({
      logger,
      clock,
      idGenerator,
      ping,
      userRepository,
      userDomainRepository: {} as IUserDomainRepository,
      quizRepository,
      questionRepository,
      premiumAccessService,
      authProvider,
      txRunner,
    });

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
    // Create fake dependencies
    const logger = getRootLogger();
    const clock = () => new Date();
    const idGenerator: IdGenerator = new CryptoIdGenerator();
    const ping = async () => {
      /* no-op */
    };

    // Create minimal fake repositories
    const userRepository = {} as IUserRepository;
    const quizRepository = {} as IQuizRepository;
    const questionRepository = {} as IQuestionRepository;
    const premiumAccessService: IPremiumAccessService = new PremiumAccessService();

    // Create auth provider and noop tx runner
    const authProvider = new FakeAuthProvider();
    const txRunner = createNoopTxRunner();

    // Build app with fake dependencies
    const app = buildApp({
      logger,
      clock,
      idGenerator,
      ping,
      userRepository,
      userDomainRepository: {} as IUserDomainRepository,
      quizRepository,
      questionRepository,
      premiumAccessService,
      authProvider,
      txRunner,
    });

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
