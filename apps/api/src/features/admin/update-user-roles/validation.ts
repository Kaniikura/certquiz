/**
 * Update user roles validation
 * @fileoverview Input validation for role update operations
 */

import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { z } from 'zod';

/**
 * Valid role values for validation
 */
const validRoles = Object.values(UserRole);

/**
 * Schema for update user roles request
 */
export const updateUserRolesSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  roles: z
    .array(z.enum(validRoles as [string, ...string[]]))
    .min(1, 'At least one role must be specified'),
  updatedBy: z.string().uuid('Invalid updater ID format'),
});
