/**
 * Auth login E2E tests
 * @fileoverview End-to-end tests for complete login flow through HTTP
 */

import { buildApp } from '@api/app-factory';
import { User } from '@api/features/auth/domain/entities/User';
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { StubAuthProvider } from '@api/infra/auth/StubAuthProvider';
import { unwrapOrFail } from '@api/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeQuizRepository, FakeUserRepository } from '../fakes';
import { fakeLogger } from '../helpers/app';

describe('POST /api/auth/login - E2E', () => {
  let app: ReturnType<typeof buildApp>;
  let fakeUserRepo: FakeUserRepository;
  let fakeQuizRepo: FakeQuizRepository;
  let stubAuthProvider: StubAuthProvider;

  beforeEach(() => {
    // Create fresh fake dependencies for each test
    fakeUserRepo = new FakeUserRepository();
    fakeQuizRepo = new FakeQuizRepository();
    stubAuthProvider = new StubAuthProvider();

    // Build app with all required dependencies
    app = buildApp({
      logger: fakeLogger(),
      clock: () => new Date('2025-01-01T00:00:00Z'),
      ping: async () => {
        // No-op for tests
      },
      userRepository: fakeUserRepo,
      quizRepository: fakeQuizRepo,
      authProvider: stubAuthProvider,
    });
  });

  it('should authenticate with valid credentials and existing user', async () => {
    // Arrange - Create a user in fake repository
    const _testEmail = unwrapOrFail(Email.create('test@example.com'));
    const testUser = unwrapOrFail(
      User.fromPersistence({
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        identityProviderId: 'kc-123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    fakeUserRepo.addUser(testUser);

    const loginRequest = {
      email: 'test@example.com',
      password: 'password123', // StubAuthProvider accepts any non-empty password
    };

    // Act - Make HTTP request
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginRequest),
    });

    // Assert - Should succeed
    expect(response.status).toBe(200);

    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data).toHaveProperty('token');
    expect(responseData.data.token).toMatch(/^mock-jwt-token-/);
    expect(responseData.data).toHaveProperty('user');
    expect(responseData.data.user.id).toBe('user-123');
    expect(responseData.data.user.email).toBe('test@example.com');
    expect(responseData.data.user.username).toBe('testuser');
    expect(responseData.data.user.role).toBe(UserRole.User);
  });

  it('should reject user not found', async () => {
    // Arrange - No user in repository
    const loginRequest = {
      email: 'nonexistent@example.com',
      password: 'password123',
    };

    // Act - Make HTTP request
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginRequest),
    });

    // Assert - Should fail with 401 (security: don't reveal user existence)
    expect(response.status).toBe(401);

    const responseData = await response.json();
    expect(responseData.error).toBe('Invalid credentials');
  });

  it('should reject inactive user', async () => {
    // Arrange - Create inactive user
    const _testEmail = unwrapOrFail(Email.create('inactive@example.com'));
    const inactiveUser = unwrapOrFail(
      User.fromPersistence({
        userId: 'inactive-user',
        email: 'inactive@example.com',
        username: 'inactiveuser',
        role: 'user',
        identityProviderId: 'kc-inactive',
        isActive: false, // Inactive!
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    fakeUserRepo.addUser(inactiveUser);

    const loginRequest = {
      email: 'inactive@example.com',
      password: 'password123',
    };

    // Act
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginRequest),
    });

    // Assert - Should fail with 403
    expect(response.status).toBe(403);

    const responseData = await response.json();
    expect(responseData.error).toBe('Account is not active');
  });

  it('should reject empty password with validation error', async () => {
    // Arrange - User exists but password is empty (validation error)
    const _testEmail = unwrapOrFail(Email.create('test@example.com'));
    const testUser = unwrapOrFail(
      User.fromPersistence({
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        identityProviderId: 'kc-123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    fakeUserRepo.addUser(testUser);

    const loginRequest = {
      email: 'test@example.com',
      password: '', // Empty password fails Zod validation
    };

    // Act
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginRequest),
    });

    // Assert - Should fail with 400 (validation error, not auth error)
    expect(response.status).toBe(400);

    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
  });

  it('should validate request body format', async () => {
    // Arrange - Invalid request body
    const invalidRequest = {
      email: 'not-an-email',
      password: '',
    };

    // Act
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest),
    });

    // Assert - Should fail with validation error
    expect(response.status).toBe(400);

    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
  });

  it('should handle malformed JSON', async () => {
    // Act - Make HTTP request with malformed JSON
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });

    // Assert - Should fail with 400
    expect(response.status).toBe(400);
  });

  it('should check auth health endpoint', async () => {
    // Act - Check auth service health
    const response = await app.request('/api/auth/health', {
      method: 'GET',
    });

    // Assert - Should return healthy status
    expect(response.status).toBe(200);

    const responseData = await response.json();
    expect(responseData.service).toBe('auth');
    expect(responseData.status).toBe('healthy');
    expect(responseData.timestamp).toBeDefined();
  });
});
