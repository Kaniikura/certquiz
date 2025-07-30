/**
 * User domain barrel export
 * @fileoverview Publi  c API for user bounded context
 */

// Export User entity as User for user bounded context
export { User } from './entities/User';
// Export domain types for cross-boundary communication (if needed)
export type { IUserRepository } from './repositories/IUserRepository';
// Export value objects for user bounded context
export { Email, UserId, UserRole } from './value-objects';
