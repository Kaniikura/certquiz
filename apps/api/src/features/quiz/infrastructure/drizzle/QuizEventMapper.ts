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
import type { QuizSessionEventRow } from './schema/quizSession';

type QuizEventPayloads =
  | QuizStartedPayload
  | AnswerSubmittedPayload
  | QuizCompletedPayload
  | QuizExpiredPayload;

/**
 * UUID Namespace for Deterministic Event ID Generation
 *
 * This namespace UUID is used with UUIDv5 to generate deterministic event IDs based on:
 * - sessionId: The quiz session identifier
 * - version: The aggregate version number
 * - eventSequence: The sequence number within that version
 *
 * Why this specific UUID?
 * - Generated once during initial system design (not a well-known namespace)
 * - Ensures event IDs are reproducible across event replays
 * - Prevents ID collisions across different quiz sessions
 * - Enables idempotent event processing (same input = same ID)
 *
 * IMPORTANT: Do not change this value as it would break event replay consistency.
 * All historical events depend on this namespace for their ID generation.
 *
 * Example: UUIDv5("session123:1:0", EVENT_NAMESPACE) → always produces same event ID
 */
const EVENT_NAMESPACE = '4b8f1d23-2196-4f1c-8ff0-03162b57c824';

/* ──────────────────────────────────────────────────────────────────
   Runtime payload validation schemas (zod)
   Note: These validate raw string/JSON data and cast to branded types in mappers
   ────────────────────────────────────────────────────────────────── */
const quizStartedSchema = z.object({
  sessionId: z.string().uuid(),
  ownerId: z.string().uuid(),
  config: z.object({
    examType: z.string(),
    category: z.string().nullable(),
    questionCount: z.number().int().positive(),
    timeLimit: z.number().int().positive().nullable(),
    difficulty: z.string(),
    enforceSequentialAnswering: z.boolean(),
    requireAllAnswers: z.boolean(),
    autoCompleteWhenAllAnswered: z.boolean(),
    fallbackLimitSeconds: z.number().int().positive(),
  }),
  questionIds: z.array(z.string().uuid()),
  startedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});

const answerSubmittedSchema = z.object({
  sessionId: z.string().uuid(),
  answerId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOptions: z.array(z.string().uuid()),
  submittedAt: z.coerce.date(),
});

const quizCompletedSchema = z.object({
  sessionId: z.string().uuid(),
  totalQuestions: z.number().int().positive(),
  answeredQuestions: z.number().int().nonnegative(),
  completedAt: z.coerce.date(),
});

const quizExpiredSchema = z.object({
  sessionId: z.string().uuid(),
  totalQuestions: z.number().int().positive(),
  answeredQuestions: z.number().int().nonnegative(),
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
          userId: data.ownerId as UserId,
          questionCount: data.questionIds.length,
          questionIds: data.questionIds as QuestionId[],
          configSnapshot: data.config,
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
          selectedOptionIds: data.selectedOptions as OptionId[],
          answeredAt: data.submittedAt,
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
          answeredCount: data.answeredQuestions,
          totalCount: data.totalQuestions,
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
 * Map single event row to domain event
 * Pure function for testing individual event mapping
 */
export function mapEventToQuizEvent(
  row: QuizSessionEventRow
): Result<DomainEvent<QuizSessionId, QuizEventPayloads>, Error> {
  const entry = MAPPERS[row.eventType];
  if (!entry) {
    return Result.fail(new Error(`Unknown event type: ${row.eventType}`));
  }

  const parsed = entry.schema.safeParse(row.payload);
  if (!parsed.success) {
    return Result.fail(new Error(`Invalid payload for event type ${row.eventType}`));
  }

  const domainEvent = entry.mapper(row, parsed.data);
  DomainEvent.setEventSequence(domainEvent, row.eventSequence);

  return Result.ok(domainEvent);
}

interface AnswerData {
  submittedAt?: string | Date;
  [key: string]: unknown;
}

interface QuizSnapshot {
  sessionId: string;
  ownerId: string;
  state: string;
  questionCount?: number;
  currentQuestionIndex?: number;
  startedAt?: Date;
  expiresAt?: Date;
  completedAt?: Date | null;
  version?: number;
  config?: unknown;
  questionOrder?: string[];
  answers?: Record<string, AnswerData> | null;
  updatedAt?: Date;
}

// Zod schema for QuizSnapshot validation
const answerDataSchema = z
  .object({
    submittedAt: z.union([z.string(), z.date()]).optional(),
  })
  .catchall(z.unknown());

const quizSnapshotSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  ownerId: z.string().min(1, 'ownerId is required'),
  state: z.enum(['IN_PROGRESS', 'COMPLETED', 'EXPIRED'], {
    errorMap: () => ({ message: 'Invalid state: must be IN_PROGRESS, COMPLETED, or EXPIRED' }),
  }),
  questionCount: z.number().int().nonnegative().optional(),
  currentQuestionIndex: z.number().int().nonnegative().optional(),
  startedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  completedAt: z.date().nullable().optional(),
  version: z.number().int().positive().optional(),
  config: z.unknown().optional(),
  questionOrder: z.array(z.string()).optional(),
  answers: z.record(z.string(), answerDataSchema).nullable().optional(),
  updatedAt: z.date().optional(),
});

/**
 * Validate quiz snapshot using zod schema for type safety and consistent validation
 */
function validateQuizSnapshot(snapshot: unknown): Result<QuizSnapshot, Error> {
  const parseResult = quizSnapshotSchema.safeParse(snapshot);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
    return Result.fail(new Error(`Invalid quiz state: ${errorMessages}`));
  }

  return Result.ok(parseResult.data);
}

/**
 * Check if a Date object is valid
 */
function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Check if a date is within reasonable range (2000 to 50 years in future)
 */
function isDateInReasonableRange(date: Date): boolean {
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();
  return dateYear >= 2000 && dateYear <= currentYear + 50;
}

/**
 * Safely parse a date value, handling invalid formats gracefully
 * @param dateValue - The date value to parse (string or Date)
 * @returns Valid Date object or undefined if parsing fails
 */
function safeParseDateValue(dateValue: string | Date | undefined): Date | undefined {
  if (!dateValue) {
    return undefined;
  }

  try {
    // If already a Date object, validate it
    if (dateValue instanceof Date) {
      return isValidDate(dateValue) ? dateValue : undefined;
    }

    // Parse string date value
    const parsedDate = new Date(dateValue);

    // Validate the parsed date
    if (!isValidDate(parsedDate) || !isDateInReasonableRange(parsedDate)) {
      return undefined;
    }

    return parsedDate;
  } catch {
    // Return undefined for any parsing errors
    return undefined;
  }
}

/**
 * Convert answers from stored format with safe date parsing
 */
function processAnswers(answers: Record<string, AnswerData> | null): Record<string, unknown> {
  if (!answers || typeof answers !== 'object') {
    return {};
  }

  const processedAnswers: Record<string, unknown> = {};

  for (const [questionId, answer] of Object.entries(answers)) {
    if (typeof answer === 'object' && answer !== null) {
      processedAnswers[questionId] = {
        ...answer,
        submittedAt: safeParseDateValue(answer.submittedAt),
      };
    }
  }

  return processedAnswers;
}

/**
 * Map quiz state snapshot to domain state
 * Pure function for testing state mapping
 */
export function mapRowToQuizState(
  snapshot: unknown
): Result<QuizSnapshot & { answers: Record<string, unknown> }, Error> {
  try {
    const validationResult = validateQuizSnapshot(snapshot);
    if (!validationResult.success) {
      return validationResult;
    }

    const data = validationResult.data;

    // Validate answers structure
    if (data.answers && typeof data.answers !== 'object') {
      return Result.fail(new Error('Invalid answers structure'));
    }

    const processedAnswers = processAnswers(data.answers ?? null);

    return Result.ok({
      ...data,
      answers: processedAnswers,
    } as QuizSnapshot & { answers: Record<string, unknown> });
  } catch (error) {
    return Result.fail(error instanceof Error ? error : new Error('Failed to map quiz state'));
  }
}

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
