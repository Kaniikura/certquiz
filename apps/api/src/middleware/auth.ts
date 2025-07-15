import { JwtVerifier } from '@api/infra/auth/JwtVerifier';
import { DEFAULT_ROLE_MAPPING, RoleMapper } from '@api/infra/auth/RoleMapper';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AuthUser } from './auth/auth-user';

export interface AuthOptions {
  required?: boolean;
  roles?: string[];
}

// Cache JwtVerifier instance
let jwtVerifier: JwtVerifier | null = null;

// Export for testing purposes only
export function resetJwtVerifierCache(): void {
  jwtVerifier = null;
}

function getJwtVerifier(): JwtVerifier {
  if (!jwtVerifier) {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const keycloakRealm = process.env.KEYCLOAK_REALM || 'certquiz';

    // Create role mapper with default or configured mapping
    const roleMapping = process.env.ROLE_MAPPING_JSON
      ? JSON.parse(process.env.ROLE_MAPPING_JSON)
      : DEFAULT_ROLE_MAPPING;
    const roleMapper = new RoleMapper(roleMapping);

    jwtVerifier = new JwtVerifier(
      {
        jwksUri: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`,
        audience: 'certquiz',
        issuer: `${keycloakUrl}/realms/${keycloakRealm}`,
      },
      roleMapper
    );
  }
  return jwtVerifier;
}

/* ---------- Private helpers ---------- */

// 1. Missing / invalid header handling
function resolveHeader(
  c: Context<{ Variables: { user?: AuthUser } }>,
  required: boolean
): string | null {
  const header = c.req.header('Authorization');

  // (a) Missing header
  if (header == null) {
    if (required) throw c.json({ error: 'Authentication required' }, 401);
    c.set('user', undefined);
    return null;
  }

  // (b) Empty string = invalid
  if (header.trim() === '') {
    if (required) throw c.json({ error: 'Invalid authorization format' }, 401);
    c.set('user', undefined);
    return null;
  }

  return header;
}

// 2. "Bearer …" syntax check
function extractBearerToken(
  header: string,
  c: Context<{ Variables: { user?: AuthUser } }>,
  required: boolean
): string | null {
  const [scheme, ...rest] = header.trim().split(' ');
  if (scheme !== 'Bearer' || rest.join(' ').trim() === '') {
    if (required) throw c.json({ error: 'Invalid authorization format' }, 401);
    c.set('user', undefined);
    return null;
  }
  return rest.join(' ').trim();
}

// 3. Role authorization
function ensureRoles(user: AuthUser, roles: string[]): void {
  if (roles.length > 0 && !roles.every((role) => user.roles.includes(role))) {
    throw new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
}

// 4. Auth-library error whitelist
function isAuthError(err: unknown): err is Error {
  return (
    err instanceof Error &&
    [
      'Token expired',
      'Token not yet valid',
      'Invalid token signature',
      'Invalid token format',
      'Missing required claim',
      'Key not found in JWKS',
      'Failed to fetch JWKS',
      'Unsupported algorithm',
    ].some((msg) => err.message.includes(msg))
  );
}

/**
 * Authentication middleware for Hono applications.
 * Validates JWT tokens and sets authenticated user in context.
 *
 * @param options - Configuration options
 * @param options.required - Whether authentication is required (default: true)
 * @param options.roles - Required roles for authorization
 * @returns Hono middleware handler
 */
export const auth = (options?: AuthOptions) => {
  const { required = true, roles = [] } = options ?? {};

  return createMiddleware<{ Variables: { user?: AuthUser } }>(async (c, next) => {
    try {
      /* 1. Header checks --------------------------------------------------- */
      const rawHeader = resolveHeader(c, required);
      if (!rawHeader) return next(); // optional & no header

      const token = extractBearerToken(rawHeader, c, required);
      if (!token) return next(); // optional & bad header

      /* 2. Token verification --------------------------------------------- */
      const verifier = getJwtVerifier();
      const user = await verifier.verifyToken(token);

      /* 3. Role check ------------------------------------------------------ */
      ensureRoles(user, roles);

      /* 4. Success --------------------------------------------------------- */
      c.set('user', user);
      return next();
    } catch (err) {
      /* Responses deliberately thrown by helpers -------------------------- */
      if (err instanceof Response) return err;

      /* JWT-lib known failures -------------------------------------------- */
      if (isAuthError(err)) {
        return c.json({ error: err.message }, 401);
      }

      /* Everything else ---------------------------------------------------- */
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
};
