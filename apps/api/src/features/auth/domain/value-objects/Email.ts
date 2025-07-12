import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

export class Email {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<Email, ValidationError> {
    const cleaned = value.trim().toLowerCase();

    // Basic email validation
    if (!cleaned.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return Result.fail(new ValidationError('Invalid email format'));
    }

    if (cleaned.length > 254) {
      return Result.fail(new ValidationError('Email too long'));
    }

    return Result.ok(new Email(cleaned));
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
