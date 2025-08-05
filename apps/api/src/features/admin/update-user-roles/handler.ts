/**
 * Update user roles handler
 * @fileoverview Business logic for admin role management
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type { IAuthUserRepository } from '@api/features/auth/domain/repositories/IAuthUserRepository';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { createAdminActionHandler } from '@api/shared/handler/admin-handler-utils';
import { AUTH_USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { AdminPermissionError } from '../shared/admin-errors';
import type { UpdateUserRolesParams, UpdateUserRolesResponse } from './dto';
import { updateUserRolesSchema } from './validation';

/**
 * Handler for updating user roles with validation and permission checks
 * @param params - Role update parameters
 * @param unitOfWork - Unit of work for database operations
 * @returns Update confirmation with previous and new roles
 * @throws {ValidationError} if parameters are invalid
 * @throws {NotFoundError} if user doesn't exist
 * @throws {AdminPermissionError} if role combination is invalid or self-demotion attempted
 */
export const updateUserRolesHandler = createAdminActionHandler<
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
    const { roles, updatedBy } = params;

    // Validate role combinations
    if (roles.includes('admin') && roles.includes('user')) {
      throw new AdminPermissionError('Invalid role combination: admin cannot have user role');
    }

    // Prevent self-demotion for admins
    if (user.id.toString() === updatedBy && user.role === 'admin' && !roles.includes('admin')) {
      throw new AdminPermissionError('Admins cannot remove their own admin role');
    }
  },

  executeAction: async (repo, _user, params) => {
    // Update roles with audit trail
    await repo.updateRoles(params.userId, params.roles, params.updatedBy);
  },

  buildResponse: (user, params) => ({
    success: true,
    userId: params.userId,
    previousRoles: [user.role],
    newRoles: params.roles,
    updatedBy: params.updatedBy,
    updatedAt: new Date(),
  }),
});
