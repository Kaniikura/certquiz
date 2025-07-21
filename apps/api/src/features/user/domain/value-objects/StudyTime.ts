import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

/**
 * StudyTime value object representing time spent studying in minutes
 */
export class StudyTime {
  private constructor(public readonly minutes: number) {}

  /**
   * Create StudyTime from minutes
   */
  static create(minutes: number): Result<StudyTime, ValidationError> {
    if (!Number.isInteger(minutes)) {
      return Result.fail(new ValidationError('Study time must be in whole minutes'));
    }

    if (minutes < 0) {
      return Result.fail(new ValidationError('Study time cannot be negative'));
    }

    return Result.ok(new StudyTime(minutes));
  }

  /**
   * Create StudyTime from hours
   */
  static fromHours(hours: number): StudyTime {
    const minutes = Math.round(hours * 60);
    return new StudyTime(minutes);
  }

  /**
   * Add study minutes
   */
  addMinutes(minutes: number): Result<StudyTime, ValidationError> {
    if (minutes < 0) {
      return Result.fail(new ValidationError('Cannot add negative study time'));
    }

    return StudyTime.create(this.minutes + minutes);
  }

  /**
   * Convert to hours (rounded to 2 decimal places)
   */
  toHours(): number {
    return Math.round((this.minutes / 60) * 100) / 100;
  }

  /**
   * Format as human-readable duration
   */
  formatDuration(): string {
    if (this.minutes === 0) {
      return '0m';
    }

    const hours = Math.floor(this.minutes / 60);
    const remainingMinutes = this.minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  toString(): string {
    return this.minutes.toString();
  }

  equals(other: StudyTime): boolean {
    return this.minutes === other.minutes;
  }
}
