/**
 * Update user roles DTOs
 * @fileoverview Request and response types for role updates
 */

/**
 * Request parameters for updating user role
 */
export interface UpdateUserRolesParams {
  userId: string;
  role: string;
  updatedBy: string;
}

/**
 * Response for successful role update
 */
export interface UpdateUserRolesResponse {
  success: boolean;
  userId: string;
  previousRole: string;
  newRole: string;
  updatedBy: string;
  updatedAt: Date;
}
