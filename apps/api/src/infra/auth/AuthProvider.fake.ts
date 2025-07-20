/**
 * Fake Auth Provider for Testing
 * @fileoverview Programmable stub for unit tests - no mocks, just TypeScript
 */

import { AppError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { AuthToken, AuthUserInfo, IAuthProvider } from './AuthProvider';

/**
 * Script function type for programmable behavior
 */
type AuthenticateScript = (email: string, password: string) => Result<AuthToken>;
type ValidateTokenScript = (token: string) => Result<AuthUserInfo>;
type RefreshTokenScript = (refreshToken: string) => Result<AuthToken>;

/**
 * Fake authentication provider for unit testing
 * Provides programmable behavior without vi.fn() magic
 */
export class FakeAuthProvider implements IAuthProvider {
  public readonly name = 'fake';

  private scripts = {
    authenticate: (_email: string, _password: string): Result<AuthToken> =>
      Result.fail(new AppError('authenticate not configured', 'NOT_CONFIGURED', 500)),
    validateToken: (_token: string): Result<AuthUserInfo> =>
      Result.fail(new AppError('validateToken not configured', 'NOT_CONFIGURED', 500)),
    refreshToken: (_refreshToken: string): Result<AuthToken> =>
      Result.fail(new AppError('refreshToken not configured', 'NOT_CONFIGURED', 500)),
  };

  /**
   * Program the authenticate behavior
   */
  whenAuthenticate(script: AuthenticateScript): this {
    this.scripts.authenticate = script;
    return this;
  }

  /**
   * Program the validateToken behavior
   */
  whenValidateToken(script: ValidateTokenScript): this {
    this.scripts.validateToken = script;
    return this;
  }

  /**
   * Program the refreshToken behavior
   */
  whenRefreshToken(script: RefreshTokenScript): this {
    this.scripts.refreshToken = script;
    return this;
  }

  /**
   * Convenient method for successful authentication
   */
  givenAuthenticationSucceeds(email?: string, token = 'fake-token-123'): this {
    return this.whenAuthenticate((inputEmail) => {
      if (email && inputEmail !== email) {
        return Result.fail(new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401));
      }
      return Result.ok({
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'fake-refresh-123',
      });
    });
  }

  /**
   * Convenient method for failed authentication
   */
  givenAuthenticationFails(errorMessage = 'Invalid credentials'): this {
    return this.whenAuthenticate(() => Result.fail(new AppError(errorMessage, 'AUTH_FAILED', 401)));
  }

  /**
   * Convenient method for authentication that throws an error
   */
  givenAuthenticationThrows(error: Error): this {
    return this.whenAuthenticate(() => {
      throw error;
    });
  }

  /**
   * Convenient method for successful token validation
   */
  givenTokenValidationSucceeds(token?: string, userInfo: Partial<AuthUserInfo> = {}): this {
    return this.whenValidateToken((inputToken) => {
      if (token && inputToken !== token) {
        return Result.fail(new AppError('Invalid token', 'INVALID_TOKEN', 401));
      }
      return Result.ok({
        id: 'fake-user-123',
        email: 'fake@example.com',
        username: 'fakeuser',
        roles: ['user'],
        isActive: true,
        ...userInfo,
      });
    });
  }

  /**
   * Reset all scripts to default (failing) state
   */
  reset(): this {
    this.scripts = {
      authenticate: () =>
        Result.fail(new AppError('authenticate not configured', 'NOT_CONFIGURED', 500)),
      validateToken: () =>
        Result.fail(new AppError('validateToken not configured', 'NOT_CONFIGURED', 500)),
      refreshToken: () =>
        Result.fail(new AppError('refreshToken not configured', 'NOT_CONFIGURED', 500)),
    };
    return this;
  }

  // IAuthProvider implementation ─────────────────────────────────────────

  async authenticate(email: string, password: string): Promise<Result<AuthToken>> {
    return Promise.resolve(this.scripts.authenticate(email, password));
  }

  async validateToken(token: string): Promise<Result<AuthUserInfo>> {
    return Promise.resolve(this.scripts.validateToken(token));
  }

  async refreshToken(refreshToken: string): Promise<Result<AuthToken>> {
    return Promise.resolve(this.scripts.refreshToken(refreshToken));
  }
}
