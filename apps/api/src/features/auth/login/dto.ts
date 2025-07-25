/**
 * Login use case DTOs
 * @fileoverview Input and output types for auth/login
 */

import type { UserRole } from '../domain/value-objects/UserRole';

/**
 * Login response type for successful authentication
 * Updated to match domain User entity structure
 */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    isActive: boolean;
  };
}

// Note: LoginRequest type is now defined in validation.ts using z.infer<typeof loginSchema>
// This ensures the DTO and validation schema never drift apart
