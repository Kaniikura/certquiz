/**
 * Drizzle implementation of Quiz repository
 * @fileoverview Event-sourcing implementation using Drizzle ORM with optimistic locking
 */

import {
  type QuizSessionEventRow,
  quizSessionEvent,
  quizSessionSnapshot,
} from '@api/infra/db/schema/quiz';
import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, eq, lt } from 'drizzle-orm';
import { PostgresError } from 'postgres';
import { v5 as uuidv5 } from 'uuid';
import { z } from 'zod';
import { QuizSession } from '../aggregates/QuizSession';
import { OptimisticLockError } from '../errors/QuizErrors';
import { DomainEvent } from '../events/DomainEvent';
import {
  AnswerSubmittedEvent,
  type AnswerSubmittedPayload,
  QuizCompletedEvent,
  type QuizCompletedPayload,
  QuizExpiredEvent,
  type QuizExpiredPayload,
  QuizStartedEvent,
  type QuizStartedPayload,
} from '../events/QuizEvents';
import type { AnswerId, OptionId, QuestionId, QuizSessionId, UserId } from '../value-objects/Ids';
import type { IQuizRepository } from './IQuizRepository';

type QuizEventPayloads =
  | QuizStartedPayload
  | AnswerSubmittedPayload
  | QuizCompletedPayload
  | QuizExpiredPayload;

// Constant UUID namespace for deterministic event ID generation
const EVENT_NAMESPACE = '4b8f1d23-2196-4f1c-8ff0-03162b57c824';

/* ──────────────────────────────────────────────────────────────────
   Runtime payload validation schemas (zod)
   Note: These validate raw string/JSON data and cast to branded types in mappers
   ────────────────────────────────────────────────────────────────── */
const quizStartedSchema = z.object({
  userId: z.string().uuid(),
  questionCount: z.number().int().positive(),
  questionIds: z.array(z.string().uuid()),
  configSnapshot: z.any(), // QuizConfigDTO - could be more specific
  questionSnapshots: z.array(z.any()).optional(),
});

const answerSubmittedSchema = z.object({
  answerId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()),
  answeredAt: z.coerce.date(),
});

const quizCompletedSchema = z.object({
  answeredCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
});

const quizExpiredSchema = z.object({
  expiredAt: z.coerce.date(),
});

/* ──────────────────────────────────────────────────────────────────
   Mapper registry for event reconstruction
   ────────────────────────────────────────────────────────────────── */
type MapperFn = (
  row: QuizSessionEventRow,
  payload: unknown
) => DomainEvent<QuizSessionId, QuizEventPayloads>;

interface MapperEntry {
  schema: z.ZodTypeAny;
  mapper: MapperFn;
}

const MAPPERS: Record<string, MapperEntry> = {
  'quiz.started': {
    schema: quizStartedSchema,
    mapper: (row, payload) => {
      const data = payload as z.infer<typeof quizStartedSchema>;
      return new QuizStartedEvent({
        aggregateId: row.sessionId as QuizSessionId,
        version: row.version,
        payload: {
          userId: data.userId as UserId,
          questionCount: data.questionCount,
          questionIds: data.questionIds as QuestionId[],
          configSnapshot: data.configSnapshot,
          questionSnapshots: data.questionSnapshots,
        },
        eventId: deterministicEventId(row),
        occurredAt: row.occurredAt,
      });
    },
  },
  'quiz.answer_submitted': {
    schema: answerSubmittedSchema,
    mapper: (row, payload) => {
      const data = payload as z.infer<typeof answerSubmittedSchema>;
      return new AnswerSubmittedEvent({
        aggregateId: row.sessionId as QuizSessionId,
        version: row.version,
        payload: {
          answerId: data.answerId as AnswerId,
          questionId: data.questionId as QuestionId,
          selectedOptionIds: data.selectedOptionIds as OptionId[],
          answeredAt: data.answeredAt,
        },
        eventId: deterministicEventId(row),
        occurredAt: row.occurredAt,
      });
    },
  },
  'quiz.completed': {
    schema: quizCompletedSchema,
    mapper: (row, payload) => {
      const data = payload as z.infer<typeof quizCompletedSchema>;
      return new QuizCompletedEvent({
        aggregateId: row.sessionId as QuizSessionId,
        version: row.version,
        payload: {
          answeredCount: data.answeredCount,
          totalCount: data.totalCount,
        },
        eventId: deterministicEventId(row),
        occurredAt: row.occurredAt,
      });
    },
  },
  'quiz.expired': {
    schema: quizExpiredSchema,
    mapper: (row, payload) => {
      const data = payload as z.infer<typeof quizExpiredSchema>;
      return new QuizExpiredEvent({
        aggregateId: row.sessionId as QuizSessionId,
        version: row.version,
        payload: {
          expiredAt: data.expiredAt,
        },
        eventId: deterministicEventId(row),
        occurredAt: row.occurredAt,
      });
    },
  },
};

/**
 * Generate deterministic event ID for consistent replay
 */
function deterministicEventId(row: QuizSessionEventRow): string {
  // UUIDv5(sessionId + version + eventSequence, NAMESPACE) → identical ID every replay
  return uuidv5(`${row.sessionId}:${row.version}:${row.eventSequence}`, EVENT_NAMESPACE);
}

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
      const domainEvents = this.mapToDomainEvents(events);
      session.loadFromHistory(domainEvents);

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
      throw new OptimisticLockError(
        `Failed to save quiz session due to database error: ${this.getErrorMessage(error)}`
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
        and(eq(quizSessionSnapshot.state, 'IN_PROGRESS'), lt(quizSessionSnapshot.expiresAt, now))
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
        and(eq(quizSessionSnapshot.ownerId, userId), eq(quizSessionSnapshot.state, 'IN_PROGRESS'))
      )
      .limit(1);

    if (snapshot.length === 0) {
      return null;
    }

    const sessionId = snapshot[0].sessionId as QuizSessionId;
    return await this.findById(sessionId); // Reuse event-sourcing method
  }

  /**
   * Map database event rows to domain events
   * Helper method for event-sourcing reconstruction
   */
  private mapToDomainEvents(
    eventRows: QuizSessionEventRow[]
  ): DomainEvent<QuizSessionId, QuizEventPayloads>[] {
    const domainEvents: DomainEvent<QuizSessionId, QuizEventPayloads>[] = [];

    for (const row of eventRows) {
      const entry = MAPPERS[row.eventType];
      if (!entry) {
        // Unknown event type – fail fast (prevents silent data corruption)
        throw new Error(`QuizSession ${row.sessionId}: unsupported eventType '${row.eventType}'`);
      }

      // 1. Validate / coerce payload
      const parsed = entry.schema.safeParse(row.payload);
      if (!parsed.success) {
        throw new Error(
          `QuizSession ${row.sessionId}: invalid payload for '${row.eventType}'.\n${parsed.error}`
        );
      }

      // 2. Map to DomainEvent instance
      const domainEvent = entry.mapper(row, parsed.data);

      // 3. Preserve the original sequence number in the DomainEvent
      // Use the static method to set sequence properly
      DomainEvent.setEventSequence(domainEvent, row.eventSequence);

      domainEvents.push(domainEvent);
    }

    // The DB query should already be ordered, but sort defensively
    return domainEvents.sort(
      (a, b) =>
        a.version - b.version ||
        a.eventSequence - b.eventSequence ||
        a.occurredAt.getTime() - b.occurredAt.getTime()
    );
  }
}
