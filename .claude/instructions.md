# Instructions for Claude Code - Operating Manual

> **Purpose**: This is your exhaustive rulebook for working on the CertQuiz project. Follow these instructions exactly.

## 🚨 CRITICAL: Development Principles

### Test-Driven Development (TDD) is MANDATORY
- **Write tests before implementation code**
- **Follow the Red-Green-Refactor (RGR) cycle**:
  1. **Red**: Write a failing test
  2. **Green**: Write minimal code to make the test pass
  3. **Refactor**: Improve code quality while keeping tests green
- **This is the #1 rule - apply to every feature**

### Schema-Driven Development is REQUIRED
- **Define TypeSpec schemas before creating APIs**
- **Update database schema before writing queries**
- **Create schema definitions for all endpoints**

## Project Context

You are implementing CertQuiz - a technical certification quiz application using:
- **Architecture**: Vertical Slice Architecture (VSA) + Domain-Driven Design (DDD) + Repository Pattern
- **Backend**: Bun + Hono + Drizzle ORM with Neon PostgreSQL
- **Frontend**: SvelteKit + TypeScript + TailwindCSS
- **Auth**: KeyCloak OAuth 2.0
- **Testing**: Vitest with 80% coverage requirement
- **Code Quality**: Biome 2.x for linting and formatting

The main project overview is in `/CLAUDE.md`. This document provides detailed implementation rules.

## Implementation Approach

### 1. Test-Driven Development (TDD)
- **Write tests before implementation**
- **Place test files next to source files** (`*.test.ts`)
- **Use Vitest for testing**
- **Aim for 80% coverage minimum**

### 2. Type Safety
- **Use specific types instead of `any`**
- **Prefer explicit types over inference**
- **Use type guards for runtime validation**
- **All functions must have explicit return types**

### 3. Database Operations
- **Use transactions for multi-table operations**
- **Use Drizzle's query builder**
- **Handle errors with Result types**
- **Check `/docs/database-schema-v2.md` for schema**

### 4. Code Organization

#### Path Aliases
- `@certquiz/shared` → Shared package (types, constants, utils)
- `@certquiz/typespec` → API specification types
- `@api/*` → API source (`apps/api/src/*`)
- `@api/test-support` → Domain test utilities (feature-specific)
- `@api/testing/infra` → Infrastructure test utilities
- `@api/testing/domain` → Domain layer test utilities
- `@api/testing` → Unified test utilities (both layers)
- `@web/*` → Web source (`apps/web/src/*`)

#### Import Order
1. External packages
2. Cross-package imports (`@certquiz/*`)
3. App-specific imports (`@api/*`, `@web/*`)
4. Relative imports
5. Type imports

**Use path aliases for**: cross-package imports, cross-feature boundaries  
**Use relative imports for**: same feature slice, co-located files

## Folder/Module Layout (VSA Structure)

### Backend Structure (`apps/api/src/`)

```
features/              # Vertical slices by use case
├── quiz/             # Quiz bounded context
│   ├── start-quiz/   # Use case folder
│   │   ├── handler.ts        # Business logic orchestration
│   │   ├── handler.test.ts   # Handler unit tests
│   │   ├── dto.ts            # Data transfer objects
│   │   ├── validation.ts     # Zod schemas
│   │   └── route.ts          # Hono route definition
│   ├── submit-answer/        # Another use case
│   └── domain/              # Domain layer
│       ├── aggregates/      # Rich domain models
│       ├── entities/        # Domain entities
│       ├── value-objects/   # Immutable VOs
│       ├── events/          # Domain events
│       ├── errors/          # Domain-specific errors
│       └── repositories/    # Interfaces + implementations
├── auth/             # Auth bounded context
├── user/             # User bounded context
└── question/         # Question bounded context

infra/                # Infrastructure layer
├── db/
│   ├── schema/       # Drizzle table definitions
│   ├── migrations/   # Generated SQL migrations
│   └── client.ts     # Database connection
├── unit-of-work.ts   # Transaction wrapper
└── auth/             # External auth providers

shared/               # Shared kernel
├── result.ts         # Result<T, E> type
├── errors.ts         # Base error classes
└── utils.ts          # Common utilities

middleware/           # HTTP middleware
├── on-error.ts       # Global error handler
├── logger.ts         # Request logging
└── security.ts       # CORS, headers

test-support/         # Feature-specific domain test utilities
└── types/            # Test-only TypeScript helpers

testing/              # Unified test infrastructure (DDD layers)
├── infra/            # Infrastructure layer test utilities
│   ├── db/           # Database, testcontainers, transactions
│   ├── errors/       # Error testing utilities
│   ├── process/      # Process execution utilities
│   ├── runtime/      # Runtime environment utilities
│   └── vitest/       # Test configuration
├── domain/           # Domain layer test utilities
│   ├── fakes/        # Repository fakes, test doubles
│   └── integration-helpers.ts  # Domain integration helpers
└── index.ts          # Barrel exports for both layers
```

### Key Rules for VSA:
1. **Each use case gets its own folder** with handler, dto, validation, route
2. **Co-locate tests** - always `filename.test.ts` next to `filename.ts`
3. **Domain stays pure** - no framework dependencies in domain layer
4. **Repository pattern** - interface in domain, implementation alongside
5. **Cross-slice imports forbidden** - use events for communication

### Frontend Structure (`apps/web/src/`)

```
lib/
├── api/              # Typed API client
├── stores/           # Svelte stores
└── components/       # Reusable components

routes/               # SvelteKit pages
├── +layout.svelte    # Root layout
├── quiz/
│   ├── +page.svelte  # Quiz list
│   └── [id]/
│       └── +page.svelte  # Quiz detail
└── admin/            # Admin routes
```

## Common Patterns

### API Endpoint Pattern
Use Hono with `zValidator` for type-safe endpoints. Structure: validate → auth → business logic → response.

### Error Handling Pattern
Use `Result<T, E>` type for fallible operations instead of throwing exceptions.

### Component Pattern (Svelte)
Order: props → state → reactive → functions → template → styles.

### Logging Pattern
Use domain-pure `LoggerPort` interface with structured logging:
- HTTP routes: `c.get('logger')` - includes request metadata
- Domain services: `createDomainLogger('service.name')` 
- Repositories: Accept `LoggerPort` in constructor
- Tests: Use `silentLoggerStub()` or `visibleLoggerStub()` for debugging
- Correlation tracking: Automatic via AsyncLocalStorage middleware

## VSA Implementation Patterns

### Creating a New Feature Slice

1. **Start with the Use Case Folder**
   ```bash
   mkdir -p apps/api/src/features/quiz/calculate-score
   cd apps/api/src/features/quiz/calculate-score
   ```

2. **Create Handler Test First (TDD)**
   ```typescript
   // handler.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { calculateScoreHandler } from './handler';
   
   describe('calculateScoreHandler', () => {
     it('should calculate quiz score', async () => {
       const mockRepo = {
         findById: vi.fn().mockResolvedValue(mockQuizSession),
         save: vi.fn()
       };
       
       const result = await calculateScore(sessionId, mockRepo);
       
       expect(result.success).toBe(true);
       expect(result.data.score).toBe(8);
     });
   });
   ```

3. **Implement Handler**
   ```typescript
   // handler.ts
   import { withTransaction } from '@api/infra/unit-of-work';
   import { DrizzleQuizRepository } from '../domain/repositories/DrizzleQuizRepository';
   
   export async function calculateScoreHandler(c: Context) {
     const { sessionId } = c.req.valid('param');
     const userId = c.get('user').id;
     
     return withTransaction(async (trx) => {
       const repo = new DrizzleQuizRepository(trx);
       const session = await repo.findById(sessionId);
       
       if (!session) {
         return c.json({ error: 'Session not found' }, 404);
       }
       
       if (!session.belongsTo(userId)) {
         return c.json({ error: 'Forbidden' }, 403);
       }
       
       const score = session.calculateScore();
       await repo.save(session);
       
       return c.json({ 
         success: true, 
         data: { score: score.value, total: score.total } 
       });
     });
   }
   ```

4. **Define DTOs**
   ```typescript
   // dto.ts
   export interface CalculateScoreRequest {
     sessionId: string;
   }
   
   export interface CalculateScoreResponse {
     score: number;
     total: number;
     percentage: number;
   }
   ```

5. **Create Validation**
   ```typescript
   // validation.ts
   import { z } from 'zod';
   
   export const calculateScoreSchema = z.object({
     sessionId: z.string().uuid()
   });
   ```

6. **Wire Up Route**
   ```typescript
   // route.ts
   import { Hono } from 'hono';
   import { zValidator } from '@hono/zod-validator';
   import { calculateScoreHandler } from './handler';
   import { calculateScoreSchema } from './validation';
   
   export const calculateScoreRoute = new Hono()
     .post('/:sessionId/score',
       zValidator('param', calculateScoreSchema),
       authMiddleware,
       calculateScoreHandler
     );
   ```

### Repository Implementation Pattern

```typescript
// domain/repositories/IQuizRepository.ts
export interface IQuizRepository {
  findById(id: QuizId): Promise<QuizSession | null>;
  findActiveByUser(userId: UserId): Promise<QuizSession[]>;
  save(session: QuizSession): Promise<void>;
  delete(id: QuizId): Promise<void>;
}

// domain/repositories/DrizzleQuizRepository.ts
export class DrizzleQuizRepository extends BaseRepository implements IQuizRepository {
  constructor(
    private readonly trx: PostgresJsTransaction,
    logger: LoggerPort
  ) {
    super(logger);
  }
  
  async findById(id: QuizId): Promise<QuizSession | null> {
    const row = await this.trx.query.quizSessions.findFirst({
      where: eq(quizSessions.id, id.value),
      with: {
        questions: {
          with: { question: true }
        }
      }
    });
    
    return row ? QuizSession.fromPersistence(row) : null;
  }
  
  async save(session: QuizSession): Promise<void> {
    const data = session.toPersistence();
    
    await this.trx.insert(quizSessions)
      .values(data)
      .onConflictDoUpdate({
        target: quizSessions.id,
        set: data
      });
  }
}
```

### Domain Event Pattern

```typescript
// domain/events/QuizEvents.ts
export class QuizCompletedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: QuizId,
    public readonly userId: UserId,
    public readonly score: Score,
    public readonly completedAt: Date
  ) {
    super(sessionId.value);
  }
}

// In aggregate
class QuizSession extends AggregateRoot {
  complete(): Result<void> {
    if (this.state !== 'IN_PROGRESS') {
      return err(new InvalidStateError('Quiz not in progress'));
    }
    
    this.state = 'COMPLETED';
    this.completedAt = new Date();
    
    this.addDomainEvent(new QuizCompletedEvent(
      this.id,
      this.userId,
      this.calculateScore(),
      this.completedAt
    ));
    
    return ok(undefined);
  }
}
```

### Value Object Pattern

```typescript
// domain/value-objects/Score.ts
export class Score {
  private constructor(
    public readonly correct: number,
    public readonly total: number
  ) {}
  
  static create(correct: number, total: number): Result<Score> {
    if (correct < 0 || total < 0) {
      return err(new ValidationError('Score values must be non-negative'));
    }
    
    if (correct > total) {
      return err(new ValidationError('Correct cannot exceed total'));
    }
    
    return ok(new Score(correct, total));
  }
  
  get percentage(): number {
    return this.total === 0 ? 0 : (this.correct / this.total) * 100;
  }
  
  equals(other: Score): boolean {
    return this.correct === other.correct && this.total === other.total;
  }
}
```

## File Naming Conventions

- Components: `PascalCase.svelte`
- Utilities: `camelCase.ts`
- Types: `types/PascalCase.ts`
- Routes: `kebab-case/+page.svelte`
- API routes: `routes/resource.ts`

## Git Workflow

1. Create feature branch: `feat/feature-name`
2. Make atomic commits following `.claude/commit-convention.md`
3. Write tests → implement → ensure tests pass
4. Update relevant documentation

## Commit Format

See `.claude/commit-convention.md`. Example: `✨ feat(quiz): add timer functionality`

## Performance Considerations

- Keep API responses under 200ms
- Use database indexes (check schema)
- Implement pagination for lists
- Cache static data
- Lazy load frontend components

## Security Checklist

- [ ] Validate all inputs
- [ ] Use parameterized queries (Drizzle handles this)
- [ ] Check authentication on protected routes
- [ ] Sanitize user-generated content
- [ ] Keep sensitive data out of responses

## When Stuck

1. Check `/docs/task-list.md` for current task details
2. Follow patterns in `/docs/coding-standards.md`
3. Look for similar implementations in codebase
4. If o3 MCP server is available, ask for advice using `mcp__o3__o3-search`:
   - Include full project context (architecture, tech stack, current issue)
   - Mention this is a CertQuiz project using VSA + DDD + Repository Pattern
   - Provide specific error messages or blockers
   - Remember o3 interactions are stateless - include all necessary context
5. Add TODO comment with specific blocker details and continue with next task

## Schema-Driven Workflow

### For Database Changes

1. **Update Drizzle Schema**
   ```typescript
   // apps/api/src/infra/db/schema/quiz.ts
   export const quizSessions = pgTable('quiz_sessions', {
     id: uuid('id').primaryKey(),
     // Add new columns here
   });
   ```

2. **Generate Migration**
   ```bash
   bun run db:generate
   ```

3. **Review Generated SQL**
   - Check `apps/api/src/infra/db/migrations/`
   - Ensure migration is correct

4. **Apply Migration**
   ```bash
   bun run db:migrate
   ```

5. **Update Domain Models**
   - Modify entities/aggregates to use new fields
   - Update repository implementations

### For API Changes

1. **Define TypeSpec Schema**
   ```typescript
   // packages/typespec/main.tsp
   @route("/quiz/start")
   @post
   op startQuiz(@body request: StartQuizRequest): StartQuizResponse;
   ```

2. **Generate Types**
   ```bash
   bun run typespec:compile
   ```

3. **Create Validation Schema**
   ```typescript
   // features/quiz/start-quiz/validation.ts
   export const startQuizSchema = z.object({
     questionCount: z.number().min(1).max(50),
     // Match TypeSpec definition
   });
   ```

4. **Implement Handler with TDD**
   - Write handler.test.ts first
   - Implement handler.ts
   - Create route.ts

## Daily Workflow - Step by Step

### Starting Your Day

1. **Check Project Status**
   ```bash
   git pull
   bun install  # If package.json changed
   bun run docker:up  # Start services
   ```

2. **Read Context**
   - Open `/CLAUDE.md` for project overview
   - Check `/docs/task-list.md` for current task
   - Review recent commits: `git log --oneline -10`

3. **Find Your Task**
   - Look for tasks marked 🟡 (High Priority) or 🟢 (Normal)
   - Read task description and acceptance criteria

### Implementing a Feature

1. **Create Feature Branch**
   ```bash
   git checkout -b feat/quiz-timer
   ```

2. **Start with Tests (TDD)**
   ```typescript
   // Write failing test first
   bun run test --watch QuizSession.test.ts
   ```

3. **Implement Domain Logic**
   - Create/modify aggregates, entities, VOs
   - Keep domain pure (no framework deps)

4. **Create Use Case Slice**
   ```bash
   mkdir -p features/quiz/add-timer
   touch handler.ts handler.test.ts dto.ts validation.ts route.ts
   ```

5. **Wire Up Route**
   ```typescript
   // In routes.ts
   .route('/quiz', addTimerRoute)
   ```

### Before Committing

1. **Run Quality Checks**
   ```bash
   bun run typecheck  # TypeScript validation
   bun run format     # Auto-format code
   bun run check      # Lint with fixes
   ```

2. **Run All Tests**
   ```bash
   bun run test
   bun run test --coverage  # Verify 80%+
   ```

3. **Review Changes**
   ```bash
   git diff
   git status
   ```

4. **Commit with Convention**
   ```bash
   git add .
   git commit -m "✨ feat(quiz): add timer functionality"
   ```

5. **Update Task Status**
   - Add comment in task-list.md if needed
   - Mark subtasks as completed

### End of Day

1. **Push Your Work**
   ```bash
   git push -u origin feat/quiz-timer
   ```

2. **Create Draft PR** (if multi-day task)
   ```bash
   gh pr create --draft --title "feat(quiz): add timer"
   ```

3. **Stop Services**
   ```bash
   bun run docker:down
   ```

## Code Quality Checks

After completing code edits, **always run**: `bun run typecheck && bun run format && bun run check`

This ensures TypeScript types are correct, applies consistent formatting, and runs linting rules.

## Important Reminders

- Mobile-first design (test on small screens)
- Dark mode support required
- Accessibility (ARIA labels, keyboard nav)
- Keep functions focused (see Function Size Guidelines)
- Document complex logic with comments

## Test Strategy

### Test Types & Coverage Targets

| Layer | Test Type | Coverage Target | Tools | Key Patterns |
|-------|-----------|----------------|-------|--------------|
| Domain | Unit | 90% | Vitest | Pure functions, no I/O, test factories |
| Repository | Integration | 80% | Vitest + TestContainers | Real DB, transaction isolation |
| Handler | Unit | 80% | Vitest | Mock repositories, test orchestration |
| Route | Contract | Critical paths | Vitest + Supertest | Full HTTP, real DB |
| E2E | UI | User journeys | Playwright | Browser automation |

### Writing Domain Tests

```typescript
// QuizSession.test.ts
import { describe, it, expect } from 'vitest';
import { testIds, TestClock } from '@api/test-support';

describe('QuizSession', () => {
  it('should enforce business rules', () => {
    // Arrange
    const clock = new TestClock('2025-01-01T00:00:00Z');
    const userId = testIds.userId();
    
    // Act
    const session = QuizSession.create(config, userId, clock);
    
    // Assert
    expect(session.isExpired(clock)).toBe(false);
  });
});
```

### Writing Repository Tests

```typescript
// DrizzleQuizRepository.test.ts
import { withTestDb, withRollback } from '@api/testing/infra/db';

describe('DrizzleQuizRepository', () => {
  it('should save and retrieve', async () => {
    await withTestDb(async (db) => {
      await withRollback(db, async (trx) => {
        // Arrange
        const repo = new DrizzleQuizRepository(trx);
        const session = QuizSession.create(/*...*/);
        
        // Act
        await repo.save(session);
        const retrieved = await repo.findById(session.id);
        
        // Assert
        expect(retrieved).toEqual(session);
      });
    });
  });
});
```

### Writing Handler Tests

```typescript
// handler.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('startQuizHandler', () => {
  it('should start quiz', async () => {
    // Arrange
    const mockRepo = {
      findActiveSession: vi.fn().mockResolvedValue(null),
      save: vi.fn()
    };
    
    // Act
    const result = await startQuiz(input, userId, mockRepo);
    
    // Assert
    expect(result.success).toBe(true);
    expect(mockRepo.save).toHaveBeenCalledOnce();
  });
});
```

### Test Organization Rules

1. **Co-locate tests**: `QuizSession.ts` → `QuizSession.test.ts`
2. **Use descriptive names**: `should calculate score when all answers correct`
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **One assertion per test** (when possible)
5. **Test behavior, not implementation**
6. **Use test factories** for complex objects
7. **Mock at the boundary** (repositories, external services)

### Running Tests

```bash
# Run all tests
bun run test

# Run specific file
bun run test QuizSession.test.ts

# Run with coverage
bun run test --coverage

# Watch mode for TDD
bun run test --watch

# Run only unit tests
bun run test --grep "unit"

# Run integration tests
bun run test --grep "integration"
```

## Testing Commands

- `bun run test` - Run all tests
- `bun run test [file]` - Run specific test file
- `bun run test --coverage` - Check coverage (min 80%)
- `bun run test --watch` - Watch mode for TDD

## Common Mistakes to Avoid

### Architecture Violations
- ❌ **Cross-slice imports**: `import { QuizService } from '../user/services'`
- ✅ **Use events instead**: Publish domain events for cross-boundary communication

- ❌ **Framework in domain**: `import { Context } from 'hono'` in domain files
- ✅ **Keep domain pure**: Only TypeScript, no framework dependencies

- ❌ **Direct DB access**: Using `db` directly in handlers
- ✅ **Use repositories**: Always go through repository pattern with transactions

### Testing Anti-Patterns
- ❌ **Testing implementation**: `expect(service._privateMethod()).toBe(...)`
- ✅ **Test behavior**: `expect(result.score).toBe(expectedScore)`

- ❌ **No test isolation**: Tests depend on each other
- ✅ **Independent tests**: Each test sets up its own data

- ❌ **Skipping TDD**: Writing code first, tests later
- ✅ **Red-Green-Refactor**: Always start with failing test

### Code Quality Issues
- ❌ **Using `any`**: `const data: any = await fetch(...)`
- ✅ **Explicit types**: `const data: QuizResponse = await fetch(...)`

- ❌ **Throwing exceptions**: `throw new Error('Not found')`
- ✅ **Result types**: `return err(new NotFoundError('Quiz not found'))`

### Function Size Guidelines

Different types of functions have different limits:

| Function Type | Line Limit | Examples |
|---------------|------------|----------|
| **Pure domain logic** | ≤ 20 lines | Value object methods, entity business rules |
| **Stateless helpers** | ≤ 20 lines | Utility functions, formatters |
| **Use case handlers** | ≤ 40 lines | HTTP handlers, orchestration layers |
| **UI components** | ≤ 60 lines | Svelte components (includes markup) |
| **Test cases** | No limit | Tests should be readable above all |

**Note**: Line counts exclude imports, blank lines, and comments.

Signs a function needs splitting:
- **Cognitive complexity > 15** (Biome will warn with `noExcessiveCognitiveComplexity`)
- **Multiple responsibilities** (can't describe with one verb)
- **Difficult to test** (too many mocks needed)
- **Name doesn't match content** (doing more than name suggests)

**Note**: Biome checks cognitive complexity (not line count) with the `noExcessiveCognitiveComplexity` rule set to max 15.

## Quick Reference

### Essential Commands
```bash
# Development
bun run dev              # Start all services
bun run test --watch     # TDD mode
bun run check           # Format + lint

# Database
bun run db:generate     # Generate migration
bun run db:migrate      # Apply migrations
bun run db:studio       # GUI for database

# Quality
bun run typecheck       # Type checking
bun run test --coverage # Coverage report
```

### File Templates

**New Feature Slice**: `features/[context]/[use-case]/`
- `handler.ts` - Business logic with transaction
- `handler.test.ts` - Unit tests for handler
- `dto.ts` - Request/response types
- `validation.ts` - Zod schemas
- `route.ts` - HTTP endpoint

**Domain Layer**: `features/[context]/domain/`
- `aggregates/` - Rich domain models
- `entities/` - Domain entities
- `value-objects/` - Immutable VOs
- `repositories/` - Interfaces + implementations
- `events/` - Domain events

### Import Cheat Sheet
```typescript
// External
import { z } from 'zod';

// Cross-package
import { Result } from '@certquiz/shared';

// Infrastructure
import { withTransaction } from '@api/infra/unit-of-work';

// Domain (relative within feature)
import { QuizSession } from '../domain/aggregates/QuizSession';

// Co-located (same folder)
import { startQuizSchema } from './validation';
```

### Test Patterns
```typescript
// Domain test
import { testIds, TestClock } from '@api/test-support';

// Repository test  
import { withTestDb, withRollback } from '@api/testing/infra/db';

// Handler test
import { vi } from 'vitest';
const mockRepo = { save: vi.fn() };
```

Remember: Quality over speed. Write clean, tested code that follows the established patterns.