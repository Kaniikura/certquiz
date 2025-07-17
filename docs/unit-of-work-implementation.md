# Unit of Work Implementation

This document describes the enhanced Unit of Work pattern implementation in CertQuiz API.

## Overview

The Unit of Work pattern ensures that all database operations within a use case execute within a single transaction context. This implementation provides both the traditional transaction wrapper and an enhanced UnitOfWork class that coordinates repository access.

## Enhanced Unit of Work Pattern

### Basic Usage

```typescript
import { withUnitOfWork } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';

export async function startQuizHandler(
  command: StartQuizCommand,
  logger: LoggerPort
) {
  return withUnitOfWork(async (uow) => {
    // All repository operations share the same transaction
    const user = await uow.users.findById(command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const activeQuiz = await uow.quizzes.findActiveByUser(command.userId);
    if (activeQuiz) {
      throw new Error('User already has an active quiz');
    }

    const newQuiz = QuizSession.create(command.config, command.userId);
    await uow.quizzes.save(newQuiz);

    return { quizId: newQuiz.id, startedAt: new Date() };
  }, logger);
}
```

### Key Benefits

1. **Automatic Transaction Management**: The UnitOfWork automatically wraps all operations in a transaction
2. **Repository Coordination**: All repositories share the same transaction context
3. **Clean API**: No need to manually create repository instances or pass transaction objects
4. **Type Safety**: Full TypeScript support with proper typing
5. **Testing Support**: Easy to mock repositories for testing

### Available Repositories

The UnitOfWork provides access to:
- `uow.users` - User repository for authentication and user management
- `uow.quizzes` - Quiz repository for quiz sessions and results

Additional repositories can be added by extending the UnitOfWork class.

## Legacy Transaction Pattern (Still Supported)

For cases where you need more control or backward compatibility:

```typescript
import { withTransaction } from '@api/infra/unit-of-work';
import { DrizzleUserRepository } from '@api/features/auth/domain/repositories/DrizzleUserRepository';

export async function legacyHandler(command: Command, logger: LoggerPort) {
  return withTransaction(async (trx) => {
    const userRepo = new DrizzleUserRepository(trx, logger);
    const user = await userRepo.findById(command.userId);
    // ... rest of handler logic
  });
}
```

## Testing with Unit of Work

### Mock Repositories for Testing

```typescript
import { withUnitOfWork, type RepositoryFactory } from '@api/infra/unit-of-work';

// In your test
const mockUserRepo = {
  findById: vi.fn().mockResolvedValue(mockUser),
  save: vi.fn(),
  // ... other methods
};

const mockQuizRepo = {
  findActiveByUser: vi.fn().mockResolvedValue(null),
  save: vi.fn(),
  // ... other methods
};

const result = await withUnitOfWork(async (uow) => {
  // Test your handler logic
  return handlerLogic(uow);
}, logger, {
  userRepository: () => mockUserRepo,
  quizRepository: () => mockQuizRepo,
});
```

### Handler Testing Pattern

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NoopLogger } from '@api/shared/logger/LoggerPort';

describe('startQuizHandler', () => {
  it('should start quiz successfully', async () => {
    const mockUser = User.create(/* ... */);
    const logger = new NoopLogger();
    
    const result = await withUnitOfWork(async (uow) => {
      return startQuizHandler(command, logger, uow);
    }, logger, {
      userRepository: () => ({
        findById: vi.fn().mockResolvedValue(mockUser),
      }),
      quizRepository: () => ({
        findActiveByUser: vi.fn().mockResolvedValue(null),
        save: vi.fn(),
      }),
    });

    expect(result.quizId).toBeDefined();
  });
});
```

## Implementation Details

### UnitOfWork Class

The `UnitOfWork` class is implemented in `apps/api/src/infra/db/uow.ts`:

- **Lazy Repository Creation**: Repositories are created only when accessed
- **Singleton Pattern**: Each repository instance is cached within the UnitOfWork
- **Transaction Sharing**: All repositories use the same Drizzle transaction context
- **Error Handling**: Graceful fallback when repositories are not available (useful for tests)

### Transaction Management

- **Automatic Commit**: Transaction commits when the function completes successfully
- **Automatic Rollback**: Transaction rolls back if an error is thrown
- **Nested Transactions**: Drizzle handles nested transaction scenarios
- **Connection Management**: Database connections are managed by Drizzle ORM

### Architecture Alignment

This implementation aligns with the project's design specifications:

1. **Vertical Slice Architecture**: Each feature can use the UnitOfWork without coupling to other features
2. **Domain-Driven Design**: Domain logic remains pure, infrastructure is abstracted
3. **Repository Pattern**: Repositories are accessed through the UnitOfWork facade
4. **Transaction Boundaries**: All use cases are properly wrapped in transactions

## Migration Guide

### From Legacy to Enhanced Pattern

**Before (Legacy)**:
```typescript
return withTransaction(async (trx) => {
  const userRepo = new DrizzleUserRepository(trx, logger);
  const quizRepo = new DrizzleQuizRepository(trx, logger);
  // ... business logic
});
```

**After (Enhanced)**:
```typescript
return withUnitOfWork(async (uow) => {
  // Repositories are automatically available
  const user = await uow.users.findById(userId);
  const quiz = await uow.quizzes.save(newQuiz);
  // ... business logic
}, logger);
```

### Benefits of Migration

1. **Less Boilerplate**: No need to manually import and instantiate repositories
2. **Better Testing**: Easier to mock repositories for unit tests
3. **Consistency**: All handlers follow the same pattern
4. **Future-Proof**: Easy to add new repositories or extend functionality

## Best Practices

1. **Keep Transactions Short**: Minimize the time spent in transaction callbacks
2. **Handle Errors Properly**: Let exceptions bubble up to trigger rollback
3. **Use TypeScript**: Leverage type safety for better development experience
4. **Test with Mocks**: Use repository factories for comprehensive testing
5. **Log Appropriately**: Use the provided logger for transaction-related logging

## Future Enhancements

Potential future improvements to the Unit of Work pattern:

1. **Domain Events**: Publish events after successful transaction commit
2. **Caching**: Repository-level caching within transaction scope
3. **Metrics**: Transaction timing and performance monitoring
4. **Retry Logic**: Automatic retry on deadlock or connection issues
5. **Connection Pooling**: Advanced connection management strategies