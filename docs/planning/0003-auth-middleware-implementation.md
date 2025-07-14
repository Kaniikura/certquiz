# 0003: Authentication Middleware Implementation Plan

## Overview

This document outlines the implementation plan for enhancing authentication in the CertQuiz application. The plan consists of two phases:
1. **Provider Field Rename** - Remove vendor-specific naming from domain model
2. **Authentication Middleware** - Add JWT validation middleware for API security

Based on architectural review, we will maintain the current simple database schema approach while ensuring clean domain modeling and proper security.

## Current State

### What We Have
- ✅ **IAuthProvider interface** with methods for authenticate/validateToken/refreshToken
- ✅ **KeyCloakAuthProvider** implementation for KeyCloak integration
- ✅ **Simple UserId** as branded string type
- ✅ **User aggregate** with identityProviderId property
- ✅ **Clean repository pattern** with transaction support
- ✅ **Login handler** that authenticates and returns tokens

### What's Missing
- ❌ **Authentication middleware** for protecting API endpoints
- ❌ **User context injection** into request handlers
- ❌ **Role-based authorization** checks

## Implementation Strategy

### Phase 1: Provider Field Rename (30 minutes)

Rename `keycloakId` to `identityProviderId` to maintain clean domain model:

#### 1.1 Database Migration

```sql
-- Create migration file
ALTER TABLE auth_user 
  RENAME COLUMN keycloak_id TO identity_provider_id;
```

#### 1.2 Domain Model Update

```typescript
// Before
export class User extends AggregateRoot<UserId> {
  constructor(
    // ...
    public readonly identityProviderId: string,
    // ...
  ) {}
}

// After
export class User extends AggregateRoot<UserId> {
  constructor(
    // ...
    public readonly identityProviderId: string,
    // ...
  ) {}
}
```

#### 1.3 Repository Updates

```typescript
// Rename method
- async findByIdentityProviderId(identityProviderId: string): Promise<User | null>
+ async findByIdentityProviderId(identityProviderId: string): Promise<User | null>
```

**Benefits**:
- Domain model becomes provider-agnostic
- No infrastructure details in domain layer
- Future-proof naming for potential multi-provider support
- Follows DDD best practices

### Phase 2: Implement Authentication Middleware

#### 2.1 Define Auth Context Types

**File**: `apps/api/src/lib/context-types.ts`

```typescript
export type AuthUser = {
  sub: string;          // Identity provider user id
  email?: string;
  preferred_username?: string;
  roles: string[];      // Flattened from JWT claims
};

declare module 'hono' {
  interface ContextVariableMap {
    user?: AuthUser;    // Available via c.get('user')
  }
}
```

**Key Decision**: Store only JWT claims, not the full User aggregate, to avoid unnecessary database queries.

#### 2.2 JWT Verification Service

**File**: `apps/api/src/infra/auth/JwtVerifier.ts`

```typescript
import jwks from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@api/lib/context-types';

export class JwtVerifier {
  private client = jwks({
    jwksUri: `${config.auth.jwksUri}`,
  });

  async verifyToken(token: string): Promise<AuthUser> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    const kid = decoded.header.kid;
    const key = await this.client.getSigningKey(kid);
    const pubKey = key.getPublicKey();

    const payload = jwt.verify(token, pubKey, {
      audience: config.auth.clientId,
      issuer: config.auth.issuer,
    }) as jwt.JwtPayload;

    // Flatten roles from JWT structure
    const roles = [
      ...(payload.realm_access?.roles ?? []),
      ...(payload.resource_access?.[config.auth.clientId]?.roles ?? []),
    ] as string[];

    return {
      sub: payload.sub,
      email: payload.email,
      preferred_username: payload.preferred_username,
      roles,
    };
  }
}
```

#### 2.3 Authentication Middleware

**File**: `apps/api/src/middleware/auth.ts`

```typescript
import type { Context, Next } from 'hono';
import { JwtVerifier } from '@api/infra/auth/JwtVerifier';

const verifier = new JwtVerifier();

type AuthOptions = {
  required?: boolean;    // Default: true
  roles?: string[];      // Optional role requirements
};

export const auth = (options: AuthOptions = { required: true }) =>
  async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (options.required) {
        return c.json({ error: 'Authentication required' }, 401);
      }
      return await next();
    }

    const token = authHeader.slice(7).trim();
    
    try {
      const user = await verifier.verifyToken(token);
      
      // Check roles if specified
      if (options.roles && !options.roles.some(r => user.roles.includes(r))) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
      
      c.set('user', user);
      await next();
    } catch (error) {
      if (options.required) {
        return c.json({ error: 'Invalid token' }, 401);
      }
      await next();
    }
  };
```

#### 2.4 Updated Route Configuration

**File**: `apps/api/src/routes.ts`

```typescript
import { Hono } from 'hono';
import { auth } from './middleware/auth';

const app = new Hono();

// Public endpoints
app.get('/health', healthHandler);
app.post('/auth/login', loginHandler);

// Authenticated endpoints
app.use('/api/*', auth());  // Require auth for all /api routes

// Specific role requirements
app.delete('/api/admin/*', auth({ roles: ['admin'] }));

// Optional authentication
app.get('/api/public/questions', auth({ required: false }), listQuestionsHandler);
```

#### 2.5 Updated Handler Pattern

**File**: `apps/api/src/features/quiz/start-quiz/handler.ts`

```typescript
export async function startQuizHandler(c: Context) {
  const input = c.req.valid('json');
  const authUser = c.get('user')!;  // Guaranteed by middleware
  
  return withTransaction(async (trx) => {
    // Convert identity provider ID to internal UserId
    const userRepo = new DrizzleUserRepository(trx);
    const user = await userRepo.findByIdentityProviderId(authUser.sub);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const quizRepo = new DrizzleQuizRepository(trx);
    const sessionResult = QuizSession.startNew(
      user.id,
      input.config,
      input.questionIds,
      new Date()
    );
    
    if (!sessionResult.success) {
      return c.json({ error: sessionResult.error.message }, 400);
    }
    
    await quizRepo.save(sessionResult.data);
    return c.json({ sessionId: sessionResult.data.id });
  });
}
```

## Implementation Plan

### Phase 1: Provider Field Rename (30 minutes)
1. Create database migration for column rename
2. Update User domain entity (identityProviderId is now used)
3. Update DrizzleUserRepository schema and methods
4. Update all references in handlers and tests
5. Run all tests to ensure no breakage
6. Commit with atomic change

### Phase 2: Authentication Middleware (2 hours)

#### Day 1: Context Types & JWT Verifier
1. Create context type definitions
2. Implement JwtVerifier with JWKS support
3. Add configuration for auth provider endpoints
4. Write unit tests for JWT verification

#### Day 2: Authentication Middleware
1. Implement auth middleware with role support
2. Update app factory to include middleware
3. Configure public vs protected routes
4. Write middleware tests

#### Day 3: Update Handlers
1. Update all handlers to use auth context
2. Update findByIdentityProviderId usage
3. Ensure backward compatibility
4. Integration tests for auth flow

#### Day 4: Testing & Documentation
1. End-to-end tests with real identity provider
2. Update API documentation
3. Add auth examples
4. Performance testing

## Future Considerations

### When to Add Provider Abstraction

Consider migrating to a provider-agnostic approach when:
1. **Adding a second IdP** (Auth0, Cognito, SAML)
2. **Account linking** is required (same user, multiple providers)
3. **Provider replacement** is planned
4. **Multi-tenancy** requires different providers per tenant

### Migration Path (When Needed)

```sql
-- Future migration to support multiple providers
CREATE TABLE user_id_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_user(user_id),
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  UNIQUE(provider, provider_user_id)
);

-- Migrate existing data
INSERT INTO user_id_mappings (user_id, provider, provider_user_id)
SELECT user_id, 'keycloak', identity_provider_id FROM auth_user;

-- Eventually drop old column if migrating from legacy schema
-- ALTER TABLE auth_user DROP COLUMN old_provider_id;
```

## Testing Strategy

### Unit Tests
- JWT verification with mocked JWKS
- Middleware with various token scenarios
- Role-based authorization checks

### Integration Tests
- Full auth flow with test identity provider
- Protected endpoint access
- Token refresh flows

### E2E Tests
- Login → Access protected resource → Logout
- Role-based access scenarios
- Token expiration handling

## Benefits of This Approach

1. **Immediate Security**: Endpoints are protected now
2. **Simple Implementation**: No complex schema changes
3. **Clean Architecture**: Middleware pattern keeps concerns separated
4. **Future-Proof**: Easy migration path when needed
5. **Performance**: No extra database joins or lookups

## Acceptance Criteria

### Phase 1: Provider Field Rename
- [ ] No "keycloak" references in domain layer
- [ ] Database migration applied successfully
- [ ] All tests passing after rename
- [ ] Clean git history with atomic commit

### Phase 2: Authentication Middleware
- [ ] All API endpoints are protected by default
- [ ] Public endpoints are explicitly marked
- [ ] JWT tokens are validated against the identity provider
- [ ] User context is available in all handlers
- [ ] Role-based authorization works
- [ ] Tests achieve 90%+ coverage
- [ ] Zero breaking changes to existing APIs
- [ ] Performance impact < 10ms per request

## Conclusion

This revised approach provides immediate security benefits while maintaining simplicity. By keeping the current database schema and focusing on the missing middleware component, we can deliver a secure API quickly without over-engineering the solution. The clean architecture ensures we can evolve to a more complex multi-provider system when business requirements demand it.