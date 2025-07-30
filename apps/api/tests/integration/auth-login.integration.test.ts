/**
 * Auth login E2E tests
 * @fileoverview End-to-end tests for complete login flow through HTTP
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../setup/test-app-factory';
import { createHttpTestApp } from '../setup/test-app-factory';

describe('POST /api/auth/login - E2E', () => {
  let app: TestApp;

  beforeEach(() => {
    // Create HTTP test app using DI container with in-memory providers
    app = createHttpTestApp();
  });

  it('should reject login when user does not exist in the system', async () => {
    // Arrange - In a clean system, no users exist
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

    // Assert - Should fail with 401 (for security, we don't reveal if user exists)
    expect(response.status).toBe(401);

    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.error.message).toBe('Invalid credentials');
    expect(responseData.error.code).toBe('INVALID_CREDENTIALS');
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
    expect(responseData.success).toBe(false);
    expect(responseData.error.message).toBe('Invalid credentials');
    expect(responseData.error.code).toBe('INVALID_CREDENTIALS');
  });

  // Note: Testing inactive user requires creating a user first through registration
  // This is a limitation of integration testing with proper separation of concerns
  // For unit tests of the login handler, see handler.test.ts

  it('should reject empty password with validation error', async () => {
    // Arrange - Validation happens before checking if user exists
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
