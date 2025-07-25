/**
 * Auth Provider abstraction
 * @fileoverview Interface for authentication providers (KeyCloak, stub, etc.)
 */

import type { Result } from '@api/shared/result';

/**
 * Authentication token response
 */
export interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
}

/**
 * User information from auth provider
 */
export interface AuthUserInfo {
  id: string;
  email: string;
  username: string;
  roles?: string[];
  isActive: boolean;
}

/**
 * Auth provider interface for dependency injection
 * Abstracts away specific authentication implementation (KeyCloak, Auth0, etc.)
 */
export interface IAuthProvider {
  /**
   * Authenticate user with email/password
   * @param email User email
   * @param password User password
   * @returns Auth token or error
   */
  authenticate(email: string, password: string): Promise<Result<AuthToken>>;

  /**
   * Validate and decode access token
   * @param token Access token
   * @returns User info or error
   */
  validateToken(token: string): Promise<Result<AuthUserInfo>>;

  /**
   * Refresh access token using refresh token
   * @param refreshToken Refresh token
   * @returns New auth token or error
   */
  refreshToken(refreshToken: string): Promise<Result<AuthToken>>;

  /**
   * Get provider name for logging/debugging
   */
  readonly name: string;
}

/**
 * Auth provider configuration
 */
export interface AuthProviderConfig {
  provider: 'keycloak' | 'stub';
  keycloak?: {
    url: string;
    realm: string;
    clientId: string;
    clientSecret?: string;
  };
}
