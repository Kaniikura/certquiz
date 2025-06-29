# Project Structure - Phase 1 (Simple & Fast MVP)

## Overview

This document describes the **Phase 1** project structure for CertQuiz. This is a simplified architecture designed for rapid MVP development while maintaining a clear migration path to the more sophisticated Phase 2 architecture.

**Key Principle**: Start simple, evolve when needed. This structure supports a solo developer building an MVP in 6-8 weeks.

## Phase 1 Structure

```
certquiz/
├── CLAUDE.md                    # Project context at root (required by Claude Code)
├── README.md                    # Public project documentation
├── .env.example                 # Environment template
├── .gitignore
├── package.json                 # Root monorepo config
├── bun.lockb
├── tsconfig.json               # Root TypeScript config
├── biome.json                  # Biome linter/formatter config
│
├── apps/                       # Application packages
│   ├── web/                    # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api/       # API client
│   │   │   │   ├── stores/    # Svelte stores
│   │   │   │   └── utils/
│   │   │   ├── routes/
│   │   │   └── app.html
│   │   ├── static/
│   │   ├── package.json
│   │   └── svelte.config.js
│   │
│   └── api/                    # Hono backend (Simple Service Layer)
│       ├── db/                 # Database-related files
│       │   ├── schema/         # Drizzle table definitions
│       │   ├── migrations/     # Generated migration files
│       │   └── index.ts        # Database client factory
│       ├── src/
│       │   ├── index.ts        # Application entry point
│       │   ├── config/         # Environment configuration (values only)
│       │   │   ├── env.ts      # Typed environment variables
│       │   │   └── index.ts    # Config exports
│       │   ├── modules/        # Feature-based organization
│       │   │   ├── quiz/       # Quiz module
│       │   │   │   ├── quiz.service.ts      # Business logic
│       │   │   │   ├── quiz.routes.ts       # HTTP endpoints
│       │   │   │   ├── quiz.db.ts          # Direct Drizzle queries
│       │   │   │   ├── quiz.types.ts       # TypeScript types
│       │   │   │   └── index.ts            # Module barrel exports
│       │   │   ├── user/       # User module
│       │   │   │   ├── user.service.ts
│       │   │   │   ├── user.routes.ts
│       │   │   │   ├── user.db.ts
│       │   │   │   ├── user.types.ts
│       │   │   │   └── index.ts
│       │   │   ├── auth/       # Auth module
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.routes.ts
│       │   │   │   ├── auth.middleware.ts
│       │   │   │   └── index.ts
│       │   │   └── health/     # Health check module
│       │   │       ├── health.routes.ts
│       │   │       └── index.ts
│       │   ├── shared/         # Shared utilities & infrastructure
│       │   │   ├── logger.ts   # Structured logging
│       │   │   ├── cache.ts    # Redis wrapper (implementation)
│       │   │   ├── result.ts   # Result<T, E> type
│       │   │   ├── errors.ts   # Error classes
│       │   │   └── types.ts    # Shared TypeScript types
│       │   └── middleware/     # HTTP middleware
│       │       ├── validation.middleware.ts
│       │       ├── error.middleware.ts
│       │       └── rate-limit.middleware.ts
│       ├── tests/              # Integration & E2E tests
│       │   ├── integration/
│       │   │   ├── setup.ts    # Integration test setup
│       │   │   └── redis-connection.test.ts
│       │   └── e2e/
│       │       └── setup.ts    # E2E test setup
│       ├── package.json
│       ├── tsconfig.json       # API-specific TypeScript config
│       ├── vitest.config.ts    # Test configuration (API project)
│       ├── drizzle.config.ts
│       └── .dockerignore       # Exclude tests, docs from Docker
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
├── docs/                      # Documentation
│   ├── project-structure.md   # THIS FILE - Phase 1 structure
│   ├── project-setup.md
│   ├── database-schema.md
│   ├── api-specification.md
│   ├── task-list.md
│   ├── coding-standards.md
│   └── designs/               # Future design plans
│       └── phase-2-clean-architecture.md
│
├── docker/                    # Container configurations
│   └── docker-compose.yml
│
└── scripts/                   # Utility scripts
    ├── setup.sh
    └── migrate.sh
```

> 📝 **Co-located File Conventions**: 
> - **Unit tests** are co-located with source files using the `.test.ts` suffix (e.g., `quiz.service.ts` → `quiz.service.test.ts`)
> - **Validation schemas** are co-located using the `.schema.ts` suffix (e.g., `quiz.schema.ts` for Zod validation)
> - This convention applies throughout the codebase except for integration/E2E tests which remain in the `tests/` directory

## Key Design Decisions

### 1. Module-Based Organization 🔑
Group by feature (`modules/quiz/`, `modules/user/`) rather than technical layer. This makes the eventual migration to clean architecture a simple directory reorganization rather than a complete rewrite.

### 2. Co-located Tests ✅
Unit tests live next to the code they test (`feature.ts` + `feature.test.ts`). This follows TDD best practices and makes tests impossible to ignore.

### 3. Simple Service Pattern 🎯
Services contain business logic but directly use Drizzle queries (no repository abstraction yet). This keeps things simple while maintaining clear separation of concerns.

### 4. Shared Infrastructure 🔧
Common utilities in `shared/` folder:
- **logger.ts**: Pino logger instance
- **cache.ts**: Redis client wrapper
- **result.ts**: Result<T, E> type for consistent error handling
- **errors.ts**: Custom error classes
- **types.ts**: Shared TypeScript types

### 5. Direct Database Access 📊
Each module has a `*.db.ts` file with Drizzle queries. No repository pattern yet - just organized query functions. Database schema and migrations are kept outside `src/` to exclude them from runtime bundles.

### 6. Module Barrel Exports 📦
Each module includes an `index.ts` file that re-exports public APIs, making imports cleaner and controlling module boundaries:
```typescript
// modules/quiz/index.ts
export { quizRoutes } from './quiz.routes';
export { QuizService } from './quiz.service';
export type { Quiz, QuizSession } from './quiz.types';
```

### 7. Validation Schemas 🛡️
Each module has a `*.schema.ts` file for Zod validation schemas, keeping validation logic separate from business logic for easier testing and future migration.

## Migration Path to Phase 2

When ready to evolve (see triggers below), the migration is straightforward:

```
Phase 1:
modules/quiz/
  ├── quiz.service.ts    →  services/quiz/quiz.service.ts
  ├── quiz.routes.ts     →  routes/v1/quiz.routes.ts
  ├── quiz.db.ts        →  repositories/quiz/quiz.repository.ts
  └── quiz.types.ts     →  domain/quiz/quiz.types.ts
```

## Phase 2 Migration Triggers

Move to Phase 2 when **2 or more** of these conditions are met:

1. **Team size ≥ 3 developers**
2. **>10 domain entities** or business rules leaking into HTTP layer
3. **PR reviews** dominated by "where does this go?" questions
4. **Alternative runtimes needed** (workers, edge functions)
5. **Performance issues** due to lack of proper layering

## Linting & Code Quality

### Biome Configuration

Using [Biome 2.x](https://biomejs.dev) for fast, all-in-one formatting and linting:

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "ignore": ["**/dist", "**/node_modules", "**/.svelte-kit"]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "nursery": {
        "noImportCycles": "error"  // Prevent circular dependencies
      },
      "complexity": {
        "noExplicitAny": "error",   // No any types
        "useArrowFunction": "error"  // Prefer arrow functions
      },
      "style": {
        "useConst": "error",
        "useTemplate": "error"       // Use template literals
      },
      "suspicious": {
        "noConsole": "warn"         // Warn on console usage
      }
    }
  },
  "javascript": {
    "formatter": {
      "semicolons": "asNeeded",
      "quoteStyle": "single"
    }
  }
}
```

### Key Linting Rules for Phase 1

1. **No circular imports** - Enforced by Biome's `nursery/noImportCycles`
2. **No `any` types** - Enforced by `complexity/noExplicitAny`
3. **Consistent code style** - Automatic formatting with Biome
4. **No console in production** - Warning via `suspicious/noConsole`

### VS Code Integration

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit"
  }
}
```

## TypeScript Configuration

### Path Aliases

Configure path aliases in `apps/api/tsconfig.json` for cleaner imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@api/*": ["./src/*"]
    }
  }
}
```

This allows imports like:
```typescript
import { cache } from '@api/shared/cache';
import { QuizService } from '@api/modules/quiz';
```

### Docker Configuration

Create `apps/api/.dockerignore` to exclude unnecessary files from the Docker build:

```
# Dependencies
node_modules/

# Test files
src/tests/
**/*.test.ts
**/*.spec.ts

# Development files
.env.local
.env.development

# Documentation
README.md
docs/

# Source maps
**/*.map

# TypeScript cache
*.tsbuildinfo
```

## Development Workflow

### 1. Adding a New Feature

```bash
# 1. Create module structure
mkdir -p apps/api/src/modules/newfeature

# 2. Create module files
touch apps/api/src/modules/newfeature/index.ts              # Barrel exports
touch apps/api/src/modules/newfeature/newfeature.types.ts   # TypeScript types
touch apps/api/src/modules/newfeature/newfeature.schema.ts  # Zod schemas

# 3. Write tests first (TDD)
touch apps/api/src/modules/newfeature/newfeature.service.test.ts

# 4. Implement service
touch apps/api/src/modules/newfeature/newfeature.service.ts

# 5. Add routes
touch apps/api/src/modules/newfeature/newfeature.routes.ts

# 6. Database queries if needed
touch apps/api/src/modules/newfeature/newfeature.db.ts
```

### 2. Running Tests

```bash
# Run all tests
bun test

# Run specific module tests
bun test quiz

# Run in watch mode (TDD)
bun test --watch
```

## What NOT to Do in Phase 1

1. **Don't create repository interfaces** - Direct Drizzle queries are fine
2. **Don't over-abstract** - YAGNI (You Aren't Gonna Need It)
3. **Don't create domain layer** - Keep types in modules
4. **Don't implement event bus** - Use direct function calls
5. **Don't optimize prematurely** - Focus on working features

## Benefits of This Structure

1. **Fast Development** - Minimal abstraction, direct implementation
2. **Clear Organization** - Feature-based modules are intuitive
3. **Easy Testing** - Co-located tests with high coverage
4. **Future-Ready** - Clean migration path to Phase 2
5. **Type Safety** - Full TypeScript with strict mode
6. **Developer Experience** - Hot reload, fast tests, clear structure

## Example: Quiz Module

```typescript
// modules/quiz/quiz.types.ts
export interface Quiz {
  id: string;
  userId: string;
  questions: Question[];
  score?: number;
}

// modules/quiz/quiz.schema.ts
import { z } from 'zod';

export const startQuizSchema = z.object({
  questionCount: z.number().int().min(1).max(50),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string(),
});

// modules/quiz/quiz.service.ts
import { Result } from '@api/shared/result';
import * as quizDb from './quiz.db';

export async function startQuiz(
  userId: string, 
  questionCount: number
): Promise<Result<Quiz, Error>> {
  // Business logic here
  const questions = await quizDb.getRandomQuestions(questionCount);
  // ...
}

// modules/quiz/quiz.routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as quizService from './quiz.service';
import { startQuizSchema } from './quiz.schema';

export const quizRoutes = new Hono()
  .post('/start', 
    zValidator('json', startQuizSchema),
    async (c) => {
      const { questionCount } = c.req.valid('json');
      const result = await quizService.startQuiz(c.get('user').id, questionCount);
      if (!result.success) {
        return c.json({ error: result.error.message }, 400);
      }
      return c.json(result.data);
    }
  );

// modules/quiz/index.ts (barrel exports)
export { quizRoutes } from './quiz.routes';
export { QuizService } from './quiz.service';
export type { Quiz, QuizSession } from './quiz.types';
export { startQuizSchema, submitAnswerSchema } from './quiz.schema';
```

## Next Steps

1. Complete Phase 1 MVP implementation
2. Monitor for migration triggers
3. When ready, follow migration path to Phase 2

For the full clean architecture vision, see [Phase 2 Architecture](./designs/phase-2-clean-architecture.md).