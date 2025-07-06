# Project Structure - Vertical Slice Architecture with Repository Pattern

## Overview

This document describes the project structure for CertQuiz using **Vertical Slice Architecture (VSA)** with **Domain-Driven Design (DDD)** and a **thin Repository Pattern**. This architecture organizes code by features/use cases with proper persistence isolation.

**Key Principles**:
- **Vertical Slice Architecture**: Each feature contains all layers in one folder
- **Domain-Driven Design**: Rich domain models with business logic
- **Repository Pattern**: Thin interfaces for persistence isolation
- **Unit of Work**: Transaction boundaries via Drizzle's transaction wrapper
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
│   └── api/                    # Hono backend (VSA + DDD + Repository)
│       ├── db/                 # Database layer (centralized infrastructure)
│       │   ├── schema/         # Drizzle table definitions
│       │   │   ├── index.ts    # Bounded context exports
│       │   │   ├── enums.ts    # PostgreSQL enums
│       │   │   ├── user.ts     # User bounded context tables
│       │   │   ├── quiz.ts     # Quiz bounded context tables
│       │   │   ├── question.ts # Question bounded context tables
│       │   │   ├── exam.ts     # Exam/Category tables
│       │   │   ├── community.ts # Community tables
│       │   │   ├── system.ts   # System tables
│       │   │   └── relations.ts # Drizzle relationships
│       │   ├── migrations/     # Generated migration files
│       │   └── seeds/          # Seed data
│       ├── src/
│       │   ├── index.ts        # Application entry point
│       │   ├── routes.ts       # Route composition root
│       │   ├── features/       # Feature slices (vertical slices)
│       │   │   ├── quiz/       # Quiz bounded context
│       │   │   │   ├── start-quiz/         # Use case: Start a quiz
│       │   │   │   │   ├── handler.ts      # Application logic (uses repository)
│       │   │   │   │   ├── handler.test.ts # Handler tests (mocks repository)
│       │   │   │   │   ├── dto.ts          # Input/output DTOs
│       │   │   │   │   ├── validation.ts   # Zod schemas
│       │   │   │   │   └── route.ts        # Hono route definition
│       │   │   │   ├── submit-answer/      # Use case: Submit answer
│       │   │   │   │   └── ...             # Same structure
│       │   │   │   ├── get-results/        # Use case: Get results
│       │   │   │   │   └── ...             # Same structure
│       │   │   │   └── domain/             # Domain layer (quiz BC)
│       │   │   │       ├── entities/
│       │   │   │       │   ├── Quiz.ts
│       │   │   │       │   └── Question.ts
│       │   │   │       ├── value-objects/
│       │   │   │       │   ├── QuizId.ts
│       │   │   │       │   ├── Score.ts
│       │   │   │       │   └── QuizConfig.ts
│       │   │   │       ├── aggregates/
│       │   │   │       │   └── QuizSession.ts
│       │   │   │       └── repositories/
│       │   │   │           ├── IQuizRepository.ts      # Interface (domain)
│       │   │   │           └── DrizzleQuizRepository.ts # Implementation
│       │   │   ├── user/       # User bounded context
│       │   │   │   ├── register/           # Use case: Register
│       │   │   │   ├── update-progress/    # Use case: Update progress
│       │   │   │   ├── get-profile/        # Use case: Get profile
│       │   │   │   └── domain/
│       │   │   │       ├── entities/
│       │   │   │       │   └── User.ts
│       │   │   │       ├── value-objects/
│       │   │   │       │   ├── UserId.ts
│       │   │   │       │   └── Email.ts
│       │   │   │       └── repositories/
│       │   │   │           ├── IUserRepository.ts
│       │   │   │           └── DrizzleUserRepository.ts
│       │   │   ├── auth/       # Auth bounded context
│       │   │   │   ├── login/              # Use case: Login
│       │   │   │   ├── refresh-token/      # Use case: Refresh
│       │   │   │   ├── logout/             # Use case: Logout
│       │   │   │   ├── middleware/         # Auth middleware
│       │   │   │   └── domain/
│       │   │   │       └── repositories/   # Reuses User repository
│       │   │   └── question/   # Question bounded context
│       │   │       ├── list-questions/     # Use case: List
│       │   │       ├── get-question/       # Use case: Get one
│       │   │       ├── create-question/    # Use case: Create
│       │   │       └── domain/
│       │   │           └── repositories/   # Reuses Quiz domain
│       │   ├── system/         # System/operational features
│       │   │   └── health/     # Health check endpoint
│       │   │       ├── handler.ts
│       │   │       ├── handler.test.ts
│       │   │       └── route.ts
│       │   ├── infra/          # Infrastructure layer
│       │   │   ├── db/
│       │   │   │   ├── client.ts          # Postgres → Drizzle wrapper
│       │   │   │   └── unit-of-work.ts    # Transaction helper
│       │   │   ├── events/                # Domain event dispatcher
│       │   │   │   └── EventBus.ts
│       │   │   ├── keycloak/              # Auth provider
│       │   │   │   └── KeycloakClient.ts
│       │   │   └── email/                 # Email service (future)
│       │   ├── shared/         # Shared kernel
│       │   │   ├── logger.ts   # Pino structured logging
│       │   │   ├── result.ts   # Result<T, E> type
│       │   │   ├── errors.ts   # Domain & application errors
│       │   │   ├── types.ts    # Shared TypeScript types
│       │   │   └── utils.ts    # Common utilities
│       │   └── middleware/     # Global HTTP middleware
│       │       ├── error.middleware.ts
│       │       ├── logging.middleware.ts
│       │       ├── request-id.middleware.ts
│       │       ├── cors.middleware.ts
│       │       └── rate-limit.middleware.ts
│       ├── tests/              # Cross-cutting tests
│       │   ├── containers/     # Testcontainers setup
│       │   ├── integration/    # Multi-feature tests
│       │   ├── e2e/            # End-to-end tests
│       │   └── fixtures/       # Test data factories
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── drizzle.config.ts
│
├── packages/                   # Shared packages
│   ├── shared/                 # Cross-app shared code
│   │   ├── src/
│   │   │   ├── types/         # Shared domain types
│   │   │   ├── constants/     # App-wide constants
│   │   │   └── utils/         # Shared utilities
│   │   └── package.json
│   └── typespec/              # API specifications
│       ├── main.tsp           # TypeSpec definitions
│       └── package.json
│
├── docs/                      # Documentation
│   ├── project-structure.md   # THIS FILE
│   ├── database-schema.md
│   ├── api-specification.md
│   ├── vsa-implementation-plan.md
│   └── adr/                   # Architecture Decision Records
│
├── docker/                    # Container configurations
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── docker-compose.yml
│
└── scripts/                   # Utility scripts
    ├── migrate.ts             # Database migration runner
    ├── seed.ts                # Database seeder
    └── codegen.ts             # Code generation scripts
```

> 📝 **Key Conventions**:
> - **Co-located tests**: Unit tests use `.test.ts` suffix next to source files
> - **Repository pattern**: Interface in domain, implementation alongside
> - **Use case folders**: Each contains handler, DTO, validation, route
> - **Domain isolation**: Pure TypeScript, no framework dependencies
> - **Transaction scope**: All handlers wrapped in `withTransaction`

## Architecture Layers

### 1. Presentation Layer (Routes)
Thin HTTP layer that delegates to handlers:
```typescript
// features/quiz/start-quiz/route.ts
export const startQuizRoute = new Hono()
  .post('/start', 
    zValidator('json', startQuizSchema),
    authMiddleware,
    startQuizHandler
  )
```

### 2. Application Layer (Handlers)
Orchestrates use cases with transaction boundaries:
```typescript
// features/quiz/start-quiz/handler.ts
export async function startQuizHandler(c: Context) {
  const input = c.req.valid('json')
  const userId = c.get('user').id
  
  return withTransaction(async (trx) => {
    const repo = new DrizzleQuizRepository(trx)
    const result = await startQuiz(input, userId, repo)
    
    if (!result.success) {
      return c.json({ error: result.error.message }, 400)
    }
    
    return c.json(result.data)
  })
}
```

### 3. Domain Layer (Pure Business Logic)
Rich domain models with no infrastructure dependencies:
```typescript
// features/quiz/domain/aggregates/QuizSession.ts
export class QuizSession {
  private constructor(
    public readonly id: QuizId,
    public readonly userId: UserId,
    private questions: Question[],
    private answers: Map<QuestionId, Answer>
  ) {}

  static create(config: QuizConfig, userId: UserId): QuizSession {
    // Domain validation
    if (config.questionCount < 1 || config.questionCount > 50) {
      throw new DomainError('Invalid question count')
    }
    
    return new QuizSession(
      QuizId.generate(),
      userId,
      [],
      new Map()
    )
  }

  submitAnswer(questionId: QuestionId, answer: Answer): void {
    // Business rules
    if (this.isComplete()) {
      throw new DomainError('Quiz already completed')
    }
    
    this.answers.set(questionId, answer)
  }

  calculateScore(): Score {
    // Domain logic
    const correct = Array.from(this.answers.entries())
      .filter(([qId, answer]) => {
        const question = this.questions.find(q => q.id.equals(qId))
        return question?.isCorrect(answer)
      }).length
    
    return Score.of(correct, this.questions.length)
  }
}
```

### 4. Infrastructure Layer
Implements domain interfaces with external services:
```typescript
// features/quiz/domain/repositories/DrizzleQuizRepository.ts
export class DrizzleQuizRepository implements IQuizRepository {
  constructor(private readonly trx: PostgresJsTransaction) {}

  async findActiveSession(userId: UserId): Promise<QuizSession | null> {
    const row = await this.trx.query.quizSessions.findFirst({
      where: and(
        eq(quizSessions.userId, userId.value),
        isNull(quizSessions.completedAt)
      ),
      with: {
        questions: {
          with: { question: true }
        }
      }
    })

    return row ? QuizSession.fromPersistence(row) : null
  }

  async save(session: QuizSession): Promise<void> {
    const data = session.toPersistence()
    
    await this.trx.insert(quizSessions)
      .values(data)
      .onConflictDoUpdate({
        target: quizSessions.id,
        set: data
      })
  }
}
```

## Key Design Decisions

### 1. Repository Pattern with Domain Focus 🎯
- **Interfaces in domain**: Part of the ubiquitous language
- **Implementations in infrastructure**: Swappable persistence
- **Thin abstraction**: Only methods needed by use cases
- **No generic repositories**: Each repository is domain-specific

### 2. Unit of Work via Transaction Wrapper 🔄
```typescript
// infra/unit-of-work.ts
import { db } from './db/client'

export const withTransaction = db.transaction.bind(db)

// Usage in handler
export async function handler(c: Context) {
  return withTransaction(async (trx) => {
    const userRepo = new DrizzleUserRepository(trx)
    const quizRepo = new DrizzleQuizRepository(trx)
    // All operations share the same transaction
  })
}
```

### 3. Vertical Slice Organization 📁
Each use case is self-contained:
```
features/quiz/start-quiz/
├── handler.ts      # Orchestration + transaction
├── handler.test.ts # Mock repositories
├── dto.ts          # Input/Output types
├── validation.ts   # Request validation
├── route.ts        # HTTP endpoint
└── README.md       # Use case documentation
```

### 4. Domain Model Evolution 📈
Start simple, add complexity as needed:
1. **Phase 1**: Simple entities with basic validation
2. **Phase 2**: Add value objects for type safety
3. **Phase 3**: Introduce aggregates for invariants
4. **Phase 4**: Domain events for decoupling

### 5. Testing Strategy 🧪
- **Domain tests**: Pure unit tests, no dependencies (90% coverage)
- **Repository tests**: In-memory SQLite for speed
- **Handler tests**: Mock repositories, test orchestration
- **Contract tests**: Real database, full integration

## Development Workflow

### 1. Creating a New Feature Slice

```bash
# 1. Create feature structure
mkdir -p apps/api/src/features/quiz/submit-answer

# 2. Start with failing test (TDD)
cat > apps/api/src/features/quiz/submit-answer/handler.test.ts << 'EOF'
import { describe, it, expect, vi } from 'vitest'
import { submitAnswerHandler } from './handler'

describe('submitAnswerHandler', () => {
  it('should submit answer successfully', async () => {
    // Arrange
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(mockQuizSession),
      save: vi.fn()
    }
    
    // Act & Assert
    // ...
  })
})
EOF

# 3. Implement handler
cat > apps/api/src/features/quiz/submit-answer/handler.ts << 'EOF'
import { withTransaction } from '@/infra/unit-of-work'
import { DrizzleQuizRepository } from '../domain/repositories/DrizzleQuizRepository'

export async function submitAnswerHandler(c: Context) {
  const { quizId, questionId, answer } = c.req.valid('json')
  const userId = c.get('user').id
  
  return withTransaction(async (trx) => {
    const repo = new DrizzleQuizRepository(trx)
    // Implementation
  })
}
EOF

# 4. Create other files
touch dto.ts validation.ts route.ts

# 5. Wire up route
# In src/routes.ts:
# .route('/quiz', submitAnswerRoute)
```

### 2. Adding Domain Complexity

```typescript
// Start simple
class Quiz {
  constructor(
    public id: string,
    public userId: string,
    public questions: string[]
  ) {}
}

// Evolve to value objects
class Quiz {
  constructor(
    public id: QuizId,
    public userId: UserId,
    public questions: Question[]
  ) {}
}

// Add aggregate behavior
class QuizSession {
  private constructor(
    private readonly id: QuizId,
    private readonly config: QuizConfig,
    private state: QuizState
  ) {}
  
  submitAnswer(answer: Answer): Result<void, DomainError> {
    return this.state.submitAnswer(answer)
  }
}
```

### 3. Repository Implementation Pattern

```typescript
// 1. Define interface in domain
// features/quiz/domain/repositories/IQuizRepository.ts
export interface IQuizRepository {
  findById(id: QuizId): Promise<Quiz | null>
  findActiveByUser(userId: UserId): Promise<Quiz[]>
  save(quiz: Quiz): Promise<void>
  delete(id: QuizId): Promise<void>
}

// 2. Implement with Drizzle
// features/quiz/domain/repositories/DrizzleQuizRepository.ts
export class DrizzleQuizRepository implements IQuizRepository {
  constructor(private readonly trx: PostgresJsTransaction) {}
  
  async findById(id: QuizId): Promise<Quiz | null> {
    const row = await this.trx.query.quizzes.findFirst({
      where: eq(quizzes.id, id.value)
    })
    
    return row ? Quiz.fromPersistence(row) : null
  }
  
  async save(quiz: Quiz): Promise<void> {
    const data = quiz.toPersistence()
    await this.trx.insert(quizzes).values(data)
  }
}

// 3. Use in handler with transaction
export async function handler(c: Context) {
  return withTransaction(async (trx) => {
    const repo = new DrizzleQuizRepository(trx)
    const quiz = await repo.findById(quizId)
    // Modifications...
    await repo.save(quiz)
  })
}
```

## Migration Strategy (Clean Slate)

### 1. Backup Current Code
```bash
git checkout -b legacy-module-arch
git push origin legacy-module-arch
```

### 2. Remove Old Structure
```bash
rm -rf apps/api/src/modules
rm -rf apps/api/src/services
rm -rf apps/api/src/repositories
```

### 3. Create New Structure
```bash
# Create directories
mkdir -p apps/api/src/{features,system,infra,shared,middleware}
mkdir -p apps/api/src/features/{quiz,user,auth,question}/domain/{entities,value-objects,aggregates,repositories}

# Move existing database files
mv apps/api/src/shared/database.ts apps/api/src/infra/db/client.ts
```

### 4. Implement First Slice
Start with health check to validate the structure:
```bash
mkdir -p apps/api/src/system/health
# Implement handler, test, route
# Wire up in main application
# Verify it works
```

### 5. Continue Feature by Feature
Implement in priority order:
1. Auth (login) - validates repository pattern
2. Quiz (start) - complex domain logic
3. Quiz (submit) - transaction handling
4. User (profile) - read operations

## Testing Guidelines

### 1. Domain Unit Tests (90% coverage)
```typescript
// features/quiz/domain/aggregates/QuizSession.test.ts
describe('QuizSession', () => {
  it('should calculate score correctly', () => {
    const session = QuizSession.create(config, userId)
    session.submitAnswer(questionId1, Answer.of('A'))
    session.submitAnswer(questionId2, Answer.of('B'))
    
    const score = session.calculateScore()
    expect(score.percentage).toBe(50)
  })
})
```

### 2. Repository Integration Tests
```typescript
// features/quiz/domain/repositories/DrizzleQuizRepository.test.ts
describe('DrizzleQuizRepository', () => {
  let repo: DrizzleQuizRepository
  
  beforeEach(async () => {
    const trx = await testDb.transaction()
    repo = new DrizzleQuizRepository(trx)
  })
  
  it('should save and retrieve quiz', async () => {
    const quiz = Quiz.create(/* ... */)
    await repo.save(quiz)
    
    const retrieved = await repo.findById(quiz.id)
    expect(retrieved).toEqual(quiz)
  })
})
```

### 3. Handler Contract Tests
```typescript
// features/quiz/start-quiz/handler.contract.test.ts
describe('POST /quiz/start', () => {
  it('should start quiz with valid input', async () => {
    const response = await app.request('/quiz/start', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ questionCount: 10 })
    })
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.quizId).toBeDefined()
  })
})
```

## Performance Considerations

### 1. Repository Query Optimization
- Use selective queries (only needed columns)
- Implement batch operations where possible
- Add appropriate database indexes
- Use prepared statements for hot paths

### 2. Transaction Scope
- Keep transactions as short as possible
- Don't perform external calls inside transactions
- Use read-only transactions where applicable

### 3. Domain Model Performance
- Lazy load aggregates when possible
- Use value objects for immutability
- Implement domain caching carefully

## Common Patterns

### 1. Result Type for Error Handling
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

// Usage
function divide(a: number, b: number): Result<number> {
  if (b === 0) {
    return { success: false, error: new Error('Division by zero') }
  }
  return { success: true, data: a / b }
}
```

### 2. Value Object Pattern
```typescript
export class Email {
  private constructor(private readonly value: string) {}
  
  static create(value: string): Result<Email> {
    if (!value.includes('@')) {
      return { success: false, error: new Error('Invalid email') }
    }
    return { success: true, data: new Email(value) }
  }
  
  toString(): string {
    return this.value
  }
  
  equals(other: Email): boolean {
    return this.value === other.value
  }
}
```

### 3. Domain Event Pattern (Future)
```typescript
export abstract class DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class QuizStartedEvent extends DomainEvent {
  constructor(
    public readonly quizId: string,
    public readonly userId: string,
    public readonly questionCount: number
  ) {
    super(quizId)
  }
}
```

## Success Criteria

1. **All features rebuilt with VSA + Repository pattern**
2. **90% test coverage in domain layer**
3. **No cross-slice imports (enforced by ESLint)**
4. **All handlers wrapped in transactions**
5. **Zero downtime migration from legacy**
6. **Performance equal or better than legacy**

## References

- [Vertical Slice Architecture](https://jimmybogard.com/vertical-slice-architecture/)
- [Domain-Driven Design](https://martinfowler.com/tags/domain%20driven%20design.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html)