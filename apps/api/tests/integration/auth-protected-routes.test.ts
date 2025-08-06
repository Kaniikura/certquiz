import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase } from '../helpers/setup-database';
import type { TestApp } from '../setup/test-app-factory';
import { createIntegrationTestApp } from '../setup/test-app-factory';

// Global variables for test keys (will be initialized in beforeAll)
let testPrivateKey: CryptoKey;
let testPublicKey: CryptoKey;

// Create the spy outside the mock so it can access testPublicKey at runtime
const getKeySpy = vi.fn(async () => testPublicKey);

// Mock only createRemoteJWKSet to control the behavior of the JWK retrieval process during tests.
// Other jose functions are kept as actual implementations to ensure the integrity of cryptographic operations.
vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');

  const mockCreateRemoteJWKSet = vi.fn(() => getKeySpy);

  return {
    ...actual,
    createRemoteJWKSet: mockCreateRemoteJWKSet,
  };
});

import { generateKeyPair, SignJWT } from 'jose';

describe('Authentication Protected Routes Integration', () => {
  // Setup isolated test database
  setupTestDatabase();

  let testApp: TestApp;
  let privateKey: CryptoKey;
  const issuer = 'http://localhost:8080/realms/certquiz';
  const audience = 'certquiz';

  beforeAll(async () => {
    // Generate test key pair
    const keyPair = await generateKeyPair('RS256');
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;
    privateKey = testPrivateKey;
  });

  beforeEach(async () => {
    // Create integration test app using DI container
    testApp = await createIntegrationTestApp();
  });

  // Helper to create test tokens
  async function createTestToken(claims: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT({
      sub: 'test-user-123',
      email: 'test@example.com',
      realm_access: { roles: ['certquiz-user'] },
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer(issuer)
      .setAudience(audience)
      .sign(privateKey);
  }

  describe('Public Routes', () => {
    it('GET /health should be accessible without authentication', async () => {
      const res = await testApp.request('/health/live');
      expect(res.status).toBe(200);
    });

    it('POST /api/auth/login should be accessible without authentication', async () => {
      const res = await testApp.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });
      // Login will fail with invalid credentials (401) or validation error (400)
      // but it should NOT require an Authorization header
      // We just need to ensure it's accessible, not that it succeeds
      expect(res.status === 400 || res.status === 401).toBe(true);
    });

    it('GET /api/quiz should return 501 Not Implemented (quiz catalog not yet built)', async () => {
      const res = await testApp.request('/api/quiz');
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error).toBe('Public quiz catalog not yet implemented');
      expect(body.code).toBe('NOT_IMPLEMENTED');
      expect(body.message).toContain('Question catalog implementation');
    });

    it('GET /api/quiz/:id should return 501 Not Implemented (quiz preview not yet built)', async () => {
      const res = await testApp.request('/api/quiz/test-quiz-123');
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error).toBe('Quiz preview not yet implemented');
      expect(body.code).toBe('NOT_IMPLEMENTED');
      expect(body.message).toContain('test-quiz-123');
      expect(body.message).toContain('Question catalog implementation');
    });
  });

  describe('Protected Routes', () => {
    it('POST /api/quiz should require authentication', async () => {
      const res = await testApp.request('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Quiz' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('POST /api/quiz should allow authenticated users', async () => {
      const token = await createTestToken();
      const res = await testApp.request('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: 'New Quiz' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.createdBy).toBe('test-user-123');
    });

    it('POST /api/quiz/start should require authentication', async () => {
      const res = await testApp.request('/api/quiz/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examType: 'CCNA',
          questionCount: 10,
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Premium Routes', () => {
    it('GET /api/quiz/premium should require premium role', async () => {
      // User without premium role
      const token = await createTestToken();
      const res = await testApp.request('/api/quiz/premium', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Insufficient permissions');
    });

    it('GET /api/quiz/premium should allow premium users', async () => {
      const token = await createTestToken({
        realm_access: { roles: ['certquiz-premium'] },
      });
      const res = await testApp.request('/api/quiz/premium', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.premiumFeatures).toBeDefined();
      expect(body.data.status).toBe('active');
    });

    it('GET /api/quiz/premium should allow admin users', async () => {
      const token = await createTestToken({
        realm_access: { roles: ['certquiz-admin'] },
      });
      const res = await testApp.request('/api/quiz/premium', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.premiumFeatures).toBeDefined();
      expect(body.data.status).toBe('active');
    });
  });

  describe('Admin Routes', () => {
    it('GET /api/admin/stats should require admin role', async () => {
      // Regular user
      const token = await createTestToken();
      const res = await testApp.request('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/stats should allow admin users', async () => {
      const token = await createTestToken({
        sub: '550e8400-e29b-41d4-a716-446655440001',
        realm_access: { roles: ['certquiz-admin'] },
      });
      const res = await testApp.request('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);

      // Debug: Log the raw response text if JSON parsing fails
      const text = await res.text();
      let body: {
        success: boolean;
        data?: {
          users?: unknown;
          quizzes?: unknown;
          questions?: unknown;
          system?: unknown;
        };
      };
      try {
        body = JSON.parse(text);
      } catch (_e) {
        // Re-throw error with additional context
        throw new Error(`Failed to parse JSON response: ${text}`);
      }

      expect(body.success).toBe(true);
      // Verify the response contains system statistics
      expect(body.data).toHaveProperty('users');
      expect(body.data).toHaveProperty('quizzes');
      expect(body.data).toHaveProperty('questions');
      expect(body.data).toHaveProperty('system');
    });

    it('GET /api/admin/users should require admin role', async () => {
      const token = await createTestToken({
        realm_access: { roles: ['certquiz-user'] },
      });
      const res = await testApp.request('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/users should allow admin users with pagination', async () => {
      const token = await createTestToken({
        sub: '550e8400-e29b-41d4-a716-446655440001',
        realm_access: { roles: ['certquiz-admin'] },
      });
      const res = await testApp.request('/api/admin/users?page=1&pageSize=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('items');
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('page');
      expect(body.data).toHaveProperty('pageSize');
      expect(body.data).toHaveProperty('totalPages');
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(10);
    });

    it('PATCH /api/admin/users/:id/roles should require admin role', async () => {
      const token = await createTestToken({
        realm_access: { roles: ['certquiz-user'] },
      });
      const res = await testApp.request('/api/admin/users/test-user/roles', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'premium' }),
      });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/admin/users/:id/roles should allow admin to update roles', async () => {
      const token = await createTestToken({
        sub: '550e8400-e29b-41d4-a716-446655440001',
        realm_access: { roles: ['certquiz-admin'] },
      });

      // This will fail with user not found, but that's expected in test environment
      // The important part is that it passes authentication and reaches the handler
      const res = await testApp.request(
        '/api/admin/users/550e8400-e29b-41d4-a716-446655440000/roles',
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'premium' }),
        }
      );

      // In test environment, we expect 404 as user doesn't exist
      // In real environment with data, this would be 200
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('DELETE /api/admin/quiz/:id should require admin role', async () => {
      const token = await createTestToken({
        realm_access: { roles: ['certquiz-user'] },
      });
      const res = await testApp.request('/api/admin/quiz/test-quiz', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for invalid tokens on protected routes', async () => {
      const res = await testApp.request('/api/quiz', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid.token.here',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 for expired tokens on protected routes', async () => {
      const expiredToken = await new SignJWT({
        sub: 'test-user',
        realm_access: { roles: ['certquiz-user'] },
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setExpirationTime(0) // Already expired
        .setIssuer(issuer)
        .setAudience(audience)
        .sign(privateKey);

      const res = await testApp.request('/api/quiz', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Token expired');
    });
  });

  describe('Route Ordering (Regression Test)', () => {
    it('should return quiz health status without authentication', async () => {
      const res = await testApp.request('/api/quiz/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        service: 'quiz',
        status: 'healthy',
      });
      expect(body.timestamp).toBeDefined();
    });

    it('should not confuse health endpoint with :id parameter', async () => {
      // Test that /health is not captured by /:id route
      const healthRes = await testApp.request('/api/quiz/health');
      expect(healthRes.status).toBe(200);

      const healthBody = await healthRes.json();
      expect(healthBody.service).toBe('quiz');
      expect(healthBody.error).toBeUndefined();

      // Test that actual :id route still works
      const idRes = await testApp.request('/api/quiz/some-quiz-id');
      expect(idRes.status).toBe(501);

      const idBody = await idRes.json();
      expect(idBody.error).toBe('Quiz preview not yet implemented');
      expect(idBody.message).toContain('some-quiz-id');
    });
  });
});
