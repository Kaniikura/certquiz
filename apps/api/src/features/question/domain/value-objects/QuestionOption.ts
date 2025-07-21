/**
 * QuestionOption value object
 * @fileoverview Represents a single option in a multiple choice question
 */

import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

/**
 * Maximum length for option text
 */
const MAX_OPTION_TEXT_LENGTH = 1000;

/**
 * UUID regex pattern for validation (matches v1-v5)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * JSON representation of a question option
 */
export interface QuestionOptionJSON {
  id: string;
  text: string;
  isCorrect: boolean;
}

/**
 * QuestionOption value object
 * Represents a single answer option for a question
 */
export class QuestionOption {
  private constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly isCorrect: boolean
  ) {
    Object.freeze(this);
  }

  /**
   * Create a new QuestionOption with validation
   */
  static create(props: { id: string; text: string; isCorrect: boolean }): Result<QuestionOption> {
    // Validate ID format
    if (!UUID_REGEX.test(props.id)) {
      return Result.fail(new ValidationError('Invalid option ID format'));
    }

    // Validate and clean text
    const trimmedText = props.text.trim();
    if (!trimmedText) {
      return Result.fail(new ValidationError('Option text cannot be empty'));
    }

    if (trimmedText.length > MAX_OPTION_TEXT_LENGTH) {
      return Result.fail(
        new ValidationError(`Option text too long (max ${MAX_OPTION_TEXT_LENGTH} characters)`)
      );
    }

    return Result.ok(new QuestionOption(props.id, trimmedText, props.isCorrect));
  }

  /**
   * Check equality with another option
   */
  equals(other: QuestionOption): boolean {
    return this.id === other.id && this.text === other.text && this.isCorrect === other.isCorrect;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): QuestionOptionJSON {
    return {
      id: this.id,
      text: this.text,
      isCorrect: this.isCorrect,
    };
  }

  /**
   * Create from JSON representation
   */
  static fromJSON(json: unknown): Result<QuestionOption> {
    if (
      typeof json !== 'object' ||
      json === null ||
      !('id' in json) ||
      !('text' in json) ||
      !('isCorrect' in json)
    ) {
      return Result.fail(new ValidationError('Invalid QuestionOption JSON structure'));
    }

    // Type-safe property access after validation
    const validJson = json as QuestionOptionJSON;

    return QuestionOption.create({
      id: validJson.id,
      text: validJson.text,
      isCorrect: validJson.isCorrect,
    });
  }
}
