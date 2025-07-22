/**
 * QuestionOptions value object
 * @fileoverview Collection of question options with business rule validation
 *
 * Usage Examples:
 *
 * Basic shuffling (random each time):
 * ```typescript
 * const shuffled = questionOptions.shuffle();
 * ```
 *
 * Deterministic shuffling for quiz fairness:
 * ```typescript
 * const quizSeed = QuestionOptions.generateSecureSeed();
 * const shuffled = questionOptions.shuffle(quizSeed);
 * // Store quizSeed with quiz session for consistent ordering
 * ```
 *
 * Testing with predictable results:
 * ```typescript
 * const shuffled = questionOptions.shuffle(12345);
 * // Always produces same order for seed 12345
 * ```
 */

import { ValidationError } from '@api/shared/errors';
import { generateCryptoSeed, shuffleWithSeed } from '@api/shared/random';
import { Result } from '@api/shared/result';
import { QuestionOption, type QuestionOptionJSON } from './QuestionOption';

/**
 * Minimum number of options required
 */
const MIN_OPTIONS = 2;

/**
 * Maximum number of options allowed
 */
const MAX_OPTIONS = 10;

/**
 * QuestionOptions value object
 * Encapsulates a collection of options with business rules
 */
export class QuestionOptions {
  private readonly options: ReadonlyArray<QuestionOption>;

  private constructor(options: QuestionOption[]) {
    this.options = Object.freeze([...options]);
    Object.freeze(this);
  }

  /**
   * Create a new QuestionOptions collection with validation
   */
  static create(options: QuestionOption[]): Result<QuestionOptions> {
    // Validate minimum options
    if (options.length < MIN_OPTIONS) {
      return Result.fail(
        new ValidationError(`Questions must have at least ${MIN_OPTIONS} options`)
      );
    }

    // Validate maximum options
    if (options.length > MAX_OPTIONS) {
      return Result.fail(new ValidationError(`Maximum ${MAX_OPTIONS} options allowed`));
    }

    // Check for at least one correct answer
    const hasCorrect = options.some((opt) => opt.isCorrect);
    if (!hasCorrect) {
      return Result.fail(new ValidationError('Questions must have at least one correct answer'));
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const option of options) {
      if (ids.has(option.id)) {
        return Result.fail(new ValidationError('Duplicate option IDs found'));
      }
      ids.add(option.id);
    }

    // Check for duplicate text
    const texts = new Set<string>();
    for (const option of options) {
      const normalizedText = option.text.toLowerCase().trim();
      if (texts.has(normalizedText)) {
        return Result.fail(new ValidationError('Duplicate option texts found'));
      }
      texts.add(normalizedText);
    }

    return Result.ok(new QuestionOptions(options));
  }

  /**
   * Get total number of options
   */
  get count(): number {
    return this.options.length;
  }

  /**
   * Check if collection has at least one correct answer
   */
  hasCorrectAnswer(): boolean {
    return this.options.some((opt) => opt.isCorrect);
  }

  /**
   * Get number of correct options
   */
  getCorrectCount(): number {
    return this.options.filter((opt) => opt.isCorrect).length;
  }

  /**
   * Get all options
   */
  getAll(): ReadonlyArray<QuestionOption> {
    return this.options;
  }

  /**
   * Find option by ID
   */
  findById(id: string): QuestionOption | null {
    return this.options.find((opt) => opt.id === id) || null;
  }

  /**
   * Get correct options
   */
  getCorrectOptions(): QuestionOption[] {
    return this.options.filter((opt) => opt.isCorrect);
  }

  /**
   * Get shuffled copy of options
   * Uses Fisher-Yates shuffle algorithm with optional seeded randomness
   *
   * @param seed Optional seed for deterministic shuffling. If not provided,
   *             uses cryptographically secure random generation.
   *             Same seed will always produce the same shuffle order.
   *
   * Business Rules:
   * - For quiz fairness: Use same seed for all users taking the same quiz version
   * - For security: Seeds should be cryptographically random and unpredictable
   * - For testing: Use known seeds to ensure predictable behavior
   */
  shuffle(seed?: number): QuestionOption[] {
    return shuffleWithSeed(this.options, seed);
  }

  /**
   * Generate cryptographically secure seed for shuffling
   * Uses Web Crypto API for true randomness
   *
   * @returns A secure 32-bit unsigned integer seed
   */
  static generateSecureSeed(): number {
    return generateCryptoSeed();
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): QuestionOptionJSON[] {
    return this.options.map((opt) => opt.toJSON());
  }

  /**
   * Create from JSON representation
   */
  static fromJSON(json: unknown): Result<QuestionOptions> {
    if (!Array.isArray(json)) {
      return Result.fail(new ValidationError('Invalid QuestionOptions JSON: not an array'));
    }

    const optionResults: QuestionOption[] = [];

    for (const item of json) {
      const optionResult = QuestionOption.fromJSON(item);
      if (!optionResult.success) {
        return Result.fail(optionResult.error);
      }
      optionResults.push(optionResult.data);
    }

    return QuestionOptions.create(optionResults);
  }
}
