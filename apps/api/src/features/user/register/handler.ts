/**
 * Register handler implementation
 * @fileoverview Business logic for user registration
 */
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { User } from '../domain/entities/User';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import type { RegisterResponse } from './dto';
import { registerSchema } from './validation';

/**
 * Register use case handler
 * Creates a new user with default progress
 */
export async function registerHandler(
  input: unknown,
  userRepository: IUserRepository,
  clock: Clock
): Promise<Result<RegisterResponse, Error>> {
  try {
    // 1. Validate input using Zod schema
    const validationResult = registerSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const { email, username, identityProviderId, role } = validationResult.data;

    // 2. Create and validate email value object
    const emailResult = Email.create(email);
    if (!emailResult.success) {
      return Result.fail(emailResult.error);
    }

    // 3. Create user with domain rules
    // Note: We no longer pre-check for duplicates. The database UNIQUE constraints
    // will handle this atomically, avoiding race conditions
    const userResult = User.create(
      {
        email: emailResult.data.toString(),
        username,
        identityProviderId,
        role: UserRole.fromString(role),
      },
      clock
    );

    if (!userResult.success) {
      return Result.fail(userResult.error);
    }

    const user = userResult.data;

    // 4. Save user using repository
    // The repository will catch PostgreSQL duplicate key violations and throw
    // EmailAlreadyTakenError or UsernameAlreadyTakenError if appropriate
    await userRepository.create(user);

    // 5. Return successful registration response
    return Result.ok({
      user: {
        id: UserId.toString(user.id),
        email: user.email.toString(),
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        progress: {
          level: user.progress.level.value,
          experience: user.progress.experience.value,
          currentStreak: user.progress.currentStreak.days,
        },
      },
    });
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
