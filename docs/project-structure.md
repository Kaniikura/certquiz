# Updated Project Structure with Service Layer Architecture

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
│   └── api/                    # Elysia backend (Service Layer Architecture)
│       ├── src/
│       │   ├── index.ts        # Application entry point
│       │   ├── config/         # Configuration management
│       │   │   ├── index.ts
│       │   │   ├── database.ts
│       │   │   └── redis.ts
│       │   ├── routes/         # HTTP route handlers (thin layer)
│       │   │   ├── v1/         # Versioned API routes
│       │   │   │   ├── auth.routes.ts
│       │   │   │   ├── questions.routes.ts
│       │   │   │   ├── quiz.routes.ts
│       │   │   │   └── admin.routes.ts
│       │   │   └── health.ts
│       │   ├── services/       # Business logic layer
│       │   │   ├── auth.service.ts
│       │   │   ├── question.service.ts
│       │   │   ├── quiz.service.ts
│       │   │   ├── user.service.ts
│       │   │   └── progress.service.ts
│       │   ├── repositories/   # Data access layer
│       │   │   ├── base.repository.ts
│       │   │   ├── question.repository.ts
│       │   │   ├── user.repository.ts
│       │   │   ├── quiz.repository.ts
│       │   │   └── progress.repository.ts
│       │   ├── db/            # Database schema and migrations
│       │   │   ├── schema.ts
│       │   │   ├── relations.ts
│       │   │   ├── migrations/
│       │   │   ├── seeds/
│       │   │   └── index.ts
│       │   ├── lib/           # Infrastructure services
│       │   │   ├── cache.ts   # Redis cache service
│       │   │   ├── event-bus.ts # Event bus implementation
│       │   │   ├── logger.ts  # Structured logging
│       │   │   └── monitoring.ts # OpenTelemetry
│       │   ├── middleware/    # Express/Elysia middleware
│       │   │   ├── auth.middleware.ts
│       │   │   ├── rate-limit.middleware.ts
│       │   │   ├── validation.middleware.ts
│       │   │   └── error.middleware.ts
│       │   ├── interfaces/    # TypeScript interfaces
│       │   │   ├── repository.ts
│       │   │   ├── service.ts
│       │   │   ├── cache.ts
│       │   │   └── event-bus.ts
│       │   ├── events/        # Domain events
│       │   │   ├── quiz.events.ts
│       │   │   ├── user.events.ts
│       │   │   └── handlers/
│       │   ├── errors/        # Custom error classes
│       │   │   ├── app.error.ts
│       │   │   ├── validation.error.ts
│       │   │   └── auth.error.ts
│       │   └── utils/         # Utility functions
│       ├── tests/            # Test files
│       │   ├── unit/
│       │   ├── integration/
│       │   └── fixtures/
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

### 3. Service Layer Architecture
- **Routes**: Thin HTTP layer, handles requests/responses only
- **Services**: Business logic, orchestrates operations
- **Repositories**: Data access abstraction
- **Events**: Decoupled communication between services

### 4. Source Code Structure
- Monorepo with Bun workspaces
- Clear separation between apps and shared packages
- Database schemas co-located with API
- Versioned API routes (`/api/v1/`)

### 5. Infrastructure Services
- **Cache**: Redis integration for performance
- **Event Bus**: For async operations and decoupling
- **Logger**: Structured logging with trace IDs
- **Monitoring**: OpenTelemetry integration

### 6. Configuration Files
- Root config files for monorepo setup
- App-specific configs in their directories
- Docker and K8s configs isolated
- Environment-specific configurations

## File Creation Order

When Claude Code starts implementation:

1. **Read CLAUDE.md** - Get project context
2. **Follow PROJECT_SETUP.md** - Initialize structure
3. **Implement from TASK_LIST.md** - Work through tasks
4. **Reference other docs as needed** - Schema, API, Standards

## Benefits of This Structure

1. **Claude Code Optimized**: CLAUDE.md at root provides immediate context
2. **Clear Separation**: Docs, code, and configs are well organized
3. **Monorepo Benefits**: Shared types and easy cross-package imports
4. **Scalable**: Easy to add new apps or packages
5. **CI/CD Ready**: Scripts and workflows pre-organized

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