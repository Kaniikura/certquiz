/**
 * Shared error classes for user domain
 * @fileoverview Custom error types used across user feature handlers
 */

/**
 * Error thrown when user is not found in the repository
 */
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error thrown when email is already taken during registration
 */
export class EmailAlreadyTakenError extends Error {
  constructor(email: string) {
    super(`Email ${email} is already taken`);
    this.name = 'EmailAlreadyTakenError';
  }
}

/**
 * Error thrown when username is already taken during registration
 */
export class UsernameAlreadyTakenError extends Error {
  constructor(username: string) {
    super(`Username ${username} is already taken`);
    this.name = 'UsernameAlreadyTakenError';
  }
}
