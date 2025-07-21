import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

/**
 * Experience value object representing accumulated XP points
 */
export class Experience {
  private static readonly MIN_EXPERIENCE = 0;
  private static readonly MAX_EXPERIENCE = 1000000; // 1 million cap
  private static readonly BASE_CORRECT_POINTS = 10;
  private static readonly BASE_INCORRECT_POINTS = 2; // Consolation points

  private constructor(public readonly value: number) {}

  /**
   * Create Experience from a value
   */
  static create(value: number): Result<Experience, ValidationError> {
    if (!Number.isInteger(value)) {
      return Result.fail(new ValidationError('Experience must be a whole number'));
    }

    if (value < Experience.MIN_EXPERIENCE) {
      return Result.fail(new ValidationError('Experience cannot be negative'));
    }

    if (value > Experience.MAX_EXPERIENCE) {
      return Result.fail(new ValidationError('Experience cannot exceed 1000000'));
    }

    return Result.ok(new Experience(value));
  }

  /**
   * Add experience points
   */
  add(points: number): Result<Experience, ValidationError> {
    if (points < 0) {
      return Result.fail(new ValidationError('Cannot add negative experience'));
    }

    const newValue = Math.min(this.value + points, Experience.MAX_EXPERIENCE);
    return Experience.create(newValue);
  }

  /**
   * Calculate experience points for a quiz answer
   * @param isCorrect - Whether the answer was correct
   * @param difficulty - Difficulty level (1=easy, 2=medium, 3=hard)
   */
  static calculatePoints(isCorrect: boolean, difficulty: number): number {
    const basePoints = isCorrect
      ? Experience.BASE_CORRECT_POINTS
      : Experience.BASE_INCORRECT_POINTS;

    // Apply difficulty multiplier
    const difficultyMultiplier = difficulty >= 1 && difficulty <= 3 ? difficulty : 1;

    return basePoints * difficultyMultiplier;
  }

  toString(): string {
    return this.value.toString();
  }

  equals(other: Experience): boolean {
    return this.value === other.value;
  }
}
