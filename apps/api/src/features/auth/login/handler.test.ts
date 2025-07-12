/**
 * Login handler unit tests
 * @fileoverview TDD tests for login use case handler
 */

import { ValidationError } from '@api/shared/errors';
import { unwrapOrFail } from '@api/test-support';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../domain/entities/User';
import {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from '../domain/errors/AuthErrors';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { UserRole } from '../domain/value-objects/UserRole';
import type { LoginRequest } from './dto';
import { validateLoginRequest } from './dto';
import { loginHandler } from './handler';

// Mock KeyCloak client
const mockKeyCloakClient = {
  authenticate: vi.fn(),
  getUserInfo: vi.fn(),
};

// Mock user repository
const createMockUserRepository = (): IUserRepository => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByKeycloakId: vi.fn(),
  findByUsername: vi.fn(),
  save: vi.fn(),
  isEmailTaken: vi.fn(),
  isUsernameTaken: vi.fn(),
});

describe('loginHandler', () => {
  let mockUserRepo: IUserRepository;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should fail with invalid input', async () => {
      // Arrange
      const invalidInput = null;

      // Act
      const result = await loginHandler(invalidInput, mockUserRepo, mockKeyCloakClient);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Request body must be an object');
      }
    });

    it('should fail with missing email', async () => {
      // Arrange
      const invalidInput = { password: 'password123' };

      // Act
      const result = await loginHandler(invalidInput, mockUserRepo, mockKeyCloakClient);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Email is required');
      }
    });

    it('should fail with missing password', async () => {
      // Arrange
      const invalidInput = { email: 'test@example.com' };

      // Act
      const result = await loginHandler(invalidInput, mockUserRepo, mockKeyCloakClient);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Password is required');
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
      const result = await loginHandler(validLoginRequest, mockUserRepo, mockKeyCloakClient);

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
          keycloakId: 'kc-123',
          isActive: false, // Inactive user
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(inactiveUser);

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, mockKeyCloakClient);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserNotActiveError);
      }
    });

    it('should fail when KeyCloak authentication fails', async () => {
      // Arrange
      const activeUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          keycloakId: 'kc-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(activeUser);
      mockKeyCloakClient.authenticate.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, mockKeyCloakClient);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InvalidCredentialsError);
      }
      expect(mockKeyCloakClient.authenticate).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });

    it('should succeed with valid credentials and active user', async () => {
      // Arrange
      const activeUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'premium',
          keycloakId: 'kc-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const mockToken = 'jwt-token-123';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(activeUser);
      mockKeyCloakClient.authenticate.mockResolvedValue({
        success: true,
        data: { token: mockToken },
      });

      // Act
      const result = await loginHandler(validLoginRequest, mockUserRepo, mockKeyCloakClient);

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
    it('should handle KeyCloak client errors gracefully', async () => {
      // Arrange
      const activeUser = unwrapOrFail(
        User.fromPersistence({
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          keycloakId: 'kc-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(activeUser);
      mockKeyCloakClient.authenticate.mockRejectedValue(new Error('KeyCloak service unavailable'));

      // Act
      const result = await loginHandler(
        { email: 'test@example.com', password: 'password123' },
        mockUserRepo,
        mockKeyCloakClient
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('KeyCloak service unavailable');
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
        mockKeyCloakClient
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Database connection failed');
      }
    });
  });
});

describe('validateLoginRequest', () => {
  it('should validate correct login request', () => {
    // Arrange
    const validInput = {
      email: 'test@example.com',
      password: 'password123',
    };

    // Act
    const result = validateLoginRequest(validInput);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.password).toBe('password123');
    }
  });

  it('should trim email whitespace', () => {
    // Arrange
    const inputWithWhitespace = {
      email: '  test@example.com  ',
      password: 'password123',
    };

    // Act
    const result = validateLoginRequest(inputWithWhitespace);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('should fail with invalid email format', () => {
    // Arrange
    const invalidInput = {
      email: 'not-an-email',
      password: 'password123',
    };

    // Act
    const result = validateLoginRequest(invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Invalid email format');
    }
  });
});
