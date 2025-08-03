import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { Question } from '../entities/Question';
import type { QuestionDifficulty } from '../value-objects/QuestionDifficulty';

/**
 * Pagination parameters for question listing
 */
export interface QuestionPagination {
  /** Number of items per page (max 100) */
  limit: number;
  /** Offset for pagination */
  offset: number;
}

/**
 * Filtering options for question catalog
 */
export interface QuestionFilters {
  /** Filter by exam types (e.g., 'CCNA', 'CCNP') */
  examTypes?: string[];
  /** Filter by categories */
  categories?: string[];
  /** Filter by difficulty level */
  difficulty?: QuestionDifficulty;
  /** Include premium content (requires premium role) */
  includePremium?: boolean;
  /** Full-text search query */
  searchQuery?: string;
  /** Filter by active status only */
  activeOnly?: boolean;
}

/**
 * Question summary for public listing (without answers)
 */
export interface QuestionSummary {
  questionId: QuestionId;
  questionText: string;
  questionType: 'multiple_choice' | 'multiple_select' | 'true_false';
  examTypes: string[];
  categories: string[];
  difficulty: string;
  isPremium: boolean;
  hasImages: boolean;
  optionCount: number;
  tags: string[];
  createdAt: Date;
}

/**
 * Paginated response for question listing
 */
export interface PaginatedQuestions {
  questions: QuestionSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
  };
}

/**
 * Question Repository interface for public catalog browsing
 *
 * Note: This is separate from quiz session management (IQuizRepository)
 * and focuses on the Question bounded context for catalog operations.
 */
export interface IQuestionRepository {
  /**
   * Find questions for public catalog with filtering and pagination
   *
   * @param filters - Filtering criteria
   * @param pagination - Pagination parameters
   * @returns Paginated list of question summaries
   *
   * @throws {ValidationError} Invalid pagination or filter parameters
   * @throws {RepositoryError} Database connection or query errors
   *
   * TODO: Implement with the following features:
   * - Efficient database queries with proper indexing
   * - Redis caching with TTL for performance
   * - Premium content filtering based on user role
   * - Full-text search using PostgreSQL tsvector
   * - Proper error handling and logging
   * - Performance monitoring to ensure < 200ms P95
   */
  findQuestions(
    filters: QuestionFilters,
    pagination: QuestionPagination
  ): Promise<PaginatedQuestions>;

  /**
   * Get question details by ID (for public preview)
   *
   * @param questionId - Question identifier
   * @param includePremium - Whether to include premium content
   * @returns Question summary or null if not found/accessible
   *
   * TODO: Implement with caching and premium access control
   */
  findQuestionById(
    questionId: QuestionId,
    includePremium?: boolean
  ): Promise<QuestionSummary | null>;

  /**
   * Get question statistics for catalog overview
   *
   * @returns Statistics about available questions
   *
   * TODO: Implement cached statistics with real-time updates
   */
  getQuestionStats(): Promise<{
    totalQuestions: number;
    questionsByExamType: Record<string, number>;
    questionsByDifficulty: Record<string, number>;
    premiumQuestions: number;
  }>;

  /**
   * Create a new question (admin only)
   *
   * @param question - The question entity to create
   * @returns The created question with generated ID
   *
   * @throws {ValidationError} Invalid question data
   * @throws {RepositoryError} Database operation error
   */
  createQuestion(question: Question): Promise<Question>;

  /**
   * Update an existing question (admin only)
   * Updates the question and increments version
   *
   * @param question - The question entity with updated data
   * @returns The updated question
   *
   * @throws {NotFoundError} Question not found
   * @throws {ValidationError} Invalid question data
   * @throws {RepositoryError} Database operation error
   */
  updateQuestion(question: Question): Promise<Question>;

  /**
   * Get full question details including answers (admin only)
   *
   * @param questionId - Question identifier
   * @returns Full question entity or null if not found
   *
   * @throws {RepositoryError} Database operation error
   */
  findQuestionWithDetails(questionId: QuestionId): Promise<Question | null>;

  /**
   * Admin statistics: Count total number of questions
   */
  countTotalQuestions(): Promise<number>;

  /**
   * Admin statistics: Count questions pending moderation
   */
  countPendingQuestions(): Promise<number>;
}
