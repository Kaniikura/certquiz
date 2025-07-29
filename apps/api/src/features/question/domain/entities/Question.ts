/**
 * Question entity
 * @fileoverview Domain entity representing a question in the certification exam system
 */

import { QuestionId } from '@api/features/quiz/domain';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { QuestionSummary } from '../repositories/IQuestionRepository';
import type { QuestionDifficulty } from '../value-objects/QuestionDifficulty';
import { QuestionOptions } from '../value-objects/QuestionOptions';

/**
 * Question types supported by the system
 */
export type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false';

// Re-export for backward compatibility
export type { QuestionDifficulty };

/**
 * Question status in the system
 */
export enum QuestionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

/**
 * Question JSON representation for persistence
 */
interface QuestionJSON {
  id: string;
  version: number;
  questionText: string;
  questionType: QuestionType;
  explanation: string;
  detailedExplanation?: string;
  options: ReturnType<QuestionOptions['toJSON']>;
  examTypes: string[];
  categories: string[];
  difficulty: QuestionDifficulty;
  tags: string[];
  images: string[];
  isPremium: boolean;
  status: QuestionStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Question entity
 * Represents a question with versioning support
 */
export class Question {
  private _version: number;
  private _questionText: string;
  private _explanation: string;
  private _detailedExplanation?: string;
  private _options: QuestionOptions;
  private _examTypes: string[];
  private _categories: string[];
  private _difficulty: QuestionDifficulty;
  private _tags: string[];
  private _images: string[];
  private _isPremium: boolean;
  private _status: QuestionStatus;
  private _updatedAt: Date;

  private constructor(
    public readonly id: QuestionId,
    version: number,
    questionText: string,
    public readonly questionType: QuestionType,
    explanation: string,
    detailedExplanation: string | undefined,
    options: QuestionOptions,
    examTypes: string[],
    categories: string[],
    difficulty: QuestionDifficulty,
    tags: string[],
    images: string[],
    isPremium: boolean,
    status: QuestionStatus,
    public readonly createdById: string,
    public readonly createdAt: Date,
    updatedAt: Date
  ) {
    this._version = version;
    this._questionText = questionText;
    this._explanation = explanation;
    this._detailedExplanation = detailedExplanation;
    this._options = options;
    this._examTypes = [...examTypes];
    this._categories = [...categories];
    this._difficulty = difficulty;
    this._tags = [...tags];
    this._images = [...images];
    this._isPremium = isPremium;
    this._status = status;
    this._updatedAt = updatedAt;
  }

  // Getters for private fields
  get version(): number {
    return this._version;
  }
  get questionText(): string {
    return this._questionText;
  }
  get explanation(): string {
    return this._explanation;
  }
  get detailedExplanation(): string | undefined {
    return this._detailedExplanation;
  }
  get options(): QuestionOptions {
    return this._options;
  }
  get examTypes(): string[] {
    return [...this._examTypes];
  }
  get categories(): string[] {
    return [...this._categories];
  }
  get difficulty(): QuestionDifficulty {
    return this._difficulty;
  }
  get tags(): string[] {
    return [...this._tags];
  }
  get images(): string[] {
    return [...this._images];
  }
  get isPremium(): boolean {
    return this._isPremium;
  }
  get status(): QuestionStatus {
    return this._status;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Create a new Question with validation
   */
  static create(props: {
    id: QuestionId;
    version: number;
    questionText: string;
    questionType: QuestionType;
    explanation: string;
    detailedExplanation?: string;
    options: QuestionOptions;
    examTypes: string[];
    categories: string[];
    difficulty: QuestionDifficulty;
    tags: string[];
    images: string[];
    isPremium: boolean;
    status: QuestionStatus;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  }): Result<Question> {
    // Validate question text
    const trimmedText = props.questionText.trim();
    if (!trimmedText) {
      return Result.fail(new ValidationError('Question text cannot be empty'));
    }

    // Validate explanation
    const trimmedExplanation = props.explanation.trim();
    if (!trimmedExplanation) {
      return Result.fail(new ValidationError('Explanation cannot be empty'));
    }

    // Validate version
    if (props.version < 1) {
      return Result.fail(new ValidationError('Version must be at least 1'));
    }

    // Validate exam types
    if (props.examTypes.length === 0) {
      return Result.fail(new ValidationError('At least one exam type is required'));
    }

    // Validate categories
    if (props.categories.length === 0) {
      return Result.fail(new ValidationError('At least one category is required'));
    }

    return Result.ok(
      new Question(
        props.id,
        props.version,
        trimmedText,
        props.questionType,
        trimmedExplanation,
        props.detailedExplanation?.trim(),
        props.options,
        props.examTypes,
        props.categories,
        props.difficulty,
        props.tags,
        props.images,
        props.isPremium,
        props.status,
        props.createdById,
        props.createdAt,
        props.updatedAt
      )
    );
  }

  /**
   * Update question content and increment version
   */
  updateContent(props: {
    questionText: string;
    explanation: string;
    detailedExplanation?: string;
    options: QuestionOptions;
  }): Result<void> {
    const trimmedText = props.questionText.trim();
    if (!trimmedText) {
      return Result.fail(new ValidationError('Question text cannot be empty'));
    }

    const trimmedExplanation = props.explanation.trim();
    if (!trimmedExplanation) {
      return Result.fail(new ValidationError('Explanation cannot be empty'));
    }

    this._questionText = trimmedText;
    this._explanation = trimmedExplanation;
    this._detailedExplanation = props.detailedExplanation?.trim();
    this._options = props.options;
    this._version++;
    this._updatedAt = new Date();

    return Result.ok(undefined);
  }

  /**
   * Update question metadata and increment version
   */
  updateMetadata(props: {
    examTypes?: string[];
    categories?: string[];
    difficulty?: QuestionDifficulty;
    tags?: string[];
    images?: string[];
  }): Result<void> {
    if (props.examTypes !== undefined) {
      if (props.examTypes.length === 0) {
        return Result.fail(new ValidationError('At least one exam type is required'));
      }
      this._examTypes = [...props.examTypes];
    }

    if (props.categories !== undefined) {
      if (props.categories.length === 0) {
        return Result.fail(new ValidationError('At least one category is required'));
      }
      this._categories = [...props.categories];
    }

    if (props.difficulty !== undefined) {
      this._difficulty = props.difficulty;
    }

    if (props.tags !== undefined) {
      this._tags = [...props.tags];
    }

    if (props.images !== undefined) {
      this._images = [...props.images];
    }

    this._version++;
    this._updatedAt = new Date();

    return Result.ok(undefined);
  }

  /**
   * Activate the question
   */
  activate(): Result<void> {
    if (this._status === QuestionStatus.ACTIVE) {
      return Result.fail(new ValidationError('Question is already active'));
    }

    this._status = QuestionStatus.ACTIVE;
    this._updatedAt = new Date();
    return Result.ok(undefined);
  }

  /**
   * Deactivate the question
   */
  deactivate(): Result<void> {
    if (this._status === QuestionStatus.INACTIVE) {
      return Result.fail(new ValidationError('Question is already inactive'));
    }

    this._status = QuestionStatus.INACTIVE;
    this._updatedAt = new Date();
    return Result.ok(undefined);
  }

  /**
   * Set premium status
   */
  setPremium(isPremium: boolean): void {
    this._isPremium = isPremium;
    this._version++;
    this._updatedAt = new Date();
  }

  /**
   * Check if question type allows multiple answers
   * Business Rule: Only multiple_select questions allow multiple correct answers
   * Used by quiz validation logic to determine scoring strategy
   */
  allowsMultipleAnswers(): boolean {
    return this.questionType === 'multiple_select';
  }

  /**
   * Get question summary for public listing (without answers)
   */
  getSummary(): QuestionSummary {
    return {
      questionId: this.id,
      questionText: this.questionText,
      questionType: this.questionType,
      examTypes: this.examTypes,
      categories: this.categories,
      difficulty: this.difficulty,
      isPremium: this.isPremium,
      hasImages: this.images.length > 0,
      optionCount: this.options.count,
      tags: this.tags,
      createdAt: this.createdAt,
    };
  }

  /**
   * Convert to JSON for persistence
   */
  toJSON(): QuestionJSON {
    return {
      id: this.id,
      version: this.version,
      questionText: this.questionText,
      questionType: this.questionType,
      explanation: this.explanation,
      detailedExplanation: this.detailedExplanation,
      options: this.options.toJSON(),
      examTypes: this.examTypes,
      categories: this.categories,
      difficulty: this.difficulty,
      tags: this.tags,
      images: this.images,
      isPremium: this.isPremium,
      status: this.status,
      createdById: this.createdById,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Create from JSON representation
   */
  static fromJSON(json: unknown): Result<Question> {
    if (
      typeof json !== 'object' ||
      json === null ||
      !('id' in json) ||
      !('version' in json) ||
      !('questionText' in json) ||
      !('questionType' in json) ||
      !('explanation' in json) ||
      !('options' in json) ||
      !('examTypes' in json) ||
      !('categories' in json) ||
      !('difficulty' in json) ||
      !('tags' in json) ||
      !('images' in json) ||
      !('isPremium' in json) ||
      !('status' in json) ||
      !('createdById' in json) ||
      !('createdAt' in json) ||
      !('updatedAt' in json)
    ) {
      return Result.fail(new ValidationError('Invalid Question JSON structure'));
    }

    // Type-safe property access after validation
    const data = json as QuestionJSON;

    // Parse options
    const optionsResult = QuestionOptions.fromJSON(data.options);
    if (!optionsResult.success) {
      return Result.fail(optionsResult.error);
    }

    return Question.create({
      id: QuestionId.of(data.id),
      version: data.version,
      questionText: data.questionText,
      questionType: data.questionType,
      explanation: data.explanation,
      detailedExplanation: data.detailedExplanation,
      options: optionsResult.data,
      examTypes: data.examTypes,
      categories: data.categories,
      difficulty: data.difficulty,
      tags: data.tags,
      images: data.images,
      isPremium: data.isPremium,
      status: data.status,
      createdById: data.createdById,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }
}
