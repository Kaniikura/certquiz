import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Global variables for test keys (will be initialized in beforeAll)
let testPrivateKey: CryptoKey;
let testPublicKey: CryptoKey;

// Create the spy outside the mock so it can access testPublicKey at runtime
const getKeySpy = vi.fn(async () => testPublicKey);

// Mock only createRemoteJWKSet
vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');

  const mockCreateRemoteJWKSet = vi.fn(() => getKeySpy);

  return {
    ...actual,
    createRemoteJWKSet: mockCreateRemoteJWKSet,
  };
});

import { Hono } from 'hono';
import { generateKeyPair, SignJWT } from 'jose';
import { resetJwtVerifierCache } from '../test-support/jwt-helpers';
import { auth } from './auth';
import type { AuthUser } from './auth/auth-user';

describe('Authentication Integration Tests', () => {
  let testApp: Hono<{ Variables: { user?: AuthUser } }>;
  let privateKey: CryptoKey;

  // Test configuration matching production setup
  const issuer = 'http://localhost:8080/realms/certquiz';
  const audience = 'certquiz';

  beforeAll(async () => {
    // Generate test keys
    const keyPair = await generateKeyPair('RS256');
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;
    privateKey = testPrivateKey;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables
    process.env.KEYCLOAK_URL = 'http://localhost:8080';
    process.env.KEYCLOAK_REALM = 'certquiz';

    // Reset JwtVerifier cache before each test
    resetJwtVerifierCache();

    // Create test app with auth middleware
    testApp = new Hono<{ Variables: { user?: AuthUser } }>();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.KEYCLOAK_URL;
    delete process.env.KEYCLOAK_REALM;
    delete process.env.ROLE_MAPPING_JSON;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // Helper to create signed JWT tokens
  async function createToken(
    payload: Record<string, unknown>,
    options?: { expired?: boolean; notYetValid?: boolean }
  ): Promise<string> {
    const iat = Math.floor(Date.now() / 1000);
    const exp = options?.expired ? iat - 3600 : iat + 3600;
    const nbf = options?.notYetValid ? iat + 3600 : undefined;

    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .setIssuer(issuer)
      .setAudience(audience);

    if (nbf) {
      jwt.setNotBefore(nbf);
    }

    return await jwt.sign(privateKey);
  }

  describe('End-to-end authentication flow', () => {
    it('should authenticate valid JWT and set user in context', async () => {
      // Arrange
      testApp.use(auth());
      testApp.get('/protected', (c) => {
        const user = c.get('user');
        return c.json({ authenticated: true, user });
      });

      const token = await createToken({
        sub: 'user-123',
        email: 'test@example.com',
        preferred_username: 'testuser',
        realm_access: { roles: ['certquiz-user'] },
      });

      // Act
      const res = await testApp.request('/protected', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        authenticated: true,
        user: {
          sub: 'user-123',
          email: 'test@example.com',
          preferred_username: 'testuser',
          roles: ['user'], // Mapped from certquiz-user
        },
      });
    });

    it('should map KeyCloak roles to domain roles correctly', async () => {
      // Arrange
      testApp.use(auth());
      testApp.get('/user-info', (c) => c.json(c.get('user')));

      const token = await createToken({
        sub: 'admin-456',
        email: 'admin@example.com',
        realm_access: { roles: ['certquiz-admin', 'manage-account'] },
        resource_access: {
          certquiz: { roles: ['certquiz-premium'] },
        },
      });

      // Act
      const res = await testApp.request('/user-info', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Assert
      expect(res.status).toBe(200);
      const user = await res.json();
      expect(user.roles).toEqual(['user', 'premium', 'admin']); // Sorted by hierarchy
    });

    it('should reject expired tokens', async () => {
      // Arrange
      testApp.use(auth());
      testApp.get('/protected', (c) => c.text('Should not reach here'));

      const token = await createToken({ sub: 'user-123' }, { expired: true });

      // Act
      const res = await testApp.request('/protected', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Token expired' });
    });

    it('should enforce role-based authorization', async () => {
      // Arrange
      testApp.use(auth({ roles: ['admin'] }));
      testApp.get('/admin-only', (c) => c.text('Admin access granted'));

      const userToken = await createToken({
        sub: 'user-789',
        realm_access: { roles: ['certquiz-user'] },
      });

      // Act
      const res = await testApp.request('/admin-only', {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      // Assert
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Insufficient permissions' });
    });

    it('should allow optional authentication', async () => {
      // Arrange
      testApp.use(auth({ required: false }));
      testApp.get('/public', (c) => {
        const user = c.get('user');
        return c.json({
          public: true,
          authenticated: !!user,
          user: user || null,
        });
      });

      // Act - Without token
      const res1 = await testApp.request('/public');
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1).toEqual({
        public: true,
        authenticated: false,
        user: null,
      });

      // Act - With valid token
      const token = await createToken({
        sub: 'user-999',
        realm_access: { roles: ['certquiz-user'] },
      });
      const res2 = await testApp.request('/public', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2).toMatchObject({
        public: true,
        authenticated: true,
        user: {
          sub: 'user-999',
          roles: ['user'],
        },
      });
    });
  });

  describe('Configuration and environment', () => {
    it('should use custom role mapping from environment variable', async () => {
      // Arrange
      const customMapping = {
        'custom-student': 'user',
        'custom-premium': 'premium',
        'custom-admin': 'admin',
      };
      process.env.ROLE_MAPPING_JSON = JSON.stringify(customMapping);

      // Reset cache to pick up new env var
      resetJwtVerifierCache();

      testApp.use(auth());
      testApp.get('/roles', (c) => c.json({ roles: c.get('user')?.roles }));

      const token = await createToken({
        sub: 'user-custom',
        realm_access: { roles: ['custom-student', 'custom-premium'] },
      });

      // Act
      const res = await testApp.request('/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.roles).toEqual(['user', 'premium']);
    });

    it('should handle malformed tokens gracefully', async () => {
      // Arrange
      testApp.use(auth());
      testApp.get('/protected', (c) => c.text('Should not reach here'));

      // Act
      const res = await testApp.request('/protected', {
        headers: { Authorization: 'Bearer not.a.valid.jwt' },
      });

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('Integration with main app', () => {
    it('should work with the main application instance', async () => {
      // Create a test app that simulates main app behavior
      const testMainApp = new Hono<{ Variables: { user?: AuthUser } }>();

      // Add the test route
      testMainApp.get('/integration-test', auth(), (c) => {
        const user = c.get('user');
        return c.json({ integration: 'success', userId: user?.sub });
      });

      const token = await createToken({
        sub: 'integration-user',
        realm_access: { roles: ['certquiz-user'] },
      });

      // Act
      const res = await testMainApp.request('/integration-test', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        integration: 'success',
        userId: 'integration-user',
      });
    });
  });
});
