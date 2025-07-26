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
├── CLAUDE.md                    # Project context at root
├── package.json                 # Root monorepo config
├── tsconfig.json               # Root TypeScript config
├── biome.json                  # Biome linter/formatter config
│
├── apps/                       # Application packages
│   ├── web/                    # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api/
│   │   │   │   ├── stores/
│   │   │   │   └── utils/
│   │   │   └── routes/
│   │   ├── static/
│   │   └── package.json
│   │
│   └── api/                    # Hono backend (VSA + DDD + Repository)
│       ├── src/
│       │   ├── features/       # Feature slices (vertical slices)
│       │   │   ├── quiz/
│       │   │   │   ├── [use-cases]/    # start-quiz, submit-answer, get-results
│       │   │   │   ├── domain/
│       │   │   │   │   ├── entities/
│       │   │   │   │   ├── value-objects/
│       │   │   │   │   ├── aggregates/
│       │   │   │   │   └── repositories/  # Interfaces only
│       │   │   │   ├── infrastructure/
│       │   │   │   │   └── drizzle/      # Repository implementations & mappers
│       │   │   │   └── shared/
│       │   │   ├── user/
│       │   │   │   ├── [use-cases]/    # register, update-progress, get-profile
│       │   │   │   ├── domain/
│       │   │   │   │   ├── entities/
│       │   │   │   │   ├── value-objects/
│       │   │   │   │   └── repositories/
│       │   │   │   ├── infrastructure/
│       │   │   │   │   └── drizzle/
│       │   │   │   └── shared/
│       │   │   ├── auth/
│       │   │   │   ├── [use-cases]/    # login, refresh-token
│       │   │   │   ├── domain/
│       │   │   │   └── infrastructure/
│       │   │   └── question/
│       │   │       ├── [use-cases]/    # list-questions, get-question, create-question
│       │   │       ├── domain/
│       │   │       └── infrastructure/
│       │   ├── system/         # System/operational features
│       │   │   ├── health/
│       │   │   └── migration/
│       │   ├── infra/          # Cross-cutting infrastructure
│       │   │   ├── db/
│       │   │   ├── events/
│       │   │   ├── logger/
│       │   │   ├── auth/
│       │   │   └── email/
│       │   ├── shared/         # Shared kernel
│       │   │   ├── errors.ts
│       │   │   ├── result.ts
│       │   │   └── repository/
│       │   ├── test-support/
│       │   └── middleware/
│       ├── testing/            # Test infrastructure
│       │   ├── infra/
│       │   └── domain/
│       ├── tests/
│       │   ├── integration/
│       │   ├── e2e/
│       │   └── fixtures/
│       └── package.json
│
├── packages/
│   ├── shared/
│   └── typespec/
│
├── docs/
│   ├── project-structure.md
│   └── adr/
│
├── docker/
│
└── scripts/
```

**Legend**:
- `[use-cases]/` = Multiple use case folders (e.g., `start-quiz/`, `submit-answer/`, `get-results/`)
- Only essential files and all directories are shown for clarity

> 📝 **Key Conventions**:
> - **Co-located tests**: Unit tests use `.test.ts` suffix next to source files
> - **Integration tests**: Single-slice tests use `.integration.test.ts` co-located, multi-slice tests in `tests/integration/`
> - **Repository pattern**: Interface in domain, Drizzle implementation in infrastructure/drizzle/
> - **Mapper pattern**: Pure data transformation functions in infrastructure/drizzle/
> - **Use case folders**: Each contains handler, DTO, validation, route
> - **Domain isolation**: Pure TypeScript, no framework dependencies
> - **Transaction scope**: All handlers wrapped in `withTransaction`
> - **Dependency injection**: App factory pattern with `buildApp(deps)` for clean testing
> - **Unified test infrastructure**: Consolidated test utilities in `testing/` package with DDD layer separation
> - **Test database API**: Always use `createTestDb()` or `withTestDb()`, never raw `drizzle()`
- **Domain test utilities**: Feature-specific helpers remain in `test-support/` for co-location

## Architecture Layers

### 1. Presentation Layer
- **[use-cases]/route.ts**: HTTP route definitions with validation and middleware
- Thin layer that delegates to application handlers

### 2. Application Layer
- **[use-cases]/handler.ts**: Orchestrate use cases with transaction boundaries
- Coordinate between domain and infrastructure layers

### 3. Domain Layer
- **domain/aggregates/**: Rich domain models with business logic
- **domain/entities/**: Core domain objects
- **domain/value-objects/**: Immutable domain concepts
- **domain/repositories/**: Domain interfaces for persistence
- Pure TypeScript with no framework dependencies

### 4. Infrastructure Layer
- **infrastructure/drizzle/**: Concrete implementations using Drizzle ORM
- Repository implementations with colocated mapper functions
- **infra/**: Cross-cutting concerns (db, auth, logger, events)

## Key Design Decisions

### 1. Repository Pattern with Domain Focus 🎯
- **Interfaces in domain**: Part of the ubiquitous language
- **Implementations in infrastructure/drizzle**: Colocated with mappers
- **Pure mappers**: Testable data transformation functions separate from SQL
- **Thin abstraction**: Only methods needed by use cases
- **No generic repositories**: Each repository is domain-specific

### 2. Unit of Work via Transaction Wrapper
- **infra/unit-of-work.ts**: Application layer facade using Drizzle transactions
- All multi-repository operations wrapped in single transaction
- Ensures data consistency across aggregates

### 3. Vertical Slice Organization
- **features/[context]/[use-case]/**: Self-contained use case folders
- Each slice contains: handler, tests, DTOs, validation, routes
- No cross-slice dependencies - use domain events for communication

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
- **Test infrastructure**: Database utilities in `testing/infra/db/`, domain helpers in `test-support/`

## Development Workflow

### 1. Creating New Features
- **Test-Driven Development**: Start with failing tests, then implement
- **Feature Structure**: Each use case gets dedicated folder with handler, tests, DTOs, validation, routes
- **Domain Evolution**: Start simple, add complexity progressively

### 2. Repository Pattern
- **Interface Definition**: Domain interfaces in `domain/repositories/`
- **Implementation**: Drizzle-based implementations in `infrastructure/drizzle/`
- **Mapper Extraction**: Pure functions for data transformation in same directory
- **Transaction Management**: All operations wrapped with `withTransaction`

## Migration Strategy

### Implementation Approach
- **Clean Slate**: Backup existing code, implement new VSA structure
- **Feature Priority**: Auth → Quiz → User → Question bounded contexts
- **Validation**: Start with health check, validate each layer incrementally

## Testing Guidelines

### Test Strategy by Layer
| Layer | Type | Coverage | Tools |
|-------|------|----------|--------|
| Domain | Unit Tests | 90% | Pure functions, test factories |
| Repository | Integration | 80% | Real DB, transaction isolation |
| Handler | Unit Tests | 80% | Mock repositories |
| Route | Contract | Critical paths | Full HTTP, real DB |

### Test Organization
- **Co-location**: Tests next to source files with `.test.ts` suffix
- **Domain Tests**: Use `@api/test-support` for domain-specific utilities
- **Infrastructure Tests**: Use `@api/testing/infra` for database and containers
- **Integration Tests**: Use `@api/testing/domain` for cross-layer helpers

## Performance Guidelines

### Query Optimization
- **Repository Layer**: Selective queries, batch operations, proper indexing
- **Transaction Management**: Short transaction scope, no external calls
- **Domain Models**: Lazy loading, value object immutability

## Key Patterns

### Error Handling
- **Result Type**: `Result<T, E>` for fallible operations instead of exceptions
- **Domain Errors**: Custom error types in domain layer

### Value Objects
- **Immutable Types**: Email, UserId, Score with factory methods and validation
- **Domain Events**: Future pattern for cross-boundary communication

### Test Utilities
- **Infrastructure Layer**: `@api/testing/infra` for database, containers, process utilities
- **Domain Layer**: `@api/test-support` for domain-specific helpers and factories

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