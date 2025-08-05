/**
 * List users handler tests
 * @fileoverview Tests for admin user listing with pagination
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type {
  IAuthUserRepository,
  PaginatedUserResult,
} from '@api/features/auth/domain/repositories/IAuthUserRepository';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { AUTH_USER_REPO_TOKEN, type RepositoryToken } from '@api/shared/types/RepositoryToken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListUsersParams } from './dto';
import { listUsersHandler } from './handler';

describe('listUsersHandler', () => {
  let mockAuthUserRepo: IAuthUserRepository;
  let mockUnitOfWork: IUnitOfWork;

  beforeEach(() => {
    mockAuthUserRepo = {
      findAllPaginated: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByIdentityProviderId: vi.fn(),
      findByUsername: vi.fn(),
      save: vi.fn(),
      isEmailTaken: vi.fn(),
      isUsernameTaken: vi.fn(),
      countTotalUsers: vi.fn(),
      countActiveUsers: vi.fn(),
      updateRole: vi.fn(),
      updateLastLoginAt: vi.fn(),
    };

    mockUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === AUTH_USER_REPO_TOKEN) return mockAuthUserRepo as T;
        throw new Error(`Unknown repository token: ${String(token)}`);
      },
      begin: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      getQuestionDetailsService: vi.fn().mockReturnValue(null),
    };
  });

  it('should return paginated user list', async () => {
    // Arrange
    const mockUsers = [
      createMockUser({
        userId: 'user-1',
        email: 'user1@example.com',
        username: 'user1',
        role: UserRole.User,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: null, // Explicitly set to null for lastLoginAt to be null
        lastLoginAt: null,
      }),
      createMockUser({
        userId: 'user-2',
        email: 'admin@example.com',
        username: 'admin',
        role: UserRole.Admin,
        isActive: true,
        createdAt: new Date('2025-01-02'),
        updatedAt: null, // Explicitly set to null for lastLoginAt to be null
        lastLoginAt: null,
      }),
    ];

    const mockResult: PaginatedUserResult = {
      items: mockUsers,
      total: 100,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockAuthUserRepo.findAllPaginated).mockResolvedValue(mockResult);

    const params: ListUsersParams = { page: 1, pageSize: 20 };

    // Act
    const result = await listUsersHandler(params, mockUnitOfWork);

    // Assert
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(100);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(5); // 100/20 = 5

    expect(result.items[0]).toEqual({
      userId: 'user-1',
      email: 'user1@example.com',
      username: 'user1',
      roles: ['user'],
      isActive: true,
      createdAt: new Date('2025-01-01'),
      lastLoginAt: null,
    });

    expect(mockAuthUserRepo.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      filters: undefined,
      orderBy: 'createdAt',
      orderDir: 'desc',
    });
  });

  it('should apply filters when provided', async () => {
    // Arrange
    const mockResult: PaginatedUserResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockAuthUserRepo.findAllPaginated).mockResolvedValue(mockResult);

    const params: ListUsersParams = {
      page: 2,
      pageSize: 10,
      search: 'admin',
      role: UserRole.Admin,
      isActive: true,
    };

    // Act
    await listUsersHandler(params, mockUnitOfWork);

    // Assert
    expect(mockAuthUserRepo.findAllPaginated).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      filters: {
        search: 'admin',
        role: UserRole.Admin,
        isActive: true,
      },
      orderBy: 'createdAt',
      orderDir: 'desc',
    });
  });

  it('should handle empty results', async () => {
    // Arrange
    const mockResult: PaginatedUserResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockAuthUserRepo.findAllPaginated).mockResolvedValue(mockResult);

    const params: ListUsersParams = { page: 1, pageSize: 20 };

    // Act
    const result = await listUsersHandler(params, mockUnitOfWork);

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('should validate page number', async () => {
    // Arrange
    const params: ListUsersParams = { page: 0, pageSize: 20 };

    // Act & Assert
    await expect(listUsersHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
  });

  it('should validate page size', async () => {
    // Arrange
    const params: ListUsersParams = { page: 1, pageSize: 0 };

    // Act & Assert
    await expect(listUsersHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
  });

  it('should limit maximum page size', async () => {
    // Arrange
    const params: ListUsersParams = { page: 1, pageSize: 200 };

    // Act & Assert
    await expect(listUsersHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
  });

  it('should map users with lastLoginAt when present', async () => {
    // Arrange
    const lastLogin = new Date('2025-01-05');
    const mockUser = createMockUser({
      userId: 'user-1',
      email: 'user1@example.com',
      username: 'user1',
      role: UserRole.User,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: lastLogin,
      lastLoginAt: lastLogin,
    });

    const mockResult: PaginatedUserResult = {
      items: [mockUser],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockAuthUserRepo.findAllPaginated).mockResolvedValue(mockResult);

    const params: ListUsersParams = { page: 1, pageSize: 20 };

    // Act
    const result = await listUsersHandler(params, mockUnitOfWork);

    // Assert
    expect(result.items[0].lastLoginAt).toEqual(lastLogin);
  });
});

// Helper function to create mock users
function createMockUser(data: {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  lastLoginAt?: Date | null;
}): User {
  // Create a mock user that matches the User entity structure
  const user = {
    id: data.userId,
    email: { toString: () => data.email },
    username: data.username,
    role: data.role,
    isActive: data.isActive,
    identityProviderId: null,
    createdAt: data.createdAt,
    // Only set updatedAt if explicitly provided, otherwise use createdAt
    // When updatedAt is null, it should represent no recent activity (null lastLoginAt)
    updatedAt: data.updatedAt !== undefined ? data.updatedAt : data.createdAt,
    lastLoginAt: data.lastLoginAt !== undefined ? data.lastLoginAt : null,
  } as unknown as User;

  return user;
}
