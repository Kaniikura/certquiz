/**
 * Test helper functions for creating test applications
 * @fileoverview Provides utilities for creating app instances with mocked dependencies
 */

import type { AuthToken, AuthUserInfo, IAuthProvider } from '@api/infra/auth/AuthProvider';
import type { Logger } from '@api/infra/logger/root-logger';
import { Result } from '@api/shared/result';
import { vi } from 'vitest';

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
