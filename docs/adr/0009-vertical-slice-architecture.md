# 9. Adopt Vertical Slice Architecture with DDD

Date: 2025-01-06

## Status

Accepted

## Context

The current module-based architecture groups code by feature (quiz, user, auth) but still separates concerns horizontally within each module (service, routes, db, types). As the application grows, this structure has several limitations:

1. **Related code is scattered**: To understand a single use case, developers must navigate between multiple files
2. **Unclear boundaries**: It's not always obvious where business logic should live
3. **Test organization**: Tests for a feature are spread across service, route, and db test files
4. **Domain logic leakage**: Business rules are scattered between services and route handlers

After careful consideration, we've decided to adopt Vertical Slice Architecture (VSA) with Domain-Driven Design (DDD) principles.

## Decision

We will restructure the codebase to use Vertical Slice Architecture with the following key decisions:

### 1. Vertical Slice Architecture (VSA)
- Organize code by use cases rather than technical layers
- Each use case contains all its code in a single folder (handler, tests, DTOs, validation, queries)
- Features are grouped by bounded contexts (quiz, user, auth)

### 2. Domain-Driven Design (DDD) 
- Implement rich domain models with entities, value objects, and aggregates
- Keep domain layer pure (no framework dependencies)
- Business logic lives in domain objects, not services

### 3. DbContext Pattern instead of Repository Interfaces
- Use a single DbContext class that wraps Drizzle ORM
- Each use case exposes only the queries it needs
- No generic repository interfaces
- Direct, type-safe database access

### 4. No CQRS
- Use unified handlers for both commands and queries
- Simplifies the architecture for a solo developer project
- Can be introduced later if needed

## Consequences

### Positive

1. **High Cohesion**: All code for a use case is in one place
2. **Easy Navigation**: Developers can find all related code in a single folder
3. **Clear Boundaries**: Obvious where each piece of code belongs
4. **Testability**: Co-located tests make TDD easier
5. **Feature Independence**: Use cases can be developed and deployed independently
6. **Rich Domain Models**: Business logic is properly encapsulated
7. **Type Safety**: Full TypeScript support with Drizzle ORM
8. **Gradual Migration**: Can migrate from current structure incrementally

### Negative

1. **Initial Learning Curve**: Team needs to understand VSA and DDD concepts
2. **More Files**: Each use case has multiple files (handler, dto, validation, etc.)
3. **Potential Duplication**: Some code might be duplicated across use cases initially
4. **Restructuring Effort**: Existing code needs to be migrated

### Neutral

1. **Different from Common Patterns**: Not the typical layered architecture many developers expect
2. **Domain Complexity**: Need to decide when to introduce domain concepts vs keeping things simple

## Implementation Plan

1. Create new folder structure under `src/features/`
2. Implement DbContext in `db/DbContext.ts`
3. Migrate one use case at a time starting with quiz features
4. Keep old module structure during transition
5. Update route composition in `routes.ts`
6. Delete old modules when no longer referenced

## Example Structure

```
src/features/quiz/start-quiz/
├── handler.ts       # Application logic
├── handler.test.ts  # Tests
├── dto.ts          # Input/output types
├── validation.ts   # Zod schemas
├── db.ts           # Database queries
└── route.ts        # HTTP route
```

## References

- [Vertical Slice Architecture - Jimmy Bogard](https://jimmybogard.com/vertical-slice-architecture/)
- [Domain-Driven Design - Eric Evans](https://www.domainlanguage.com/ddd/)
- [Pragmatic Clean Architecture](https://www.youtube.com/watch?v=18IqltQ4XE4)