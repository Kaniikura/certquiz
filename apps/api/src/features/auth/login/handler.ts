/**
 * Login handler implementation
 * @fileoverview Business logic for user authentication
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from '../domain/errors/AuthErrors';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { Email } from '../domain/value-objects/Email';
import { UserId } from '../domain/value-objects/UserId';
import type { LoginResponse } from './dto';
import { loginSchema } from './validation';

/**
 * Login use case handler
 * Coordinates authentication between domain and auth provider
 */
export async function loginHandler(
  input: unknown,
  userRepository: IUserRepository,
  authProvider: IAuthProvider
): Promise<Result<LoginResponse>> {
  try {
    // 1. Validate input using Zod schema
    const validationResult = loginSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const { email, password } = validationResult.data;

    // 2. Find user by email
    const emailResult = Email.create(email);
    if (!emailResult.success) {
      return Result.fail(emailResult.error);
    }

    const user = await userRepository.findByEmail(emailResult.data);
    if (!user) {
      return Result.fail(new UserNotFoundError());
    }

    // 3. Check if user is active
    if (!user.isActive) {
      return Result.fail(new UserNotActiveError());
    }

    // 4. Authenticate with auth provider
    const authResult = await authProvider.authenticate(email, password);
    if (!authResult.success) {
      return Result.fail(new InvalidCredentialsError());
    }

    // 5. Return successful login response
    return Result.ok({
      token: authResult.data.accessToken,
      user: {
        id: UserId.toString(user.id),
        email: user.email.toString(),
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
