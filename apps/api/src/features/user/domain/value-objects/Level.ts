import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

/**
 * Level value object representing user's progression level
 * Level is calculated based on experience points
 */
export class Level {
  private static readonly MIN_LEVEL = 1;
  private static readonly MAX_LEVEL = 100;
  private static readonly XP_PER_LEVEL = 100; // Simple linear progression

  private constructor(public readonly value: number) {}

  /**
   * Create a Level from a specific value
   */
  static create(value: number): Result<Level, ValidationError> {
    if (!Number.isInteger(value)) {
      return Result.fail(new ValidationError('Level must be a whole number'));
    }

    if (value < Level.MIN_LEVEL) {
      return Result.fail(new ValidationError('Level must be at least 1'));
    }

    if (value > Level.MAX_LEVEL) {
      return Result.fail(new ValidationError('Level cannot exceed 100'));
    }

    return Result.ok(new Level(value));
  }

  /**
   * Calculate level from experience points
   * Using simple linear progression: Level = floor(XP / 100) + 1
   */
  static fromExperience(experience: number): Level {
    const calculatedLevel = Math.floor(experience / Level.XP_PER_LEVEL) + 1;
    const cappedLevel = Math.min(calculatedLevel, Level.MAX_LEVEL);
    return new Level(cappedLevel);
  }

  /**
   * Get experience required to reach next level
   */
  experienceRequired(): number {
    if (this.value >= Level.MAX_LEVEL) {
      return 0;
    }
    return this.value * Level.XP_PER_LEVEL;
  }

  /**
   * Get total experience needed to reach this level
   */
  experienceForLevel(): number {
    return (this.value - 1) * Level.XP_PER_LEVEL;
  }

  toString(): string {
    return this.value.toString();
  }

  equals(other: Level): boolean {
    return this.value === other.value;
  }
}
