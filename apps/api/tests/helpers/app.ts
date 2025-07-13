/**
 * Test helper functions for creating test applications
 * @fileoverview Provides utilities for creating app instances with mocked dependencies
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type { IUserRepository } from '@api/features/auth/domain/repositories/IUserRepository';
import type { Email } from '@api/features/auth/domain/value-objects/Email';
import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { AuthToken, AuthUserInfo, IAuthProvider } from '@api/infra/auth/AuthProvider';
import type { Logger } from '@api/infra/logger/root-logger';
import { Result } from '@api/shared/result';
import { vi } from 'vitest';
import { type AppDependencies, buildApp } from '../../src/app-factory';

/**
 * Create a fake user repository for testing
 */
export function fakeUserRepository(): IUserRepository {
  return {
    async findByEmail(_email: Email): Promise<User | null> {
      return null;
    },
    async findById(_id: UserId): Promise<User | null> {
      return null;
    },
    async findByKeycloakId(_keycloakId: string): Promise<User | null> {
      return null;
    },
    async findByUsername(_username: string): Promise<User | null> {
      return null;
    },
    async save(_user: User): Promise<void> {
      // No-op
    },
    async isEmailTaken(_email: Email, _excludeUserId?: UserId): Promise<boolean> {
      return false;
    },
    async isUsernameTaken(_username: string, _excludeUserId?: UserId): Promise<boolean> {
      return false;
    },
  };
}

/**
 * Create a fake auth provider for testing
 */
export function fakeAuthProvider(): IAuthProvider {
  return {
    name: 'fake',
    async authenticate(_email: string, _password: string): Promise<Result<AuthToken>> {
      return Result.ok({
        accessToken: 'fake-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'fake-refresh-token',
      });
    },
    async validateToken(_token: string): Promise<Result<AuthUserInfo>> {
      return Result.ok({
        id: 'fake-user-id',
        email: 'test@example.com',
        username: 'testuser',
        roles: ['user'],
        isActive: true,
      });
    },
    async refreshToken(_refreshToken: string): Promise<Result<AuthToken>> {
      return Result.ok({
        accessToken: 'fake-new-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'fake-new-refresh-token',
      });
    },
  };
}

/**
 * Create a fake logger for testing
 */
export function fakeLogger(): Logger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => fakeLogger()),
  } as unknown as Logger;
}

/**
 * Create an HTTP app for testing without database dependencies
 */
export async function makeHttpApp() {
  const noop = async () => {
    // No-op function that always succeeds
  };
  const deps: AppDependencies = {
    // Fast deterministic doubles
    logger: fakeLogger(),
    clock: () => new Date('2025-01-01T00:00:00Z'),
    ping: noop, // Always healthy
    userRepository: fakeUserRepository(),
    authProvider: fakeAuthProvider(),
  };

  return buildApp(deps);
}

/**
 * Create an app with broken database for testing error scenarios
 */
export async function makeBrokenDbApp() {
  const deps: AppDependencies = {
    logger: fakeLogger(),
    clock: () => new Date('2025-01-01T00:00:00Z'),
    ping: async () => {
      throw new Error('Database connection failed');
    },
    userRepository: fakeUserRepository(),
    authProvider: fakeAuthProvider(),
  };

  return buildApp(deps);
}
