/**
 * Update user roles DTOs
 * @fileoverview Request and response types for role updates
 */

/**
 * Request parameters for updating user roles
 */
export interface UpdateUserRolesParams {
  userId: string;
  roles: string[];
  updatedBy: string;
}

/**
 * Response for successful role update
 */
export interface UpdateUserRolesResponse {
  success: boolean;
  userId: string;
  previousRoles: string[];
  newRoles: string[];
  updatedBy: string;
  updatedAt: Date;
}
