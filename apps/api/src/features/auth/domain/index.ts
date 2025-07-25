/**
 * Auth domain exports
 * @fileoverview Main entry point for auth domain layer
 */

// Base infrastructure
export { AggregateRoot } from './base/AggregateRoot';

// Entities
export { User } from './entities/User';

// Errors
export {
  AuthError,
  AuthErrorCode,
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from './errors/AuthErrors';
export { DrizzleUserRepository as DrizzleAuthUserRepository } from './repositories/DrizzleUserRepository';
// Repositories
export type { IUserRepository } from './repositories/IUserRepository';

// Value Objects
export { Email } from './value-objects/Email';
export { UserId } from './value-objects/UserId';
export { UserRole } from './value-objects/UserRole';
