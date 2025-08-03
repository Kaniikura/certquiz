# Type Management Policy

## Core Principles

1. **No Barrel Exports** - Direct imports only, eliminates `index.ts` re-export files
2. **Explicit Types** - No `any` types, explicit return types required
3. **Co-location** - Types defined near their usage
4. **Minimal Shared Types** - Only essential types in `@certquiz/shared`

## Import Patterns

### ✅ Direct Imports (Required)
```typescript
// Domain types
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';

// Shared constants
import { QUIZ_SIZES } from '@certquiz/shared/constants';

// Infrastructure
import { createDrizzleInstance } from '@api/infra/db/shared';
```

### ❌ Barrel Imports (Forbidden)
```typescript
// Never do this
import { Email, UserId } from '@api/features/auth';
import { QuizSession } from '@api/features/quiz';
```

## Type Organization

### Domain Types
- **Location**: `features/[context]/domain/`
- **Ownership**: Each bounded context owns its types
- **Examples**: `Email`, `UserId`, `QuizSession`, `Score`

### Shared Types (`@certquiz/shared`)
- **Purpose**: Environment-agnostic constants and utilities only
- **Current Scope**: `QUIZ_SIZES`, `CONFIG` constants
- **Rule**: Only add types used by multiple bounded contexts

### API Types
- **Generated**: From Drizzle schemas for database operations
- **DTOs**: Co-located with use cases in `[use-case]/dto.ts`
- **Validation**: Zod schemas in `[use-case]/validation.ts`

## Migration Guidelines

1. **Replace barrel imports** with direct imports
2. **Remove `index.ts` files** that only re-export
3. **Update path references** to point to actual files
4. **Validate with TypeScript compiler** - no import errors

## Quality Gates

- ✅ TypeScript compilation passes
- ✅ No `index.ts` barrel export files
- ✅ All imports use direct paths
- ✅ knip reports zero unused exports

## Tools

- **knip**: Detects unused exports and imports
- **Biome**: Enforces import ordering and style
- **TypeScript**: Validates type correctness