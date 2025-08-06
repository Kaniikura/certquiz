import { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { beforeEach, describe, expect, it } from 'vitest';
import { Question, QuestionStatus } from '../../domain/entities/Question';
import type {
  QuestionFilters,
  QuestionPagination,
} from '../../domain/repositories/IQuestionRepository';
import { QuestionOption } from '../../domain/value-objects/QuestionOption';
import { QuestionOptions } from '../../domain/value-objects/QuestionOptions';
import {
  InvalidQuestionDataError,
  QuestionNotFoundError,
  QuestionRepositoryConfigurationError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from '../../shared/errors';
import { DrizzleQuestionRepository } from './DrizzleQuestionRepository';

// Mock types for testing
interface MockQuestionRow {
  questionId: string;
  currentVersion: number;
  createdById: string;
  isPremium: boolean;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

interface MockQuestionVersionRow {
  questionId: string;
  version: number;
  questionText: string;
  questionType: 'single' | 'multiple';
  explanation: string;
  detailedExplanation: string | null;
  options: unknown[];
  examTypes: string[];
  categories: string[];
  difficulty: string;
  tags: string[];
  images: string[];
  createdAt: Date;
}

interface MockJoinedQuestionRow extends MockQuestionRow {
  // Version fields from join (with master prefix for disambiguation)
  master: MockQuestionRow;
  version: MockQuestionVersionRow;
}

// Mock logger implementation
class MockLogger implements LoggerPort {
  public debugMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public infoMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public warnMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public errorMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.debugMessages.push({ message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.infoMessages.push({ message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.warnMessages.push({ message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.errorMessages.push({ message, meta });
  }
}

// Type alias for test repository
type TestRepository = DrizzleQuestionRepository;

// Mock database connection with sophisticated context-aware operations
// Uses type assertions for test mocking while maintaining business logic type safety
class MockDatabaseConnection {
  private questions: MockQuestionRow[] = [];
  private questionVersions: MockQuestionVersionRow[] = [];
  private insertShouldFail = false;
  private insertFailureError: Error | null = null;
  private selectShouldFail = false;
  private selectFailureError: Error | null = null;
  private updateShouldFail = false;
  private updateFailureError: Error | null = null;
  private currentQueryContext: {
    type?: 'findById' | 'findWithDetails' | 'findQuestions' | 'getStats' | 'select' | 'count';
    questionId?: string;
    includePremium?: boolean;
    filters?: QuestionFilters;
    pagination?: QuestionPagination;
    operation?: string;
  } = {};
  private queryCallStack: Array<{ method: string; args: unknown[] }> = [];
  private statsQueryCount = 0;

  // Track calls for testing
  public insertCalls: Array<{ table: string; values: unknown }> = [];
  public updateCalls: Array<{ table: string; data: unknown; where: unknown }> = [];
  public transactionCalls: Array<{ fn: unknown }> = [];

  // Mock select operations with context-aware filtering
  select(fields?: unknown) {
    if (this.selectShouldFail && this.selectFailureError) {
      throw this.selectFailureError;
    }

    // Track query for analysis
    this.queryCallStack.push({ method: 'select', args: [fields] });

    // Determine query type
    const queryType = this.determineQueryType(fields);

    // Delegate to appropriate builder based on query type
    return this.createQueryBuilder(queryType);
  }

  private determineQueryType(
    fields: unknown
  ): 'stats' | 'count' | 'examType' | 'difficulty' | 'default' {
    if (this.isExamTypeAggregationQuery(fields)) return 'examType';
    if (this.isDifficultyAggregationQuery(fields)) return 'difficulty';
    if (this.isStatsQuery(fields)) return 'stats';
    if (this.isCountQuery(fields)) return 'count';
    return 'default';
  }

  private createQueryBuilder(queryType: string) {
    return {
      from: (table: unknown) => {
        if (!this.isQuestionTable(table)) {
          return this.createEmptyQueryResult();
        }
        return this.createQuestionQueryResult(queryType);
      },
    };
  }

  private createEmptyQueryResult() {
    return {
      where: () => ({
        limit: () => [],
        innerJoin: () => ({ where: () => ({ limit: () => [] }) }),
      }),
    };
  }

  private createQuestionQueryResult(queryType: string) {
    return {
      innerJoin: (_versionTable: unknown, _condition: unknown) => ({
        where: (_condition: unknown) => this.handleInnerJoinWhere(queryType),
      }),
      where: (condition: unknown) => this.handleDirectWhere(queryType, condition),
    };
  }

  private handleInnerJoinWhere(queryType: string) {
    switch (queryType) {
      case 'examType':
        return this.handleExamTypeAggregationQuery();
      case 'difficulty':
        return this.handleDifficultyAggregationQuery();
      case 'stats':
        return this.handleStatsQuery();
      case 'count':
        return this.handleCountQuery();
      default:
        return this.handleDefaultJoinQuery();
    }
  }

  private handleDirectWhere(queryType: string, condition: unknown) {
    // Track where conditions for analysis
    this.queryCallStack.push({ method: 'where', args: [condition] });

    switch (queryType) {
      case 'count':
        return this.handleDirectCountQuery(condition);
      case 'examType':
      case 'difficulty':
        return this.handleDirectAggregationQuery(
          queryType === 'examType',
          queryType === 'difficulty'
        );
      default:
        return this.handleDirectDefaultQuery();
    }
  }

  // Mock insert operations
  insert(table: unknown) {
    const tableName = this.getTableName(table);

    return {
      values: (data: unknown) => {
        if (this.insertShouldFail && this.insertFailureError) {
          throw this.insertFailureError;
        }

        // Track the insert call
        this.insertCalls.push({ table: tableName, values: data });

        if (this.isQuestionTable(table)) {
          const questionRow = data as MockQuestionRow;
          this.questions.push(questionRow);
        } else if (this.isQuestionVersionTable(table)) {
          const versionRow = data as MockQuestionVersionRow;
          this.questionVersions.push(versionRow);
        }

        return Promise.resolve();
      },
    };
  }

  // Mock update operations
  update(table: unknown) {
    const tableName = this.getTableName(table);

    return {
      set: (data: unknown) => ({
        where: (condition: unknown) => {
          if (this.updateShouldFail && this.updateFailureError) {
            throw this.updateFailureError;
          }

          // Track the update call
          this.updateCalls.push({ table: tableName, data, where: condition });

          if (this.isQuestionTable(table)) {
            const updateData = data as Partial<MockQuestionRow>;
            const questionIndex = this.questions.findIndex(
              (q) => q.questionId === this.currentQueryContext.questionId
            );
            if (questionIndex >= 0) {
              this.questions[questionIndex] = { ...this.questions[questionIndex], ...updateData };
            }
          }

          return Promise.resolve();
        },
      }),
    };
  }

  // Mock transaction support
  transaction<T>(fn: (tx: MockDatabaseConnection) => Promise<T>): Promise<T> {
    // Track the transaction call
    this.transactionCalls.push({ fn });

    const tx = new MockDatabaseConnection();
    tx.questions = [...this.questions];
    tx.questionVersions = [...this.questionVersions];
    tx.insertShouldFail = this.insertShouldFail;
    tx.insertFailureError = this.insertFailureError;
    tx.updateShouldFail = this.updateShouldFail;
    tx.updateFailureError = this.updateFailureError;
    tx.currentQueryContext = { ...this.currentQueryContext };
    tx.insertCalls = this.insertCalls;
    tx.updateCalls = this.updateCalls;

    return fn(tx);
  }

  // Mock Queryable methods to satisfy interface
  delete(_table: unknown): { where: () => Promise<void> } {
    return { where: () => Promise.resolve() };
  }

  execute(_query: unknown): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  query(_query: unknown, _params?: unknown[]): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  // Helper methods for testing
  addQuestion(question: MockQuestionRow): void {
    this.questions.push(question);
  }

  addQuestionVersion(version: MockQuestionVersionRow): void {
    this.questionVersions.push(version);
  }

  addCompleteQuestion(questionData: MockQuestionRow, versionData: MockQuestionVersionRow): void {
    this.questions.push(questionData);
    this.questionVersions.push(versionData);
  }

  clearAll(): void {
    this.questions = [];
    this.questionVersions = [];
  }

  simulateInsertFailure(error: Error): void {
    this.insertShouldFail = true;
    this.insertFailureError = error;
  }

  simulateSelectFailure(error: Error): void {
    this.selectShouldFail = true;
    this.selectFailureError = error;
  }

  simulateUpdateFailure(error: Error): void {
    this.updateShouldFail = true;
    this.updateFailureError = error;
  }

  resetFailures(): void {
    this.insertShouldFail = false;
    this.insertFailureError = null;
    this.selectShouldFail = false;
    this.selectFailureError = null;
    this.updateShouldFail = false;
    this.updateFailureError = null;
  }

  // Methods to set query context for different scenarios
  setFindByIdContext(questionId: string, includePremium = false): void {
    this.currentQueryContext = { type: 'findById', questionId, includePremium };
  }

  setFindWithDetailsContext(questionId: string): void {
    this.currentQueryContext = { type: 'findWithDetails', questionId };
  }

  setFindQuestionsContext(filters: QuestionFilters, pagination: QuestionPagination): void {
    this.currentQueryContext = { type: 'findQuestions', filters, pagination };
  }

  setGetStatsContext(operation?: string): void {
    this.currentQueryContext = { type: 'getStats', operation };
  }

  setSelectContext(questionId?: string, operation?: string): void {
    this.currentQueryContext = { type: 'select', questionId, operation };
  }

  clearQueryContext(): void {
    this.currentQueryContext = {};
    this.queryCallStack = [];
    this.statsQueryCount = 0;
  }

  // Extracted methods to reduce complexity in the where() handler
  private handleExamTypeAggregationQuery() {
    return {
      groupBy: (_groupByField: unknown) => {
        return this.getExamTypeAggregationResults();
      },
    };
  }

  private handleDifficultyAggregationQuery() {
    return {
      groupBy: (_groupByField: unknown) => {
        return this.getDifficultyAggregationResults();
      },
    };
  }

  private handleStatsQuery() {
    return this.getStatsVersionRows();
  }

  private handleCountQuery() {
    return this.getFilteredCountResults();
  }

  private handleDefaultJoinQuery() {
    return {
      limit: (n: number) => {
        return this.getJoinQueryResults().slice(0, n);
      },
      orderBy: (_field: unknown) => ({
        limit: (n: number) => ({
          offset: (offset: number) => {
            return this.getJoinQueryResults().slice(offset, offset + n);
          },
        }),
      }),
      groupBy: (_groupByField: unknown) => {
        // Handle groupBy for aggregation queries that weren't caught earlier
        // Note: This shouldn't normally happen as aggregation queries
        // should be caught by the earlier conditions
        return [];
      },
    };
  }

  // Methods for direct where queries (not through innerJoin)
  private handleDirectCountQuery(condition: unknown) {
    return this.getStatsCountResults(condition);
  }

  private handleDirectAggregationQuery(isExamType: boolean, isDifficulty: boolean) {
    return {
      groupBy: (_groupByField: unknown) => {
        if (isExamType) {
          return this.getExamTypeAggregationResults();
        }
        if (isDifficulty) {
          return this.getDifficultyAggregationResults();
        }
        return [];
      },
    };
  }

  private handleDirectDefaultQuery() {
    return {
      limit: (n: number) => {
        if (this.currentQueryContext.type === 'getStats') {
          return this.getStatsResults();
        }
        return this.getQuestionResults().slice(0, n);
      },
    };
  }

  private getJoinQueryResults(): MockJoinedQuestionRow[] {
    return this.questions
      .map((question) => this.createJoinedRowIfValid(question))
      .filter((row): row is MockJoinedQuestionRow => row !== null);
  }

  private createJoinedRowIfValid(question: MockQuestionRow): MockJoinedQuestionRow | null {
    const version = this.findQuestionVersion(question);
    if (!version) return null;

    const joinedRow: MockJoinedQuestionRow = {
      ...question,
      master: question,
      version,
    };

    return this.applyQueryFilters(question, version, joinedRow);
  }

  private findQuestionVersion(question: MockQuestionRow): MockQuestionVersionRow | undefined {
    return this.questionVersions.find(
      (v) =>
        v.questionId === question.questionId &&
        (this.currentQueryContext.operation === 'update'
          ? true // For updates, we need the current version for version checking
          : v.version === question.currentVersion)
    );
  }

  private applyQueryFilters(
    question: MockQuestionRow,
    version: MockQuestionVersionRow,
    joinedRow: MockJoinedQuestionRow
  ): MockJoinedQuestionRow | null {
    switch (this.currentQueryContext.type) {
      case 'findById':
      case 'findWithDetails':
        return this.applyIdBasedFilters(question, joinedRow);
      case 'findQuestions':
        return this.applySearchFilters(question, version, joinedRow);
      default:
        return joinedRow;
    }
  }

  private applyIdBasedFilters(
    question: MockQuestionRow,
    joinedRow: MockJoinedQuestionRow
  ): MockJoinedQuestionRow | null {
    if (question.questionId !== this.currentQueryContext.questionId) return null;

    // Apply premium filtering for findById
    if (
      this.currentQueryContext.type === 'findById' &&
      !this.currentQueryContext.includePremium &&
      question.isPremium
    ) {
      return null;
    }
    return joinedRow;
  }

  private applySearchFilters(
    question: MockQuestionRow,
    version: MockQuestionVersionRow,
    joinedRow: MockJoinedQuestionRow
  ): MockJoinedQuestionRow | null {
    if (!this.currentQueryContext.filters) return joinedRow;

    const filters = this.currentQueryContext.filters;

    if (!this.passesBasicFilters(question, filters)) return null;
    if (!this.passesAdvancedFilters(version, filters)) return null;

    return joinedRow;
  }

  private passesBasicFilters(question: MockQuestionRow, filters: QuestionFilters): boolean {
    // Active only filter
    if (filters.activeOnly && question.status !== 'active') return false;

    // Premium filter
    if (!filters.includePremium && question.isPremium) return false;

    return true;
  }

  private passesAdvancedFilters(
    version: MockQuestionVersionRow,
    filters: QuestionFilters
  ): boolean {
    // Exam types filter
    if (
      filters.examTypes &&
      filters.examTypes.length > 0 &&
      !filters.examTypes.some((type: string) => version.examTypes.includes(type))
    ) {
      return false;
    }

    // Categories filter
    if (
      filters.categories &&
      filters.categories.length > 0 &&
      !filters.categories.some((cat: string) => version.categories.includes(cat))
    ) {
      return false;
    }

    // Difficulty filter
    if (filters.difficulty && version.difficulty !== filters.difficulty) return false;

    // Search query filter
    if (
      filters.searchQuery &&
      !version.questionText.toLowerCase().includes(filters.searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  }

  private getQuestionResults(): MockQuestionRow[] {
    if (this.currentQueryContext.type === 'select' && this.currentQueryContext.questionId) {
      return this.questions.filter((q) => q.questionId === this.currentQueryContext.questionId);
    }
    return this.questions;
  }

  private getStatsResults(): Array<{ count: number }> {
    if (this.currentQueryContext.type === 'getStats') {
      const activeQuestions = this.questions.filter((q) => q.status === 'active');
      return [{ count: activeQuestions.length }];
    }
    return [{ count: this.questions.length }];
  }

  private getStatsVersionRows(): Array<{ examTypes: string[]; difficulty: string }> {
    const activeQuestions = this.questions.filter((q) => q.status === 'active');
    return activeQuestions.map((question) => {
      const version = this.questionVersions.find(
        (v) => v.questionId === question.questionId && v.version === question.currentVersion
      );
      return {
        examTypes: version?.examTypes || [],
        difficulty: version?.difficulty || 'Beginner',
      };
    });
  }

  private getFilteredCountResults(): Array<{ count: number }> {
    // Apply the same filtering logic as getJoinQueryResults but return count
    const filtered = this.getJoinQueryResults();
    return [{ count: filtered.length }];
  }

  private getStatsCountResults(whereCondition?: unknown): Array<{ count: number }> {
    const activeQuestions = this.questions.filter((q) => q.status === 'active');

    // When getQuestionStats is called, it makes two separate count queries:
    // 1. First query: counts all active questions (simple WHERE condition)
    // 2. Second query: counts active AND premium questions (complex WHERE with AND)

    // Track which query this is when in stats context
    if (this.currentQueryContext.type === 'getStats') {
      this.statsQueryCount++;

      // First query is always the total count (simple condition)
      // Second query is the premium count (complex condition with AND)
      if (this.statsQueryCount === 2) {
        const premiumQuestions = activeQuestions.filter((q) => q.isPremium);
        return [{ count: premiumQuestions.length }];
      }
    } else {
      // For non-stats queries, use condition analysis
      const isPremiumQuery =
        this.hasMultipleWhereConditions(whereCondition) ||
        this.containsPremiumCondition(whereCondition);

      if (isPremiumQuery) {
        const premiumQuestions = activeQuestions.filter((q) => q.isPremium);
        return [{ count: premiumQuestions.length }];
      }
    }

    // Default: return total active questions count
    return [{ count: activeQuestions.length }];
  }

  private getExamTypeAggregationResults(): Array<{ examType: string; count: number }> {
    const activeQuestions = this.questions.filter((q) => q.status === 'active');
    const examTypeCounts: Record<string, number> = {};

    for (const question of activeQuestions) {
      const version = this.questionVersions.find(
        (v) => v.questionId === question.questionId && v.version === question.currentVersion
      );
      if (version) {
        for (const examType of version.examTypes) {
          examTypeCounts[examType] = (examTypeCounts[examType] || 0) + 1;
        }
      }
    }

    return Object.entries(examTypeCounts).map(([examType, count]) => ({ examType, count }));
  }

  private getDifficultyAggregationResults(): Array<{ difficulty: string; count: number }> {
    const activeQuestions = this.questions.filter((q) => q.status === 'active');
    const difficultyCounts: Record<string, number> = {};

    for (const question of activeQuestions) {
      const version = this.questionVersions.find(
        (v) => v.questionId === question.questionId && v.version === question.currentVersion
      );
      if (version) {
        difficultyCounts[version.difficulty] = (difficultyCounts[version.difficulty] || 0) + 1;
      }
    }

    return Object.entries(difficultyCounts).map(([difficulty, count]) => ({ difficulty, count }));
  }

  private hasMultipleWhereConditions(condition: unknown): boolean {
    // In a real WHERE with AND conditions, there would be multiple conditions
    // Check if this is an AND condition with multiple parts
    if (typeof condition === 'object' && condition !== null) {
      // Simple heuristic: if the condition has nested structure, it's likely an AND
      const keys = Object.keys(condition as Record<string, unknown>);
      return keys.length > 1 || keys.some((key) => key.toLowerCase() === 'and');
    }
    return false;
  }

  private containsPremiumCondition(condition: unknown): boolean {
    // Recursively check if the condition references isPremium field
    if (typeof condition !== 'object' || condition === null) {
      return false;
    }

    // Check if any property name contains 'isPremium'
    for (const [key, value] of Object.entries(condition as Record<string, unknown>)) {
      if (key.includes('isPremium')) {
        return true;
      }
      // Check nested objects recursively, but avoid circular references
      if (typeof value === 'object' && value !== null && !this.isCircularReference(value)) {
        if (this.containsPremiumCondition(value)) {
          return true;
        }
      }
    }
    return false;
  }

  private isCircularReference(obj: unknown): boolean {
    // Simple check to avoid circular references in Drizzle objects
    if (typeof obj !== 'object' || obj === null) return false;
    const objWithConstructor = obj as { constructor?: { name?: string } };
    const constructorName = objWithConstructor.constructor?.name;
    // Skip known Drizzle ORM objects that have circular references
    return (
      constructorName === 'PgTable' ||
      constructorName === 'PgUUID' ||
      constructorName === 'PgColumn' ||
      constructorName === 'PgEnum'
    );
  }

  private isStatsQuery(fields: unknown): boolean {
    if (typeof fields !== 'object' || fields === null) return false;
    const keys = Object.keys(fields as Record<string, unknown>);
    return keys.includes('examTypes') && keys.includes('difficulty');
  }

  private isCountQuery(fields: unknown): boolean {
    if (typeof fields !== 'object' || fields === null) return false;
    const fieldsObj = fields as Record<string, unknown>;
    const keys = Object.keys(fieldsObj);

    // A simple count query has exactly one field named 'count'
    // Aggregation queries have additional fields like 'examType' or 'difficulty'
    return keys.length === 1 && keys.includes('count');
  }

  private isExamTypeAggregationQuery(fields: unknown): boolean {
    if (typeof fields !== 'object' || fields === null) return false;
    const fieldsObj = fields as Record<string, unknown>;

    // Check if this is an aggregation query for exam types
    // Look for a field with fieldAlias 'exam_type' and another with fieldAlias 'count'
    const hasExamType = Object.values(fieldsObj).some((field) => {
      if (field && typeof field === 'object' && 'fieldAlias' in field) {
        return field.fieldAlias === 'exam_type';
      }
      return false;
    });

    const hasCount = Object.values(fieldsObj).some((field) => {
      if (field && typeof field === 'object' && 'fieldAlias' in field) {
        return field.fieldAlias === 'count';
      }
      return false;
    });

    return hasExamType && hasCount;
  }

  private isDifficultyAggregationQuery(fields: unknown): boolean {
    if (typeof fields !== 'object' || fields === null) return false;
    const fieldsObj = fields as Record<string, unknown>;
    const keys = Object.keys(fieldsObj);

    // Check if this looks like a difficulty aggregation query
    // It should have exactly 2 fields and include 'difficulty' and 'count'
    return keys.length === 2 && keys.includes('difficulty') && keys.includes('count');
  }

  private isQuestionTable(table: unknown): boolean {
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    return (
      keys.includes('questionId') && keys.includes('currentVersion') && keys.includes('status')
    );
  }

  private isQuestionVersionTable(table: unknown): boolean {
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    return (
      keys.includes('questionId') &&
      keys.includes('version') &&
      keys.includes('questionText') &&
      keys.includes('questionType')
    );
  }

  private isModerationLogsTable(table: unknown): boolean {
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    return (
      keys.includes('id') &&
      keys.includes('questionId') &&
      keys.includes('action') &&
      keys.includes('moderatedBy') &&
      keys.includes('moderatedAt')
    );
  }

  private getTableName(table: unknown): string {
    if (this.isQuestionTable(table)) {
      return 'question';
    }
    if (this.isQuestionVersionTable(table)) {
      return 'questionVersion';
    }
    if (this.isModerationLogsTable(table)) {
      return 'moderationLogs';
    }
    return 'unknown';
  }
}

describe('DrizzleQuestionRepository (Unit Tests)', () => {
  let mockConn: MockDatabaseConnection;
  let mockLogger: MockLogger;
  let repository: TestRepository;

  // Helper to create test question options
  function createTestOptions() {
    const option1Result = QuestionOption.create({
      id: '550e8400-e29b-41d4-a716-446655440001',
      text: 'Option A',
      isCorrect: true,
    });
    const option2Result = QuestionOption.create({
      id: '550e8400-e29b-41d4-a716-446655440002',
      text: 'Option B',
      isCorrect: false,
    });

    if (!option1Result.success || !option2Result.success) {
      throw new Error('Failed to create test options');
    }

    const optionsResult = QuestionOptions.create([option1Result.data, option2Result.data]);
    if (!optionsResult.success) {
      throw new Error('Failed to create test options collection');
    }

    return optionsResult.data;
  }

  // Helper to create test question
  function createTestQuestion(overrides: Partial<Parameters<typeof Question.create>[0]> = {}) {
    const options = createTestOptions();

    const questionResult = Question.create({
      id: QuestionId.of('test-question-1'),
      version: 1,
      questionText: 'What is networking?',
      questionType: 'multiple_choice',
      explanation: 'Basic networking concept',
      detailedExplanation: 'Detailed explanation here',
      options,
      examTypes: ['CCNA'],
      categories: ['Networking'],
      difficulty: 'Beginner',
      tags: ['network', 'basic'],
      images: [],
      isPremium: false,
      status: QuestionStatus.ACTIVE,
      createdById: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: new Date('2025-01-01T12:00:00Z'),
      updatedAt: new Date('2025-01-01T12:00:00Z'),
      ...overrides,
    });

    if (!questionResult.success) {
      throw new Error(`Failed to create test question: ${questionResult.error.message}`);
    }

    return questionResult.data;
  }

  beforeEach(() => {
    mockConn = new MockDatabaseConnection();
    mockLogger = new MockLogger();
    repository = new DrizzleQuestionRepository(
      mockConn as unknown as TransactionContext,
      mockLogger
    );
    mockConn.clearQueryContext();
  });

  describe('constructor', () => {
    it('should throw error when database connection lacks transaction support', () => {
      const nonTransactionalConn = {
        select: mockConn.select.bind(mockConn),
        insert: mockConn.insert.bind(mockConn),
        update: mockConn.update.bind(mockConn),
        // No transaction method
      };

      expect(
        () =>
          new DrizzleQuestionRepository(
            nonTransactionalConn as unknown as TransactionContext,
            mockLogger
          )
      ).toThrow(QuestionRepositoryConfigurationError);
    });

    it('should validate transaction support on initialization', () => {
      expect(
        () => new DrizzleQuestionRepository(mockConn as unknown as TransactionContext, mockLogger)
      ).not.toThrow();
    });
  });

  describe('createQuestion', () => {
    it('should create question successfully with master and version records', async () => {
      const question = createTestQuestion();

      const result = await repository.createQuestion(question);

      expect(result).toBe(question);
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Creating new question',
          meta: expect.objectContaining({
            questionId: question.id,
          }),
        })
      );
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question created successfully',
          meta: expect.objectContaining({
            questionId: question.id,
            version: question.version,
          }),
        })
      );
    });

    it('should handle database errors during creation', async () => {
      const question = createTestQuestion();
      const dbError = new Error('Database insert failed');

      mockConn.simulateInsertFailure(dbError);

      await expect(repository.createQuestion(question)).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to create question',
          meta: expect.objectContaining({
            questionId: question.id,
            error: expect.objectContaining({
              message: 'Database insert failed',
            }),
          }),
        })
      );
    });

    it('should create question with different types correctly', async () => {
      const option1 = QuestionOption.create({
        id: '550e8400-e29b-41d4-a716-446655440003',
        text: 'True',
        isCorrect: true,
      });
      const option2 = QuestionOption.create({
        id: '550e8400-e29b-41d4-a716-446655440004',
        text: 'False',
        isCorrect: false,
      });

      if (!option1.success || !option2.success) {
        throw new Error('Failed to create test options');
      }

      const trueFalseOptions = QuestionOptions.create([option1.data, option2.data]);

      if (!trueFalseOptions.success) {
        throw new Error('Failed to create options collection');
      }

      const trueFalseQuestion = createTestQuestion({
        id: QuestionId.of('true-false-question'),
        questionText: 'Is the sky blue?',
        questionType: 'true_false',
        options: trueFalseOptions.data,
      });

      const result = await repository.createQuestion(trueFalseQuestion);

      expect(result.questionType).toBe('true_false');
    });
  });

  describe('updateQuestion', () => {
    it('should update question successfully with optimistic locking', async () => {
      const questionId = 'test-question-1';

      // Add existing question with version 1
      mockConn.addCompleteQuestion(
        {
          questionId,
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId,
          version: 1,
          questionText: 'Original question',
          questionType: 'single',
          explanation: 'Original explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const updatedQuestion = createTestQuestion({
        id: QuestionId.of(questionId),
        version: 2, // Incremented version
        questionText: 'Updated question text',
        updatedAt: new Date('2025-01-01T13:00:00Z'),
      });

      // Set context for version check
      mockConn.setSelectContext(questionId, 'update');

      const result = await repository.updateQuestion(updatedQuestion);

      expect(result).toBe(updatedQuestion);
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question updated successfully',
          meta: expect.objectContaining({
            questionId: updatedQuestion.id,
            version: updatedQuestion.version,
          }),
        })
      );
    });

    it('should throw QuestionNotFoundError when question does not exist', async () => {
      const question = createTestQuestion({
        id: QuestionId.of('nonexistent-question'),
        version: 2,
      });

      mockConn.setSelectContext('nonexistent-question', 'update');

      await expect(repository.updateQuestion(question)).rejects.toThrow(QuestionNotFoundError);
    });

    it('should throw QuestionVersionConflictError on version mismatch', async () => {
      const questionId = 'test-question-1';

      // Add existing question with version 2 (current)
      mockConn.addCompleteQuestion(
        {
          questionId,
          currentVersion: 2, // Current version is 2
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId,
          version: 2,
          questionText: 'Current question',
          questionType: 'single',
          explanation: 'Current explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const question = createTestQuestion({
        id: QuestionId.of(questionId),
        version: 2, // Trying to update to version 2, but expects 1 as current
      });

      mockConn.setSelectContext(questionId, 'update');

      await expect(repository.updateQuestion(question)).rejects.toThrow(
        QuestionVersionConflictError
      );

      expect(mockLogger.warnMessages).toContainEqual(
        expect.objectContaining({
          message: 'Version conflict detected',
          meta: expect.objectContaining({
            questionId,
            expectedVersion: 1, // Expected previous version
            actualVersion: 2, // Actual current version
          }),
        })
      );
    });

    it('should handle database errors during update', async () => {
      const questionId = 'test-question-1';

      mockConn.addCompleteQuestion(
        {
          questionId,
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId,
          version: 1,
          questionText: 'Original question',
          questionType: 'single',
          explanation: 'Original explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const question = createTestQuestion({
        id: QuestionId.of(questionId),
        version: 2,
      });

      mockConn.setSelectContext(questionId, 'update');

      const dbError = new Error('Database update failed');
      mockConn.simulateUpdateFailure(dbError);

      await expect(repository.updateQuestion(question)).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to update question',
          meta: expect.objectContaining({
            questionId: question.id,
            error: expect.objectContaining({
              message: 'Database update failed',
            }),
          }),
        })
      );
    });
  });

  describe('findQuestionWithDetails', () => {
    it('should return question with complete details when found', async () => {
      const questionId = QuestionId.of('test-question-1');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'What is networking?',
          questionType: 'single',
          explanation: 'Basic networking concept',
          detailedExplanation: 'Detailed explanation',
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: ['network'],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindWithDetailsContext(questionId.toString());

      const result = await repository.findQuestionWithDetails(questionId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(questionId.toString());
      expect(result?.questionText).toBe('What is networking?');
      expect(result?.version).toBe(1);
    });

    it('should return null when question not found', async () => {
      const questionId = QuestionId.of('nonexistent-question');

      mockConn.setFindWithDetailsContext(questionId.toString());

      const result = await repository.findQuestionWithDetails(questionId);

      expect(result).toBeNull();
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question not found',
          meta: expect.objectContaining({
            questionId,
          }),
        })
      );
    });

    it('should handle database errors during find', async () => {
      const questionId = QuestionId.of('test-question-1');
      const dbError = new Error('Database query failed');

      mockConn.simulateSelectFailure(dbError);

      await expect(repository.findQuestionWithDetails(questionId)).rejects.toThrow(
        QuestionRepositoryError
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find question with details',
          meta: expect.objectContaining({
            questionId,
            error: expect.objectContaining({
              message: 'Database query failed',
            }),
          }),
        })
      );
    });

    it('should handle invalid question data during reconstruction', async () => {
      const questionId = QuestionId.of('test-question-1');

      // Add question with invalid data that will fail Question.fromJSON
      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: '', // Invalid empty question text
          questionType: 'single',
          explanation: 'Basic networking concept',
          detailedExplanation: null,
          options: [], // Invalid empty options
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindWithDetailsContext(questionId.toString());

      await expect(repository.findQuestionWithDetails(questionId)).rejects.toThrow(
        InvalidQuestionDataError
      );
    });

    it('should correctly detect and map true/false questions', async () => {
      const questionId = QuestionId.of('true-false-question');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Is the sky blue?',
          questionType: 'single',
          explanation: 'Sky appears blue due to light scattering',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440003', text: 'True', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440004', text: 'False', isCorrect: false },
          ],
          examTypes: ['GENERAL'],
          categories: ['Science'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindWithDetailsContext(questionId.toString());

      const result = await repository.findQuestionWithDetails(questionId);

      expect(result).toBeDefined();
      expect(result?.questionType).toBe('true_false');
      expect(result?.questionText).toBe('Is the sky blue?');
    });
  });

  describe('findQuestionById', () => {
    it('should return question summary when found', async () => {
      const questionId = QuestionId.of('test-question-1');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'What is networking?',
          questionType: 'single',
          explanation: 'Basic networking concept',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: ['network'],
          images: ['image1.jpg'],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindByIdContext(questionId.toString(), false);

      const result = await repository.findQuestionById(questionId, false);

      expect(result).toBeDefined();
      expect(result?.questionId).toEqual(questionId);
      expect(result?.questionText).toBe('What is networking?');
      expect(result?.questionType).toBe('multiple_choice');
      expect(result?.optionCount).toBe(2);
      expect(result?.hasImages).toBe(true);
      expect(result?.isPremium).toBe(false);
    });

    it('should return null when premium question found but includePremium is false', async () => {
      const questionId = QuestionId.of('premium-question');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true, // Premium question
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Premium question',
          questionType: 'single',
          explanation: 'Premium explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'advanced',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindByIdContext(questionId.toString(), false);

      const result = await repository.findQuestionById(questionId, false);

      expect(result).toBeNull();
    });

    it('should return premium question when includePremium is true', async () => {
      const questionId = QuestionId.of('premium-question');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Premium question',
          questionType: 'single',
          explanation: 'Premium explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'advanced',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindByIdContext(questionId.toString(), true);

      const result = await repository.findQuestionById(questionId, true);

      expect(result).toBeDefined();
      expect(result?.isPremium).toBe(true);
    });

    it('should handle database errors during findById', async () => {
      const questionId = QuestionId.of('test-question-1');
      const dbError = new Error('Database connection failed');

      mockConn.simulateSelectFailure(dbError);

      await expect(repository.findQuestionById(questionId)).rejects.toThrow(
        QuestionRepositoryError
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find question by ID',
          meta: expect.objectContaining({
            questionId,
            error: expect.objectContaining({
              message: 'Database connection failed',
            }),
          }),
        })
      );
    });
  });

  describe('findQuestions', () => {
    it('should return paginated questions with filters', async () => {
      // Add multiple questions
      mockConn.addCompleteQuestion(
        {
          questionId: 'question-1',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: 'question-1',
          version: 1,
          questionText: 'CCNA networking question',
          questionType: 'single',
          explanation: 'CCNA explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.addCompleteQuestion(
        {
          questionId: 'question-2',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true,
          status: 'active',
          createdAt: new Date('2025-01-01T13:00:00Z'),
          updatedAt: new Date('2025-01-01T13:00:00Z'),
        },
        {
          questionId: 'question-2',
          version: 1,
          questionText: 'CCNP security question',
          questionType: 'multiple',
          explanation: 'CCNP explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: true },
          ],
          examTypes: ['CCNP'],
          categories: ['Security'],
          difficulty: 'intermediate',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T13:00:00Z'),
        }
      );

      const filters: QuestionFilters = {
        activeOnly: true,
        includePremium: false,
        examTypes: ['CCNA'],
        categories: undefined,
        difficulty: undefined,
        searchQuery: undefined,
      };

      const pagination: QuestionPagination = {
        limit: 10,
        offset: 0,
      };

      mockConn.setFindQuestionsContext(filters, pagination);

      const result = await repository.findQuestions(filters, pagination);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toBe('CCNA networking question');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should handle search query filtering', async () => {
      mockConn.addCompleteQuestion(
        {
          questionId: 'question-1',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: 'question-1',
          version: 1,
          questionText: 'What is the TCP/IP protocol stack?',
          questionType: 'single',
          explanation: 'TCP/IP explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const filters: QuestionFilters = {
        activeOnly: true,
        includePremium: true,
        searchQuery: 'TCP/IP',
      };

      const pagination: QuestionPagination = {
        limit: 10,
        offset: 0,
      };

      mockConn.setFindQuestionsContext(filters, pagination);

      const result = await repository.findQuestions(filters, pagination);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toContain('TCP/IP');
    });

    it('should handle database errors during find', async () => {
      const filters: QuestionFilters = {
        activeOnly: true,
        includePremium: true,
      };

      const pagination: QuestionPagination = {
        limit: 10,
        offset: 0,
      };

      const dbError = new Error('Query execution failed');
      mockConn.simulateSelectFailure(dbError);

      await expect(repository.findQuestions(filters, pagination)).rejects.toThrow(
        QuestionRepositoryError
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find questions',
          meta: expect.objectContaining({
            filters,
            pagination,
            error: expect.objectContaining({
              message: 'Query execution failed',
            }),
          }),
        })
      );
    });
  });

  describe('getQuestionStats', () => {
    it('should return question statistics', async () => {
      // Add questions for stats testing
      mockConn.addCompleteQuestion(
        {
          questionId: 'question-1',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: 'question-1',
          version: 1,
          questionText: 'CCNA question',
          questionType: 'single',
          explanation: 'CCNA explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.addCompleteQuestion(
        {
          questionId: 'question-2',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true,
          status: 'active',
          createdAt: new Date('2025-01-01T13:00:00Z'),
          updatedAt: new Date('2025-01-01T13:00:00Z'),
        },
        {
          questionId: 'question-2',
          version: 1,
          questionText: 'CCNP question',
          questionType: 'multiple',
          explanation: 'CCNP explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: true },
          ],
          examTypes: ['CCNP'],
          categories: ['Security'],
          difficulty: 'intermediate',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T13:00:00Z'),
        }
      );

      mockConn.setGetStatsContext();

      const result = await repository.getQuestionStats();

      expect(result.totalQuestions).toBe(2);
      expect(result.premiumQuestions).toBe(1);
      expect(result.questionsByExamType).toEqual({
        CCNA: 1,
        CCNP: 1,
      });
      expect(result.questionsByDifficulty).toEqual({
        Beginner: 1,
        intermediate: 1,
      });
    });

    it('should handle database errors during stats retrieval', async () => {
      const dbError = new Error('Stats query failed');
      mockConn.simulateSelectFailure(dbError);

      await expect(repository.getQuestionStats()).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to get question stats',
          meta: expect.objectContaining({
            error: expect.objectContaining({
              message: 'Stats query failed',
            }),
          }),
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update question status and create moderation log', async () => {
      const questionId = QuestionId.of('test-question-1');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';
      const feedback = 'Question looks good, approved for use';

      // Mock the database responses
      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'draft',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Test question for moderation',
          questionType: 'single',
          explanation: 'Test explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      // Execute updateStatus
      await repository.updateStatus(questionId, QuestionStatus.ACTIVE, moderatedBy, feedback);

      // Verify update was called with correct parameters
      expect(mockConn.updateCalls.length).toBeGreaterThan(0);
      const updateCall = mockConn.updateCalls.find((call) => call.table === 'question');
      expect(updateCall).toBeDefined();
      expect(updateCall?.table).toBe('question');
      const updateData = updateCall?.data as { status: string; updatedAt: Date };
      expect(updateData.status).toBe('active');
      expect(updateData.updatedAt).toBeInstanceOf(Date);

      // Verify moderation log was inserted
      expect(mockConn.insertCalls.length).toBeGreaterThan(0);
      const insertCall = mockConn.insertCalls.find((call) => call.table === 'moderationLogs');
      expect(insertCall).toBeDefined();
      expect(insertCall?.table).toBe('moderationLogs');
      const values = insertCall?.values as {
        questionId: string;
        action: string;
        moderatedBy: string;
        moderatedAt: Date;
        feedback?: string;
        previousStatus: string;
        newStatus: string;
      };
      expect(values.questionId).toBe(questionId.toString());
      expect(values.action).toBe('approve');
      expect(values.moderatedBy).toBe(moderatedBy);
      expect(values.feedback).toBe(feedback);
      expect(values.previousStatus).toBe('draft');
      expect(values.newStatus).toBe('active');

      // Verify logging
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question status updated successfully',
          meta: expect.objectContaining({
            questionId,
            previousStatus: 'draft',
            newStatus: QuestionStatus.ACTIVE,
            moderatedBy,
          }),
        })
      );
    });

    it('should enforce business rule that only DRAFT questions can be moderated', async () => {
      const questionId = QuestionId.of('active-question');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';

      // Add an active question
      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active', // Already active
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Already active question',
          questionType: 'single',
          explanation: 'Test explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      await expect(
        repository.updateStatus(questionId, QuestionStatus.INACTIVE, moderatedBy)
      ).rejects.toThrow(InvalidQuestionDataError);

      await expect(
        repository.updateStatus(questionId, QuestionStatus.INACTIVE, moderatedBy)
      ).rejects.toThrow(
        'Cannot moderate question with status active. Only DRAFT questions can be moderated.'
      );
    });

    it('should require feedback for rejection', async () => {
      const questionId = QuestionId.of('test-question-1');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';

      // Add a draft question
      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'draft',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Test question',
          questionType: 'single',
          explanation: 'Test explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      // Test without feedback
      await expect(
        repository.updateStatus(questionId, QuestionStatus.ARCHIVED, moderatedBy)
      ).rejects.toThrow(InvalidQuestionDataError);

      // Test with short feedback
      await expect(
        repository.updateStatus(questionId, QuestionStatus.ARCHIVED, moderatedBy, 'Too short')
      ).rejects.toThrow(
        'Feedback is required for question rejection and must be at least 10 characters long'
      );
    });

    it('should handle question not found error', async () => {
      const questionId = QuestionId.of('non-existent-question');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';

      await expect(
        repository.updateStatus(questionId, QuestionStatus.ACTIVE, moderatedBy)
      ).rejects.toThrow(QuestionNotFoundError);

      await expect(
        repository.updateStatus(questionId, QuestionStatus.ACTIVE, moderatedBy)
      ).rejects.toThrow(`Question with ID ${questionId} not found`);
    });

    it('should use transaction for atomic updates', async () => {
      const questionId = QuestionId.of('test-question-1');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'draft',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Test question',
          questionType: 'single',
          explanation: 'Test explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      await repository.updateStatus(questionId, QuestionStatus.ACTIVE, moderatedBy);

      // Verify transaction was called
      expect(mockConn.transactionCalls).toHaveLength(1);
    });

    it('should map status to correct moderation action', async () => {
      const questionId = QuestionId.of('test-question-1');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';

      // Test approve action
      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'draft',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Test question',
          questionType: 'single',
          explanation: 'Test explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      await repository.updateStatus(questionId, QuestionStatus.ACTIVE, moderatedBy);

      // Verify approve action
      const approveCall = mockConn.insertCalls.find((call) => call.table === 'moderationLogs');
      expect(approveCall).toBeDefined();
      const approveValues = approveCall?.values as { action: string };
      expect(approveValues.action).toBe('approve');

      // Clear calls
      mockConn.insertCalls = [];
      mockConn.updateCalls = [];

      // Test reject action
      await repository.updateStatus(
        questionId,
        QuestionStatus.INACTIVE,
        moderatedBy,
        'Needs improvement'
      );

      const rejectCall = mockConn.insertCalls.find((call) => call.table === 'moderationLogs');
      expect(rejectCall).toBeDefined();
      const rejectValues = rejectCall?.values as { action: string };
      expect(rejectValues.action).toBe('reject');
    });

    it('should handle database errors gracefully', async () => {
      const questionId = QuestionId.of('test-question-1');
      const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';
      const dbError = new Error('Database connection lost');

      mockConn.simulateSelectFailure(dbError);

      await expect(
        repository.updateStatus(questionId, QuestionStatus.ACTIVE, moderatedBy)
      ).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find question with details',
          meta: expect.objectContaining({
            questionId,
            error: expect.objectContaining({
              message: 'Database connection lost',
            }),
          }),
        })
      );
    });
  });

  describe('withTransaction', () => {
    it('should execute operations within transaction context', async () => {
      let transactionExecuted = false;

      const result = await repository.withTransaction(async (txRepo: DrizzleQuestionRepository) => {
        expect(txRepo).toBeInstanceOf(DrizzleQuestionRepository);
        transactionExecuted = true;
        return 'success';
      });

      expect(transactionExecuted).toBe(true);
      expect(result).toBe('success');
    });

    it('should propagate errors from transaction operations', async () => {
      const txError = new Error('Transaction operation failed');

      await expect(
        repository.withTransaction(async () => {
          throw txError;
        })
      ).rejects.toThrow(txError);
    });
  });
});
