# Coding Standards & Best Practices

## Overview

This document defines coding conventions and best practices for the CertQuiz project. All code should follow these standards to ensure consistency and maintainability.

## General Principles

1. **Type Safety First**: No `any` types, explicit types preferred
2. **Functional Style**: Pure functions, immutability when possible
3. **Small Functions**: Single responsibility, <20 lines preferred
4. **Descriptive Names**: Self-documenting code
5. **Test-Driven**: Write tests before implementation
6. **Vertical Slice Architecture**: Organize by use case, not by layer
7. **Domain-Driven Design**: Rich domain models with business logic
8. **DbContext Pattern**: Direct database access without repository interfaces

## TypeScript Standards

### Type Definitions

```typescript
// ✅ Good: Explicit types
interface QuizSession {
  id: string;
  userId: string;
  questions: Question[];
  currentIndex: number;
  startedAt: Date;
  completedAt?: Date; // Optional fields clearly marked
}

// ❌ Bad: Implicit or any types
const processData = (data: any) => { /* ... */ }

// ✅ Good: Type guards
function isQuestion(obj: unknown): obj is Question {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'questionText' in obj
  );
}
```

### Function Patterns

```typescript
// ✅ Good: Pure function with clear return type
function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

// ✅ Good: Error handling with Result type
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function fetchQuestion(id: string): Promise<Result<Question>> {
  try {
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, id)
    });
    
    if (!question) {
      return { success: false, error: new Error('Question not found') };
    }
    
    return { success: true, data: question };
  } catch (error) {
    return { success: false, error };
  }
}

// ✅ Good: Functional composition
const pipeline = (...fns: Function[]) => (value: any) =>
  fns.reduce((acc, fn) => fn(acc), value);

const processQuizResult = pipeline(
  calculateScore,
  updateProgress,
  checkBadgeUnlock
);
```

### Constants and Enums

```typescript
// ✅ Good: Use const assertions
export const QUIZ_SIZES = [1, 3, 5, 10] as const;
export type QuizSize = typeof QUIZ_SIZES[number];

// ✅ Good: Object freeze for immutability
export const CONFIG = Object.freeze({
  MAX_OPTIONS: 6,
  MIN_OPTIONS: 2,
  DEFAULT_PAGE_SIZE: 10,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
});

// ✅ Good: String literal types over enums
export type UserRole = 'guest' | 'user' | 'premium' | 'admin';
```

## File Organization

### VSA Directory Structure

```
src/
├── features/        # Feature slices (vertical slices)
│   ├── quiz/       # Quiz bounded context
│   │   ├── start-quiz/         # Use case folder
│   │   │   ├── handler.ts      # Application logic
│   │   │   ├── handler.test.ts # Co-located test
│   │   │   ├── dto.ts          # Input/output types
│   │   │   ├── validation.ts   # Zod schemas
│   │   │   ├── db.ts           # Database queries
│   │   │   └── route.ts        # HTTP route
│   │   └── domain/             # Domain models
│   │       ├── entities/
│   │       ├── value-objects/
│   │       └── aggregates/
│   ├── user/       # User bounded context
│   └── auth/       # Auth bounded context
├── system/          # Operational features
│   └── health/
├── shared/          # Shared kernel
│   ├── logger.ts
│   ├── result.ts
│   └── errors.ts
├── infrastructure/  # External adapters
│   ├── database.ts
│   └── keycloak.ts
├── middleware/      # Global middleware
├── routes.ts        # Route composition
└── index.ts         # Application entry
```

### Import Order

```typescript
// 1. External imports
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';

// 2. Internal absolute imports
import { db } from '@/db';
import { authMiddleware } from '@/middleware/auth';

// 3. Internal relative imports
import { calculateScore } from './utils';
import type { QuizSession } from './types';

// 4. Style imports (frontend only)
import './styles.css';
```

## API Design Standards

### Route Patterns

```typescript
// ✅ Good: RESTful conventions
app.group('/api', (app) => app
  // Resources (plural)
  .get('/questions', listQuestions)
  .get('/questions/:id', getQuestion)
  .post('/questions', createQuestion)
  .put('/questions/:id', updateQuestion)
  
  // Actions
  .post('/quiz/start', startQuiz)
  .post('/quiz/:id/answer', submitAnswer)
  
  // Nested resources
  .get('/users/:userId/progress', getUserProgress)
);

// ✅ Good: Consistent response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}
```

### Validation

```typescript
// ✅ Good: Zod schemas co-located with routes
const CreateQuestionSchema = z.object({
  examType: z.string().min(1),
  category: z.string().min(1),
  questionText: z.string().min(10).max(1000),
  type: z.enum(['single', 'multiple']),
  options: z.array(z.object({
    text: z.string().min(1),
    isCorrect: z.boolean()
  })).min(2).max(6)
});

// ✅ Good: Type inference from schema
type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
```

## VSA Standards

### Use Case Structure

```typescript
// features/quiz/start-quiz/handler.ts
import { Result, ok, err } from '@/shared/result';
import type { StartQuizInput, StartQuizOutput } from './dto';

// Handler function - contains application logic
export async function startQuiz(
  input: StartQuizInput,
  context: { userId: string, db: DbContext }
): Promise<Result<StartQuizOutput, StartQuizError>> {
  // 1. Domain logic
  const session = QuizSession.create(input);
  
  // 2. Persistence
  const result = await context.db.quizzes.create(session);
  
  // 3. Return result
  return ok({ quizId: result.id });
}
```

### Domain Models

```typescript
// ✅ Good: Rich domain entity
export class QuizSession {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    private _questions: Question[],
    private _startedAt: Date
  ) {}

  static create(props: CreateQuizProps): QuizSession {
    // Factory with validation
    if (props.questionCount < 1) {
      throw new DomainError('Invalid question count');
    }
    return new QuizSession(/*...*/);
  }

  // Business methods
  submitAnswer(questionId: string, answer: string): void {
    // Domain logic here
  }
}

// ❌ Bad: Anemic domain model
interface QuizSession {
  id: string;
  userId: string;
  questions: Question[];
}
```

### DbContext Usage

```typescript
// ✅ Good: Slice-specific queries
// features/quiz/start-quiz/db.ts
import { dbContext } from '@/infrastructure/database';

export const startQuizDb = {
  async getRandomQuestions(count: number, category?: string) {
    return dbContext.questions.random(count, { category });
  },
  
  async createSession(session: QuizSession) {
    return dbContext.transaction(async (tx) => {
      // Transaction logic
    });
  }
};
```

### Route Organization

```typescript
// ✅ Good: Each slice exports its routes
// features/quiz/start-quiz/route.ts
export const startQuizRoute = new Hono()
  .post('/start', zValidator('json', startQuizSchema), handler);

// src/routes.ts - Composition root
export const appRoutes = new Hono()
  .route('/api/quiz', startQuizRoute)
  .route('/api/quiz', submitAnswerRoute);
```

## Database Standards

### Query Patterns

```typescript
// ✅ Good: Use query builder for complex queries
const questionsWithStats = await db
  .select({
    question: questions,
    totalAttempts: sql<number>`count(distinct sq.session_id)`,
    correctRate: sql<number>`
      avg(case when sq.is_correct then 1 else 0 end) * 100
    `
  })
  .from(questions)
  .leftJoin(sessionQuestions, eq(questions.id, sessionQuestions.questionId))
  .groupBy(questions.id)
  .where(eq(questions.status, 'active'));

// ✅ Good: Use transactions for multi-table operations
const result = await db.transaction(async (tx) => {
  const [question] = await tx.insert(questions).values(data).returning();
  await tx.insert(questionOptions).values(options);
  return question;
});

// ✅ Good: Prepared statements for frequent queries
const getQuestionById = db
  .select()
  .from(questions)
  .where(eq(questions.id, sql.placeholder('id')))
  .prepare('getQuestionById');
```

### Migration Standards

```sql
-- ✅ Good: Descriptive migration names
-- 0001_create_users_table.sql
-- 0002_add_premium_flag_to_questions.sql

-- ✅ Good: Include rollback
-- Up
ALTER TABLE questions ADD COLUMN is_premium BOOLEAN DEFAULT false;

-- Down
ALTER TABLE questions DROP COLUMN is_premium;
```

## Frontend Standards (Svelte)

### Component Structure

```svelte
<!-- ✅ Good: Script-first approach -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Question } from '@certquiz/shared/types';
  
  // Props
  export let question: Question;
  export let showAnswer = false;
  
  // State
  let selected: string[] = [];
  
  // Computed
  $: isCorrect = checkAnswer(selected, question);
  
  // Methods
  function handleSubmit() {
    // ...
  }
  
  // Lifecycle
  onMount(() => {
    // ...
  });
</script>

<!-- Template -->
<div class="question-card">
  <!-- content -->
</div>

<!-- Styles -->
<style>
  /* Component-scoped styles */
  .question-card {
    @apply bg-white dark:bg-gray-800 rounded-lg p-6;
  }
</style>
```

### State Management

```typescript
// ✅ Good: Typed stores
// stores/auth.ts
import { writable, derived } from 'svelte/store';
import type { User } from '@certquiz/shared/types';

function createAuthStore() {
  const { subscribe, set, update } = writable<User | null>(null);
  
  return {
    subscribe,
    login: async (credentials: LoginCredentials) => {
      const user = await api.login(credentials);
      set(user);
    },
    logout: () => set(null),
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, $auth => !!$auth);
```

## Testing Standards

### VSA Test Organization

```typescript
// ✅ Good: Co-located test next to handler
// features/quiz/start-quiz/handler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { startQuiz } from './handler';
import { createMockDbContext } from '@/tests/mocks';

describe('startQuiz', () => {
  let mockDb: DbContext;

  beforeEach(() => {
    mockDb = createMockDbContext();
  });

  it('should create quiz session with valid input', async () => {
    // Arrange
    const input = { questionCount: 10, category: 'networking' };
    const userId = 'user-123';

    // Act
    const result = await startQuiz(input, { userId, db: mockDb });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.quizId).toBeDefined();
  });

  it('should return error for invalid question count', async () => {
    // Arrange
    const input = { questionCount: 0 };
    const userId = 'user-123';

    // Act
    const result = await startQuiz(input, { userId, db: mockDb });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Invalid question count');
  });
});
```

### Domain Model Testing

```typescript
// ✅ Good: Test domain logic in isolation
// features/quiz/domain/entities/QuizSession.test.ts
describe('QuizSession', () => {
  it('should calculate score correctly', () => {
    // No database, pure domain logic
    const session = QuizSession.create({
      userId: 'user-123',
      questionCount: 5
    });

    session.submitAnswer('q1', 'correct');
    session.submitAnswer('q2', 'wrong');

    expect(session.getScore()).toBe(1);
    expect(session.getAccuracy()).toBe(50);
  });
});
```

### Test Data

```typescript
// ✅ Good: Test factories
export const createMockQuestion = (
  overrides?: Partial<Question>
): Question => ({
  id: crypto.randomUUID(),
  examType: 'CCNP',
  category: 'OSPF',
  questionText: 'Test question',
  type: 'single',
  options: [
    { id: '1', text: 'Option 1', isCorrect: true },
    { id: '2', text: 'Option 2', isCorrect: false },
  ],
  ...overrides,
});

// ✅ Good: Explicit test data
const testCases = [
  { input: 0, total: 10, expected: 0 },
  { input: 5, total: 10, expected: 50 },
  { input: 10, total: 10, expected: 100 },
];
```

## Error Handling

### Error Classes

```typescript
// ✅ Good: Custom error classes
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}
```

### Error Handling Patterns

```typescript
// ✅ Good: Centralized error handling
app.onError(({ code, error, set }) => {
  if (error instanceof AppError) {
    set.status = error.statusCode;
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error);
  
  set.status = 500;
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
});
```

## Performance Guidelines

### Database Optimization

```typescript
// ✅ Good: Select only needed columns
const questions = await db
  .select({
    id: questions.id,
    questionText: questions.questionText,
    type: questions.type,
  })
  .from(questions);

// ✅ Good: Use indexes effectively
// In schema:
index('idx_questions_exam_category').on(
  questions.examType, 
  questions.category
);

// ✅ Good: Batch operations
const questionIds = ['id1', 'id2', 'id3'];
const questions = await db
  .select()
  .from(questions)
  .where(inArray(questions.id, questionIds));
```

### Frontend Optimization

```svelte
<!-- ✅ Good: Lazy loading -->
<script>
  import { onMount } from 'svelte';
  
  let QuestionEditor;
  
  onMount(async () => {
    if (isAdmin) {
      const module = await import('./QuestionEditor.svelte');
      QuestionEditor = module.default;
    }
  });
</script>

{#if QuestionEditor}
  <svelte:component this={QuestionEditor} />
{/if}
```

## Security Guidelines

### Input Validation

```typescript
// ✅ Good: Validate all user input
const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// ✅ Good: Parameterized queries (Drizzle handles this)
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, userInput)); // Safe from SQL injection
```

### Authentication

```typescript
// ✅ Good: Secure token handling
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set');
}

// ✅ Good: Token expiration
const token = jwt.sign(
  { userId: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '24h' }
);
```

## Git Commit Standards

### Commit Message Format

```
type(scope): subject

body

footer
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

### Examples

```bash
# ✅ Good
feat(quiz): add timer functionality for quiz sessions
fix(auth): correct token expiration handling
docs(api): update endpoint documentation
test(questions): add integration tests for question CRUD

# ❌ Bad
update code
fix bug
WIP
```

## Code Review Checklist

### General
- [ ] Types are explicit (no `any`)
- [ ] Functions are pure where possible
- [ ] Error handling uses Result type
- [ ] Tests are included and co-located
- [ ] Documentation is updated

### VSA Specific
- [ ] Use case is in its own folder
- [ ] Handler contains only application logic
- [ ] Domain logic is in entities/aggregates
- [ ] Database queries are in db.ts
- [ ] Routes are thin wrappers
- [ ] No cross-slice imports

### Quality
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Accessibility maintained
- [ ] Mobile experience tested

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Svelte Documentation](https://svelte.dev/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Hono Documentation](https://hono.dev/)