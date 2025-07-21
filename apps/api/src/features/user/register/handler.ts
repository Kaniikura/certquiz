/**
 * Register handler implementation
 * @fileoverview Business logic for user registration
 */

import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { User } from '../domain/entities/User';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { Email, UserId, UserRole } from '../domain/value-objects';
import type { RegisterResponse } from './dto';
import { registerSchema } from './validation';

/**
 * Custom errors for registration use case
 */
export class EmailAlreadyTakenError extends Error {
  constructor(email: string) {
    super(`Email ${email} is already taken`);
    this.name = 'EmailAlreadyTakenError';
  }
}

export class UsernameAlreadyTakenError extends Error {
  constructor(username: string) {
    super(`Username ${username} is already taken`);
    this.name = 'UsernameAlreadyTakenError';
  }
}

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

    // 3. Check if email is already taken
    const emailTaken = await userRepository.isEmailTaken(emailResult.data);
    if (emailTaken) {
      return Result.fail(new EmailAlreadyTakenError(email));
    }

    // 4. Check if username is already taken
    const usernameTaken = await userRepository.isUsernameTaken(username);
    if (usernameTaken) {
      return Result.fail(new UsernameAlreadyTakenError(username));
    }

    // 5. Create user with domain rules
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

    // 6. Save user using repository
    await userRepository.create(user);

    // 7. Return successful registration response
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
