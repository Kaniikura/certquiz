/**
 * Login handler unit tests
 * @fileoverview TDD tests for login use case handler
 */

import { FakeAuthProvider } from '@api/infra/auth/AuthProvider.fake';
import { ValidationError } from '@api/shared/errors';
import { unwrapOrFail } from '@api/test-support/helpers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../domain/entities/User';
import {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from '../domain/errors/AuthErrors';
import type { IAuthUserRepository } from '../domain/repositories/IAuthUserRepository';
import { UserRole } from '../domain/value-objects/UserRole';
import { loginHandler } from './handler';
import { type LoginRequest, loginSchema } from './validation';

// Mock user repository
const createMockUserRepository = (): IAuthUserRepository => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByIdentityProviderId: vi.fn(),
  findByUsername: vi.fn(),
  save: vi.fn(),
  isEmailTaken: vi.fn(),
  isUsernameTaken: vi.fn(),
  countTotalUsers: vi.fn().mockResolvedValue(0),
  countActiveUsers: vi.fn().mockResolvedValue(0),
  findAllPaginated: vi.fn(),
  updateRoles: vi.fn(),
  updateLastLoginAt: vi.fn(),
});

describe('loginHandler', () => {
  let mockUserRepo: IAuthUserRepository;
  let fakeAuthProvider: FakeAuthProvider;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    fakeAuthProvider = new FakeAuthProvider();
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should fail with invalid input', async () => {
      // Arrange
      const invalidInput = null;

      // Act
      const result = await loginHandler(invalidInput, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Expected object, received null');
      }
    });

    it('should fail with missing email', async () => {
      // Arrange
      const invalidInput = { password: 'password123' };

      // Act
      const result = await loginHandler(invalidInput, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Required');
      }
    });

    it('should fail with missing password', async () => {
      // Arrange
      const invalidInput = { email: 'test@example.com' };

      // Act
      const result = await loginHandler(invalidInput, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Required');
      }
    });
  });

  describe('authentication flow', () => {
    const validLoginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should fail when user not found', async () => {
      // Arrange
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserNotFoundError);
      }
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toString: expect.any(Function) })
      );
    });

    it('should fail when user is not active', async () => {
      // Arrange
      const inactiveUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          identityProviderId: 'kc-123',
          isActive: false, // Inactive user
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        })
      );

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(inactiveUser);

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserNotActiveError);
      }
    });

    it('should fail when identity provider authentication fails', async () => {
      // Arrange
      const activeUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          identityProviderId: 'kc-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        })
      );

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(activeUser);
      fakeAuthProvider.givenAuthenticationFails('Invalid credentials');

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InvalidCredentialsError);
      }
    });

    it('should succeed with valid credentials and active user', async () => {
      // Arrange
      const activeUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'premium',
          identityProviderId: 'kc-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        })
      );

      const mockToken = 'jwt-token-123';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(activeUser);
      vi.mocked(mockUserRepo.updateLastLoginAt).mockResolvedValue(undefined);
      fakeAuthProvider.givenAuthenticationSucceeds('test@example.com', mockToken);

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, fakeAuthProvider);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe(mockToken);
        expect(result.data.user.id).toBe('user-123');
        expect(result.data.user.email).toBe('test@example.com');
        expect(result.data.user.username).toBe('testuser');
        expect(result.data.user.role).toBe(UserRole.Premium);
        expect(result.data.user.isActive).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle identity provider client errors gracefully', async () => {
      // Arrange
      const activeUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          identityProviderId: 'kc-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        })
      );

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(activeUser);
      fakeAuthProvider.givenAuthenticationThrows(
        new Error('Identity provider service unavailable')
      );

      // Act
      const result = await loginHandler(
        { email: 'test@example.com', password: 'password123' },
        mockUserRepo,
        fakeAuthProvider
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Identity provider service unavailable');
      }
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      vi.mocked(mockUserRepo.findByEmail).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const result = await loginHandler(
        { email: 'test@example.com', password: 'password123' },
        mockUserRepo,
        fakeAuthProvider
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Database connection failed');
      }
    });
  });
});

describe('loginSchema validation', () => {
  it('should validate correct login request', () => {
    // Arrange
    const validInput = {
      email: 'test@example.com',
      password: 'password123',
    };

    // Act
    const result = loginSchema.safeParse(validInput);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.password).toBe('password123');
    }
  });

  it('should fail with invalid email format', () => {
    // Arrange
    const invalidInput = {
      email: 'not-an-email',
      password: 'password123',
    };

    // Act
    const result = loginSchema.safeParse(invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].code).toBe('invalid_string');
      expect(result.error.issues[0].message).toContain('Invalid email format');
    }
  });

  it('should fail with missing email', () => {
    // Arrange
    const invalidInput = {
      password: 'password123',
    };

    // Act
    const result = loginSchema.safeParse(invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].code).toBe('invalid_type');
      expect(result.error.issues[0].path).toEqual(['email']);
    }
  });

  it('should fail with missing password', () => {
    // Arrange
    const invalidInput = {
      email: 'test@example.com',
    };

    // Act
    const result = loginSchema.safeParse(invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].code).toBe('invalid_type');
      expect(result.error.issues[0].path).toEqual(['password']);
    }
  });

  it('should fail with empty email', () => {
    // Arrange
    const invalidInput = {
      email: '',
      password: 'password123',
    };

    // Act
    const result = loginSchema.safeParse(invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      // Empty email triggers both min length and email format validation
      expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
      // Check that one of the issues is about email being required
      const hasEmailRequiredError = result.error.issues.some(
        (issue) => issue.message === 'Email is required'
      );
      expect(hasEmailRequiredError).toBe(true);
    }
  });

  it('should fail with empty password', () => {
    // Arrange
    const invalidInput = {
      email: 'test@example.com',
      password: '',
    };

    // Act
    const result = loginSchema.safeParse(invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].message).toBe('Password is required');
    }
  });
});
