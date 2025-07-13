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

/**
 * Login error types for domain error mapping
 */
export interface LoginError {
  code: 'INVALID_CREDENTIALS' | 'USER_NOT_ACTIVE' | 'USER_NOT_FOUND' | 'KEYCLOAK_ERROR';
  message: string;
}

// Note: LoginRequest type is now defined in validation.ts using z.infer<typeof loginSchema>
// This ensures the DTO and validation schema never drift apart
