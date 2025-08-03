/**
 * Update user roles handler
 * @fileoverview Business logic for admin role management
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { NotFoundError, ValidationError } from '@api/shared/errors';
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
export async function updateUserRolesHandler(
  params: UpdateUserRolesParams,
  unitOfWork: IUnitOfWork
): Promise<UpdateUserRolesResponse> {
  // Validate input parameters
  const validationResult = updateUserRolesSchema.safeParse(params);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0].message);
  }

  const { userId, roles, updatedBy } = params;

  // Validate role combinations
  if (roles.includes('admin') && roles.includes('user')) {
    throw new AdminPermissionError('Invalid role combination: admin cannot have user role');
  }

  // Get repository from unit of work
  const authUserRepo = unitOfWork.getRepository(AUTH_USER_REPO_TOKEN);

  // Check if user exists
  const user = await authUserRepo.findById(UserId.of(userId));
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Store previous roles for response
  const previousRoles = [user.role];

  // Prevent self-demotion for admins
  if (user.id.toString() === updatedBy && user.role === 'admin' && !roles.includes('admin')) {
    throw new AdminPermissionError('Admins cannot remove their own admin role');
  }

  // Update roles with audit trail
  await authUserRepo.updateRoles(userId, roles, updatedBy);

  return {
    success: true,
    userId,
    previousRoles,
    newRoles: roles,
    updatedBy,
    updatedAt: new Date(),
  };
}
