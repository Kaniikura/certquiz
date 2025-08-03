import type { Context } from 'hono';
import type { AuthUser } from '../auth/auth-user';

/**
 * Type for key generator functions
 */
type KeyGenerator = (c: Context) => string;

/**
 * Available key generator types
 */
export type KeyGeneratorType = 'ip' | 'user';

/**
 * Extracts the client IP address from request headers.
 * Checks multiple headers in order of preference to handle various proxy configurations.
 *
 * Priority order:
 * 1. X-Forwarded-For (first IP if multiple)
 * 2. CF-Connecting-IP (Cloudflare)
 * 3. X-Real-IP (common proxy header)
 * 4. Fallback to 'unknown'
 *
 * @param c - Hono context
 * @returns IP-based rate limiting key in format "ip:xxx.xxx.xxx.xxx" or "ip:unknown"
 *
 * @example
 * ```typescript
 * const key = getIpKey(c); // "ip:192.168.1.1"
 * ```
 */
export function getIpKey(c: Context): string {
  // Check X-Forwarded-For header (standard proxy header)
  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    // Take the first IP if multiple are present (client IP is first)
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) {
      return `ip:${firstIp}`;
    }
  }

  // Check CF-Connecting-IP header (Cloudflare)
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp?.trim()) {
    return `ip:${cfConnectingIp.trim()}`;
  }

  // Check X-Real-IP header (common proxy header)
  const xRealIp = c.req.header('x-real-ip');
  if (xRealIp?.trim()) {
    return `ip:${xRealIp.trim()}`;
  }

  // Fallback when no IP can be determined
  return 'ip:unknown';
}

/**
 * Extracts the user identifier from the authenticated context.
 * Uses the 'sub' (subject) field from the JWT claims stored in context.
 *
 * @param c - Hono context with potential AuthUser
 * @returns User-based rate limiting key in format "user:xxx" or "user:anonymous"
 *
 * @example
 * ```typescript
 * // Authenticated user
 * const key = getUserKey(c); // "user:user-123"
 *
 * // Anonymous user
 * const key = getUserKey(c); // "user:anonymous"
 * ```
 */
export function getUserKey(c: Context): string {
  const user = c.get('user') as AuthUser | undefined;

  // Check if user exists and has a valid sub (subject/user ID)
  if (user?.sub?.trim()) {
    return `user:${user.sub}`;
  }

  // Fallback for unauthenticated or invalid user
  return 'user:anonymous';
}

/**
 * Creates a composite key that includes the request path.
 * Useful for endpoint-specific rate limiting.
 *
 * @param c - Hono context
 * @param type - Type of base key to use ('user' or 'ip')
 * @returns Composite key in format "type:identifier:path:/api/endpoint"
 *
 * @example
 * ```typescript
 * // IP-based path limiting
 * const key = getCompositeKey(c, 'ip'); // "ip:192.168.1.1:path:/api/quiz"
 *
 * // User-based path limiting
 * const key = getCompositeKey(c, 'user'); // "user:user-123:path:/api/quiz"
 * ```
 */
export function getCompositeKey(c: Context, type: 'user' | 'ip'): string {
  const baseKey = type === 'user' ? getUserKey(c) : getIpKey(c);
  const path = c.req.path;

  return `${baseKey}:path:${path}`;
}

/**
 * Gets a key generator function by name.
 * Useful for dynamic key generator selection in middleware configuration.
 *
 * @param type - The type of key generator to get
 * @returns The corresponding key generator function
 * @throws Error if an invalid type is provided
 *
 * @example
 * ```typescript
 * const generator = getKeyGenerator('ip');
 * const key = generator(c); // "ip:192.168.1.1"
 * ```
 */
export function getKeyGenerator(type: KeyGeneratorType): KeyGenerator {
  switch (type) {
    case 'ip':
      return getIpKey;
    case 'user':
      return getUserKey;
    default:
      // This should never happen with TypeScript, but provides runtime safety
      throw new Error(`Invalid key generator type: ${type}`);
  }
}
