import type { AuthUser } from '@api/middleware/auth/auth-user';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface JwtVerifierOptions {
  jwksUri: string;
  audience: string;
  issuer: string;
}

export class JwtVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private options: JwtVerifierOptions;

  constructor(options: JwtVerifierOptions) {
    this.options = options;
    this.jwks = createRemoteJWKSet(new URL(options.jwksUri));
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      // Basic token format validation
      if (!token || !token.includes('.')) {
        throw new Error('Invalid token format');
      }

      // Check algorithm from header
      const [header] = token.split('.');
      let decodedHeader: { alg?: string };

      try {
        decodedHeader = JSON.parse(atob(header));
      } catch {
        throw new Error('Invalid token format');
      }

      if (decodedHeader.alg !== 'RS256') {
        throw new Error('Unsupported algorithm');
      }

      // Verify the JWT
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
      });

      // Extract user information
      const authUser: AuthUser = {
        sub: payload.sub as string,
        email: payload.email as string,
        preferred_username: payload.preferred_username as string,
        roles: this.extractRoles(payload),
      };

      // Validate required claims
      if (!authUser.sub) {
        throw new Error('Missing required claim: sub');
      }

      return authUser;
    } catch (error) {
      throw this.handleVerificationError(error);
    }
  }

  private extractRoles(payload: Record<string, unknown>): string[] {
    const roles: string[] = [];

    // Extract from realm_access
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    if (realmAccess?.roles) {
      roles.push(...realmAccess.roles);
    }

    // Extract from resource_access
    const resourceAccess = payload.resource_access as
      | Record<string, { roles?: string[] }>
      | undefined;
    const audienceRoles = resourceAccess?.[this.options.audience]?.roles;
    if (audienceRoles) {
      roles.push(...audienceRoles);
    }

    return roles;
  }

  private handleVerificationError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error('Token verification failed');
    }

    // Handle our own domain errors first
    const domainErrors = [
      'Missing required claim',
      'Invalid token format',
      'Unsupported algorithm',
    ];
    if (domainErrors.some((msg) => error.message.includes(msg))) {
      return error;
    }

    // Map JWT library errors to user-friendly messages
    const errorMappings = [
      { pattern: 'JWT expired', message: 'Token expired' },
      { pattern: 'JWT not active', message: 'Token not yet valid' },
      { pattern: 'JWS signature verification failed', message: 'Invalid token signature' },
      { pattern: 'Unable to find a key', message: 'Key not found in JWKS' },
      { pattern: 'failed to fetch JWKS', message: 'Failed to fetch JWKS' },
    ];

    for (const { pattern, message } of errorMappings) {
      if (error.message.includes(pattern)) {
        return new Error(message);
      }
    }

    // Re-throw other errors as-is
    return error;
  }
}
