/**
 * Drizzle implementation of Quiz repository
 * @fileoverview Event-sourcing implementation using Drizzle ORM with optimistic locking
 */

import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, asc, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { QuizState } from '../../domain/value-objects/QuizState';
import type { QuizStateValue } from './schema/enums';
import { quizSessionEvent, quizSessionSnapshot } from './schema/quizSession';

// Extract PostgresError using property access to avoid CJS/ESM interop issues
const { PostgresError } = postgres;

import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { PaginatedResult } from '@api/shared/types/pagination';
import { QuizSession } from '../../domain/aggregates/QuizSession';
import { Answer } from '../../domain/entities/Answer';
import type {
  AdminQuizParams,
  IQuizRepository,
  QuizWithUserInfo,
} from '../../domain/repositories/IQuizRepository';
import type { AnswerId, OptionId, QuestionId, QuizSessionId } from '../../domain/value-objects/Ids';
import type {
  IQuestionDetailsService,
  QuestionDetails,
} from '../../domain/value-objects/QuestionDetailsService';
import type { AnswerResult } from '../../get-results/dto';
import {
  buildAnswerResultsFromAnswers,
  calculateScoreSummary,
} from '../../get-results/scoring-utils';
import { OptimisticLockError, QuizRepositoryError } from '../../shared/errors';
import { mapToDomainEvents } from './QuizEventMapper';

/**
 * Helper to convert raw answer data to domain Answer objects and call scoring utility
 * @param answersMap Raw answer data from database
 * @param questionDetailsMap Question details for scoring
 * @returns Answer results and correct count
 */
function buildAnswerResultsFromRawData(
  answersMap: Record<
    string,
    {
      answerId: string;
      questionId: string;
      selectedOptionIds: string[];
      answeredAt: string;
    }
  >,
  questionDetailsMap: Map<QuestionId, QuestionDetails>
): { answerResults: AnswerResult[]; correctCount: number } {
  // Convert raw data to Answer map
  const answers = new Map<QuestionId, Answer>();
  for (const [_, answerData] of Object.entries(answersMap)) {
    const answer = Answer.fromEventReplay(
      answerData.answerId as AnswerId,
      answerData.questionId as QuestionId,
      answerData.selectedOptionIds as OptionId[],
      new Date(answerData.answeredAt)
    );
    answers.set(answerData.questionId as QuestionId, answer);
  }

  return buildAnswerResultsFromAnswers(answers, questionDetailsMap);
}

export class DrizzleQuizRepository extends BaseRepository implements IQuizRepository {
  constructor(
    private readonly trx: TransactionContext,
    private readonly questionDetailsService: IQuestionDetailsService,
    logger: LoggerPort
  ) {
    super(logger);
  }

  async findById(id: QuizSessionId): Promise<QuizSession | null> {
    try {
      this.logger.debug('Finding quiz session by ID', { sessionId: id });

      // Load all events for the session (event-sourcing approach)
      const events = await this.trx
        .select()
        .from(quizSessionEvent)
        .where(eq(quizSessionEvent.sessionId, id))
        .orderBy(quizSessionEvent.version, quizSessionEvent.eventSequence);

      if (events.length === 0) {
        this.logger.debug('Quiz session not found', { sessionId: id });
        return null;
      }

      // Reconstruct aggregate from events
      const session = QuizSession.createForReplay(id);
      const domainEventsResult = mapToDomainEvents(events);
      if (!domainEventsResult.success) {
        throw domainEventsResult.error;
      }
      session.loadFromHistory(domainEventsResult.data);

      this.logger.debug('Quiz session loaded successfully', {
        sessionId: id,
        eventCount: events.length,
      });
      return session;
    } catch (error) {
      this.logger.error('Failed to find quiz session', {
        sessionId: id,
        error: this.getErrorMessage(error),
      });
      throw error;
    }
  }

  async save(session: QuizSession): Promise<void> {
    const events = session.pullUncommittedEvents();

    if (events.length === 0) {
      this.logger.debug('No events to persist for session', { sessionId: session.id });
      return; // No changes to persist
    }

    try {
      this.logger.info('Saving quiz session events', {
        sessionId: session.id,
        eventCount: events.length,
      });

      // Insert events with optimistic locking for conflict detection
      const eventInserts = events.map((event) => ({
        sessionId: session.id,
        version: event.version,
        eventSequence: event.eventSequence,
        eventType: event.eventType,
        payload: event.payload,
        occurredAt: event.occurredAt,
      }));

      // Insert events - PostgreSQL will automatically detect conflicts
      await this.trx.insert(quizSessionEvent).values(eventInserts);

      // Update snapshot table for performance queries
      await this.updateSnapshot(session);

      // Mark events as committed in aggregate
      session.markChangesAsCommitted();

      this.logger.info('Quiz session saved successfully', {
        sessionId: session.id,
        eventCount: events.length,
      });
    } catch (error: unknown) {
      // PostgreSQL raises unique_violation (23505) on conflict
      if (error instanceof PostgresError && error.code === '23505') {
        this.logger.warn('Optimistic lock conflict detected', {
          sessionId: session.id,
          errorCode: error.code,
        });
        throw new OptimisticLockError(
          `Concurrent modification detected for session ${session.id}. Another process has already modified this session.`
        );
      }

      // Re-wrap other database errors for consistency
      this.logger.error('Failed to save quiz session', {
        sessionId: session.id,
        error: this.getErrorMessage(error),
      });
      throw new QuizRepositoryError(
        'save',
        `Failed to save quiz session: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Updates the quiz session snapshot for performance queries
   * @param session - Quiz session aggregate with current state
   */
  private async updateSnapshot(session: QuizSession): Promise<void> {
    try {
      // Convert session answers to JSONB format
      const answersMap: Record<
        string,
        {
          answerId: string;
          questionId: string;
          selectedOptionIds: string[];
          answeredAt: string;
        }
      > = {};
      const submittedAnswers = session.getAnswers();

      for (const [questionId, answer] of submittedAnswers) {
        answersMap[answer.id] = {
          answerId: answer.id,
          questionId: questionId.toString(),
          selectedOptionIds: answer.selectedOptionIds.map((id) => id.toString()),
          answeredAt: answer.answeredAt.toISOString(),
        };
      }

      // Calculate correct_answers if quiz is completed
      let correctAnswers: number | null = null;
      if (session.state === QuizState.Completed && submittedAnswers.size > 0) {
        try {
          const questionIds = session.getQuestionIds();
          const questionDetailsMap =
            await this.questionDetailsService.getMultipleQuestionDetails(questionIds);
          const { correctCount } = buildAnswerResultsFromAnswers(
            submittedAnswers,
            questionDetailsMap
          );
          correctAnswers = correctCount;
        } catch (error) {
          this.logger.warn('Failed to calculate correct answers for snapshot', {
            sessionId: session.id,
            error: this.getErrorMessage(error),
          });
          // Continue with null correctAnswers - will be calculated later if needed
        }
      }

      // Map domain state to database state
      let dbState: QuizStateValue;
      switch (session.state) {
        case QuizState.InProgress:
          dbState = 'IN_PROGRESS';
          break;
        case QuizState.Completed:
          dbState = 'COMPLETED';
          break;
        case QuizState.Expired:
          dbState = 'EXPIRED';
          break;
        default:
          throw new Error(`Unknown quiz state: ${session.state}`);
      }

      // Calculate expires_at based on config
      let expiresAt: Date | null = null;
      if (session.config.timeLimit) {
        expiresAt = new Date(session.startedAt.getTime() + session.config.timeLimit * 1000);
      } else if (session.config.fallbackLimitSeconds) {
        expiresAt = new Date(
          session.startedAt.getTime() + session.config.fallbackLimitSeconds * 1000
        );
      }

      // Calculate current question index based on answered questions
      const currentQuestionIndex = submittedAnswers.size;

      // Prepare snapshot data
      const snapshotData = {
        sessionId: session.id,
        ownerId: session.userId,
        state: dbState,
        questionCount: session.config.questionCount,
        currentQuestionIndex,
        startedAt: session.startedAt,
        expiresAt,
        completedAt: session.completedAt,
        version: session.version,
        config: session.config as unknown as Record<string, unknown>, // QuizConfig is serializable as JSONB
        questionOrder: session.getQuestionIds().map((id) => id.toString()),
        answers: Object.keys(answersMap).length > 0 ? answersMap : null,
        correctAnswers,
        updatedAt: new Date(),
      };

      // Upsert snapshot record (PostgreSQL UPSERT)
      await this.trx
        .insert(quizSessionSnapshot)
        .values(snapshotData)
        .onConflictDoUpdate({
          target: quizSessionSnapshot.sessionId,
          set: {
            state: snapshotData.state,
            questionCount: snapshotData.questionCount,
            currentQuestionIndex: snapshotData.currentQuestionIndex,
            expiresAt: snapshotData.expiresAt,
            completedAt: snapshotData.completedAt,
            version: snapshotData.version,
            config: snapshotData.config,
            questionOrder: snapshotData.questionOrder,
            answers: snapshotData.answers,
            correctAnswers: snapshotData.correctAnswers,
            updatedAt: snapshotData.updatedAt,
          },
        });

      this.logger.debug('Quiz session snapshot updated', {
        sessionId: session.id,
        state: dbState,
        correctAnswers,
      });
    } catch (error) {
      this.logger.error('Failed to update quiz session snapshot', {
        sessionId: session.id,
        error: this.getErrorMessage(error),
      });
      // Don't throw error - snapshot update failure shouldn't fail the main operation
      // The snapshot is for performance only, not critical for consistency
    }
  }

  async findExpiredSessions(now: Date, limit: number): Promise<QuizSession[]> {
    // Note: This method uses snapshot table for performance
    // In pure event-sourcing, we might query by event timestamp instead
    const expiredSnapshots = await this.trx
      .select()
      .from(quizSessionSnapshot)
      .where(
        and(
          eq(quizSessionSnapshot.state, 'IN_PROGRESS' satisfies QuizStateValue),
          lt(quizSessionSnapshot.expiresAt, now)
        )
      )
      .limit(limit);

    const sessions: QuizSession[] = [];

    for (const snapshot of expiredSnapshots) {
      const sessionId = snapshot.sessionId as QuizSessionId;
      const session = await this.findById(sessionId); // Reuse event-sourcing method
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async findActiveByUser(userId: UserId): Promise<QuizSession | null> {
    // Note: This method uses snapshot table for performance
    // In pure event-sourcing, we might scan events instead
    const snapshot = await this.trx
      .select()
      .from(quizSessionSnapshot)
      .where(
        and(
          eq(quizSessionSnapshot.ownerId, userId),
          eq(quizSessionSnapshot.state, 'IN_PROGRESS' satisfies QuizStateValue)
        )
      )
      .limit(1);

    if (snapshot.length === 0) {
      return null;
    }

    const sessionId = snapshot[0].sessionId as QuizSessionId;
    return await this.findById(sessionId); // Reuse event-sourcing method
  }

  async countTotalSessions(): Promise<number> {
    try {
      const result = await this.trx
        .select({ count: sql<number>`COUNT(DISTINCT session_id)` })
        .from(quizSessionEvent);

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error('Failed to count total sessions:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async countActiveSessions(): Promise<number> {
    try {
      const result = await this.trx
        .select({ count: sql<number>`COUNT(*)` })
        .from(quizSessionSnapshot)
        .where(eq(quizSessionSnapshot.state, 'IN_PROGRESS' satisfies QuizStateValue));

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error('Failed to count active sessions:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async getAverageScore(): Promise<number> {
    try {
      this.logger.debug('Calculating average quiz score using database aggregation');

      // Use database aggregation with the pre-calculated correct_answers column
      const result = await this.trx
        .select({
          averagePercentage: sql<number>`
            ROUND(
              AVG(
                CASE 
                  WHEN ${quizSessionSnapshot.correctAnswers} IS NOT NULL 
                  THEN (${quizSessionSnapshot.correctAnswers}::float / ${quizSessionSnapshot.questionCount}::float) * 100
                  ELSE NULL
                END
              )
            )
          `,
          validQuizCount: sql<number>`
            COUNT(
              CASE 
                WHEN ${quizSessionSnapshot.correctAnswers} IS NOT NULL 
                THEN 1
                ELSE NULL
              END
            )
          `,
          totalCompletedQuizzes: sql<number>`COUNT(*)`,
        })
        .from(quizSessionSnapshot)
        .where(eq(quizSessionSnapshot.state, 'COMPLETED' satisfies QuizStateValue));

      const aggregationResult = result[0];

      if (!aggregationResult || aggregationResult.validQuizCount === 0) {
        this.logger.debug('No completed quizzes with valid scores found');
        return 0;
      }

      const averageScore = Math.round(aggregationResult.averagePercentage || 0);

      this.logger.debug('Average score calculated via database aggregation', {
        totalCompletedQuizzes: aggregationResult.totalCompletedQuizzes,
        validQuizzes: aggregationResult.validQuizCount,
        averageScore,
      });

      return averageScore;
    } catch (error) {
      this.logger.error('Failed to get average score:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  /**
   * TODO: Performance Optimization - Cursor-Based Pagination
   * Current offset-based pagination has same performance limitations as
   * described in DrizzleQuestionRepository. Consider implementing cursor-based
   * pagination when dealing with large numbers of quiz sessions.
   */

  async findAllForAdmin(params: AdminQuizParams): Promise<PaginatedResult<QuizWithUserInfo>> {
    try {
      this.logger.debug('Finding quizzes for admin', { params });

      const { page, pageSize, filters, orderBy = 'startedAt', orderDir = 'desc' } = params;
      const offset = (page - 1) * pageSize;

      // Build WHERE conditions
      const conditions = [];

      if (filters?.state) {
        conditions.push(eq(quizSessionSnapshot.state, filters.state as QuizStateValue));
      }

      if (filters?.userId) {
        conditions.push(eq(quizSessionSnapshot.ownerId, filters.userId));
      }

      if (filters?.startDate) {
        conditions.push(gte(quizSessionSnapshot.startedAt, filters.startDate));
      }

      if (filters?.endDate) {
        conditions.push(lte(quizSessionSnapshot.startedAt, filters.endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total records
      const countResult = await this.trx
        .select({ count: sql<number>`COUNT(*)` })
        .from(quizSessionSnapshot)
        .innerJoin(authUser, eq(quizSessionSnapshot.ownerId, authUser.userId))
        .where(whereClause);

      const totalCount = Number(countResult[0]?.count ?? 0);

      // Get paginated data with user info
      const orderColumn =
        orderBy === 'startedAt' ? quizSessionSnapshot.startedAt : quizSessionSnapshot.completedAt;
      const orderFn = orderDir === 'asc' ? asc : desc;

      const results = await this.trx
        .select({
          sessionId: quizSessionSnapshot.sessionId,
          userId: quizSessionSnapshot.ownerId,
          userEmail: authUser.email,
          state: quizSessionSnapshot.state,
          questionCount: quizSessionSnapshot.questionCount,
          startedAt: quizSessionSnapshot.startedAt,
          completedAt: quizSessionSnapshot.completedAt,
          answers: quizSessionSnapshot.answers,
        })
        .from(quizSessionSnapshot)
        .innerJoin(authUser, eq(quizSessionSnapshot.ownerId, authUser.userId))
        .where(whereClause)
        .orderBy(orderFn(orderColumn))
        .limit(pageSize)
        .offset(offset);

      // Calculate scores and map to QuizWithUserInfo
      const items: QuizWithUserInfo[] = await Promise.all(
        results.map(async (row) => {
          let score: number | null = null;

          // Only calculate score for completed quizzes
          if (row.state === 'COMPLETED' && row.answers) {
            try {
              // Parse answers from JSONB
              const answersMap = row.answers as Record<
                string,
                {
                  answerId: string;
                  questionId: string;
                  selectedOptionIds: string[];
                  answeredAt: string;
                }
              >;

              // Get question IDs from answers
              const questionIds = Object.values(answersMap).map(
                (answer) => answer.questionId as QuestionId
              );

              // If no answers, keep score as null
              if (questionIds.length === 0) {
                score = null;
              } else {
                // Fetch question details
                const questionDetailsMap =
                  await this.questionDetailsService.getMultipleQuestionDetails(questionIds);

                // Check if we got details for all questions
                if (questionDetailsMap.size < questionIds.length) {
                  // Some question details are missing, can't calculate accurate score
                  this.logger.warn('Missing question details for score calculation', {
                    sessionId: row.sessionId,
                    requestedQuestions: questionIds.length,
                    foundQuestions: questionDetailsMap.size,
                  });
                  score = null;
                } else {
                  // Calculate score using new utility function
                  const { correctCount } = buildAnswerResultsFromRawData(
                    answersMap,
                    questionDetailsMap
                  );
                  const scoreSummary = calculateScoreSummary(correctCount, row.questionCount);
                  score = scoreSummary.percentage;
                }
              }
            } catch (error) {
              this.logger.warn('Failed to calculate score for quiz', {
                sessionId: row.sessionId,
                error: this.getErrorDetails(error),
              });
              // Keep score as null if calculation fails
            }
          }

          // Convert database state value to QuizState enum
          let quizState: QuizState;
          switch (row.state) {
            case 'IN_PROGRESS':
              quizState = QuizState.InProgress;
              break;
            case 'COMPLETED':
              quizState = QuizState.Completed;
              break;
            case 'EXPIRED':
              quizState = QuizState.Expired;
              break;
            default:
              throw new Error(`Unknown quiz state: ${row.state}`);
          }

          return {
            sessionId: row.sessionId,
            userId: row.userId,
            userEmail: row.userEmail,
            state: quizState,
            score,
            questionCount: row.questionCount,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
          };
        })
      );

      const result: PaginatedResult<QuizWithUserInfo> = {
        items,
        total: totalCount,
        page,
        pageSize,
      };

      this.logger.debug('Found quizzes for admin', {
        totalCount,
        currentPage: page,
        itemCount: items.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to find quizzes for admin', {
        params,
        error: this.getErrorDetails(error),
      });
      throw new QuizRepositoryError(
        'findAllForAdmin',
        `Failed to find quizzes: ${this.getErrorMessage(error)}`
      );
    }
  }

  async deleteWithCascade(sessionId: QuizSessionId): Promise<void> {
    try {
      this.logger.info('Deleting quiz session with cascade', { sessionId });

      // Delete events first (child records)
      const eventDeleteResult = await this.trx
        .delete(quizSessionEvent)
        .where(eq(quizSessionEvent.sessionId, sessionId));

      // Delete snapshot (parent record)
      const snapshotDeleteResult = await this.trx
        .delete(quizSessionSnapshot)
        .where(eq(quizSessionSnapshot.sessionId, sessionId));

      this.logger.info('Quiz session deleted successfully', {
        sessionId,
        eventsDeleted: (eventDeleteResult as { rowCount?: number }).rowCount || 0,
        snapshotDeleted: (snapshotDeleteResult as { rowCount?: number }).rowCount || 0,
      });
    } catch (error) {
      this.logger.error('Failed to delete quiz session', {
        sessionId,
        error: this.getErrorDetails(error),
      });
      throw new QuizRepositoryError(
        'deleteWithCascade',
        `Failed to delete quiz session: ${this.getErrorMessage(error)}`
      );
    }
  }
}
