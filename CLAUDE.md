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
- **Backend**: Bun + Elysia + Drizzle ORM
- **Database**: PostgreSQL 16 + Redis (caching)
- **Auth**: KeyCloak
- **Architecture**: Service Layer + Repository Pattern + Event Bus
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

# Start development (TDD mode)
bun test --watch  # Keep tests running
bun run dev       # In another terminal
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

## Current Status

### Completed:
- ✅ Project setup and monorepo structure
- ✅ Docker environment (PostgreSQL + KeyCloak)
- ✅ Environment configuration with validation
- ✅ Architecture documentation (ADRs)

### In Progress: Phase 1
- 🔄 Service layer architecture implementation
- 🔄 Repository pattern for data access
- 🔄 Redis caching integration
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
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/certquiz
REDIS_URL=redis://localhost:6379

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
bun test --watch        # Run tests in watch mode
bun test --coverage     # Check coverage (must be >80%)

# Specific test types
bun test:unit          # Unit tests only
bun test:integration   # Integration tests
bun test:e2e          # End-to-end tests
```

## Common Commands

```bash
# Development
bun run dev              # Start all services
bun run typecheck       # Type checking

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