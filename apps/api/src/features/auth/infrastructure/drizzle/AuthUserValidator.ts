import type { AuthUserRow } from '@api/infra/db/schema/user';
import type { Result } from '@api/shared/result';
import { User } from '../../domain/entities/User';

/**
 * Validate and map auth user row to domain entity
 * Pure function testable without database dependencies
 */
export function validateAndMapAuthUser(row: AuthUserRow): Result<User, Error> {
  return User.fromPersistence(row);
}
