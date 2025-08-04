/**
 * List users handler
 * @fileoverview Business logic for admin user listing with pagination
 */
import type { User } from '@api/features/auth/domain/entities/User';
import type {
  IAuthUserRepository,
  UserPaginationParams,
} from '@api/features/auth/domain/repositories/IAuthUserRepository';
import type { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { extractFilterFields } from '@api/shared/handler/filter-utils';
import { createPaginatedListHandlerWithUow } from '@api/shared/handler/list-handler-utils';
import { buildPaginationOptions } from '@api/shared/handler/pagination-utils';
import { createRepositoryFetch } from '@api/shared/handler/repository-utils';
import { AUTH_USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { ListUsersParams, UserSummary } from './dto';
import { listUsersSchema } from './validation';

/**
 * Handler for listing users with pagination and filters
 *
 * Uses the generic list handler utility to reduce code duplication
 * and maintain consistency with other list endpoints
 */
/**
 * Create the list users handler using the generic utility
 */
export const listUsersHandler = createPaginatedListHandlerWithUow<
  ListUsersParams,
  UserSummary,
  IUnitOfWork,
  { search?: string; role?: UserRole; isActive?: boolean } | undefined,
  User,
  IAuthUserRepository
>({
  schema: listUsersSchema,

  getRepository: (unitOfWork) => unitOfWork.getRepository(AUTH_USER_REPO_TOKEN),

  buildFilters: (params) => extractFilterFields(params, ['search', 'role', 'isActive']),

  fetchData: createRepositoryFetch<
    'findAllPaginated',
    { search?: string; role?: UserRole; isActive?: boolean } | undefined,
    User,
    UserPaginationParams,
    IAuthUserRepository
  >(
    'findAllPaginated',
    (filters, pagination) =>
      ({
        ...buildPaginationOptions(pagination),
        filters,
      }) as UserPaginationParams
  ),

  transformItem: (user) => ({
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
  }),
});
