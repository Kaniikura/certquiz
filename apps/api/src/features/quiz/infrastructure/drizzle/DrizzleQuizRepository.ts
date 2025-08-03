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
import { QuizSession } from '../../domain/aggregates/QuizSession';
import type {
  AdminQuizParams,
  IQuizRepository,
  PaginatedResult,
  QuizWithUserInfo,
} from '../../domain/repositories/IQuizRepository';
import type { QuizSessionId } from '../../domain/value-objects/Ids';
import { OptimisticLockError, QuizRepositoryError } from '../../shared/errors';
import { mapToDomainEvents } from './QuizEventMapper';

export class DrizzleQuizRepository extends BaseRepository implements IQuizRepository {
  constructor(
    private readonly trx: TransactionContext,
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
      // For now, return a placeholder value since score calculation requires
      // parsing the answers JSON and comparing with correct answers
      // TODO: Implement proper score calculation from answers
      return 0;
    } catch (error) {
      this.logger.error('Failed to get average score:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

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
      const items: QuizWithUserInfo[] = results.map((row) => {
        // TODO: Implement proper score calculation with question validation
        // Score calculation requires comparing actual answers with correct answers
        // from question data, which is not available in this context.
        // Return null until proper scoring logic is implemented.
        const score: number | null = null;

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
      });

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
