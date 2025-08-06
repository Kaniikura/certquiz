/**
 * Update user role handler
 * @fileoverview Business logic for admin role management
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type { IAuthUserRepository } from '@api/features/auth/domain/repositories/IAuthUserRepository';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { createAdminActionHandler } from '@api/shared/handler/admin-handler-utils';
import { AUTH_USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { AdminPermissionError } from '../shared/admin-errors';
import type { UpdateUserRolesParams, UpdateUserRolesResponse } from './dto';
import { updateUserRolesSchema } from './validation';

/**
 * Handler for updating user role with validation and permission checks
 * @param params - Role update parameters
 * @param unitOfWork - Unit of work for database operations
 * @returns Update confirmation with previous and new role
 * @throws {ValidationError} if parameters are invalid
 * @throws {NotFoundError} if user doesn't exist
 * @throws {AdminPermissionError} if invalid role or self-demotion attempted
 */
export const updateUserRolesHandler = createAdminActionHandler<
  UpdateUserRolesParams,
  UpdateUserRolesParams,
  User,
  IAuthUserRepository,
  UpdateUserRolesResponse,
  IUnitOfWork
>({
  schema: updateUserRolesSchema,

  getRepository: (unitOfWork) => unitOfWork.getRepository(AUTH_USER_REPO_TOKEN),

  findEntity: async (repo, params) => {
    return repo.findById(UserId.of(params.userId));
  },

  notFoundMessage: 'User not found',

  validateBusinessRules: (user, params) => {
    const { role, updatedBy } = params;

    // Convert string role to UserRole enum for proper comparison
    const newRole = UserRole.fromString(role);

    // Prevent self-demotion for admins
    if (
      UserId.equals(user.id, UserId.of(updatedBy)) &&
      user.role === UserRole.Admin &&
      newRole !== UserRole.Admin
    ) {
      throw new AdminPermissionError('Admins cannot remove their own admin role');
    }
  },

  executeAction: async (repo, _user, params) => {
    // Update role with audit trail
    await repo.updateRole(params.userId, params.role, params.updatedBy);
  },

  buildResponse: (user, params) => ({
    success: true,
    userId: params.userId,
    previousRole: UserRole.roleToString(user.role),
    newRole: params.role,
    updatedBy: params.updatedBy,
    updatedAt: new Date(),
  }),
});
