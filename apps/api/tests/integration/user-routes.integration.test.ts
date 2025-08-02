/**
 * User routes HTTP integration tests
 * @fileoverview Tests actual HTTP request/response behavior for user endpoints
 */

import { createExpiredJwtBuilder, createJwtBuilder } from '@api/test-support';
import { setupTestDatabase } from '@test/helpers';
import { generateKeyPair } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('User Routes HTTP Integration', () => {
  // Setup isolated test database
  setupTestDatabase();

  let privateKey: CryptoKey;
  let testApp: TestApp;

  beforeAll(async () => {
    // Generate test key pair for JWT signing
    const keyPair = await generateKeyPair('RS256');
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;
    privateKey = testPrivateKey;

    // Create HTTP test app using DI container with in-memory providers
    testApp = await createIntegrationTestApp();
  });

  beforeEach(async () => {
    // Clean up in-memory data between tests
    await testApp.cleanup?.();
  });

  // Helper to create test JWT tokens using utility builder
  async function createTestToken(claims: Record<string, unknown> = {}): Promise<string> {
    const jwtBuilder = await createJwtBuilder(claims);
    return jwtBuilder.sign(privateKey);
  }

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await testApp.request('/api/users/health');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        service: 'user',
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });
  });

  describe('POST /register', () => {
    it('should register a new user with valid data', async () => {
      const res = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          username: 'newuser',
          identityProviderId: 'provider-123',
          role: 'user',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            email: 'newuser@example.com',
            username: 'newuser',
            role: 'user',
            isActive: true,
            progress: {
              level: 1,
              experience: 0,
              currentStreak: 0,
            },
          },
        },
      });
    });

    it('should return 400 for invalid email', async () => {
      const res = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          username: 'testuser',
          identityProviderId: 'provider-123',
          role: 'user',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('email'),
        },
      });
    });

    it('should return 400 for missing required fields', async () => {
      const res = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          // missing username
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
        },
      });
    });

    it('should return 409 for duplicate email', async () => {
      // Use unique email for this test to avoid conflicts with other tests
      const uniqueEmail = `duplicate-${Date.now()}@example.com`;

      // First registration
      const firstRes = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: uniqueEmail,
          username: `user1-${Date.now()}`,
          identityProviderId: `provider-${Date.now()}-1`,
          role: 'user',
        }),
      });

      // Check first registration succeeded
      expect(firstRes.status).toBe(201);

      // Second registration with same email
      const res = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: uniqueEmail,
          username: `user2-${Date.now()}`,
          identityProviderId: `provider-${Date.now()}-2`,
          role: 'user',
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_TAKEN',
          field: 'email',
        },
      });
    });

    it('should return 409 for duplicate username', async () => {
      // Use unique username for this test to avoid conflicts
      const uniqueUsername = `duplicateuser-${Date.now()}`;

      // First registration
      const firstRes = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `user1-${Date.now()}@example.com`,
          username: uniqueUsername,
          identityProviderId: `provider-${Date.now()}-1`,
          role: 'user',
        }),
      });

      // Check first registration succeeded
      expect(firstRes.status).toBe(201);

      // Second registration with same username
      const res = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `user2-${Date.now()}@example.com`,
          username: uniqueUsername,
          identityProviderId: `provider-${Date.now()}-2`,
          role: 'user',
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'USERNAME_ALREADY_TAKEN',
          field: 'username',
        },
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      const res = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /profile/:userId', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a test user using unique data
      const timestamp = Date.now();
      const registerRes = await testApp.request('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `profiletest-${timestamp}@example.com`,
          username: `profileuser-${timestamp}`,
          identityProviderId: `provider-profile-${timestamp}`,
          role: 'user',
        }),
      });

      // Check registration succeeded
      if (registerRes.status !== 201) {
        const errorData = await registerRes.json();
        throw new Error(
          `Failed to create test user: ${registerRes.status} ${JSON.stringify(errorData)}`
        );
      }

      const registerData = await registerRes.json();
      testUserId = registerData.data.user.id;

      // Note: Progress is now updated through quiz completion, not directly
      // User will have initial/default progress values
    });

    it('should require authentication', async () => {
      const res = await testApp.request(`/api/users/profile/${testUserId}`);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should return user profile with authentication', async () => {
      const token = await createTestToken();
      const res = await testApp.request(`/api/users/profile/${testUserId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        success: true,
        data: {
          user: {
            id: testUserId,
            email: expect.stringContaining('profiletest-'),
            username: expect.stringContaining('profileuser-'),
            role: 'user',
            isActive: true,
            progress: {
              level: expect.any(Number),
              experience: expect.any(Number),
              totalQuestions: 0, // Default value for new user
              correctAnswers: 0, // Default value for new user
              accuracy: 0, // Default value for new user
              studyTimeMinutes: 0, // Default value for new user
              currentStreak: 0, // Default value for new user
              lastStudyDate: null, // Default value for new user
              categoryStats: {}, // Default value for new user
            },
          },
        },
      });
    });

    it('should return 404 for non-existent user', async () => {
      const token = await createTestToken();
      const res = await testApp.request('/api/users/profile/550e8400-e29b-41d4-a716-446655440000', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
        },
      });
    });

    it('should return 400 for invalid user ID format', async () => {
      const token = await createTestToken();
      const res = await testApp.request('/api/users/profile/invalid-uuid', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });

  describe('Protected routes authorization', () => {
    it('should reject requests with invalid JWT', async () => {
      const res = await testApp.request('/api/users/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          correctAnswers: 5,
          totalQuestions: 10,
          category: 'CCNA',
          studyTimeMinutes: 30,
        }),
      });

      expect(res.status).toBe(401);
    });

    it('should reject requests with expired JWT', async () => {
      // Create an expired token using utility builder
      const expiredJwtBuilder = await createExpiredJwtBuilder();
      const expiredToken = await expiredJwtBuilder.sign(privateKey);

      const res = await testApp.request('/api/users/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expiredToken}`,
        },
        body: JSON.stringify({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          correctAnswers: 5,
          totalQuestions: 10,
          category: 'CCNA',
          studyTimeMinutes: 30,
        }),
      });

      expect(res.status).toBe(401);
    });
  });
});
