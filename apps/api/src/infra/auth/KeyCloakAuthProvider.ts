/**
 * KeyCloak Auth Provider
 * @fileoverview Real KeyCloak authentication provider
 */

import { AppError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import pino from 'pino';
import type { AuthProviderConfig, AuthToken, AuthUserInfo, IAuthProvider } from './AuthProvider';

// Create logger for KeyCloak operations
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'KeyCloakAuthProvider',
});

/**
 * KeyCloak authentication provider
 * Integrates with real KeyCloak server for authentication
 */
export class KeyCloakAuthProvider implements IAuthProvider {
  public readonly name = 'keycloak';

  constructor(private readonly config: NonNullable<AuthProviderConfig['keycloak']>) {}

  async authenticate(email: string, password: string): Promise<Result<AuthToken>> {
    try {
      const tokenUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token`;

      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        username: email,
        password: password,
      });

      // Add client secret if provided
      if (this.config.clientSecret) {
        body.append('client_secret', this.config.clientSecret);
      }

      logger.info('Authenticating with KeyCloak', {
        url: tokenUrl,
        clientId: this.config.clientId,
        username: email,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('KeyCloak authentication failed', {
          status: response.status,
          error: errorText,
        });
        return Result.fail(new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401));
      }

      const tokenData = await response.json();

      const authToken: AuthToken = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in || 3600,
        refreshToken: tokenData.refresh_token,
      };

      logger.info('KeyCloak authentication successful', {
        tokenType: authToken.tokenType,
        expiresIn: authToken.expiresIn,
      });

      return Result.ok(authToken);
    } catch (error) {
      logger.error('KeyCloak authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return Result.fail(
        error instanceof Error ? error : new AppError('Authentication failed', 'AUTH_FAILED', 500)
      );
    }
  }

  async validateToken(token: string): Promise<Result<AuthUserInfo>> {
    try {
      const userInfoUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/userinfo`;

      const response = await fetch(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        logger.error('KeyCloak token validation failed', {
          status: response.status,
        });
        return Result.fail(new AppError('Invalid token', 'INVALID_TOKEN', 401));
      }

      const userInfo = await response.json();

      const authUserInfo: AuthUserInfo = {
        id: userInfo.sub,
        email: userInfo.email,
        username: userInfo.preferred_username || userInfo.email,
        roles: userInfo.realm_access?.roles || [],
        // now coming from the userinfo claim (falls back to true if unset)
        isActive: typeof userInfo.enabled === 'boolean' ? userInfo.enabled : true,
      };
      return Result.ok(authUserInfo);
    } catch (error) {
      logger.error('KeyCloak token validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return Result.fail(
        error instanceof Error
          ? error
          : new AppError('Token validation failed', 'TOKEN_VALIDATION_FAILED', 500)
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<Result<AuthToken>> {
    try {
      const tokenUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token`;

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        refresh_token: refreshToken,
      });

      if (this.config.clientSecret) {
        body.append('client_secret', this.config.clientSecret);
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('KeyCloak token refresh failed', {
          status: response.status,
          error: errorText,
        });
        return Result.fail(new AppError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401));
      }

      const tokenData = await response.json();

      const authToken: AuthToken = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in || 3600,
        refreshToken: tokenData.refresh_token,
      };

      logger.info('KeyCloak token refresh successful');

      return Result.ok(authToken);
    } catch (error) {
      logger.error('KeyCloak token refresh error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return Result.fail(
        error instanceof Error
          ? error
          : new AppError('Token refresh failed', 'TOKEN_REFRESH_FAILED', 500)
      );
    }
  }
}
