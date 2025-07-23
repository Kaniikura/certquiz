/**
 * Auth feature barrel export
 * @fileoverview Public API for auth bounded context
 */

// Export domain entities for other bounded contexts (if needed)
export { User } from './domain/entities/User';
// Export domain errors for error handling
export {
  AuthError,
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from './domain/errors/AuthErrors';
// Export domain types for cross-boundary communication (if needed)
export type { IUserRepository } from './domain/repositories/IUserRepository';
// Export domain value objects
export { Email } from './domain/value-objects/Email';
export { UserId } from './domain/value-objects/UserId';
export { UserRole } from './domain/value-objects/UserRole';
// Export use case DTOs
export type { LoginResponse } from './login/dto';
export type { LoginRequest } from './login/validation';
// Export route factory for mounting in application
export { createAuthRoutes } from './routes-factory';
