import type { Result } from '@api/shared/result';
import { User } from '../../domain/entities/User';
import type { AuthUserRow } from './schema/authUser';

/**
 * Validate and map auth user row to domain entity
 *
 * Performs validation through User.fromPersistence which validates:
 * - Email format using Email.create()
 * - Username format and length using User.validateUsername()
 * - Returns ValidationError if any validation fails
 *
 * Pure function testable without database dependencies
 */
export function validateAndMapAuthUser(row: AuthUserRow): Result<User, Error> {
  // Validation is performed inside User.fromPersistence:
  // - Email format validation
  // - Username format and length validation
  // - Returns Result<User, ValidationError> with appropriate error messages
  return User.fromPersistence(row);
}
