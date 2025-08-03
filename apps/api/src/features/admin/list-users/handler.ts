/**
 * List users handler
 * @fileoverview Business logic for admin user listing with pagination
 */
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { AUTH_USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { ListUsersParams, PaginatedResponse, UserSummary } from './dto';
import { listUsersSchema } from './validation';

/**
 * Handler for listing users with pagination and filters
 * @param params - Pagination and filter parameters
 * @param unitOfWork - Unit of work for database operations
 * @returns Paginated list of users
 * @throws {ValidationError} if parameters are invalid
 */
export async function listUsersHandler(
  params: ListUsersParams,
  unitOfWork: IUnitOfWork
): Promise<PaginatedResponse<UserSummary>> {
  // Validate input parameters
  const validationResult = listUsersSchema.safeParse(params);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0].message);
  }

  const { page = 1, pageSize = 20, search, role, isActive } = params;

  // Get repository from unit of work
  const authUserRepo = unitOfWork.getRepository(AUTH_USER_REPO_TOKEN);

  // Build filters object only if at least one filter is provided
  const filters =
    search !== undefined || role !== undefined || isActive !== undefined
      ? { search, role, isActive }
      : undefined;

  // Fetch paginated users
  const result = await authUserRepo.findAllPaginated({
    page,
    pageSize,
    filters,
    orderBy: 'createdAt',
    orderDir: 'desc',
  });

  // Map users to summary format
  const items: UserSummary[] = result.items.map((user) => ({
    userId: user.id.toString(),
    email: user.email.toString(),
    username: user.username,
    roles: [user.role], // Currently we support single role, but keeping array for future
    isActive: user.isActive,
    createdAt: user.createdAt,
    // TEMPORARY WORKAROUND: Using updatedAt as proxy for lastLoginAt
    // WARNING: This is inaccurate as updatedAt changes for ANY user modification
    // (profile updates, role changes, etc.), not just login events.
    // TODO: Add dedicated lastLoginAt field to User entity and replace this proxy
    lastLoginAt: user.updatedAt,
  }));

  return {
    items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: Math.ceil(result.total / result.pageSize),
  };
}
