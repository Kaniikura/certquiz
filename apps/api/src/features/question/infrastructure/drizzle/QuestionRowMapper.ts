import { QuestionId } from '@api/features/quiz/domain';
import type { QuestionRow, QuestionVersionRow } from '@api/infra/db/schema/question';
import { Result } from '@api/shared/result';
import { Question, QuestionStatus, type QuestionType } from '../../domain/entities/Question';
import type { QuestionSummary } from '../../domain/repositories/IQuestionRepository';

/**
 * Map entity question type to database question type
 */
export function mapQuestionTypeToDb(type: QuestionType): 'single' | 'multiple' {
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
export function mapQuestionTypeFromDb(
  type: 'single' | 'multiple',
  options?: unknown
): QuestionType {
  // Multiple select is straightforward
  if (type === 'multiple') {
    return 'multiple_select';
  }

  // For single answer questions, check if it's a true/false question
  if (options && isTrueFalseQuestion(options)) {
    return 'true_false';
  }

  // Default to multiple choice for other single answer questions
  return 'multiple_choice';
}

/**
 * Determine if a question is a true/false question based on its options
 * @param options The question options from the database
 */
export function isTrueFalseQuestion(options: unknown): boolean {
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
export function mapQuestionStatusToDb(
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
export function mapQuestionStatusFromDb(
  status: 'draft' | 'active' | 'inactive' | 'archived'
): QuestionStatus {
  return status as QuestionStatus;
}

/**
 * Map database rows to Question entity
 * Pure function testable without database dependencies
 */
export function mapRowToQuestion(
  masterRow: QuestionRow,
  versionRow: QuestionVersionRow
): Result<Question, Error> {
  try {
    const questionResult = Question.fromJSON({
      id: masterRow.questionId,
      version: masterRow.currentVersion,
      questionText: versionRow.questionText,
      questionType: mapQuestionTypeFromDb(
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
      status: mapQuestionStatusFromDb(
        masterRow.status as 'draft' | 'active' | 'inactive' | 'archived'
      ),
      createdById: masterRow.createdById,
      createdAt: masterRow.createdAt.toISOString(),
      updatedAt: masterRow.updatedAt.toISOString(),
    });

    return questionResult;
  } catch (error) {
    return Result.fail(error instanceof Error ? error : new Error('Question mapping failed'));
  }
}

/**
 * Map to question summary (without answers)
 * Pure function testable without database dependencies
 */
export function mapToQuestionSummary(
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
    // Malformed data but don't fail the summary
    optionCount = 0;
  }

  return {
    questionId: QuestionId.of(masterRow.questionId),
    questionText: versionRow.questionText,
    questionType: mapQuestionTypeFromDb(
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
