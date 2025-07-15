/**
 * JWT claims extracted from the authentication token.
 * This is a technical/infrastructure type, not a domain entity.
 * Used by middleware to inject authenticated user context into Hono.
 */
export type AuthUser = {
  sub: string; // Identity provider user id
  email?: string;
  preferred_username?: string;
  roles: string[]; // Flattened from JWT claims
};

// Augment Hono's context to include authenticated user
declare module 'hono' {
  interface ContextVariableMap {
    user?: AuthUser; // Available via c.get('user')
  }
}
