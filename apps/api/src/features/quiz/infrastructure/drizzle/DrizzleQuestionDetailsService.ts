/**
 * Drizzle implementation of IQuestionDetailsService
 * @fileoverview Fetches question details from the database for scoring purposes
 */

import {
  question as questionTable,
  questionVersion,
} from '@api/features/question/infrastructure/drizzle/schema/question';
import type { TransactionContext } from '@api/infra/db/uow';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, eq, inArray } from 'drizzle-orm';
import type { OptionId, QuestionId } from '../../domain/value-objects/Ids';
import type {
  IQuestionDetailsService,
  QuestionDetails,
} from '../../domain/value-objects/QuestionDetailsService';

/**
 * Production implementation of IQuestionDetailsService
 * Queries the question database to retrieve question details for scoring
 */
export class DrizzleQuestionDetailsService
  extends BaseRepository
  implements IQuestionDetailsService
{
  constructor(
    private readonly trx: TransactionContext,
    logger: LoggerPort
  ) {
    super(logger);
  }

  async getQuestionDetails(questionId: QuestionId): Promise<QuestionDetails | null> {
    try {
      this.logger.debug('Fetching question details', { questionId });

      // Query the latest version of the question
      const result = await this.trx
        .select({
          questionId: questionTable.questionId,
          version: questionTable.currentVersion,
          questionText: questionVersion.questionText,
          options: questionVersion.options,
        })
        .from(questionTable)
        .innerJoin(
          questionVersion,
          and(
            eq(questionTable.questionId, questionVersion.questionId),
            eq(questionTable.currentVersion, questionVersion.version)
          )
        )
        .where(eq(questionTable.questionId, questionId))
        .limit(1);

      if (result.length === 0) {
        this.logger.debug('Question not found', { questionId });
        return null;
      }

      const row = result[0];

      // Parse options from JSONB
      const options = row.options as Array<{
        id: string;
        text: string;
        isCorrect: boolean;
      }>;

      // Extract correct option IDs
      const correctOptionIds = options
        .filter((opt) => opt.isCorrect)
        .map((opt) => opt.id as OptionId);

      return {
        id: row.questionId as QuestionId,
        text: row.questionText,
        options: options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
        correctOptionIds,
      };
    } catch (error) {
      this.logger.error('Failed to fetch question details', {
        questionId,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async getMultipleQuestionDetails(
    questionIds: QuestionId[]
  ): Promise<Map<QuestionId, QuestionDetails>> {
    try {
      if (questionIds.length === 0) {
        return new Map();
      }

      this.logger.debug('Fetching multiple question details', {
        count: questionIds.length,
      });

      // Query all questions in a single batch to avoid N+1
      const results = await this.trx
        .select({
          questionId: questionTable.questionId,
          version: questionTable.currentVersion,
          questionText: questionVersion.questionText,
          options: questionVersion.options,
        })
        .from(questionTable)
        .innerJoin(
          questionVersion,
          and(
            eq(questionTable.questionId, questionVersion.questionId),
            eq(questionTable.currentVersion, questionVersion.version)
          )
        )
        .where(inArray(questionTable.questionId, questionIds));

      // Convert results to Map
      const detailsMap = new Map<QuestionId, QuestionDetails>();

      for (const row of results) {
        // Parse options from JSONB
        const options = row.options as Array<{
          id: string;
          text: string;
          isCorrect: boolean;
        }>;

        // Extract correct option IDs
        const correctOptionIds = options
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id as OptionId);

        detailsMap.set(row.questionId as QuestionId, {
          id: row.questionId as QuestionId,
          text: row.questionText,
          options: options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
          correctOptionIds,
        });
      }

      // Log any missing questions
      const foundIds = new Set(results.map((r: (typeof results)[0]) => r.questionId));
      const missingIds = questionIds.filter((id) => !foundIds.has(id));

      if (missingIds.length > 0) {
        this.logger.warn('Some questions not found', {
          requested: questionIds.length,
          found: results.length,
          missing: missingIds.length,
        });
      }

      return detailsMap;
    } catch (error) {
      this.logger.error('Failed to fetch multiple question details', {
        count: questionIds.length,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }
}
