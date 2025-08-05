/**
 * Drizzle implementation of Question repository
 * @fileoverview CRUD operations for Question catalog with versioning support
 */

import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { QuestionId } from '../../../quiz/domain/value-objects/Ids';
import type { Question, QuestionStatus } from '../../domain/entities/Question';
import type {
  IQuestionRepository,
  ModerationParams,
  PaginatedQuestions,
  PaginatedResult,
  QuestionFilters,
  QuestionPagination,
  QuestionSummary,
  QuestionWithModerationInfo,
} from '../../domain/repositories/IQuestionRepository';
import type { QuestionDifficulty } from '../../domain/value-objects/QuestionDifficulty';
import {
  InvalidQuestionDataError,
  QuestionNotFoundError,
  QuestionRepositoryConfigurationError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from '../../shared/errors';
import {
  mapQuestionStatusToDb,
  mapQuestionTypeFromDb,
  mapQuestionTypeToDb,
  mapRowToQuestion,
  mapToQuestionSummary,
} from './QuestionRowMapper';
import { moderationLogs } from './schema/moderation';
import { question, questionVersion } from './schema/question';

/**
 * Drizzle implementation of Question repository for catalog operations
 * Handles versioned questions with two-table design (master + versions)
 * Enforces transaction support at the type level for data consistency
 */
export class DrizzleQuestionRepository extends BaseRepository implements IQuestionRepository {
  constructor(
    private readonly db: TransactionContext,
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
          status: mapQuestionStatusToDb(questionEntity.status),
          createdAt: questionEntity.createdAt,
          updatedAt: questionEntity.updatedAt,
        });

        // Insert version record
        await txRepo.db.insert(questionVersion).values({
          questionId: questionEntity.id,
          version: questionEntity.version,
          questionText: questionEntity.questionText,
          questionType: mapQuestionTypeToDb(questionEntity.questionType),
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
            status: mapQuestionStatusToDb(questionEntity.status),
            updatedAt: questionEntity.updatedAt,
          })
          .where(eq(question.questionId, questionEntity.id));

        // Insert new version record
        await txRepo.db.insert(questionVersion).values({
          questionId: questionEntity.id,
          version: questionEntity.version,
          questionText: questionEntity.questionText,
          questionType: mapQuestionTypeToDb(questionEntity.questionType),
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

      const result = mapRowToQuestion(rows[0].master, rows[0].version);
      if (!result.success) {
        throw new InvalidQuestionDataError(
          `Failed to reconstruct question from database: ${result.error.message}`
        );
      }
      return result.data;
    } catch (error) {
      // Re-throw domain errors
      if (error instanceof InvalidQuestionDataError) {
        throw error;
      }

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
      return mapToQuestionSummary(master, version);
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

      const questions = rows.map(({ master, version }) => mapToQuestionSummary(master, version));

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
  async withTransaction<T>(fn: (repo: DrizzleQuestionRepository) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
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

  async countTotalQuestions(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(question)
        .where(ne(question.status, 'archived'));

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error('Failed to count total questions:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async countPendingQuestions(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(question)
        .where(eq(question.status, 'draft'));

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error('Failed to count pending questions:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async updateStatus(
    questionId: QuestionId,
    status: QuestionStatus,
    moderatedBy: string,
    feedback?: string
  ): Promise<void> {
    try {
      this.logger.info('Updating question status', {
        questionId,
        status,
        moderatedBy,
        hasFeedback: !!feedback,
      });

      // Get the full question entity to use domain method
      const questionEntity = await this.findQuestionWithDetails(questionId);
      if (!questionEntity) {
        throw new QuestionNotFoundError(`Question with ID ${questionId} not found`);
      }

      // Use the domain method to handle status update and business rule validation
      const moderationResult = questionEntity.moderateStatus(status, feedback);

      if (!moderationResult.success) {
        throw moderationResult.error;
      }

      // Extract moderation metadata from domain result
      const { previousStatus, newStatus, action } = moderationResult.data;

      // Use transaction to ensure both operations succeed or fail together
      await this.db.transaction(async (tx) => {
        // Update the question status using the modified entity
        await tx
          .update(question)
          .set({
            status: mapQuestionStatusToDb(questionEntity.status),
            updatedAt: questionEntity.updatedAt,
          })
          .where(eq(question.questionId, questionId));

        // Log the moderation action using domain result
        await tx.insert(moderationLogs).values({
          questionId,
          action,
          moderatedBy,
          feedback,
          previousStatus: mapQuestionStatusToDb(previousStatus),
          newStatus: mapQuestionStatusToDb(newStatus),
        });
      });

      this.logger.info('Question status updated successfully', {
        questionId,
        previousStatus: mapQuestionStatusToDb(previousStatus),
        newStatus: mapQuestionStatusToDb(newStatus),
        moderatedBy,
      });
    } catch (error) {
      this.logger.error('Failed to update question status', {
        questionId,
        status,
        moderatedBy,
        error: this.getErrorDetails(error),
      });

      // Re-throw our domain errors as-is
      if (error instanceof QuestionNotFoundError || error instanceof InvalidQuestionDataError) {
        throw error;
      }

      throw new QuestionRepositoryError(
        'updateStatus',
        `Failed to update question status: ${this.getErrorMessage(error)}`
      );
    }
  }

  async findQuestionsForModeration(
    params: ModerationParams
  ): Promise<PaginatedResult<QuestionWithModerationInfo>> {
    try {
      this.logger.debug('Finding questions for moderation', { params });

      const {
        page,
        pageSize,
        status,
        dateFrom,
        dateTo,
        examType,
        difficulty,
        orderBy = 'createdAt',
        orderDir = 'desc',
      } = params;
      const offset = (page - 1) * pageSize;

      // Build WHERE conditions
      const conditions = [];

      if (status) {
        conditions.push(eq(question.status, mapQuestionStatusToDb(status)));
      } else {
        // Default to pending questions if no status filter
        conditions.push(eq(question.status, 'draft'));
      }

      if (dateFrom) {
        conditions.push(gte(question.createdAt, dateFrom));
      }

      if (dateTo) {
        conditions.push(lte(question.createdAt, dateTo));
      }

      if (examType) {
        // Use the latest version for exam type filtering
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${questionVersion} 
            WHERE ${questionVersion.questionId} = ${question.questionId} 
            AND ${questionVersion.version} = ${question.currentVersion}
            AND ${arrayContains(questionVersion.examTypes, [examType])}
          )`
        );
      }

      if (difficulty) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${questionVersion} 
            WHERE ${questionVersion.questionId} = ${question.questionId} 
            AND ${questionVersion.version} = ${question.currentVersion}
            AND ${questionVersion.difficulty} = ${difficulty}
          )`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total records
      const countResult = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(question)
        .leftJoin(
          questionVersion,
          and(
            eq(questionVersion.questionId, question.questionId),
            eq(questionVersion.version, question.currentVersion)
          )
        )
        .where(whereClause);

      const totalCount = Number(countResult[0]?.count ?? 0);

      // Get paginated data
      const orderColumn = orderBy === 'createdAt' ? question.createdAt : question.updatedAt;
      const orderFn = orderDir === 'asc' ? asc : desc;

      const results = await this.db
        .select({
          questionId: question.questionId,
          questionText: questionVersion.questionText,
          questionType: questionVersion.questionType,
          examTypes: questionVersion.examTypes,
          categories: questionVersion.categories,
          difficulty: questionVersion.difficulty,
          status: question.status,
          isPremium: question.isPremium,
          tags: questionVersion.tags,
          createdById: question.createdById,
          createdAt: question.createdAt,
          updatedAt: question.updatedAt,
        })
        .from(question)
        .leftJoin(
          questionVersion,
          and(
            eq(questionVersion.questionId, question.questionId),
            eq(questionVersion.version, question.currentVersion)
          )
        )
        .where(whereClause)
        .orderBy(orderFn(orderColumn))
        .limit(pageSize)
        .offset(offset);

      // Map results to domain objects
      const items: QuestionWithModerationInfo[] = results.map((row) => {
        const now = new Date();
        const daysPending = Math.ceil(
          (now.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          questionId: row.questionId as QuestionId,
          questionText: row.questionText || '',
          questionType: mapQuestionTypeFromDb(row.questionType || 'single'),
          examTypes: row.examTypes || [],
          categories: row.categories || [],
          difficulty: (row.difficulty || 'Beginner') as QuestionDifficulty,
          status: row.status as QuestionStatus,
          isPremium: row.isPremium || false,
          tags: row.tags || [],
          createdById: row.createdById,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          daysPending,
        };
      });

      const result: PaginatedResult<QuestionWithModerationInfo> = {
        items,
        total: totalCount,
        page,
        pageSize,
      };

      this.logger.debug('Found questions for moderation', {
        totalCount,
        currentPage: page,
        itemCount: items.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to find questions for moderation', {
        params,
        error: this.getErrorDetails(error),
      });
      throw new QuestionRepositoryError(
        'findQuestionsForModeration',
        `Failed to find questions: ${this.getErrorMessage(error)}`
      );
    }
  }
}
