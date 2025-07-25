/**
 * Production Auth Provider Factory
 * @fileoverview Factory for creating auth providers in production (excludes test stubs)
 */

import { AppError } from '@api/shared/errors';
import type { AuthProviderConfig, IAuthProvider } from './AuthProvider';
import { KeyCloakAuthProvider } from './KeyCloakAuthProvider';

/**
 * Create auth provider for production use
 * Only includes real auth providers, no test stubs
 */
export function createAuthProvider(config?: Partial<AuthProviderConfig>): IAuthProvider {
  const provider = config?.provider || process.env.AUTH_PROVIDER || 'keycloak';

  switch (provider) {
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

    case 'stub':
      throw new AppError(
        'Stub auth provider is not available in production. Use KeyCloak or another real auth provider.',
        'STUB_NOT_AVAILABLE_IN_PRODUCTION',
        500
      );

    default:
      throw new AppError('Unknown auth provider specified', 'UNKNOWN_AUTH_PROVIDER', 500);
  }
}
