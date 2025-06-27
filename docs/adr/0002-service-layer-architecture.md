# 2. Use Service Layer Architecture

Date: 2025-06-27

## Status

Accepted

## Context

The initial architecture proposal showed business logic directly implemented in HTTP route handlers. This creates several problems:

- Business logic is tightly coupled to the HTTP layer
- Testing requires HTTP mocking, making tests complex and brittle
- Reusing business logic across different interfaces (REST API, GraphQL, CLI) is impossible
- Code organization becomes unclear as routes grow
- Future migration to microservices would require significant refactoring

We need a clear separation between HTTP concerns and business logic to improve maintainability and testability.

## Decision

We will implement a service layer pattern to decouple business logic from HTTP routing layer.

The architecture will follow this structure:

```
Routes (HTTP Layer) → Services (Business Logic) → Repositories (Data Access) → Database
```

**Routes** will be thin and only handle:
- HTTP request/response mapping
- Input validation via middleware
- Calling appropriate service methods
- Formatting service results as HTTP responses

**Services** will contain:
- All business logic
- Transaction orchestration
- Integration with external services
- Event emission for cross-cutting concerns

Example structure:
```typescript
// Thin route handler
app.post('/api/v1/quiz/start', async ({ body, user }) => {
  const result = await quizService.startQuiz(user.id, body);
  if (!result.success) {
    throw new ApiError(result.error);
  }
  return { success: true, data: result.data };
});

// Service with business logic
class QuizService {
  async startQuiz(userId: string, options: QuizOptions) {
    // Business logic here
  }
}
```

## Consequences

**Positive:**
- Business logic is testable without HTTP layer
- Services can be reused across different interfaces
- Clear separation of concerns improves maintainability
- Easier to migrate to microservices in the future
- Better code organization and discoverability

**Negative:**
- Additional layer of abstraction
- More files and interfaces to maintain
- Slight performance overhead from additional function calls

**Neutral:**
- Team needs to understand and follow the layered architecture
- Dependency injection pattern becomes necessary
- More initial setup work required