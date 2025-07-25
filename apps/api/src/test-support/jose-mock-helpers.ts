/**
 * JWT token creation utilities for integration tests
 * @fileoverview Provides reusable JWT token creation functions for tests with jose mocking
 *
 * This module provides utilities for creating JWT tokens in tests. Tests must set up
 * jose mocking separately (see auth-protected-routes.test.ts for example).
 */

import type { SignJWT } from 'jose';

/**
 * Default JWT configuration for testing
 */
const DEFAULT_JWT_CONFIG = {
  issuer: 'http://localhost:8080/realms/certquiz',
  audience: 'certquiz',
  algorithm: 'RS256' as const,
};

/**
 * Default JWT claims for testing
 */
export const DEFAULT_JWT_CLAIMS = {
  sub: 'test-user-123',
  email: 'test@example.com',
  realm_access: { roles: ['certquiz-user'] },
};

/**
 * Creates a JWT builder with default test configuration
 *
 * @param claims - Custom claims to include in the token
 * @param config - JWT configuration overrides
 * @returns Configured SignJWT instance ready for signing
 *
 * @example
 * ```typescript
 * const token = await createJwtBuilder()
 *   .sign(privateKey);
 *
 * const customToken = await createJwtBuilder({ sub: 'custom-user' })
 *   .sign(privateKey);
 * ```
 */
export function createJwtBuilder(
  claims: Record<string, unknown> = {},
  config: Partial<typeof DEFAULT_JWT_CONFIG> = {}
): SignJWT {
  // Dynamic import to avoid issues with vitest mocking
  const { SignJWT } = require('jose') as typeof import('jose');

  const jwtConfig = { ...DEFAULT_JWT_CONFIG, ...config };
  const jwtClaims = { ...DEFAULT_JWT_CLAIMS, ...claims };

  return new SignJWT(jwtClaims)
    .setProtectedHeader({ alg: jwtConfig.algorithm })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer(jwtConfig.issuer)
    .setAudience(jwtConfig.audience);
}

/**
 * Creates an expired JWT builder with default test configuration
 *
 * @param claims - Custom claims to include in the token
 * @param config - JWT configuration overrides
 * @returns Configured SignJWT instance for expired token, ready for signing
 *
 * @example
 * ```typescript
 * const expiredToken = await createExpiredJwtBuilder()
 *   .sign(privateKey);
 * ```
 */
export function createExpiredJwtBuilder(
  claims: Record<string, unknown> = {},
  config: Partial<typeof DEFAULT_JWT_CONFIG> = {}
): SignJWT {
  // Dynamic import to avoid issues with vitest mocking
  const { SignJWT } = require('jose') as typeof import('jose');

  const jwtConfig = { ...DEFAULT_JWT_CONFIG, ...config };
  const jwtClaims = { ...DEFAULT_JWT_CLAIMS, ...claims };

  return new SignJWT(jwtClaims)
    .setProtectedHeader({ alg: jwtConfig.algorithm })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2 hours ago
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // 1 hour ago
    .setIssuer(jwtConfig.issuer)
    .setAudience(jwtConfig.audience);
}
