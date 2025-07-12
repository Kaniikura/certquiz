/**
 * Domain errors for Auth bounded context
 * @fileoverview Minimal error hierarchy for auth/login operations
 */

export enum AuthErrorCode {
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_ACTIVE = 'USER_NOT_ACTIVE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}

export abstract class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid credentials provided', AuthErrorCode.INVALID_CREDENTIALS);
  }
}

export class UserNotActiveError extends AuthError {
  constructor() {
    super('User account is not active', AuthErrorCode.USER_NOT_ACTIVE);
  }
}

export class UserNotFoundError extends AuthError {
  constructor() {
    super('User not found', AuthErrorCode.USER_NOT_FOUND);
  }
}
