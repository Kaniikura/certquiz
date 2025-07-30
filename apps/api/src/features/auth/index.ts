/**
 * Auth feature barrel export
 * @fileoverview Public API for auth bounded context
 */

// Export User entity as AuthUser for auth bounded context
export { User as AuthUser } from './domain/entities/User';
// Export domain errors for error handling
export {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from './domain/errors/AuthErrors';
// Export domain value objects
export { Email } from './domain/value-objects/Email';
export { UserId } from './domain/value-objects/UserId';
export { UserRole } from './domain/value-objects/UserRole';
// Export use case DTOs
export type { LoginResponse } from './login/dto';
export type { LoginRequest } from './login/validation';
