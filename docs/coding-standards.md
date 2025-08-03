# Coding Standards & Best Practices

> 📌 **Quick Reference** for CertQuiz development using VSA + DDD + Repository Pattern

## Core Principles

1. **Type Safety First** - No `any` types, explicit return types required
2. **Functional Style** - Pure functions, immutability, `Result<T>` for errors
3. **Small Functions** - Single responsibility, <20 lines preferred
4. **Test-Driven Development** - Write tests first, 90% domain coverage
5. **Vertical Slice Architecture** - Features in folders, not layers
6. **Domain-Driven Design** - Rich models with business logic
7. **Repository Pattern** - Interfaces in domain, implementations alongside
8. **Transaction Boundaries** - All handlers use `IUnitOfWork` from middleware (NOT `withTransaction`)
9. **No Barrel Exports** - Direct imports only, no `index.ts` re-exports
10. **Co-located Tests** - `.test.ts` files next to source

## Project Structure

See **[Project Structure Documentation](./project-structure.md)** for complete directory layout and architecture layers.

**Key folders**:
- `features/` - Vertical slices by use case
- `domain/` - Entities, VOs, aggregates, repositories
- `infra/` - External adapters and transaction wrapper
- `shared/` - Result types, errors, logger

## Quick Patterns

### Value Object
```typescript
export class Email {
  private constructor(private readonly value: string) {}
  
  static create(value: string): Result<Email> {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return err(new ValidationError('Invalid email'));
    }
    return ok(new Email(cleaned));
  }
  
  toString(): string { return this.value; }
  equals(other: Email): boolean { return this.value === other.value; }
}
```

### Repository Pattern
```typescript
// Domain interface
export interface IQuizRepository {
  findById(id: QuizId): Promise<QuizSession | null>;
  save(session: QuizSession): Promise<void>;
}

// Infrastructure implementation
export class DrizzleQuizRepository implements IQuizRepository {
  constructor(private readonly trx: PostgresJsTransaction) {}
  
  async save(session: QuizSession): Promise<void> {
    const data = session.toPersistence();
    await this.trx.insert(quizSessions).values(data);
  }
}
```

### Handler with UnitOfWork
```typescript
export async function startQuizHandler(c: Context) {
  const input = c.req.valid('json');
  const unitOfWork = c.get('unitOfWork'); // From middleware
  
  const result = await (async () => {
    const repo = unitOfWork.getQuizRepository();
    // All DB operations share same transaction via UnitOfWork
    return startQuiz(input, repo);
  });
  
  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }
  
  return c.json(result.data);
}
```

## Testing Strategy

| Layer | Test Type | Coverage Target | Key Points |
|-------|-----------|----------------|------------|
| Domain | Unit | 90% | Pure functions, no I/O |
| Repository | Integration | 80% | Real DB, transactions |
| Handler | Unit | 80% | Mock repositories |
| E2E | Contract | Critical paths | Full HTTP tests |

## Error Handling

```typescript
// Domain errors
export class DomainError extends Error {}
export class ValidationError extends DomainError {}
export class BusinessError extends DomainError {}

// Always use Result<T> type
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

## Code Review Checklist

**Architecture**
- [ ] Use case in own folder with handler/dto/validation/route
- [ ] Repository interface in domain, implementation uses transaction
- [ ] No domain imports from infrastructure

**Quality**
- [ ] Explicit types (no `any`)
- [ ] Result<T> for fallible operations
- [ ] Tests co-located and passing
- [ ] Transaction boundaries clear

**Security**
- [ ] Input validation with Zod
- [ ] Domain authorization checks
- [ ] No raw SQL (use Drizzle)

## Import Order

```typescript
// 1. External
import { Hono } from 'hono';

// 2. Infrastructure (direct imports only)
import { createDrizzleInstance } from '@api/infra/db/shared';

// 3. Domain (direct imports only)
import { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import { Email } from '@api/features/auth/domain/value-objects/Email';

// 4. Local
import { startQuizSchema } from './validation';
```

**Import Rules**:
- ✅ Direct imports: `import { Email } from '@api/features/auth/domain/value-objects/Email'`
- ❌ Barrel imports: `import { Email } from '@api/features/auth'`

## Anti-Patterns to Avoid

### ❌ Barrel Exports (index.ts files)
**NEVER** create `index.ts` files that re-export from other modules:

```typescript
// ❌ BAD - Barrel export (index.ts)
export { Email } from './Email';
export { UserId } from './UserId';

// ❌ BAD - Using barrel imports
import { Email, UserId } from '@api/features/auth';

// ✅ GOOD - Direct imports
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
```

**Why this matters**:
- Barrel exports prevent tree-shaking and increase bundle size
- Make dependencies unclear and harder to trace
- Slow down TypeScript compilation and IDE performance
- Create circular dependency risks

### ❌ Direct Transaction Usage in Routes
**NEVER** use `withTransaction` directly in route handlers:

```typescript
// ❌ BAD - Direct transaction usage
export async function badHandler(c: Context) {
  const result = await withTransaction(async (trx) => {
    // This bypasses the UnitOfWork pattern!
  });
}

// ✅ GOOD - Use UnitOfWork from middleware
export async function goodHandler(c: Context) {
  const unitOfWork = c.get('unitOfWork');
  const repository = unitOfWork.getQuizRepository();
  // Transaction is managed by middleware
}
```

**Why this matters**:
- Direct `withTransaction` usage prevents proper test isolation
- Breaks the Unit of Work pattern's transaction management
- Makes it impossible to mock repositories in tests
- Violates the dependency injection principle

---

> 📚 **Resources**: [DDD by Eric Evans](https://www.domainlanguage.com/ddd/) | [VSA by Jimmy Bogard](https://jimmybogard.com/vertical-slice-architecture/) | [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)