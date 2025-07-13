/**
 * Stub Auth Provider
 * @fileoverview Mock authentication provider for testing and development
 */

import { AppError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { AuthToken, AuthUserInfo, IAuthProvider } from './AuthProvider';

/**
 * Stub authentication provider for testing
 * Accepts any non-empty password and returns mock tokens
 */
export class StubAuthProvider implements IAuthProvider {
  public readonly name = 'stub';

  async authenticate(_email: string, password: string): Promise<Result<AuthToken>> {
    try {
      // Simple validation - accept any non-empty password
      if (!password || password.length === 0) {
        return Result.fail(new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401));
      }

      // Mock successful authentication
      const mockToken: AuthToken = {
        accessToken: `mock-jwt-token-${Date.now()}`,
        tokenType: 'Bearer',
        expiresIn: 3600, // 1 hour
        refreshToken: `mock-refresh-token-${Date.now()}`,
      };

      return Result.ok(mockToken);
    } catch (error) {
      return Result.fail(
        error instanceof Error ? error : new AppError('Authentication failed', 'AUTH_FAILED', 500)
      );
    }
  }

  async validateToken(token: string): Promise<Result<AuthUserInfo>> {
    try {
      // Simple validation - accept any token starting with 'mock-jwt-token'
      if (!token.startsWith('mock-jwt-token')) {
        return Result.fail(new AppError('Invalid token', 'INVALID_TOKEN', 401));
      }

      // Mock user info
      const mockUserInfo: AuthUserInfo = {
        id: 'stub-user-123',
        email: 'stub@example.com',
        username: 'stubuser',
        roles: ['user'],
        isActive: true,
      };

      return Result.ok(mockUserInfo);
    } catch (error) {
      return Result.fail(
        error instanceof Error
          ? error
          : new AppError('Token validation failed', 'TOKEN_VALIDATION_FAILED', 500)
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<Result<AuthToken>> {
    try {
      // Simple validation - accept any refresh token starting with 'mock-refresh-token'
      if (!refreshToken.startsWith('mock-refresh-token')) {
        return Result.fail(new AppError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401));
      }

      // Return new mock token
      const newToken: AuthToken = {
        accessToken: `mock-jwt-token-${Date.now()}`,
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: `mock-refresh-token-${Date.now()}`,
      };

      return Result.ok(newToken);
    } catch (error) {
      return Result.fail(
        error instanceof Error
          ? error
          : new AppError('Token refresh failed', 'TOKEN_REFRESH_FAILED', 500)
      );
    }
  }
}
