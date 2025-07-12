# CertQuiz

A web-based quiz application for technical certification exam preparation. Built with modern TypeScript stack emphasizing type safety and developer experience. Supports multiple exam types including CCNA, CCNP ENCOR, CCNP ENARSI, and other technical certifications.

## Core Development Principles

### 🧪 Test-Driven Development (TDD)
**This is a mandatory development approach.** Every feature must follow:
1. Write failing tests first
2. Implement minimum code to pass tests
3. Refactor while keeping tests green
4. No code without tests - 80% coverage minimum

### 📋 Schema-Driven Development
**API development follows schema-first approach:**
1. Define TypeSpec schemas first
2. Generate OpenAPI specifications
3. Use Zod for runtime validation
4. Database schema drives the application

### 🏗️ Service Layer Architecture
**Clean architecture with proper separation of concerns:**
1. Thin HTTP routes layer (request/response only)
2. Service layer for business logic
3. Repository layer for data access
4. Event-driven communication between services

## Tech Stack

- **Frontend**: SvelteKit + TypeScript + TailwindCSS
- **Backend**: Bun + Hono + Drizzle ORM
- **Database**: Neon PostgreSQL (serverless)
- **Auth**: KeyCloak
- **Architecture**: Service Layer + Repository Pattern + Event Bus
- **Code Quality**: Biome 2.x (linter + formatter)
- **Testing**: Vitest with 80% coverage requirement
- **Deployment**: Self-hosted K8s cluster

## Key Documentation

- **Architecture Decisions**: @docs/adr/ - Architecture Decision Records (ADRs)
- **Claude Instructions**: @.claude/instructions.md - Specific instructions for Claude Code
- **Commit Convention**: @.claude/commit-convention.md - Git commit message guidelines
- **Project Structure**: @docs/project-structure.md - Complete project organization with service layer
- **Setup Guide**: @docs/project-setup.md - Complete environment setup instructions
- **Database Schema**: @docs/database-schema.md - Drizzle ORM schemas and relations
- **API Specification**: @docs/api-specification.md - All endpoint definitions
- **Task List**: @docs/task-list.md - Phase 1 implementation tasks (revised for new architecture)
- **Coding Standards**: @docs/coding-standards.md - Development conventions

## Quick Start

```bash
# Setup environment
bun install
bun run docker:up
bun run db:migrate
```

## Development Workflow

### 1. Schema-First API Development
```bash
# 1. Define TypeSpec schema
edit packages/typespec/main.tsp

# 2. Generate OpenAPI
bun run typespec:compile

# 3. Write API tests
edit apps/api/src/routes/resource.test.ts

# 4. Implement API endpoint
edit apps/api/src/routes/resource.ts
```

### 2. TDD Feature Development
```bash
# 1. Write failing test
bun test path/to/feature.test.ts

# 2. Implement feature
# Make test pass with minimal code

# 3. Refactor
# Improve code while keeping tests green
```

### 3. Task Completion Requirements
**Before marking any task as completed, you MUST:**
```bash
# 1. Run all tests and ensure they pass
bun run test

# 2. Apply code formatting and linting
bun run check    # Format & Lint

# 3. Verify no errors remain
bun run check:ci  # Final check without fixes
```

## Current Status

### Completed:
- ✅ Project setup and monorepo structure
- ✅ Docker environment (PostgreSQL + KeyCloak)
- ✅ Environment configuration with validation
- ✅ Architecture documentation (ADRs)
- ✅ Migration from Elysia to Hono
- ✅ Migration to Biome 2.x for linting and formatting
- ✅ Removed Redis caching (using Neon PostgreSQL instead)

### In Progress: Phase 1
- 🔄 Service layer architecture implementation
- 🔄 Repository pattern for data access
- 📋 Basic quiz functionality
- 📋 User authentication via KeyCloak
- 📋 Progress tracking and gamification
- 📋 Admin interface

See @docs/task-list.md for detailed implementation tasks.

## Key Conventions

### TypeScript & TDD
- Write tests before code (always!)
- No `any` types - use `unknown` and type guards
- Explicit return types on all functions
- Test files next to source: `feature.ts` → `feature.test.ts`
- Domain objects use `Result<T,E>` pattern - use `unwrapOrFail()` in tests

### Database (Schema-Driven)
- Schema changes start in `schema.ts`
- Generate migrations from schema
- Test database operations with transactions
- Use Drizzle's type-safe query builder

### API (Schema-First)
- Define endpoints in TypeSpec first
- Generate types from TypeSpec
- Validate with Zod schemas
- Test all endpoints with integration tests

## Environment Variables

Required in `.env`:
```env
# Database (Use Neon connection string for production)
DATABASE_URL=postgresql://postgres:password@localhost:5432/certquiz

# Authentication
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=certquiz
JWT_SECRET=<generate-secure-key>

# External Services
BMAC_WEBHOOK_SECRET=<from-buy-me-a-coffee>

# Application
API_PORT=4000
NODE_ENV=development
```

## Testing Commands

```bash
# TDD workflow
bun run test --watch        # Run tests in watch mode
bun run test --coverage     # Check coverage (must be >80%)

# Specific test types
bun run test:unit          # Unit tests only
bun run test:integration   # Integration tests
bun run test:e2e          # End-to-end tests
```

## Common Commands

```bash
# Development
bun run dev              # Start all services
bun run typecheck       # Type checking

# Code Quality (Biome)
bun run format          # Format all files
bun run lint            # Lint with unsafe fixes
bun run check           # Format + lint with fixes
bun run check:ci        # Check without fixes (CI)

# Schema & Database
bun run typespec:compile # Generate from TypeSpec
bun run db:generate     # Generate migrations
bun run db:migrate      # Apply migrations
bun run db:studio       # Drizzle Studio GUI

# Docker
bun run docker:up       # Start PostgreSQL & KeyCloak
bun run docker:down     # Stop services
```

## Architecture Highlights

1. **Service Layer**: Clean separation of concerns (Routes → Services → Repositories)
2. **Event-Driven**: Loosely coupled services communicate via events
3. **Multi-Level Caching**: Redis for sessions, entities, queries, and computed data
4. **Repository Pattern**: Database abstraction for easy testing and flexibility
5. **TDD Mandatory**: No features without tests (80% coverage minimum)
6. **Schema-First**: TypeSpec → OpenAPI → Implementation
7. **Type Safety**: End-to-end type safety with TypeScript

See @docs/adr/ for detailed architecture decisions.

## Important Notes

- **Always write tests first** - This is non-negotiable
- **Schema drives development** - Update schemas before code
- **Performance**: Keep quiz response time under 200ms
- **Security**: All routes except public quiz endpoints require auth
- **Mobile First**: Test all UI on mobile devices

## Phase 2 Plans

After Phase 1 completion (with full test coverage):
- Community features (problem reporting, user submissions)
- Gamification (badges, achievements)
- Premium subscriptions via Buy Me a Coffee
- AI-powered question recommendations