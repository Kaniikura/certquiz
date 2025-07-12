/**
 * Login use case DTOs
 * @fileoverview Input and output types for auth/login with domain validation
 */

import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { UserRole } from '../domain/value-objects/UserRole';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    isActive: boolean;
  };
}

export interface LoginError {
  code: 'INVALID_CREDENTIALS' | 'USER_NOT_ACTIVE' | 'USER_NOT_FOUND' | 'KEYCLOAK_ERROR';
  message: string;
}

/**
 * Validate login request (simple domain validation without Zod)
 */
export function validateLoginRequest(input: unknown): Result<LoginRequest, ValidationError> {
  if (!input || typeof input !== 'object') {
    return Result.fail(new ValidationError('Request body must be an object'));
  }

  const body = input as Record<string, unknown>;

  // Validate email
  if (!body.email || typeof body.email !== 'string') {
    return Result.fail(new ValidationError('Email is required and must be a string'));
  }
  const email = body.email.trim();
  if (!email.includes('@')) {
    return Result.fail(new ValidationError('Invalid email format'));
  }

  // Validate password
  if (!body.password || typeof body.password !== 'string') {
    return Result.fail(new ValidationError('Password is required and must be a string'));
  }
  if (body.password.length === 0) {
    return Result.fail(new ValidationError('Password cannot be empty'));
  }

  return Result.ok({
    email,
    password: body.password,
  });
}
