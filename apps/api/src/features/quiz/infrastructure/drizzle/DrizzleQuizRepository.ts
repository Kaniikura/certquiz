/**
 * Drizzle implementation of Quiz repository
 * @fileoverview Event-sourcing implementation using Drizzle ORM with optimistic locking
 */

import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, eq, lt } from 'drizzle-orm';
import postgres from 'postgres';
import type { QuizStateValue } from './schema/enums';
import { quizSessionEvent, quizSessionSnapshot } from './schema/quizSession';

// Extract PostgresError using property access to avoid CJS/ESM interop issues
const { PostgresError } = postgres;

import { QuizSession } from '../../domain/aggregates/QuizSession';
import type { IQuizRepository } from '../../domain/repositories/IQuizRepository';
import type { QuizSessionId, UserId } from '../../domain/value-objects/Ids';
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
}
