/**
 * Auth domain exports
 * @fileoverview Main entry point for auth domain layer
 */

// Base infrastructure
export { AggregateRoot } from './base/AggregateRoot';

// Errors
export {
  AuthError,
  AuthErrorCode,
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from './errors/AuthErrors';
// Repositories
export type { IAuthUserRepository } from './repositories/IAuthUserRepository';

// Value Objects
export { Email } from './value-objects/Email';
export { UserId } from './value-objects/UserId';
export { UserRole } from './value-objects/UserRole';
