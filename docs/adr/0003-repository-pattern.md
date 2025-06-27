# 3. Use Repository Pattern for Data Access

Date: 2025-06-27

## Status

Accepted

## Context

Direct database queries in service methods create several issues:

- Database implementation details leak into business logic
- Testing services requires a real database or complex mocking
- Switching database technologies would require rewriting all services
- Common query patterns are duplicated across services
- No central place to implement caching or query optimization

We need an abstraction layer between services and the database to address these concerns.

## Decision

We will implement the Repository pattern for all data access operations.

Each aggregate root will have its own repository:
- `UserRepository`
- `QuestionRepository`  
- `QuizRepository`
- `ProgressRepository`

Repositories will:
- Encapsulate all database queries
- Provide a domain-specific API
- Handle caching transparently
- Return domain entities, not database rows

Example implementation:
```typescript
interface QuestionRepository {
  findById(id: string): Promise<Question | null>;
  findByFilters(filters: QuestionFilters): Promise<Question[]>;
  getRandomQuestions(count: number, filters: QuestionFilters): Promise<Question[]>;
  createWithOptions(question: CreateQuestionDto): Promise<Question>;
}

class QuestionRepositoryImpl implements QuestionRepository {
  constructor(
    private db: Database,
    private cache: CacheService
  ) {}
  
  async findById(id: string): Promise<Question | null> {
    const cached = await this.cache.get(`question:${id}`);
    if (cached) return cached;
    
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, id)
    });
    
    if (question) {
      await this.cache.set(`question:${id}`, question);
    }
    
    return question;
  }
}
```

## Consequences

**Positive:**
- Services are decoupled from database implementation
- Easy to mock repositories for testing
- Centralized place for query optimization and caching
- Database can be changed without affecting services
- Consistent data access patterns

**Negative:**
- Additional abstraction layer
- Potential for anemic domain model if not careful
- More boilerplate code initially

**Neutral:**
- Team must understand repository boundaries
- Need to decide on repository granularity
- Transaction handling must be carefully designed