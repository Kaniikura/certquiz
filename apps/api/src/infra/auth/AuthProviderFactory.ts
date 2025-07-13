/**
 * Auth Provider Factory
 * @fileoverview Factory for creating auth providers based on environment configuration
 */

import { AppError } from '@api/shared/errors';
import type { AuthProviderConfig, IAuthProvider } from './AuthProvider';
import { KeyCloakAuthProvider } from './KeyCloakAuthProvider';
import { StubAuthProvider } from './StubAuthProvider';

/**
 * Valid auth provider types
 */
type AuthProviderType = 'keycloak' | 'stub';

/**
 * Type guard to check if a string is a valid auth provider type
 */
function isValidAuthProvider(value: string | undefined): value is AuthProviderType {
  return value === 'keycloak' || value === 'stub';
}

/**
 * Safely get auth provider type from environment, defaulting to 'stub'
 */
function getAuthProviderType(): AuthProviderType {
  const envValue = process.env.AUTH_PROVIDER;
  return isValidAuthProvider(envValue) ? envValue : 'stub';
}

/**
 * Create auth provider based on environment configuration
 */
export function createAuthProvider(config?: Partial<AuthProviderConfig>): IAuthProvider {
  // Default to stub provider for development/testing
  const provider = config?.provider || getAuthProviderType();

  switch (provider) {
    case 'stub':
      return new StubAuthProvider();

    case 'keycloak': {
      const keycloakConfig = config?.keycloak || {
        url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
        realm: process.env.KEYCLOAK_REALM || 'certquiz',
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'certquiz-api',
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || undefined,
      };

      if (!keycloakConfig.url || !keycloakConfig.realm || !keycloakConfig.clientId) {
        throw new AppError(
          'KeyCloak configuration missing. Required: KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID',
          'KEYCLOAK_CONFIG_MISSING',
          500
        );
      }

      return new KeyCloakAuthProvider(keycloakConfig);
    }

    default:
      throw new AppError('Unknown auth provider specified', 'UNKNOWN_AUTH_PROVIDER', 500);
  }
}

/**
 * Get current auth provider configuration from environment
 */
export function getAuthProviderConfig(): AuthProviderConfig {
  const provider = getAuthProviderType();

  const config: AuthProviderConfig = {
    provider,
  };

  if (provider === 'keycloak') {
    config.keycloak = {
      url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realm: process.env.KEYCLOAK_REALM || 'certquiz',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'certquiz-api',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || undefined,
    };
  }

  return config;
}

/**
 * Validate auth provider configuration
 */
export function validateAuthProviderConfig(config: AuthProviderConfig): void {
  if (config.provider === 'keycloak') {
    if (!config.keycloak?.url) {
      throw new AppError('KeyCloak URL is required', 'KEYCLOAK_URL_REQUIRED', 500);
    }
    if (!config.keycloak?.realm) {
      throw new AppError('KeyCloak realm is required', 'KEYCLOAK_REALM_REQUIRED', 500);
    }
    if (!config.keycloak?.clientId) {
      throw new AppError('KeyCloak client ID is required', 'KEYCLOAK_CLIENT_ID_REQUIRED', 500);
    }
  }
}
