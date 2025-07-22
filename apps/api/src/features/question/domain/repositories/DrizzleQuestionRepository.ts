/**
 * Drizzle implementation of Question repository
 * @fileoverview CRUD operations for Question catalog with versioning support
 */

import { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import {
  type QuestionRow,
  type QuestionVersionRow,
  question,
  questionVersion,
} from '@api/infra/db/schema/question';
import type { Queryable, Tx } from '@api/infra/db/types';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, arrayContains, count, eq, ilike, or } from 'drizzle-orm';
import {
  InvalidQuestionDataError,
  QuestionNotFoundError,
  QuestionRepositoryConfigurationError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from '../../shared/errors';
import { Question, QuestionStatus, type QuestionType } from '../entities/Question';
import type {
  IQuestionRepository,
  PaginatedQuestions,
  QuestionFilters,
  QuestionPagination,
  QuestionSummary,
} from './IQuestionRepository';

/**
 * Interface for database connections that support transactions
 */
interface TransactionalConnection extends Queryable {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/**
 * Drizzle implementation of Question repository for catalog operations
 * Handles versioned questions with two-table design (master + versions)
 * Enforces transaction support at the type level for data consistency
 */
export class DrizzleQuestionRepository<TConnection extends TransactionalConnection>
  extends BaseRepository
  implements IQuestionRepository
{
  constructor(
    private readonly db: TConnection,
    logger: LoggerPort
  ) {
    super(logger);

    // Validate transaction support at initialization time
    if (!('transaction' in db) || typeof db.transaction !== 'function') {
      throw new QuestionRepositoryConfigurationError(
        'Database connection must support transactions. Ensure your connection implements the transaction method.'
      );
    }
  }

  /**
   * Map entity question type to database question type
   */
  private mapQuestionTypeToDb(type: QuestionType): 'single' | 'multiple' {
    switch (type) {
      case 'multiple_choice':
      case 'true_false':
        return 'single';
      case 'multiple_select':
        return 'multiple';
      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = type;
        return _exhaustiveCheck;
      }
    }
  }

  /**
   * Map database question type to entity question type
   * @param type Database question type
   * @param options Question options (optional) for inferring true/false questions
   */
  private mapQuestionTypeFromDb(type: 'single' | 'multiple', options?: unknown): QuestionType {
    // Multiple select is straightforward
    if (type === 'multiple') {
      return 'multiple_select';
    }

    // For single answer questions, check if it's a true/false question
    if (options && this.isTrueFalseQuestion(options)) {
      return 'true_false';
    }

    // Default to multiple choice for other single answer questions
    return 'multiple_choice';
  }

  /**
   * Determine if a question is a true/false question based on its options
   * @param options The question options from the database
   */
  private isTrueFalseQuestion(options: unknown): boolean {
    if (!Array.isArray(options)) {
      return false;
    }

    // True/False questions must have exactly 2 options
    if (options.length !== 2) {
      return false;
    }

    // Check if options are variations of true/false
    const normalizedTexts = options
      .map((opt) => {
        if (typeof opt === 'object' && opt !== null && 'text' in opt) {
          return String(opt.text).toLowerCase().trim();
        }
        return '';
      })
      .filter(Boolean)
      .sort();

    // Common true/false patterns
    const trueFalsePatterns = [
      ['false', 'true'],
      ['no', 'yes'],
      ['incorrect', 'correct'],
    ];

    return trueFalsePatterns.some(
      (pattern) =>
        normalizedTexts.length === 2 &&
        normalizedTexts[0] === pattern[0] &&
        normalizedTexts[1] === pattern[1]
    );
  }

  /**
   * Map entity question status to database question status
   */
  private mapQuestionStatusToDb(
    status: QuestionStatus
  ): 'draft' | 'active' | 'inactive' | 'archived' {
    switch (status) {
      case QuestionStatus.ACTIVE:
        return 'active';
      case QuestionStatus.INACTIVE:
        return 'inactive';
      case QuestionStatus.ARCHIVED:
        return 'archived';
      case QuestionStatus.DRAFT:
        return 'draft';
      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = status;
        return _exhaustiveCheck;
      }
    }
  }

  /**
   * Map database question status to entity question status
   */
  private mapQuestionStatusFromDb(
    status: 'draft' | 'active' | 'inactive' | 'archived'
  ): QuestionStatus {
    return status as QuestionStatus;
  }

  async createQuestion(questionEntity: Question): Promise<Question> {
    try {
      this.logger.info('Creating new question', { questionId: questionEntity.id });

      // Start transaction to ensure atomicity
      await this.withTransaction(async (txRepo) => {
        // Insert master record
        await txRepo.db.insert(question).values({
          questionId: questionEntity.id,
          currentVersion: questionEntity.version,
          createdById: questionEntity.createdById,
          isPremium: questionEntity.isPremium,
          status: this.mapQuestionStatusToDb(questionEntity.status),
          createdAt: questionEntity.createdAt,
          updatedAt: questionEntity.updatedAt,
        });

        // Insert version record
        await txRepo.db.insert(questionVersion).values({
          questionId: questionEntity.id,
          version: questionEntity.version,
          questionText: questionEntity.questionText,
          questionType: this.mapQuestionTypeToDb(questionEntity.questionType),
          explanation: questionEntity.explanation,
          detailedExplanation: questionEntity.detailedExplanation,
          options: questionEntity.options.toJSON(),
          examTypes: questionEntity.examTypes,
          categories: questionEntity.categories,
          difficulty: questionEntity.difficulty,
          tags: questionEntity.tags,
          images: questionEntity.images,
          createdAt: questionEntity.createdAt,
        });
      });

      this.logger.info('Question created successfully', {
        questionId: questionEntity.id,
        version: questionEntity.version,
      });

      return questionEntity;
    } catch (error) {
      this.logger.error('Failed to create question', {
        questionId: questionEntity.id,
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError('create', this.getErrorMessage(error));
    }
  }

  async updateQuestion(questionEntity: Question): Promise<Question> {
    try {
      this.logger.info('Updating question', {
        questionId: questionEntity.id,
        version: questionEntity.version,
      });

      // Start transaction for atomic update
      await this.withTransaction(async (txRepo) => {
        // Check current version for optimistic locking
        const currentQuestion = await txRepo.db
          .select({ currentVersion: question.currentVersion })
          .from(question)
          .where(eq(question.questionId, questionEntity.id))
          .limit(1);

        if (currentQuestion.length === 0) {
          throw new QuestionNotFoundError(questionEntity.id);
        }

        const expectedVersion = questionEntity.version - 1;
        if (currentQuestion[0].currentVersion !== expectedVersion) {
          this.logger.warn('Version conflict detected', {
            questionId: questionEntity.id,
            expectedVersion,
            actualVersion: currentQuestion[0].currentVersion,
          });
          throw new QuestionVersionConflictError(
            questionEntity.id,
            expectedVersion,
            currentQuestion[0].currentVersion
          );
        }

        // Update master record
        await txRepo.db
          .update(question)
          .set({
            currentVersion: questionEntity.version,
            isPremium: questionEntity.isPremium,
            status: this.mapQuestionStatusToDb(questionEntity.status),
            updatedAt: questionEntity.updatedAt,
          })
          .where(eq(question.questionId, questionEntity.id));

        // Insert new version record
        await txRepo.db.insert(questionVersion).values({
          questionId: questionEntity.id,
          version: questionEntity.version,
          questionText: questionEntity.questionText,
          questionType: this.mapQuestionTypeToDb(questionEntity.questionType),
          explanation: questionEntity.explanation,
          detailedExplanation: questionEntity.detailedExplanation,
          options: questionEntity.options.toJSON(),
          examTypes: questionEntity.examTypes,
          categories: questionEntity.categories,
          difficulty: questionEntity.difficulty,
          tags: questionEntity.tags,
          images: questionEntity.images,
          createdAt: questionEntity.updatedAt, // Use updated time for version creation
        });
      });

      this.logger.info('Question updated successfully', {
        questionId: questionEntity.id,
        version: questionEntity.version,
      });

      return questionEntity;
    } catch (error) {
      // Re-throw domain errors
      if (error instanceof QuestionNotFoundError || error instanceof QuestionVersionConflictError) {
        throw error;
      }

      this.logger.error('Failed to update question', {
        questionId: questionEntity.id,
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError('update', this.getErrorMessage(error));
    }
  }

  async findQuestionWithDetails(questionId: QuestionId): Promise<Question | null> {
    try {
      this.logger.debug('Finding question with details', { questionId });

      // Join master and current version tables
      const rows = await this.db
        .select({
          master: question,
          version: questionVersion,
        })
        .from(question)
        .innerJoin(
          questionVersion,
          and(
            eq(question.questionId, questionVersion.questionId),
            eq(question.currentVersion, questionVersion.version)
          )
        )
        .where(eq(question.questionId, questionId))
        .limit(1);

      if (rows.length === 0) {
        this.logger.debug('Question not found', { questionId });
        return null;
      }

      return this.mapRowToQuestion(rows[0].master, rows[0].version);
    } catch (error) {
      this.logger.error('Failed to find question with details', {
        questionId,
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError('findWithDetails', this.getErrorMessage(error));
    }
  }

  async findQuestionById(
    questionId: QuestionId,
    includePremium = false
  ): Promise<QuestionSummary | null> {
    try {
      this.logger.debug('Finding question by ID', { questionId, includePremium });

      const conditions = [eq(question.questionId, questionId)];

      // Exclude premium if not allowed
      if (!includePremium) {
        conditions.push(eq(question.isPremium, false));
      }

      const rows = await this.db
        .select({
          master: question,
          version: questionVersion,
        })
        .from(question)
        .innerJoin(
          questionVersion,
          and(
            eq(question.questionId, questionVersion.questionId),
            eq(question.currentVersion, questionVersion.version)
          )
        )
        .where(and(...conditions))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const { master, version } = rows[0];
      return this.mapToQuestionSummary(master, version);
    } catch (error) {
      this.logger.error('Failed to find question by ID', {
        questionId,
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError('findById', this.getErrorMessage(error));
    }
  }

  async findQuestions(
    filters: QuestionFilters,
    pagination: QuestionPagination
  ): Promise<PaginatedQuestions> {
    try {
      this.logger.debug('Finding questions with filters', { filters, pagination });

      // Build query conditions
      const conditions = this.buildQueryConditions(filters);

      // Get total count
      const totalResult = await this.db
        .select({ count: count() })
        .from(question)
        .innerJoin(
          questionVersion,
          and(
            eq(question.questionId, questionVersion.questionId),
            eq(question.currentVersion, questionVersion.version)
          )
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = totalResult[0]?.count ?? 0;

      // Get paginated results
      const rows = await this.db
        .select({
          master: question,
          version: questionVersion,
        })
        .from(question)
        .innerJoin(
          questionVersion,
          and(
            eq(question.questionId, questionVersion.questionId),
            eq(question.currentVersion, questionVersion.version)
          )
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(question.createdAt)
        .limit(pagination.limit)
        .offset(pagination.offset);

      const questions = rows.map(({ master, version }) =>
        this.mapToQuestionSummary(master, version)
      );

      return {
        questions,
        pagination: {
          total,
          limit: pagination.limit,
          offset: pagination.offset,
          hasNext: pagination.offset + pagination.limit < total,
        },
      };
    } catch (error) {
      if (error instanceof InvalidQuestionDataError) {
        throw error;
      }

      this.logger.error('Failed to find questions', {
        filters,
        pagination,
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError('findQuestions', this.getErrorMessage(error));
    }
  }

  async getQuestionStats(): Promise<{
    totalQuestions: number;
    questionsByExamType: Record<string, number>;
    questionsByDifficulty: Record<string, number>;
    premiumQuestions: number;
  }> {
    try {
      this.logger.debug('Getting question statistics');

      // Get total count
      const totalResult = await this.db
        .select({ count: count() })
        .from(question)
        .where(eq(question.status, 'active'));

      const totalQuestions = totalResult[0]?.count ?? 0;

      // Get premium count
      const premiumResult = await this.db
        .select({ count: count() })
        .from(question)
        .where(and(eq(question.status, 'active'), eq(question.isPremium, true)));

      const premiumQuestions = premiumResult[0]?.count ?? 0;

      // Get statistics from version table
      const versionRows = await this.db
        .select({
          examTypes: questionVersion.examTypes,
          difficulty: questionVersion.difficulty,
        })
        .from(question)
        .innerJoin(
          questionVersion,
          and(
            eq(question.questionId, questionVersion.questionId),
            eq(question.currentVersion, questionVersion.version)
          )
        )
        .where(eq(question.status, 'active'));

      // Aggregate statistics
      const questionsByExamType: Record<string, number> = {};
      const questionsByDifficulty: Record<string, number> = {};

      for (const row of versionRows) {
        // Count by exam type
        for (const examType of row.examTypes) {
          questionsByExamType[examType] = (questionsByExamType[examType] || 0) + 1;
        }

        // Count by difficulty
        questionsByDifficulty[row.difficulty] = (questionsByDifficulty[row.difficulty] || 0) + 1;
      }

      return {
        totalQuestions,
        questionsByExamType,
        questionsByDifficulty,
        premiumQuestions,
      };
    } catch (error) {
      this.logger.error('Failed to get question stats', {
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError('getStats', this.getErrorMessage(error));
    }
  }

  /**
   * Execute a callback within a transaction
   * Transaction support is guaranteed by type constraints and constructor validation
   */
  async withTransaction<T>(fn: (repo: DrizzleQuestionRepository<Tx>) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx: Tx) => {
      const txRepo = new DrizzleQuestionRepository(tx, this.logger);
      return await fn(txRepo);
    });
  }

  /**
   * Build query conditions based on filters
   */
  private buildQueryConditions(filters: QuestionFilters) {
    const conditions = [];

    // Always filter by active status if specified
    if (filters.activeOnly) {
      conditions.push(eq(question.status, 'active'));
    }

    // Premium filter
    if (!filters.includePremium) {
      conditions.push(eq(question.isPremium, false));
    }

    // Exam types filter (array contains)
    if (filters.examTypes && filters.examTypes.length > 0) {
      conditions.push(
        or(...filters.examTypes.map((type) => arrayContains(questionVersion.examTypes, [type])))
      );
    }

    // Categories filter
    if (filters.categories && filters.categories.length > 0) {
      conditions.push(
        or(...filters.categories.map((cat) => arrayContains(questionVersion.categories, [cat])))
      );
    }

    // Difficulty filter
    if (filters.difficulty) {
      conditions.push(eq(questionVersion.difficulty, filters.difficulty));
    }

    // Search query (simple text search)
    if (filters.searchQuery) {
      conditions.push(ilike(questionVersion.questionText, `%${filters.searchQuery}%`));
    }

    return conditions;
  }

  /**
   * Map database rows to Question entity
   */
  private mapRowToQuestion(masterRow: QuestionRow, versionRow: QuestionVersionRow): Question {
    const questionResult = Question.fromJSON({
      id: masterRow.questionId,
      version: masterRow.currentVersion,
      questionText: versionRow.questionText,
      questionType: this.mapQuestionTypeFromDb(
        versionRow.questionType as 'single' | 'multiple',
        versionRow.options
      ),
      explanation: versionRow.explanation,
      detailedExplanation: versionRow.detailedExplanation ?? undefined,
      options: versionRow.options,
      examTypes: versionRow.examTypes ?? [],
      categories: versionRow.categories ?? [],
      difficulty: versionRow.difficulty,
      tags: versionRow.tags ?? [],
      images: versionRow.images ?? [],
      isPremium: masterRow.isPremium,
      status: this.mapQuestionStatusFromDb(
        masterRow.status as 'draft' | 'active' | 'inactive' | 'archived'
      ),
      createdById: masterRow.createdById,
      createdAt: masterRow.createdAt.toISOString(),
      updatedAt: masterRow.updatedAt.toISOString(),
    });

    if (!questionResult.success) {
      throw new InvalidQuestionDataError(
        `Failed to reconstruct question from database: ${questionResult.error.message}`
      );
    }

    return questionResult.data;
  }

  /**
   * Map to question summary (without answers)
   */
  private mapToQuestionSummary(
    masterRow: QuestionRow,
    versionRow: QuestionVersionRow
  ): QuestionSummary {
    // Parse options to get count
    let optionCount = 0;
    try {
      const options = versionRow.options;
      if (Array.isArray(options)) {
        optionCount = options.length;
      }
    } catch {
      // Log malformed data but don't fail the summary
      this.logger.warn('Malformed options data', { questionId: masterRow.questionId });
    }

    return {
      questionId: QuestionId.of(masterRow.questionId),
      questionText: versionRow.questionText,
      questionType: this.mapQuestionTypeFromDb(
        versionRow.questionType as 'single' | 'multiple',
        versionRow.options
      ),
      examTypes: versionRow.examTypes ?? [],
      categories: versionRow.categories ?? [],
      difficulty: versionRow.difficulty,
      isPremium: masterRow.isPremium,
      hasImages: (versionRow.images?.length ?? 0) > 0,
      optionCount,
      tags: versionRow.tags ?? [],
      createdAt: masterRow.createdAt,
    };
  }
}
