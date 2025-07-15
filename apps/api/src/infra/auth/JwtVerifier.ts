import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { IRoleMapper } from './RoleMapper';

export interface JwtVerifierOptions {
  jwksUri: string;
  audience: string;
  issuer: string;
}

export class JwtVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private options: JwtVerifierOptions;
  private roleMapper: IRoleMapper;

  constructor(options: JwtVerifierOptions, roleMapper: IRoleMapper) {
    this.options = options;
    this.roleMapper = roleMapper;
    this.jwks = createRemoteJWKSet(new URL(options.jwksUri));
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      // Basic token format validation
      if (!token || token.split('.').length !== 3) {
        throw new Error('Invalid token format');
      }

      // Verify the JWT - jose handles all validation including algorithm checks
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: ['RS256'], // Restrict to RS256 only
      });

      // Validate and extract user information
      const sub = payload.sub;
      if (typeof sub !== 'string' || !sub) {
        throw new Error('Missing required claim: sub');
      }

      // Extract raw roles from KeyCloak token
      const rawRoles = this.extractRoles(payload);

      // Convert to domain roles using the mapper
      const domainRoles = this.roleMapper.toDomain(rawRoles);

      // Convert UserRole enum values to strings for AuthUser
      const roleStrings = domainRoles.map((role) => UserRole.roleToString(role));

      const authUser: AuthUser = {
        sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        preferred_username:
          typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
        roles: roleStrings,
      };

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
    const domainErrors = ['Missing required claim', 'Invalid token format'];
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
      { pattern: 'alg "', message: 'Unsupported algorithm' }, // jose throws errors like 'alg "HS256" is not allowed'
    ];

    for (const { pattern, message } of errorMappings) {
      if (error.message.includes(pattern)) {
        return new Error(message, { cause: error });
      }
    }

    // Re-throw other errors as-is
    return error;
  }
}
