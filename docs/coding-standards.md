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
8. **Transaction Boundaries** - All handlers use `withTransaction`
9. **Co-located Tests** - `.test.ts` files next to source

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

### Handler with Transaction
```typescript
export async function startQuizHandler(c: Context) {
  const input = c.req.valid('json');
  
  const result = await withTransaction(async (trx) => {
    const repo = new DrizzleQuizRepository(trx);
    // All DB operations share same transaction
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

// 2. Infrastructure
import { withTransaction } from '@/infra/unit-of-work';

// 3. Domain
import { QuizSession } from '../domain/aggregates/QuizSession';

// 4. Local
import { startQuizSchema } from './validation';
```

---

> 📚 **Resources**: [DDD by Eric Evans](https://www.domainlanguage.com/ddd/) | [VSA by Jimmy Bogard](https://jimmybogard.com/vertical-slice-architecture/) | [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)