import type { QuizSessionEventRow } from '@api/infra/db/schema/quiz';
import { Result } from '@api/shared/result';
import { v5 as uuidv5 } from 'uuid';
import { z } from 'zod';
import { DomainEvent } from '../../domain/events/DomainEvent';
import {
  AnswerSubmittedEvent,
  type AnswerSubmittedPayload,
  QuizCompletedEvent,
  type QuizCompletedPayload,
  QuizExpiredEvent,
  type QuizExpiredPayload,
  QuizStartedEvent,
  type QuizStartedPayload,
} from '../../domain/events/QuizEvents';
import type {
  AnswerId,
  OptionId,
  QuestionId,
  QuizSessionId,
  UserId,
} from '../../domain/value-objects/Ids';

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

/**
 * Generate deterministic event ID for consistent replay
 */
export function deterministicEventId(row: QuizSessionEventRow): string {
  // UUIDv5(sessionId + version + eventSequence, NAMESPACE) → identical ID every replay
  return uuidv5(`${row.sessionId}:${row.version}:${row.eventSequence}`, EVENT_NAMESPACE);
}

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

export const MAPPERS: Record<string, MapperEntry> = {
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
 * Map database event rows to domain events
 * Helper method for event-sourcing reconstruction
 * Pure function testable without database dependencies
 */
export function mapToDomainEvents(
  eventRows: QuizSessionEventRow[]
): Result<DomainEvent<QuizSessionId, QuizEventPayloads>[], Error> {
  try {
    const domainEvents: DomainEvent<QuizSessionId, QuizEventPayloads>[] = [];

    for (const row of eventRows) {
      const entry = MAPPERS[row.eventType];
      if (!entry) {
        // Unknown event type – fail fast (prevents silent data corruption)
        return Result.fail(
          new Error(`QuizSession ${row.sessionId}: unsupported eventType '${row.eventType}'`)
        );
      }

      // 1. Validate / coerce payload
      const parsed = entry.schema.safeParse(row.payload);
      if (!parsed.success) {
        return Result.fail(
          new Error(
            `QuizSession ${row.sessionId}: invalid payload for '${row.eventType}'.\n${parsed.error}`
          )
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
    const sortedEvents = domainEvents.sort(
      (a, b) =>
        a.version - b.version ||
        a.eventSequence - b.eventSequence ||
        a.occurredAt.getTime() - b.occurredAt.getTime()
    );

    return Result.ok(sortedEvents);
  } catch (error) {
    return Result.fail(error instanceof Error ? error : new Error('Event mapping failed'));
  }
}
