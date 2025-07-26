# Repository Testing Strategy Implementation Plan for **CertQuiz**

## 1 — Overview

This plan outlines a comprehensive testing strategy for repository layer implementations in the CertQuiz project, addressing the fundamental challenge of testing persistence logic without database dependencies. Based on expert consultation with o3 and analysis of current test architecture, this strategy separates **pure mapping logic** from **impure SQL operations** to achieve reliable 90% unit test coverage.

---

## 2 — Current State Analysis

### 2.1 Problem Statement

The project has a skipped test in `DrizzleUserRepository.test.ts`:

```typescript
it.skip('should handle invalid role values and throw error - skipped due to mock limitations', async () => {
  // Mock implementation bypasses actual repository's validation logic in mapRowToUser()
  // The real repository would throw an error for invalid roles, but our mock doesn't 
  // simulate the UserRole.fromString() validation
});
```

### 2.2 Current Architecture

| Component | Description | Testing Approach |
|-----------|-------------|------------------|
| **Small Tests (Unit)** | No DB access, use mocks | `bun run test:unit` |
| **Medium Tests (Integration)** | Real DB via testcontainers | `bun run test:integration` |
| **Repository Pattern** | Interface-based with Drizzle implementation | Mock-based unit tests |
| **Coverage Target** | 90% for domain unit tests | Currently challenging due to mock limitations |

### 2.3 Root Cause Analysis

1. **Mock Limitations**: Current mocks bypass domain validation logic
2. **Incorrect Assumptions**: Test assumes `UserRole.fromString()` throws errors, but it returns safe defaults
3. **Coupling**: Mixing pure mapping logic with impure SQL operations in same method

---

## 3 — Proposed Solution: Clean Architecture Testing

### 3.1 Core Principle

> **Separate pure mapping logic from impure SQL operations and test them at different layers**

```
Port/Domain               Adapter/Infrastructure
─────────────┬────────────────────────────────────
User, UserRole │ IUserRepository │ DrizzleUserRepository
               │                 │ └─ SQL Operations
               │                 │ └─ Pure Mappers
```

### 3.2 Testing Boundaries

| Test Type | What to Test | What NOT to Test |
|-----------|--------------|-------------------|
| **Unit Tests** | Pure mapping functions, domain validation | SQL generation, DB constraints |
| **Integration Tests** | SQL operations, constraints, transactions | Domain business logic |

---

## 4 — Implementation Plan

### Phase 1: Extract Pure Mapping Logic (Week 1)

#### 4.1.1 Create Mapper Module

**File**: `apps/api/src/features/user/infrastructure/mappers/UserRowMapper.ts`

```typescript
import { Result } from '@api/shared/result';
import { User } from '@api/features/user/domain';
import type { JoinedUserRow, AuthUserRow, UserProgressRow } from '../types';

/**
 * Pure function to map database rows to domain entities
 * Testable without database dependencies
 */
export function mapJoinedRowToUser(row: JoinedUserRow): Result<User, Error> {
  // Validate categoryStats
  if (typeof row.categoryStats !== 'object' || row.categoryStats === null) {
    return Result.fail(
      new Error(`Invalid categoryStats for user ${row.userId}: must be an object`)
    );
  }

  const authRow: AuthUserRow = {
    userId: row.userId,
    email: row.email,
    username: row.username,
    role: row.role,
    identityProviderId: row.identityProviderId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  const progressRow: UserProgressRow = {
    level: row.level,
    experience: row.experience,
    totalQuestions: row.totalQuestions,
    correctAnswers: row.correctAnswers,
    accuracy: row.accuracy,
    studyTimeMinutes: row.studyTimeMinutes,
    currentStreak: row.currentStreak,
    lastStudyDate: row.lastStudyDate,
    categoryStats: row.categoryStats,
    updatedAt: row.progressUpdatedAt,
  };

  return User.fromPersistence(authRow, progressRow);
}
```

#### 4.1.2 Update Repository Implementation

```typescript
// DrizzleUserRepository.ts
import { mapJoinedRowToUser } from './mappers/UserRowMapper';

export class DrizzleUserRepository implements IUserRepository {
  async findById(id: UserId): Promise<User | null> {
    const rows = await this.conn
      .select(this.getUserSelectFields())
      .from(authUser)
      .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
      .where(eq(authUser.userId, id))
      .limit(1);

    if (rows.length === 0) return null;

    // Use extracted mapper
    const result = mapJoinedRowToUser(rows[0]);
    if (!result.success) {
      this.logger.error('Invalid user data in database', {
        userId: id,
        error: result.error.message,
      });
      throw result.error;
    }

    return result.data;
  }
}
```

### Phase 2: Create Mapper Unit Tests (Week 1)

**File**: `apps/api/src/features/user/infrastructure/mappers/UserRowMapper.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { mapJoinedRowToUser } from './UserRowMapper';
import { createMockJoinedRow } from '@api/testing/builders';

describe('UserRowMapper', () => {
  describe('mapJoinedRowToUser', () => {
    it('should map valid row to User domain entity', () => {
      const validRow = createMockJoinedRow();
      const result = mapJoinedRowToUser(validRow);
      
      expect(result.success).toBe(true);
      expect(result.data.id.toString()).toBe(validRow.userId);
    });

    it('should handle invalid role values by using default', () => {
      // This replaces the skipped test!
      const rowWithInvalidRole = createMockJoinedRow({
        role: 'invalid_role_value',
      });
      
      const result = mapJoinedRowToUser(rowWithInvalidRole);
      
      expect(result.success).toBe(true);
      expect(result.data.role).toBe(UserRole.User); // Safe default
    });

    it('should fail when categoryStats is invalid', () => {
      const rowWithInvalidStats = createMockJoinedRow({
        categoryStats: null,
      });
      
      const result = mapJoinedRowToUser(rowWithInvalidStats);
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Invalid categoryStats');
    });

    it('should handle all edge cases', () => {
      // Test nulls, empty strings, dates, etc.
      const edgeCaseRow = createMockJoinedRow({
        identityProviderId: null,
        lastStudyDate: null,
        experience: 0,
        accuracy: '0.00',
      });
      
      const result = mapJoinedRowToUser(edgeCaseRow);
      
      expect(result.success).toBe(true);
      expect(result.data.identityProviderId).toBeNull();
    });
  });
});
```

### Phase 3: Create Integration Tests (Week 2)

**File**: `apps/api/src/features/user/infrastructure/DrizzleUserRepository.integration.test.ts`

```typescript
import { setupTestDatabase } from '@api/testing/domain';
import { DrizzleUserRepository } from './DrizzleUserRepository';
import { createTestUser } from '@api/testing/builders';

describe('DrizzleUserRepository Integration Tests', () => {
  setupTestDatabase();

  let repository: DrizzleUserRepository;

  beforeEach(async () => {
    const { db } = await getTestDatabase();
    repository = new DrizzleUserRepository(db, logger);
  });

  describe('Database Constraints', () => {
    it('should enforce unique email constraint', async () => {
      const user1 = createTestUser({ email: 'test@example.com' });
      const user2 = createTestUser({ email: 'test@example.com' });

      await repository.create(user1);
      
      await expect(repository.create(user2))
        .rejects.toThrow(EmailAlreadyTakenError);
    });

    it('should handle invalid data from database', async () => {
      // Directly insert invalid data using raw SQL
      await db.execute(sql`
        INSERT INTO auth_user (user_id, email, username, role)
        VALUES ('test-id', 'test@example.com', 'test', 'invalid_role')
      `);

      // Repository should handle this gracefully
      const result = await repository.findById(UserId.of('test-id'));
      expect(result?.role).toBe(UserRole.User); // Safe default
    });
  });

  describe('Transaction Behavior', () => {
    it('should rollback on failure', async () => {
      const user = createTestUser();
      
      await db.transaction(async (tx) => {
        const txRepo = new DrizzleUserRepository(tx, logger);
        await txRepo.create(user);
        
        // Force rollback
        throw new Error('Rollback test');
      }).catch(() => {});

      // User should not exist
      const found = await repository.findById(user.id);
      expect(found).toBeNull();
    });
  });
});
```

### Phase 4: Refactor Existing Tests (Week 2)

#### 4.4.1 Simplify Mock-based Unit Tests

```typescript
// DrizzleUserRepository.test.ts - AFTER refactoring
describe('DrizzleUserRepository (SQL Operations)', () => {
  it('should construct correct SQL query for findById', async () => {
    // Test only SQL construction, not mapping
    const mockConn = createMockConnection();
    const repository = new DrizzleUserRepository(mockConn, logger);
    
    await repository.findById(UserId.of('test-id'));
    
    expect(mockConn.select).toHaveBeenCalledWith(/* expected fields */);
    expect(mockConn.where).toHaveBeenCalledWith(/* expected condition */);
  });

  // Remove all domain validation tests - they belong in mapper tests
});
```

#### 4.4.2 Use InMemoryRepository for Application Tests

```typescript
// features/user/update-progress/handler.test.ts
import { InMemoryUserRepository } from '@api/testing/domain/fakes';

describe('UpdateProgressHandler', () => {
  it('should update user progress', async () => {
    // Use in-memory repository that preserves domain logic
    const userRepo = new InMemoryUserRepository();
    const handler = new UpdateProgressHandler(userRepo);
    
    // Test actual business logic without DB or mocks
    const result = await handler.execute(command);
    expect(result.success).toBe(true);
  });
});
```

### Phase 5: Contract Testing Pattern (Week 3)

Create shared test suite for repository interface:

```typescript
// shared/repository-contract-tests.ts
export function createUserRepositoryContractTests(
  getName: string,
  createRepository: () => Promise<IUserRepository>
) {
  describe(`${getName} - Repository Contract`, () => {
    let repository: IUserRepository;

    beforeEach(async () => {
      repository = await createRepository();
    });

    it('should find user by ID', async () => {
      const user = createTestUser();
      await repository.save(user);
      
      const found = await repository.findById(user.id);
      expect(found).toEqual(user);
    });

    // All other contract tests...
  });
}

// Run against both implementations
createUserRepositoryContractTests(
  'InMemoryUserRepository',
  async () => new InMemoryUserRepository()
);

createUserRepositoryContractTests(
  'DrizzleUserRepository', 
  async () => {
    const { db } = await getTestDatabase();
    return new DrizzleUserRepository(db, logger);
  }
);
```

---

## 5 — Migration Strategy

### 5.1 Gradual Migration

1. **Week 1**: Extract mappers for User repository
2. **Week 2**: Create integration tests, refactor unit tests
3. **Week 3**: Apply pattern to Question repository
4. **Week 4**: Apply pattern to Quiz repository
5. **Week 5**: Contract testing implementation

### 5.2 Backward Compatibility

- Keep existing tests running during migration
- Mark old tests as `@deprecated` 
- Remove only after new tests provide equivalent coverage

---

## 6 — Expected Outcomes

### 6.1 Testing Improvements

| Metric | Before | After |
|--------|--------|-------|
| **Unit Test Speed** | ~500ms with mocks | <100ms pure functions |
| **Coverage Accuracy** | Mock gaps | Real domain validation |
| **Maintenance Burden** | Complex mock setup | Simple object creation |
| **Failure Clarity** | Mock-related noise | Clear domain failures |

### 6.2 Code Quality Benefits

1. **Separation of Concerns**: Pure vs impure code clearly separated
2. **Testability**: Mapper functions easily testable
3. **Reliability**: Real validation in unit tests
4. **Performance**: Faster test execution

### 6.3 Coverage Strategy

```yaml
Unit Tests (Small):
  - Pure mappers: 100% coverage
  - Domain entities: 100% coverage  
  - Value objects: 100% coverage
  - Repository SQL logic: 60% coverage (structure only)

Integration Tests (Medium):
  - Database operations: 90% coverage
  - Constraints/transactions: 100% coverage
  - Error propagation: 90% coverage
  
Overall Target: 90% coverage with meaningful tests
```

---

## 7 — Implementation Checklist

- [ ] Create mapper module structure
- [ ] Extract `mapJoinedRowToUser` from DrizzleUserRepository
- [ ] Create comprehensive mapper unit tests
- [ ] Update repository to use extracted mapper
- [ ] Create DrizzleUserRepository integration tests
- [ ] Refactor existing mock-based tests
- [ ] Apply pattern to QuestionRepository
- [ ] Apply pattern to QuizRepository  
- [ ] Implement contract testing pattern
- [ ] Update test documentation
- [ ] Measure and report coverage improvements

---

## 8 — Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Breaking existing tests** | High | Gradual migration, keep old tests during transition |
| **Coverage drop** | Medium | Track coverage daily, add tests before removing |
| **Performance regression** | Low | Benchmark test execution times |
| **Team resistance** | Medium | Document benefits, provide examples |

---

## 9 — Success Criteria

1. ✅ All skipped tests replaced with working tests
2. ✅ 90% unit test coverage maintained
3. ✅ Test execution time < 5 seconds for unit tests
4. ✅ Zero mock-related test failures
5. ✅ Clear separation of pure/impure code
6. ✅ Team adoption of new pattern

---

## 10 — References

- [Clean Architecture Testing](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [o3 Consultation Results](#consultation-details)
- [Testcontainers Best Practices](https://www.testcontainers.org/test_framework_integration/manual_lifecycle_control/)
- [Repository Pattern Testing](https://martinfowler.com/eaaCatalog/repository.html)

---

## Appendix A: Code Examples

### Complete Mapper Implementation

```typescript
// Full implementation with all edge cases handled
export function mapJoinedRowToUser(row: JoinedUserRow): Result<User, Error> {
  try {
    // Validate required fields
    if (!row.userId) {
      return Result.fail(new Error('Missing userId'));
    }

    // Validate complex objects
    if (typeof row.categoryStats !== 'object' || row.categoryStats === null) {
      return Result.fail(
        new Error(`Invalid categoryStats for user ${row.userId}`)
      );
    }

    // Map to domain types
    const authRow: AuthUserRow = {
      userId: row.userId,
      email: row.email,
      username: row.username,
      role: row.role, // UserRole.fromString handles invalid values
      identityProviderId: row.identityProviderId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    const progressRow: UserProgressRow = {
      level: row.level ?? 1,
      experience: row.experience ?? 0,
      totalQuestions: row.totalQuestions ?? 0,
      correctAnswers: row.correctAnswers ?? 0,
      accuracy: row.accuracy ?? '0.00',
      studyTimeMinutes: row.studyTimeMinutes ?? 0,
      currentStreak: row.currentStreak ?? 0,
      lastStudyDate: row.lastStudyDate,
      categoryStats: row.categoryStats,
      updatedAt: row.progressUpdatedAt,
    };

    return User.fromPersistence(authRow, progressRow);
  } catch (error) {
    return Result.fail(
      error instanceof Error ? error : new Error('Unknown mapping error')
    );
  }
}
```

---

## Appendix B: Test Data Builders

```typescript
// testing/builders/user-row-builder.ts
export function createMockJoinedRow(overrides?: Partial<JoinedUserRow>): JoinedUserRow {
  return {
    userId: 'test-user-123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    identityProviderId: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    level: 1,
    experience: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    accuracy: '0.00',
    studyTimeMinutes: 0,
    currentStreak: 0,
    lastStudyDate: null,
    categoryStats: { version: 1, categories: {} },
    progressUpdatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
```