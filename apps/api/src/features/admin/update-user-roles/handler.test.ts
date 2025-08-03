/**
 * Update user roles handler tests
 * @fileoverview Tests for admin role management functionality
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type { IAuthUserRepository } from '@api/features/auth/domain/repositories/IAuthUserRepository';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { NotFoundError, ValidationError } from '@api/shared/errors';
import { AUTH_USER_REPO_TOKEN, type RepositoryToken } from '@api/shared/types/RepositoryToken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPermissionError } from '../shared/admin-errors';
import type { UpdateUserRolesParams } from './dto';
import { updateUserRolesHandler } from './handler';

describe('updateUserRolesHandler', () => {
  let mockAuthUserRepo: IAuthUserRepository;
  let mockUnitOfWork: IUnitOfWork;

  beforeEach(() => {
    mockAuthUserRepo = {
      findById: vi.fn(),
      updateRoles: vi.fn(),
      findByEmail: vi.fn(),
      findByIdentityProviderId: vi.fn(),
      findByUsername: vi.fn(),
      save: vi.fn(),
      isEmailTaken: vi.fn(),
      isUsernameTaken: vi.fn(),
      countTotalUsers: vi.fn(),
      countActiveUsers: vi.fn(),
      findAllPaginated: vi.fn(),
    };

    mockUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === AUTH_USER_REPO_TOKEN) return mockAuthUserRepo as T;
        throw new Error(`Unknown repository token: ${String(token)}`);
      },
      begin: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
    };
  });

  it('should update user roles with validation', async () => {
    // Arrange
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const mockUser = createMockUser({
      userId,
      email: 'user@example.com',
      username: 'testuser',
      role: UserRole.User,
      isActive: true,
    });

    vi.mocked(mockAuthUserRepo.findById).mockResolvedValue(mockUser);
    vi.mocked(mockAuthUserRepo.updateRoles).mockResolvedValue(undefined);

    const params: UpdateUserRolesParams = {
      userId,
      roles: ['user', 'premium'],
      updatedBy: '550e8400-e29b-41d4-a716-446655440001',
    };

    // Act
    const result = await updateUserRolesHandler(params, mockUnitOfWork);

    // Assert
    expect(result.success).toBe(true);
    expect(result.userId).toBe(userId);
    expect(result.previousRoles).toEqual(['user']);
    expect(result.newRoles).toEqual(['user', 'premium']);
    expect(result.updatedBy).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(result.updatedAt).toBeInstanceOf(Date);

    expect(mockAuthUserRepo.updateRoles).toHaveBeenCalledWith(
      userId,
      ['user', 'premium'],
      '550e8400-e29b-41d4-a716-446655440001'
    );
  });

  it('should reject invalid role combinations', async () => {
    // Arrange
    const params: UpdateUserRolesParams = {
      userId: '550e8400-e29b-41d4-a716-446655440002',
      roles: ['user', 'admin'], // Invalid: regular users can't be admins
      updatedBy: '550e8400-e29b-41d4-a716-446655440003',
    };

    // Act & Assert
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(
      AdminPermissionError
    );
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Invalid role combination'
    );
  });

  it('should fail when user is not found', async () => {
    // Arrange
    vi.mocked(mockAuthUserRepo.findById).mockResolvedValue(null);

    const params: UpdateUserRolesParams = {
      userId: '550e8400-e29b-41d4-a716-446655440004',
      roles: ['premium'],
      updatedBy: '550e8400-e29b-41d4-a716-446655440005',
    };

    // Act & Assert
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(NotFoundError);
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow('User not found');
  });

  it('should prevent self-demotion for admins', async () => {
    // Arrange
    const adminId = '550e8400-e29b-41d4-a716-446655440006';
    const mockAdmin = createMockUser({
      userId: adminId,
      email: 'admin@example.com',
      username: 'admin',
      role: UserRole.Admin,
      isActive: true,
    });

    vi.mocked(mockAuthUserRepo.findById).mockResolvedValue(mockAdmin);

    const params: UpdateUserRolesParams = {
      userId: adminId,
      roles: ['user'], // Trying to remove admin role from self
      updatedBy: adminId, // Same as userId
    };

    // Act & Assert
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(
      AdminPermissionError
    );
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Admins cannot remove their own admin role'
    );
  });

  it('should validate empty roles array', async () => {
    // Arrange
    const params: UpdateUserRolesParams = {
      userId: '550e8400-e29b-41d4-a716-446655440007',
      roles: [],
      updatedBy: '550e8400-e29b-41d4-a716-446655440008',
    };

    // Act & Assert
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'At least one role must be specified'
    );
  });

  it('should validate invalid roles', async () => {
    // Arrange
    const params: UpdateUserRolesParams = {
      userId: '550e8400-e29b-41d4-a716-446655440009',
      roles: ['invalid-role'],
      updatedBy: '550e8400-e29b-41d4-a716-446655440010',
    };

    // Act & Assert
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
  });

  it('should validate user ID format', async () => {
    // Arrange
    const params: UpdateUserRolesParams = {
      userId: 'invalid-uuid',
      roles: ['user'],
      updatedBy: '550e8400-e29b-41d4-a716-446655440011',
    };

    // Act & Assert
    await expect(updateUserRolesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
  });

  it('should allow admin to update other admin roles', async () => {
    // Arrange
    const otherAdminId = '550e8400-e29b-41d4-a716-446655440012';
    const mockAdmin = createMockUser({
      userId: otherAdminId,
      email: 'other-admin@example.com',
      username: 'otheradmin',
      role: UserRole.Admin,
      isActive: true,
    });

    vi.mocked(mockAuthUserRepo.findById).mockResolvedValue(mockAdmin);
    vi.mocked(mockAuthUserRepo.updateRoles).mockResolvedValue(undefined);

    const params: UpdateUserRolesParams = {
      userId: otherAdminId,
      roles: ['admin', 'premium'], // Admin can have multiple roles
      updatedBy: '550e8400-e29b-41d4-a716-446655440013', // Different admin
    };

    // Act
    const result = await updateUserRolesHandler(params, mockUnitOfWork);

    // Assert
    expect(result.success).toBe(true);
    expect(result.newRoles).toEqual(['admin', 'premium']);
  });

  it('should handle guest role upgrades', async () => {
    // Arrange
    const guestId = '550e8400-e29b-41d4-a716-446655440014';
    const mockGuest = createMockUser({
      userId: guestId,
      email: 'guest@example.com',
      username: 'guest',
      role: UserRole.Guest,
      isActive: true,
    });

    vi.mocked(mockAuthUserRepo.findById).mockResolvedValue(mockGuest);
    vi.mocked(mockAuthUserRepo.updateRoles).mockResolvedValue(undefined);

    const params: UpdateUserRolesParams = {
      userId: guestId,
      roles: ['user'],
      updatedBy: '550e8400-e29b-41d4-a716-446655440015',
    };

    // Act
    const result = await updateUserRolesHandler(params, mockUnitOfWork);

    // Assert
    expect(result.success).toBe(true);
    expect(result.previousRoles).toEqual(['guest']);
    expect(result.newRoles).toEqual(['user']);
  });
});

// Helper function to create mock users
function createMockUser(data: {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}): User {
  const user = {
    id: UserId.of(data.userId),
    email: { toString: () => data.email },
    username: data.username,
    role: data.role,
    isActive: data.isActive,
    identityProviderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as User;

  return user;
}
