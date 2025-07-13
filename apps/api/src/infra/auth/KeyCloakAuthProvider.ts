/**
 * KeyCloak Auth Provider
 * @fileoverview Real KeyCloak authentication provider
 */

import { createHash } from 'node:crypto';
import { AppError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import pino from 'pino';
import { z } from 'zod';
import type { AuthProviderConfig, AuthToken, AuthUserInfo, IAuthProvider } from './AuthProvider';

// Create logger for KeyCloak operations
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'KeyCloakAuthProvider',
});

// Validation schemas
const authenticateSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const validateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Type guards for KeyCloak responses
function isValidTokenResponse(data: unknown): data is {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'access_token' in data &&
    typeof (data as Record<string, unknown>).access_token === 'string'
  );
}

function isValidUserInfoResponse(data: unknown): data is {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles: string[] };
  enabled?: boolean;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'sub' in data &&
    typeof (data as Record<string, unknown>).sub === 'string'
  );
}

// Helper to hash email for logging
function hashEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex').substring(0, 8);
}

/**
 * KeyCloak authentication provider
 * Integrates with real KeyCloak server for authentication
 */
export class KeyCloakAuthProvider implements IAuthProvider {
  public readonly name = 'keycloak';

  constructor(private readonly config: NonNullable<AuthProviderConfig['keycloak']>) {}

  async authenticate(email: string, password: string): Promise<Result<AuthToken>> {
    // Validate input
    const validation = authenticateSchema.safeParse({ email, password });
    if (!validation.success) {
      return Result.fail(new AppError('Invalid input parameters', 'INVALID_INPUT', 400));
    }

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
        emailHash: hashEmail(email),
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

      let tokenData: unknown;
      try {
        tokenData = await response.json();

        // Type guard for KeyCloak token response
        if (!isValidTokenResponse(tokenData)) {
          logger.error('Invalid KeyCloak token response structure');
          return Result.fail(new AppError('Invalid response format', 'INVALID_RESPONSE', 500));
        }
      } catch (error) {
        logger.error('Failed to parse KeyCloak response', { error });
        return Result.fail(new AppError('Invalid response format', 'INVALID_RESPONSE', 500));
      }

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
    // Validate input
    const validation = validateTokenSchema.safeParse({ token });
    if (!validation.success) {
      return Result.fail(new AppError('Invalid token parameter', 'INVALID_INPUT', 400));
    }

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

      let userInfo: unknown;
      try {
        userInfo = await response.json();

        // Type guard for KeyCloak userinfo response
        if (!isValidUserInfoResponse(userInfo)) {
          logger.error('Invalid KeyCloak userinfo response structure');
          return Result.fail(new AppError('Invalid response format', 'INVALID_RESPONSE', 500));
        }
      } catch (error) {
        logger.error('Failed to parse KeyCloak userinfo response', { error });
        return Result.fail(new AppError('Invalid response format', 'INVALID_RESPONSE', 500));
      }

      const authUserInfo: AuthUserInfo = {
        id: userInfo.sub,
        email: userInfo.email || '',
        username: userInfo.preferred_username || userInfo.email || '',
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
    // Validate input
    const validation = refreshTokenSchema.safeParse({ refreshToken });
    if (!validation.success) {
      return Result.fail(new AppError('Invalid refresh token parameter', 'INVALID_INPUT', 400));
    }

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

      let tokenData: unknown;
      try {
        tokenData = await response.json();

        // Type guard for KeyCloak token response (reuse the same function from authenticate)
        if (!isValidTokenResponse(tokenData)) {
          logger.error('Invalid KeyCloak refresh token response structure');
          return Result.fail(new AppError('Invalid response format', 'INVALID_RESPONSE', 500));
        }
      } catch (error) {
        logger.error('Failed to parse KeyCloak refresh token response', { error });
        return Result.fail(new AppError('Invalid response format', 'INVALID_RESPONSE', 500));
      }

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
