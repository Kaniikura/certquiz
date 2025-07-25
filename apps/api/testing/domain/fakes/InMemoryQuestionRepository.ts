/**
 * In-Memory Question Repository for Testing
 * @fileoverview In-memory question repository that doesn't require database
 */

import type {
  IQuestionRepository,
  PaginatedQuestions,
  Question,
  QuestionFilters,
  QuestionPagination,
  QuestionSummary,
} from '@api/features/question/domain';
import { QuestionStatus } from '@api/features/question/domain';
import { QuestionNotFoundError } from '@api/features/question/shared/errors';
import type { QuestionId } from '@api/features/quiz/domain';

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
