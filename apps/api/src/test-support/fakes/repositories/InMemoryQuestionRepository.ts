import { Question, QuestionStatus } from '@api/features/question/domain/entities/Question';
import type {
  IQuestionRepository,
  ModerationParams,
  PaginatedQuestions,
  PaginatedResult,
  QuestionFilters,
  QuestionPagination,
  QuestionSummary,
  QuestionWithModerationInfo,
} from '@api/features/question/domain/repositories/IQuestionRepository';
import {
  InvalidQuestionDataError,
  QuestionNotFoundError,
} from '@api/features/question/shared/errors';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';

/**
 * In-memory question repository for testing
 * Provides full IQuestionRepository interface without database dependency
 */
export class InMemoryQuestionRepository implements IQuestionRepository {
  private questions = new Map<string, Question>();

  async findQuestions(
    filters: QuestionFilters,
    pagination: QuestionPagination
  ): Promise<PaginatedQuestions> {
    let filteredQuestions = Array.from(this.questions.values());

    // Apply filters
    if (filters.examTypes?.length) {
      filteredQuestions = filteredQuestions.filter((q) =>
        q.examTypes.some((et) => filters.examTypes?.includes(et))
      );
    }

    if (filters.categories?.length) {
      filteredQuestions = filteredQuestions.filter((q) =>
        q.categories.some((c) => filters.categories?.includes(c))
      );
    }

    if (filters.difficulty) {
      filteredQuestions = filteredQuestions.filter((q) => q.difficulty === filters.difficulty);
    }

    if (!filters.includePremium) {
      filteredQuestions = filteredQuestions.filter((q) => !q.isPremium);
    }

    if (filters.activeOnly) {
      filteredQuestions = filteredQuestions.filter((q) => q.status === QuestionStatus.ACTIVE);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredQuestions = filteredQuestions.filter((q) =>
        q.questionText.toLowerCase().includes(query)
      );
    }

    // Apply pagination
    const total = filteredQuestions.length;
    const start = pagination.offset;
    const end = start + pagination.limit;
    const paginatedQuestions = filteredQuestions.slice(start, end);

    // Convert to summaries
    const summaries: QuestionSummary[] = paginatedQuestions.map((q) => ({
      questionId: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      examTypes: q.examTypes,
      categories: q.categories,
      difficulty: q.difficulty,
      isPremium: q.isPremium,
      hasImages: q.images?.length > 0,
      optionCount: q.options.count,
      tags: q.tags,
      createdAt: q.createdAt,
    }));

    return {
      questions: summaries,
      pagination: {
        total,
        limit: pagination.limit,
        offset: pagination.offset,
        hasNext: end < total,
      },
    };
  }

  async findQuestionById(
    questionId: QuestionId,
    includePremium?: boolean
  ): Promise<QuestionSummary | null> {
    const question = this.questions.get(questionId);
    if (!question) {
      return null;
    }

    if (question.isPremium && !includePremium) {
      return null;
    }

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      examTypes: question.examTypes,
      categories: question.categories,
      difficulty: question.difficulty,
      isPremium: question.isPremium,
      hasImages: question.images?.length > 0,
      optionCount: question.options.count,
      tags: question.tags,
      createdAt: question.createdAt,
    };
  }

  async getQuestionStats(): Promise<{
    totalQuestions: number;
    questionsByExamType: Record<string, number>;
    questionsByDifficulty: Record<string, number>;
    premiumQuestions: number;
  }> {
    const questions = Array.from(this.questions.values());
    const questionsByExamType: Record<string, number> = {};
    const questionsByDifficulty: Record<string, number> = {};
    let premiumQuestions = 0;

    for (const question of questions) {
      // Count by exam type
      for (const examType of question.examTypes) {
        questionsByExamType[examType] = (questionsByExamType[examType] || 0) + 1;
      }

      // Count by difficulty
      questionsByDifficulty[question.difficulty] =
        (questionsByDifficulty[question.difficulty] || 0) + 1;

      // Count premium
      if (question.isPremium) {
        premiumQuestions++;
      }
    }

    return {
      totalQuestions: questions.length,
      questionsByExamType,
      questionsByDifficulty,
      premiumQuestions,
    };
  }

  async createQuestion(question: Question): Promise<Question> {
    this.questions.set(question.id, question);
    return question;
  }

  async updateQuestion(question: Question): Promise<Question> {
    const existing = this.questions.get(question.id);
    if (!existing) {
      throw new QuestionNotFoundError(question.id);
    }
    this.questions.set(question.id, question);
    return question;
  }

  async findQuestionWithDetails(questionId: QuestionId): Promise<Question | null> {
    return this.questions.get(questionId) || null;
  }

  countTotalQuestions(): Promise<number> {
    return Promise.resolve(this.questions.size);
  }

  countPendingQuestions(): Promise<number> {
    const questions = Array.from(this.questions.values());
    return Promise.resolve(questions.filter((q) => q.status === QuestionStatus.DRAFT).length);
  }

  async updateStatus(
    questionId: QuestionId,
    status: QuestionStatus,
    _moderatedBy: string,
    feedback?: string
  ): Promise<void> {
    const question = this.questions.get(questionId);
    if (!question) {
      throw new QuestionNotFoundError(`Question with ID ${questionId} not found`);
    }

    // Business rule: Only DRAFT questions can be moderated
    if (question.status !== QuestionStatus.DRAFT) {
      throw new InvalidQuestionDataError(
        `Cannot moderate question with status ${question.status}. Only DRAFT questions can be moderated.`
      );
    }

    // Business rule: Rejection requires feedback
    if (status === QuestionStatus.ARCHIVED && (!feedback || feedback.trim().length < 10)) {
      throw new InvalidQuestionDataError(
        'Feedback is required for question rejection and must be at least 10 characters long'
      );
    }

    // Update the question status by creating a new instance (immutable update)
    // In a real implementation, this would use the Question entity's status update methods
    const updatedQuestion = Question.create({
      id: question.id,
      version: question.version + 1,
      questionText: question.questionText,
      questionType: question.questionType,
      explanation: question.explanation,
      detailedExplanation: question.detailedExplanation,
      options: question.options,
      examTypes: question.examTypes,
      categories: question.categories,
      difficulty: question.difficulty,
      tags: question.tags,
      images: question.images,
      isPremium: question.isPremium,
      status,
      createdById: question.createdById,
      createdAt: question.createdAt,
      updatedAt: new Date(),
    });

    if (updatedQuestion.success) {
      this.questions.set(questionId, updatedQuestion.data);
    } else {
      throw updatedQuestion.error;
    }
  }

  async findQuestionsForModeration(
    params: ModerationParams
  ): Promise<PaginatedResult<QuestionWithModerationInfo>> {
    let filteredQuestions = Array.from(this.questions.values());

    // Apply status filter (default to DRAFT if not specified)
    if (params.status) {
      filteredQuestions = filteredQuestions.filter((q) => q.status === params.status);
    } else {
      filteredQuestions = filteredQuestions.filter((q) => q.status === QuestionStatus.DRAFT);
    }

    // Apply date filters
    if (params.dateFrom) {
      const dateFrom = params.dateFrom;
      filteredQuestions = filteredQuestions.filter((q) => q.createdAt >= dateFrom);
    }

    if (params.dateTo) {
      const dateTo = params.dateTo;
      filteredQuestions = filteredQuestions.filter((q) => q.createdAt <= dateTo);
    }

    // Apply exam type filter
    if (params.examType) {
      const examType = params.examType;
      filteredQuestions = filteredQuestions.filter((q) => q.examTypes.includes(examType));
    }

    // Apply difficulty filter
    if (params.difficulty) {
      filteredQuestions = filteredQuestions.filter((q) => q.difficulty === params.difficulty);
    }

    // Apply sorting
    const orderBy = params.orderBy || 'createdAt';
    const orderDir = params.orderDir || 'desc';

    filteredQuestions.sort((a, b) => {
      const dateA = orderBy === 'createdAt' ? a.createdAt : a.updatedAt;
      const dateB = orderBy === 'createdAt' ? b.createdAt : b.updatedAt;

      const comparison = dateA.getTime() - dateB.getTime();
      return orderDir === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const totalCount = filteredQuestions.length;
    const offset = (params.page - 1) * params.pageSize;
    const paginatedQuestions = filteredQuestions.slice(offset, offset + params.pageSize);

    // Map to QuestionWithModerationInfo
    const items: QuestionWithModerationInfo[] = paginatedQuestions.map((question) => {
      const now = new Date();
      const daysPending = Math.ceil(
        (now.getTime() - question.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        questionId: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        examTypes: question.examTypes,
        categories: question.categories,
        difficulty: question.difficulty,
        status: question.status,
        isPremium: question.isPremium,
        tags: question.tags,
        createdById: question.createdById,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        daysPending,
      };
    });

    return {
      items,
      total: totalCount,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  // Test helper methods

  /**
   * Add a question to the fake repository (test helper)
   */
  addQuestion(question: Question): void {
    this.questions.set(question.id, question);
  }

  /**
   * Clear all questions from the fake repository (test helper)
   */
  clear(): void {
    this.questions.clear();
  }

  /**
   * Get all questions (test helper)
   */
  getAllQuestions(): Question[] {
    return Array.from(this.questions.values());
  }

  /**
   * Get question count (test helper)
   */
  getQuestionCount(): number {
    return this.questions.size;
  }
}
