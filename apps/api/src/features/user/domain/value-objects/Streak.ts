import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

type StreakLevel = 'none' | 'beginner' | 'regular' | 'dedicated' | 'champion' | 'legend';

/**
 * Streak value object representing consecutive days of study activity
 */
export class Streak {
  private constructor(public readonly days: number) {}

  /**
   * Create Streak from number of days
   */
  static create(days: number): Result<Streak, ValidationError> {
    if (!Number.isInteger(days)) {
      return Result.fail(new ValidationError('Streak days must be a whole number'));
    }

    if (days < 0) {
      return Result.fail(new ValidationError('Streak days cannot be negative'));
    }

    return Result.ok(new Streak(days));
  }

  /**
   * Increment streak by one day
   */
  increment(): Streak {
    return new Streak(this.days + 1);
  }

  /**
   * Reset streak to zero
   */
  reset(): Streak {
    return new Streak(0);
  }

  /**
   * Check if streak is active (non-zero)
   */
  isActive(): boolean {
    return this.days > 0;
  }

  /**
   * Get streak level based on days
   */
  getStreakLevel(): StreakLevel {
    if (this.days === 0) return 'none';
    if (this.days < 7) return 'beginner';
    if (this.days < 21) return 'regular';
    if (this.days < 50) return 'dedicated';
    if (this.days < 100) return 'champion';
    return 'legend';
  }

  toString(): string {
    return this.days.toString();
  }

  equals(other: Streak): boolean {
    return this.days === other.days;
  }
}
