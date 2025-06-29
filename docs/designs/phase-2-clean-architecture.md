# Phase 2: Clean Architecture Design (DRAFT)

> ⚠️ **Document Status: UNDER REVIEW / TBD**
> 
> This document describes a potential Phase 2 architecture for CertQuiz. It is currently:
> - **Under active review** and subject to change
> - **Not yet validated** by domain experts in production environments
> - **Open for improvements** based on further architectural analysis
> 
> For the current implementation structure, see [Phase 1 Project Structure](../project-structure.md)

## Overview

This document outlines a more sophisticated service layer architecture suitable for when the project grows beyond the MVP phase. This design follows Clean Architecture principles with clear separation of concerns and dependency inversion.

## Recommended Folder Structure

```
quiz-app/
├── CLAUDE.md                    # Project context at root (required by Claude Code)
├── README.md                    # Public project documentation
├── .env.example                 # Environment template
├── .gitignore
├── package.json                 # Root monorepo config
├── bun.lockb
├── tsconfig.json               # Root TypeScript config
│
├── apps/                       # Application packages
│   ├── web/                    # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api/       # API client layer
│   │   │   │   ├── stores/    # Svelte stores
│   │   │   │   └── utils/
│   │   │   ├── routes/
│   │   │   └── app.html
│   │   ├── static/
│   │   ├── package.json
│   │   └── svelte.config.js
│   │
│   └── api/                    # Hono backend (Service Layer Architecture)
│       ├── src/
│       │   ├── index.ts        # Application entry point
│       │   ├── index.test.ts   # Application integration test
│       │   ├── config/         # Environment configuration (static values only)
│       │   │   ├── index.ts    # Main config export with validation
│       │   │   ├── index.test.ts
│       │   │   ├── database.ts # Database connection settings
│       │   │   └── redis.ts    # Redis connection settings (host, port, etc.)
│       │   ├── routes/         # HTTP route handlers (thin layer)
│       │   │   ├── v1/         # Versioned API routes
│       │   │   │   ├── auth.routes.ts
│       │   │   │   ├── auth.routes.test.ts  # Integration tests
│       │   │   │   ├── questions.routes.ts
│       │   │   │   ├── questions.routes.test.ts
│       │   │   │   ├── quiz.routes.ts
│       │   │   │   ├── quiz.routes.test.ts
│       │   │   │   ├── admin.routes.ts
│       │   │   │   └── admin.routes.test.ts
│       │   │   ├── health.ts
│       │   │   └── health.test.ts      # Unit test co-located
│       │   ├── domain/         # Domain logic and events (pure business objects)
│       │   │   ├── user/
│       │   │   │   ├── user.types.ts   # User domain types
│       │   │   │   ├── user.events.ts  # User domain events
│       │   │   │   └── user.types.test.ts
│       │   │   └── quiz/
│       │   │       ├── quiz.types.ts   # Quiz domain types
│       │   │       ├── quiz.events.ts  # Quiz domain events
│       │   │       └── quiz.types.test.ts
│       │   ├── services/       # Business logic layer (orchestration)
│       │   │   ├── auth/
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.service.test.ts
│       │   │   │   └── index.ts        # Service exports
│       │   │   ├── user/
│       │   │   │   ├── user.service.ts
│       │   │   │   ├── user.service.test.ts
│       │   │   │   └── index.ts
│       │   │   ├── quiz/
│       │   │   │   ├── quiz.service.ts
│       │   │   │   ├── quiz.service.test.ts
│       │   │   │   └── index.ts
│       │   │   └── progress/
│       │   │       ├── progress.service.ts
│       │   │       ├── progress.service.test.ts
│       │   │       └── index.ts
│       │   ├── repositories/   # Data access layer (database abstraction)
│       │   │   ├── base/
│       │   │   │   ├── base.repository.ts
│       │   │   │   ├── base.repository.test.ts
│       │   │   │   └── index.ts
│       │   │   ├── user/
│       │   │   │   ├── user.repository.ts
│       │   │   │   ├── user.repository.test.ts
│       │   │   │   └── index.ts
│       │   │   ├── question/
│       │   │   │   ├── question.repository.ts
│       │   │   │   ├── question.repository.test.ts
│       │   │   │   └── index.ts
│       │   │   └── quiz/
│       │   │       ├── quiz.repository.ts
│       │   │       ├── quiz.repository.test.ts
│       │   │       └── index.ts
│       │   ├── infra/          # Infrastructure services (external adapters)
│       │   │   ├── cache/
│       │   │   │   ├── redis-cache.ts     # Redis client implementation
│       │   │   │   ├── cache.interface.ts # Cache abstraction
│       │   │   │   ├── redis-cache.test.ts
│       │   │   │   └── index.ts
│       │   │   ├── database/
│       │   │   │   ├── connection.ts      # Database client setup
│       │   │   │   ├── connection.test.ts
│       │   │   │   └── index.ts
│       │   │   ├── event-bus/
│       │   │   │   ├── event-bus.ts       # Event bus implementation
│       │   │   │   ├── event-bus.interface.ts
│       │   │   │   ├── event-bus.test.ts
│       │   │   │   └── handlers/          # Event handlers
│       │   │   └── logger/
│       │   │       ├── logger.ts          # Structured logging
│       │   │       ├── logger.test.ts
│       │   │       └── index.ts
│       │   ├── db/            # Database schema and migrations
│       │   │   ├── schema.ts
│       │   │   ├── relations.ts
│       │   │   ├── migrations/
│       │   │   ├── seeds/
│       │   │   └── index.ts
│       │   ├── middleware/    # Hono middleware
│       │   │   ├── auth.middleware.ts
│       │   │   ├── auth.middleware.test.ts
│       │   │   ├── rate-limit.middleware.ts
│       │   │   ├── validation.middleware.ts
│       │   │   └── error.middleware.ts
│       │   ├── interfaces/    # Shared TypeScript interfaces
│       │   │   ├── repository.ts
│       │   │   ├── service.ts
│       │   │   └── api.ts
│       │   ├── errors/        # Custom error classes
│       │   │   ├── app.error.ts
│       │   │   ├── app.error.test.ts
│       │   │   ├── validation.error.ts
│       │   │   └── auth.error.ts
│       │   └── utils/         # Utility functions
│       │       ├── validation.ts
│       │       ├── validation.test.ts
│       │       └── date.utils.ts
│       ├── tests/            # Integration & E2E tests only
│       │   ├── integration/  # Cross-module integration tests
│       │   │   ├── auth-flow.test.ts
│       │   │   ├── quiz-flow.test.ts
│       │   │   └── database.test.ts
│       │   ├── e2e/         # End-to-end API tests
│       │   │   └── api.e2e.test.ts
│       │   └── fixtures/    # Shared test data
│       │       ├── users.json
│       │       └── questions.json
│       ├── package.json
│       └── drizzle.config.ts
│
├── packages/                   # Shared packages
│   ├── shared/                 # Common types and utilities
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── typespec/              # API specifications
│       ├── main.tsp
│       └── package.json
│
├── docs/                      # Detailed documentation
│   ├── project-setup.md       # Environment setup guide
│   ├── database-schema.md     # Complete schema documentation
│   ├── api-specification.md   # API endpoint details
│   ├── task-list.md          # Implementation tasks
│   ├── coding-standards.md    # Development conventions
│   └── architecture-decisions.md # Architecture documentation
│
├── docker/                    # Container configurations
│   ├── docker-compose.yml
│   ├── postgres/
│   │   └── init.sql
│   └── keycloak/
│       └── realm-export.json
│
├── k8s/                       # Kubernetes manifests
│   ├── base/
│   │   ├── api-deployment.yaml
│   │   ├── web-deployment.yaml
│   │   ├── postgres-statefulset.yaml
│   │   └── ingress.yaml
│   └── overlays/
│       ├── development/
│       └── production/
│
├── scripts/                   # Utility scripts
│   ├── setup.sh              # Initial setup script
│   ├── generate-types.sh     # Type generation
│   └── backup-db.sh          # Database backup
│
├── tests/                     # E2E tests
│   ├── e2e/
│   └── fixtures/
│
├── .claude/                   # Claude Code specific files
│   └── instructions.md        # Instructions for Claude Code
│
└── .github/                   # GitHub Actions
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

## Key Points for Claude Code

### 1. CLAUDE.md Location
- **MUST** be at project root
- Contains project overview and links to other docs
- Claude Code reads this first for context

### 2. Documentation Organization
- All detailed docs in `/docs` folder
- CLAUDE.md references these with relative paths
- Each doc has a specific purpose
- Architecture decisions documented separately

### 3. Service Layer Architecture (Clean Architecture)
- **Routes**: Thin HTTP layer, handles requests/responses only
- **Domain**: Pure business objects, types, and events (no dependencies)
- **Services**: Business logic orchestration, uses repositories and domain objects
- **Repositories**: Data access abstraction, implements domain interfaces
- **Infra**: External adapters (Redis, database clients, event bus)

### 4. Test Organization (Co-location Pattern)
- **Unit Tests**: Co-located with source files (`feature.ts` + `feature.test.ts`)
- **Integration Tests**: In `tests/integration/` for cross-module testing
- **E2E Tests**: In `tests/e2e/` for full API testing
- **Fixtures**: In `tests/fixtures/` for shared test data

### 5. Configuration vs Infrastructure
- **Config**: Static environment values (host, port, credentials)
  - `config/redis.ts`: Connection settings from env vars
  - `config/database.ts`: Database connection parameters
- **Infra**: Runnable clients and adapters
  - `infra/cache/`: Redis client instance and cache operations
  - `infra/database/`: Database connection and query helpers

### 6. Feature-based Organization
- Group related files by feature within layers:
  - `services/auth/` → authentication-related services
  - `repositories/user/` → user data access operations
  - `domain/quiz/` → quiz domain types and events

### 7. Source Code Structure
- Monorepo with Bun workspaces
- Clear separation between apps and shared packages
- Database schemas co-located with API
- Versioned API routes (`/api/v1/`)
- Absolute import aliases for clean imports

## File Creation Order

When Claude Code starts implementation:

1. **Read CLAUDE.md** - Get project context
2. **Follow PROJECT_SETUP.md** - Initialize structure
3. **Implement from TASK_LIST.md** - Work through tasks
4. **Reference other docs as needed** - Schema, API, Standards

## Benefits of This Structure

1. **Claude Code Optimized**: CLAUDE.md at root provides immediate context
2. **Clean Architecture**: Clear dependency flow (Routes → Services → Repositories → Infra)
3. **TDD-Friendly**: Co-located tests make test-driven development natural
4. **Feature-Focused**: Related code grouped together for easier maintenance
5. **Clear Boundaries**: Config vs Infra separation prevents coupling
6. **Monorepo Benefits**: Shared types and easy cross-package imports
7. **Scalable**: Easy to add new features or services without structural changes
8. **Testing Efficient**: Unit tests close to code, integration tests isolated
9. **CI/CD Ready**: Scripts and workflows pre-organized

## Example CLAUDE.md References

In CLAUDE.md, reference other files like:

```markdown
## Key Documentation

- **Setup Guide**: [docs/project-setup.md](docs/project-setup.md)
- **Database Schema**: [docs/database-schema.md](docs/database-schema.md)
- **API Specification**: [docs/api-specification.md](docs/api-specification.md)
- **Task List**: [docs/task-list.md](docs/task-list.md)
- **Coding Standards**: [docs/coding-standards.md](docs/coding-standards.md)
- **Architecture Decisions**: [docs/architecture-decisions.md](docs/architecture-decisions.md)
```

This allows Claude Code to navigate to detailed documentation when needed while keeping the main CLAUDE.md concise.

---

## Important Notes

> 📝 **Reminder**: This Phase 2 architecture is a **working draft** and not yet finalized.
> 
> - **Do not implement** this structure until it has been thoroughly reviewed
> - **Start with Phase 1** for MVP development
> - **Monitor migration triggers** described in the Phase 1 documentation
> - **Seek expert review** before adopting this architecture in production
> 
> This document will be updated based on:
> - Real-world implementation feedback
> - Performance benchmarking results  
> - Team scaling experiences
> - Domain expert recommendations