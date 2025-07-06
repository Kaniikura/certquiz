# Project Structure - Vertical Slice Architecture with DDD

## Overview

This document describes the project structure for CertQuiz using **Vertical Slice Architecture (VSA)** with **Domain-Driven Design (DDD)** principles. This architecture organizes code by features/use cases rather than technical layers, promoting high cohesion and maintainability.

**Key Principles**:
- **Vertical Slice Architecture**: Each feature contains all layers (presentation, application, domain, infrastructure)
- **Domain-Driven Design**: Rich domain models with business logic
- **DbContext Pattern**: Single database context instead of repository interfaces
- **No CQRS**: Unified approach for commands and queries

## Project Structure

```
certquiz/
├── CLAUDE.md                    # Project context at root (required by Claude Code)
├── README.md                    # Public project documentation
├── .env.example                 # Environment template
├── .gitignore
├── package.json                 # Root monorepo config
├── bun.lock
├── tsconfig.json               # Root TypeScript config
├── biome.json                  # Biome linter/formatter config
│
├── apps/                       # Application packages
│   ├── web/                    # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api/       # API client
│   │   │   │   ├── stores/    # Svelte stores
│   │   │   │   └── utils/
│   │   │   ├── routes/
│   │   │   └── app.html
│   │   ├── static/
│   │   ├── package.json
│   │   └── svelte.config.js
│   │
│   └── api/                    # Hono backend (VSA + DDD)
│       ├── db/                 # Database layer (kept centralized)
│       │   ├── schema/         # Drizzle table definitions
│       │   │   ├── index.ts    # Schema exports
│       │   │   ├── enums.ts    # PostgreSQL enums
│       │   │   ├── user.ts     # User tables
│       │   │   ├── quiz.ts     # Quiz tables
│       │   │   └── ...         # Other domain tables
│       │   ├── migrations/     # Generated migration files
│       │   └── DbContext.ts    # Global database context
│       ├── src/
│       │   ├── index.ts        # Application entry point
│       │   ├── routes.ts       # Route composition root
│       │   ├── config/         # Environment configuration
│       │   │   ├── env.ts      # Typed environment variables
│       │   │   └── index.ts    # Config exports
│       │   ├── features/       # Feature slices (VSA)
│       │   │   ├── quiz/       # Quiz bounded context
│       │   │   │   ├── start-quiz/         # Use case: Start a quiz
│       │   │   │   │   ├── handler.ts      # Application logic
│       │   │   │   │   ├── handler.test.ts # Co-located test
│       │   │   │   │   ├── dto.ts          # Input/output DTOs
│       │   │   │   │   ├── validation.ts   # Zod schemas
│       │   │   │   │   ├── db.ts           # Slice-specific queries
│       │   │   │   │   └── route.ts        # Hono route definition
│       │   │   │   ├── submit-answer/      # Use case: Submit answer
│       │   │   │   │   └── ...
│       │   │   │   ├── get-quiz-results/   # Use case: Get results
│       │   │   │   │   └── ...
│       │   │   │   └── domain/             # Domain layer
│       │   │   │       ├── entities/
│       │   │   │       │   ├── Quiz.ts
│       │   │   │       │   └── Question.ts
│       │   │   │       ├── value-objects/
│       │   │   │       │   ├── QuizId.ts
│       │   │   │       │   └── Score.ts
│       │   │   │       └── aggregates/
│       │   │   │           └── QuizSession.ts
│       │   │   ├── user/       # User bounded context
│       │   │   │   ├── register/           # Use case: Register user
│       │   │   │   ├── update-progress/    # Use case: Update progress
│       │   │   │   └── domain/
│       │   │   └── auth/       # Auth bounded context
│       │   │       ├── login/              # Use case: Login
│       │   │       ├── refresh-token/      # Use case: Refresh token
│       │   │       └── middleware/         # Auth middleware
│       │   ├── system/         # System/operational features
│       │   │   └── health/     # Health check endpoint
│       │   │       ├── handler.ts
│       │   │       └── route.ts
│       │   ├── shared/         # Shared kernel
│       │   │   ├── logger.ts   # Structured logging
│       │   │   ├── result.ts   # Result<T, E> type
│       │   │   ├── errors.ts   # Base error classes
│       │   │   └── types.ts    # Shared TypeScript types
│       │   ├── infrastructure/ # External adapters
│       │   │   ├── database.ts # Drizzle connection wrapper
│       │   │   ├── keycloak.ts # Auth provider client
│       │   │   └── email.ts    # Email service (future)
│       │   └── middleware/     # Global HTTP middleware
│       │       ├── error.middleware.ts
│       │       └── rate-limit.middleware.ts
│       ├── tests/              # Integration & E2E tests
│       │   ├── containers/     # Testcontainers setup
│       │   ├── integration/    # Cross-feature tests
│       │   └── e2e/            # End-to-end tests
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── drizzle.config.ts
│
├── packages/                   # Shared packages
│   ├── shared/                 # Cross-app shared code
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   └── typespec/              # API specifications
│       ├── main.tsp
│       └── package.json
│
├── docs/                      # Documentation
│   ├── project-structure.md   # THIS FILE
│   ├── database-schema.md
│   ├── api-specification.md
│   └── adr/                   # Architecture Decision Records
│
├── docker/                    # Container configurations
└── scripts/                   # Utility scripts
```

> 📝 **Co-located File Conventions**: 
> - **Unit tests** are co-located with source files using the `.test.ts` suffix (e.g., `handler.ts` → `handler.test.ts`)
> - **All files for a use case** live in the same folder (handler, tests, DTOs, validation, queries)
> - This convention applies throughout the codebase except for integration/E2E tests which remain in the `tests/` directory

## Key Design Decisions

### 1. Vertical Slice Architecture (VSA) 🔑
Each feature is organized as a vertical slice containing all layers (presentation, application, domain, infrastructure) for a specific use case. This promotes:
- **High cohesion**: Everything related to a feature is in one place
- **Low coupling**: Features are independent and can be developed/deployed separately
- **Easy navigation**: Find all code for a use case in one folder

### 2. Domain-Driven Design (DDD) 🏛️
Business logic lives in domain entities, value objects, and aggregates:
- **Entities**: Objects with identity (Quiz, User)
- **Value Objects**: Immutable objects without identity (QuizId, Score)
- **Aggregates**: Consistency boundaries (QuizSession)
- **Domain layer is pure**: No framework dependencies, just TypeScript

### 3. DbContext Pattern 📊
Instead of repository interfaces, we use a DbContext pattern:
- **Single DbContext**: Global Drizzle instance with all table access
- **Slice-specific queries**: Each use case exposes only the queries it needs
- **Type safety**: Full TypeScript support from Drizzle ORM
- **No abstraction overhead**: Direct, performant database access

### 4. Co-located Tests ✅
Tests live next to the code they test. This follows TDD best practices:
- Write test first: `handler.test.ts`
- Implement handler: `handler.ts`
- Run tests in watch mode: `bun test --watch`

### 5. Shared Kernel 🔧
Common utilities and types in `shared/` folder:
- **logger.ts**: Pino logger instance
- **result.ts**: Result<T, E> type for consistent error handling
- **errors.ts**: Base error classes
- **types.ts**: Shared TypeScript types

### 6. Infrastructure Layer 🏗️
External adapters kept separate from business logic:
- **database.ts**: Drizzle connection wrapper (existing)
- **keycloak.ts**: Auth provider integration
- **email.ts**: Email service (future)

### 7. Route Composition 🚦
Each slice exports its own routes, composed in one place:
```typescript
// features/quiz/start-quiz/route.ts
export const startQuizRoute = new Hono()
  .post('/start', startQuizHandler)

// src/routes.ts (composition root)
export const appRoutes = new Hono()
  .route('/quiz', startQuizRoute)
  .route('/users', userRoutes)
```

## Migration Strategy

### From Current Module Structure to VSA

1. **Create new feature folders** as you work on each module:
   ```
   modules/quiz/quiz.service.ts → features/quiz/start-quiz/handler.ts
   modules/quiz/quiz.routes.ts  → features/quiz/start-quiz/route.ts
   modules/quiz/quiz.db.ts      → features/quiz/start-quiz/db.ts
   ```

2. **Keep both structures** during transition:
   - Old code continues to work
   - New features use VSA structure
   - Delete old modules when no longer referenced

3. **System features** (health, metrics) go in `system/` not `features/`

### When to Add Domain Complexity

Start simple, add DDD concepts when needed:

1. **Start with DTOs**: Simple data structures
2. **Add Entities**: When business rules emerge
3. **Add Value Objects**: When you need immutability/validation
4. **Add Aggregates**: When you need transaction boundaries

## Linting & Code Quality

### Biome Configuration

Using [Biome 2.x](https://biomejs.dev) for fast, all-in-one formatting and linting:

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "ignore": ["**/dist", "**/node_modules", "**/.svelte-kit"]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "nursery": {
        "noImportCycles": "error"  // Prevent circular dependencies
      },
      "complexity": {
        "noExplicitAny": "error",   // No any types
        "useArrowFunction": "error"  // Prefer arrow functions
      },
      "style": {
        "useConst": "error",
        "useTemplate": "error"       // Use template literals
      },
      "suspicious": {
        "noConsole": "warn"         // Warn on console usage
      }
    }
  },
  "javascript": {
    "formatter": {
      "semicolons": "asNeeded",
      "quoteStyle": "single"
    }
  }
}
```

### Key Linting Rules for Phase 1

1. **No circular imports** - Enforced by Biome's `nursery/noImportCycles`
2. **No `any` types** - Enforced by `complexity/noExplicitAny`
3. **Consistent code style** - Automatic formatting with Biome
4. **No console in production** - Warning via `suspicious/noConsole`

### VS Code Integration

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit"
  }
}
```

## TypeScript Configuration

### Path Aliases

Configure path aliases in `apps/api/tsconfig.json` for cleaner imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@api/*": ["./src/*"]
    }
  }
}
```

This allows imports like:
```typescript
import { QuizService } from '@api/modules/quiz';
```

### Docker Configuration

Create `apps/api/.dockerignore` to exclude unnecessary files from the Docker build:

```
# Dependencies
node_modules/

# Test files
src/tests/
**/*.test.ts
**/*.spec.ts

# Development files
.env.local
.env.development

# Documentation
README.md
docs/

# Source maps
**/*.map

# TypeScript cache
*.tsbuildinfo
```

## Development Workflow

### 1. Adding a New Use Case

```bash
# 1. Create use case folder
mkdir -p apps/api/src/features/quiz/submit-answer

# 2. Write test first (TDD)
touch apps/api/src/features/quiz/submit-answer/handler.test.ts

# 3. Create use case files
touch apps/api/src/features/quiz/submit-answer/handler.ts      # Application logic
touch apps/api/src/features/quiz/submit-answer/dto.ts          # Input/output types
touch apps/api/src/features/quiz/submit-answer/validation.ts   # Zod schemas
touch apps/api/src/features/quiz/submit-answer/db.ts           # Database queries
touch apps/api/src/features/quiz/submit-answer/route.ts        # HTTP route

# 4. If domain logic is needed, add to domain folder
mkdir -p apps/api/src/features/quiz/domain/entities
touch apps/api/src/features/quiz/domain/entities/Answer.ts
```

### 2. TDD Workflow

```bash
# Run tests in watch mode
bun test --watch features/quiz/submit-answer

# Red: Write failing test
# Green: Implement minimal code to pass
# Refactor: Improve code while keeping tests green
```

### 3. Adding DbContext Queries

```typescript
// features/quiz/submit-answer/db.ts
import { db } from '@/infrastructure/database'
import { sessionQuestions } from '@/db/schema'

export const submitAnswerDb = {
  async updateAnswer(sessionId: string, questionId: string, answer: string) {
    return db.update(sessionQuestions)
      .set({ selectedOptions: [answer], answeredAt: new Date() })
      .where(and(
        eq(sessionQuestions.sessionId, sessionId),
        eq(sessionQuestions.questionId, questionId)
      ))
  }
}
```

## What NOT to Do

1. **Don't create repository interfaces** - DbContext pattern is sufficient
2. **Don't implement CQRS** - Unified handlers for both commands and queries
3. **Don't over-engineer domain models** - Start simple, add complexity when needed
4. **Don't scatter related code** - Keep use case files together
5. **Don't skip tests** - TDD is mandatory, no exceptions

## Benefits of VSA + DDD

1. **Feature Independence** - Each slice can be developed/tested in isolation
2. **Clear Boundaries** - Obvious where code belongs
3. **Easy Navigation** - All code for a use case in one folder
4. **Rich Domain Models** - Business logic lives in the right place
5. **Type Safety** - End-to-end TypeScript with Drizzle
6. **Testability** - Pure domain logic, co-located tests

## Example: Start Quiz Use Case

```typescript
// features/quiz/start-quiz/dto.ts
export interface StartQuizInput {
  questionCount: number
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface StartQuizOutput {
  quizId: string
  firstQuestion: QuestionDto
}

// features/quiz/start-quiz/validation.ts
import { z } from 'zod'

export const startQuizSchema = z.object({
  questionCount: z.number().int().min(1).max(50),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
})

// features/quiz/start-quiz/handler.ts
import { Result, ok, err } from '@/shared/result'
import { QuizSession } from '../domain/aggregates/QuizSession'
import { startQuizDb } from './db'
import type { StartQuizInput, StartQuizOutput } from './dto'

export async function startQuiz(
  input: StartQuizInput,
  userId: string
): Promise<Result<StartQuizOutput, StartQuizError>> {
  // Domain logic
  const session = QuizSession.create({
    userId,
    questionCount: input.questionCount,
    category: input.category,
  })

  if (!session.isValid()) {
    return err(new StartQuizError('Invalid quiz configuration'))
  }

  // Persistence
  try {
    const questions = await startQuizDb.getRandomQuestions(input)
    const savedSession = await startQuizDb.createSession(session, questions)
    
    return ok({
      quizId: savedSession.id,
      firstQuestion: questions[0],
    })
  } catch (error) {
    return err(new StartQuizError('Failed to start quiz', error))
  }
}

// features/quiz/start-quiz/route.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { startQuiz } from './handler'
import { startQuizSchema } from './validation'

export const startQuizRoute = new Hono()
  .post('/start',
    zValidator('json', startQuizSchema),
    async (c) => {
      const input = c.req.valid('json')
      const userId = c.get('user').id
      
      const result = await startQuiz(input, userId)
      
      if (!result.success) {
        return c.json({ error: result.error.message }, 400)
      }
      
      return c.json(result.data)
    }
  )

// features/quiz/domain/aggregates/QuizSession.ts
export class QuizSession {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly questionCount: number,
    public readonly category?: string,
    private _startedAt: Date = new Date()
  ) {}

  static create(props: CreateQuizSessionProps): QuizSession {
    return new QuizSession(
      generateId(),
      props.userId,
      props.questionCount,
      props.category
    )
  }

  isValid(): boolean {
    return this.questionCount > 0 && this.questionCount <= 50
  }
}
```

## DbContext Implementation

```typescript
// db/DbContext.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export class DbContext {
  private readonly db
  
  constructor(connectionString: string) {
    const pool = new Pool({ connectionString })
    this.db = drizzle(pool, { schema })
  }

  // Expose table-specific helpers
  get users() {
    return {
      all: () => this.db.select().from(schema.users),
      byId: (id: string) => 
        this.db.query.users.findFirst({ where: eq(schema.users.id, id) }),
      byEmail: (email: string) =>
        this.db.query.users.findFirst({ where: eq(schema.users.email, email) })
    }
  }

  get quizzes() {
    return {
      all: () => this.db.select().from(schema.quizzes),
      byId: (id: string) =>
        this.db.query.quizzes.findFirst({ where: eq(schema.quizzes.id, id) })
    }
  }

  // Transaction support
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.db.transaction(fn)
  }
}

// Singleton instance
export const dbContext = new DbContext(process.env.DATABASE_URL!)
```

## Testing Strategy

### Unit Tests (Co-located)
```typescript
// features/quiz/start-quiz/handler.test.ts
import { describe, it, expect } from 'vitest'
import { startQuiz } from './handler'

describe('startQuiz', () => {
  it('should create a quiz session with valid input', async () => {
    const result = await startQuiz(
      { questionCount: 10, category: 'networking' },
      'user-123'
    )
    
    expect(result.success).toBe(true)
    expect(result.data.quizId).toBeDefined()
  })
})
```

### Integration Tests
```typescript
// tests/integration/quiz-flow.test.ts
import { testDb } from '../containers'

describe('Quiz Flow Integration', () => {
  it('should complete full quiz lifecycle', async () => {
    // Test across multiple use cases
  })
})
```

## Key Principles Summary

1. **Vertical Slices**: Organize by use case, not by layer
2. **Domain First**: Rich domain models with business logic
3. **DbContext**: Direct database access without repository interfaces
4. **TDD Mandatory**: Write tests before implementation
5. **Co-location**: Keep related files together
6. **Pragmatism**: Start simple, add complexity when needed

## Migration Checklist

- [ ] Create `features/` directory structure
- [ ] Move `modules/health/` to `system/health/`
- [ ] Create DbContext in `db/DbContext.ts`
- [ ] Migrate first use case (e.g., start-quiz)
- [ ] Update route composition in `routes.ts`
- [ ] Run tests to ensure nothing breaks
- [ ] Continue migrating one use case at a time