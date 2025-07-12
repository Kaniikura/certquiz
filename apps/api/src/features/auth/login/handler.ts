/**
 * Login handler implementation
 * @fileoverview Business logic for user authentication
 */

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
import { validateLoginRequest } from './dto';

// KeyCloak client interface (will be implemented in infrastructure)
export interface IKeyCloakClient {
  authenticate(
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    data: { token: string };
    error?: string;
  }>;
}

/**
 * Login use case handler
 * Coordinates authentication between domain and KeyCloak
 */
export async function loginHandler(
  input: unknown,
  userRepository: IUserRepository,
  keyCloakClient: IKeyCloakClient
): Promise<Result<LoginResponse>> {
  try {
    // 1. Validate input
    const validationResult = validateLoginRequest(input);
    if (!validationResult.success) {
      return Result.fail(validationResult.error);
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

    // 4. Authenticate with KeyCloak
    const authResult = await keyCloakClient.authenticate(email, password);
    if (!authResult.success) {
      return Result.fail(new InvalidCredentialsError());
    }

    // 5. Return successful login response
    return Result.ok({
      token: authResult.data?.token,
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
