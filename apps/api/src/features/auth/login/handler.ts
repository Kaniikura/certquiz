/**
 * Login handler implementation
 * @fileoverview Business logic for user authentication
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { validateAndHandle } from '@api/shared/handler/handler-utils';
import { Result } from '@api/shared/result';
import {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from '../domain/errors/AuthErrors';
import type { IAuthUserRepository } from '../domain/repositories/IAuthUserRepository';
import { Email } from '../domain/value-objects/Email';
import { UserId } from '../domain/value-objects/UserId';
import type { LoginResponse } from './dto';
import { type LoginRequest, loginSchema } from './validation';

/**
 * Login use case handler
 * Coordinates authentication between domain and auth provider
 */
export const loginHandler = validateAndHandle(
  loginSchema,
  async (
    input: LoginRequest,
    userRepository: IAuthUserRepository,
    authProvider: IAuthProvider
  ): Promise<Result<LoginResponse>> => {
    const { email, password } = input;

    // Find user by email
    const emailResult = Email.create(email);
    if (!emailResult.success) {
      return Result.fail(emailResult.error);
    }

    const user = await userRepository.findByEmail(emailResult.data);
    if (!user) {
      return Result.fail(new UserNotFoundError());
    }

    // Check if user is active
    if (!user.isActive) {
      return Result.fail(new UserNotActiveError());
    }

    // Authenticate with auth provider
    const authResult = await authProvider.authenticate(email, password);
    if (!authResult.success) {
      return Result.fail(new InvalidCredentialsError());
    }

    // Return successful login response
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
  }
);
