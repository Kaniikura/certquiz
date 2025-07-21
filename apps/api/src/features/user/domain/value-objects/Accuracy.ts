import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

/**
 * Accuracy value object representing quiz performance percentage
 */
export class Accuracy {
  private static readonly MIN_ACCURACY = 0;
  private static readonly MAX_ACCURACY = 100;

  private constructor(public readonly value: number) {}

  /**
   * Create Accuracy from percentage value (0-100)
   */
  static create(value: number): Result<Accuracy, ValidationError> {
    if (value < Accuracy.MIN_ACCURACY || value > Accuracy.MAX_ACCURACY) {
      return Result.fail(new ValidationError('Accuracy must be between 0 and 100'));
    }

    // Round to 2 decimal places
    const rounded = Math.round(value * 100) / 100;
    return Result.ok(new Accuracy(rounded));
  }

  /**
   * Calculate accuracy from quiz results
   */
  static fromQuizResults(correctAnswers: number, totalQuestions: number): Accuracy {
    if (totalQuestions === 0) {
      return new Accuracy(0);
    }

    const percentage = (correctAnswers / totalQuestions) * 100;
    const rounded = Math.round(percentage * 100) / 100;
    return new Accuracy(rounded);
  }

  /**
   * Recalculate accuracy with new quiz results
   * @param currentCorrect - Current total correct answers
   * @param currentTotal - Current total questions
   * @param newCorrect - New correct answers to add
   * @param newTotal - New total questions to add
   */
  recalculate(
    currentCorrect: number,
    currentTotal: number,
    newCorrect: number,
    newTotal: number
  ): Accuracy {
    const totalCorrect = currentCorrect + newCorrect;
    const totalQuestions = currentTotal + newTotal;
    return Accuracy.fromQuizResults(totalCorrect, totalQuestions);
  }

  /**
   * Get letter grade based on accuracy
   */
  getGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (this.value >= 90) return 'A';
    if (this.value >= 80) return 'B';
    if (this.value >= 70) return 'C';
    if (this.value >= 60) return 'D';
    return 'F';
  }

  toString(): string {
    return `${this.value.toFixed(2)}%`;
  }

  equals(other: Accuracy): boolean {
    return this.value === other.value;
  }
}
