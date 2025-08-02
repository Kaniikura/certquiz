# CertQuiz Codebase Refactoring Plan: Eliminating Unused Exports

## Executive Summary

This refactoring plan addresses the significant technical debt identified by `knip` analysis, which found:
- **48 unused exports** (functions, classes, constants)
- **18 unused exported types**
- **39 index.ts files** creating excessive barrel exports
- **6 unused files** that can be removed
- **9 unused dependencies** and **13 unused devDependencies**

The primary goal is to simplify the codebase structure, eliminate dead code, and establish consistent patterns for managing exports and types across the project.

## Type Sharing Strategy with tRPC

This project will use tRPC for type-safe communication between frontend and backend. The refactoring plan has been adjusted to support this architecture:

### tRPC Integration Approach

1. **Backend Router Types**: The API router (`AppRouter`) will be defined in `apps/api` and its type will be directly imported by the frontend
2. **Shared Domain Types**: The `@certquiz/shared` package will be maintained for:
   - Environment-agnostic types (e.g., `ExamType`, `UserRole`, `QuestionType`)
   - Shared constants and enums
   - Pure utility functions that work in both Node.js and browser environments
3. **Type Flow**: Types flow from backend to frontend through TypeScript's type inference, requiring no code generation

### Updated Package Structure for tRPC

```typescript
// apps/api/src/router.ts
export const appRouter = t.router({
  auth: authRouter,
  quiz: quizRouter,
  question: questionRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter; // This type is imported by frontend

// apps/web/src/utils/trpc.ts
import type { AppRouter } from '../../../api/src/router';
export const trpc = createTRPCReact<AppRouter>();

// packages/shared/src/types.ts - Shared domain types
export type ExamType = 'CCNA' | 'CCNP' | 'CompTIA';
export type UserRole = 'USER' | 'ADMIN' | 'PREMIUM';
```

## 1. Project Structure: Before/After

### Before: Excessive Barrel Exports

```
apps/api/src/
├── features/
│   ├── auth/
│   │   ├── index.ts                    # Re-exports domain items
│   │   ├── domain/
│   │   │   ├── index.ts               # Re-exports from subdirectories
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   └── errors/
│   │   └── login/
│   │       └── route.ts               # Unused file
│   ├── quiz/
│   │   ├── domain/
│   │   │   └── index.ts               # Large barrel export
│   │   └── ...
│   └── question/
│       └── domain/
│           └── index.ts               # Another barrel export
├── shared/
│   ├── http/
│   │   ├── index.ts                   # Unused barrel export
│   │   └── response-utils.ts          # Unused file
│   └── ... (many more index.ts files)
├── test-support/
│   ├── index.ts                       # Re-exports from all subdirectories
│   └── fixtures/
│       └── index.ts                   # Empty/unused
└── index.async.ts                     # Unused async entry point
```

### After: Direct Imports, No Barrel Exports

```
apps/api/src/
├── features/
│   ├── auth/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── User.ts           # Import directly when needed
│   │   │   ├── value-objects/
│   │   │   │   ├── Email.ts          # Import directly
│   │   │   │   ├── UserId.ts         # Import directly
│   │   │   │   └── UserRole.ts       # Import directly
│   │   │   └── errors/
│   │   │       └── AuthErrors.ts     # Import specific errors
│   │   ├── login/
│   │   │   ├── handler.ts
│   │   │   ├── dto.ts
│   │   │   └── validation.ts
│   │   └── routes-factory.ts
│   ├── quiz/
│   │   └── domain/
│   │       ├── aggregates/
│   │       ├── entities/
│   │       └── value-objects/
│   └── question/
│       └── domain/
│           ├── entities/
│           └── value-objects/
├── shared/
│   ├── result.ts                      # Direct import
│   ├── errors.ts                      # Direct import
│   └── ... (no index.ts files)
├── test-support/                      # Scoped to test files only
│   ├── builders/
│   ├── fakes/
│   └── utils/
└── index.ts                          # Single entry point
```

## 2. Type Management Policy

### Core Principles

1. **No Barrel Exports**: Eliminate all `index.ts` files that solely re-export from other files
2. **Direct Imports**: Always import from the specific file where the type/function is defined
3. **Co-location**: Keep types with their implementation when possible
4. **Explicit Exports**: Only export what is actually used by other modules
5. **tRPC Type Sharing**: Leverage tRPC's type inference for API contract types
6. **Shared Package Purpose**: `@certquiz/shared` contains only environment-agnostic types and utilities

### Type Organization Strategy

#### tRPC Router Types
```typescript
// Backend: Define routers and export type
// apps/api/src/features/quiz/quiz.router.ts
export const quizRouter = t.router({
  start: t.procedure.input(startQuizSchema).mutation(/* ... */),
  submit: t.procedure.input(submitAnswerSchema).mutation(/* ... */),
});

// apps/api/src/router.ts
export const appRouter = t.router({ quiz: quizRouter });
export type AppRouter = typeof appRouter; // Frontend imports this type
```

#### Shared Package Types (@certquiz/shared)
```typescript
// Environment-agnostic types that both frontend and backend need
// packages/shared/src/types/exam.ts
export type ExamType = 'CCNA' | 'CCNP' | 'CompTIA';

// packages/shared/src/types/user.ts
export type UserRole = 'USER' | 'ADMIN' | 'PREMIUM';

// packages/shared/src/constants/quiz.ts
export const QUIZ_SIZES = { SMALL: 10, MEDIUM: 25, LARGE: 50 } as const;
export type QuizSize = keyof typeof QUIZ_SIZES;
```

#### Backend-Specific Types
```typescript
// Domain entities and value objects stay in backend
// apps/api/src/features/auth/domain/entities/User.ts
export class User { ... } // Not shared with frontend

// apps/api/src/features/auth/domain/value-objects/Email.ts
export class Email { ... } // Backend validation logic
```

#### Feature-Specific Types
```typescript
// Keep DTOs with their use case
// apps/api/src/features/quiz/start-quiz/dto.ts
export interface StartQuizRequest { ... }
export interface StartQuizResponse { ... }
```

### Import Guidelines

1. **Cross-Feature Imports**: Use domain events or shared interfaces
2. **Value Objects**: Import directly from their definition file
3. **Test Utilities**: Scope to test files only, don't export from production code
4. **Framework Types**: Import from framework packages, not re-exports

## 3. Detailed Execution Plan

### Phase 1: Analysis and Preparation (Day 1)

#### Task 1.1: Create Migration Branch
```bash
git checkout -b refactor/eliminate-unused-exports
```

#### Task 1.2: Document Current State
- [ ] Run `bunx knip > knip-baseline.txt` to capture current state
- [ ] Create spreadsheet mapping all barrel exports to their consumers
- [ ] Identify high-risk areas (most imported barrel exports)

#### Task 1.3: Set Up Tooling
- [ ] Configure ESLint rule to prevent future barrel exports
- [ ] Update `knip.ts` configuration for stricter checks
- [ ] Create codemod scripts for automated refactoring

### Phase 2: Remove Unused Files (Day 1)

#### Task 2.1: Delete Identified Unused Files
```bash
# Remove unused files identified by knip
rm apps/api/src/features/auth/login/route.ts
rm apps/api/src/index.async.ts
rm apps/api/src/infra/auth/AuthProviderFactory.ts
rm apps/api/src/shared/http/index.ts
rm apps/api/src/shared/http/response-utils.ts
rm apps/api/src/test-support/fixtures/index.ts
```

#### Task 2.2: Update Dependencies and Refactor Shared Package

##### Task 2.2a: Audit and Refactor @certquiz/shared
- [ ] Review `packages/shared/` for environment-agnostic types and utilities
- [ ] Keep types needed for tRPC: `ExamType`, `UserRole`, `QuestionType`, etc.
- [ ] Keep pure utility functions: `calculateExperience`, `shuffle`, `Result` type
- [ ] Remove any Node.js or browser-specific code
- [ ] Update exports to use direct paths instead of barrel exports

##### Task 2.2b: Verify Frontend Impact
- [ ] **Verify Frontend Dependencies**: Search `apps/web` for usage of packages before removal
- [ ] Check for `bits-ui` component usage in SvelteKit app
- [ ] Check for Tailwind utility classes (`clsx`, `tailwind-merge`, `tailwind-variants`)
- [ ] If found, either:
  - Refactor frontend to remove usage, OR
  - Keep these dependencies in `apps/web/package.json` only

##### Task 2.2c: Remove Backend-Only Dependencies
```bash
# Remove backend-only unused dependencies
bun remove @hono/node-server pino-pretty es-toolkit

# Remove unused devDependencies (verify not used by frontend first)
bun remove @testcontainers/postgresql @types/pino execa testcontainers dotenv vite-tsconfig-paths @typespec/openapi3 @typespec/http @typespec/rest
```

##### Task 2.2d: Clean Up Configuration Files
- [ ] Remove or update config files for removed packages:
  - Check for orphaned TypeSpec configs
  - Remove unused dotenv configurations
  - Clean up any vite-tsconfig-paths references
- [ ] Ensure build scripts don't reference removed dependencies

**Note**: Do NOT remove `tailwindcss`, `autoprefixer`, `postcss`, or `@sveltejs/adapter-node` if they're used by `apps/web`

### Phase 3: Eliminate Barrel Exports (Days 2-3)

#### Task 3.1: Auth Feature Refactoring
```typescript
// Step 1: Update all imports from auth/index.ts
// Find: import { Email, UserId } from '@api/features/auth';
// Replace: import { Email } from '@api/features/auth/domain/value-objects/Email';
//          import { UserId } from '@api/features/auth/domain/value-objects/UserId';

// Step 2: Remove auth/index.ts and auth/domain/index.ts
```

#### Task 3.2: Quiz Feature Refactoring
```typescript
// Update imports to be direct
// Remove quiz/domain/index.ts
```

#### Task 3.3: Question Feature Refactoring
```typescript
// Similar process for question domain
```

#### Task 3.4: Shared Module Refactoring
```typescript
// Remove all index.ts files in shared/
// Update imports to use direct paths
```

### Phase 4: Clean Up Test Support (Day 3)

#### Task 4.1: Scope Test Utilities
- [ ] Move test utilities to `tests/` directory
- [ ] Remove test-support barrel exports
- [ ] Update test imports to use direct paths

#### Task 4.2: Remove Unused Test Exports
```typescript
// Remove exports that knip identified as unused
// Update tests to import only what they need
```

### Phase 5: Type Consolidation (Day 4)

#### Task 5.1: Eliminate Duplicate Type Exports
- [ ] Resolve `Email` type duplication (auth vs user domain)
- [ ] Consolidate `UserId` definitions
- [ ] Remove unused type exports

#### Task 5.2: Create Type Declaration Files
```typescript
// apps/api/src/types/domain.d.ts
// Shared domain types that cross boundaries

// apps/api/src/types/infrastructure.d.ts  
// Infrastructure types (DB, external services)
```

**Note on Global Types**: When creating `domain.d.ts` and `infrastructure.d.ts`:
- [ ] Ensure these files are included in `tsconfig.json` under the `include` array
- [ ] Use these files only for broadly-used type definitions to avoid polluting the global namespace
- [ ] Prefer exporting types explicitly rather than declaring global types
- [ ] Document the purpose and usage of these files in the repository's README or coding standards
- [ ] Consider using module declarations instead of global declarations where possible

### Phase 6: Update Import Paths (Day 4)

#### Task 6.1: Run Codemod Script
```javascript
// codemod-script.js
// Automated script to update import paths
```

**Codemod Script Description**: This script will find imports of any `index.ts` barrel or previously removed module and rewrite them to direct file paths. It covers:
- Imports from `features/*/index.ts` → Direct imports from specific files
- Imports from `shared/index.ts` → Direct imports from shared modules
- Imports from `test-support/index.ts` → Direct imports from test utilities
- Imports from removed modules → Updated to new locations

**Note**: If any imports are missed by the script, they will be caught by the TypeScript compiler in Phase 7 and fixed manually

#### Task 6.2: Manual Review
- [ ] Review and fix any broken imports
- [ ] Ensure tests still pass
- [ ] Check build output

### Phase 7: Validation and Cleanup (Day 5)

#### Task 7.1: Run Validation Suite
```bash
# Type checking - must pass without errors
bun run typecheck

# Run all tests (unit + integration + e2e) - all must pass
bun run test
bun run test:integration  # if separate command exists
bun run test:e2e         # if separate command exists

# Build the application - must succeed
bun run build

# Start the application to verify runtime behavior
bun run dev  # Start API server and hit a few endpoints manually

# Verify no unused exports remain
bunx knip  # Should report 0 unused items
```

**Manual Sanity Checks**:
- [ ] Start the API server and test a few endpoints (health, auth, quiz)
- [ ] If frontend exists, run the web app and verify basic functionality
- [ ] Check that removed dependencies don't cause runtime errors
- [ ] Verify that all imports resolve correctly at runtime

#### Task 7.2: Update Documentation

##### Internal Architecture Documentation
- [ ] Remove references to barrel files in documentation:
  - Update examples in `docs/` that mention `index.ts` barrels
  - Update `.claude/instructions.md` to remove barrel export patterns
  - Remove mentions of `@certquiz/shared` package (unless for tRPC types)
- [ ] Document that direct imports are now the standard
- [ ] Add examples of correct import patterns for new developers

##### Project Documentation Updates
- [ ] Update README.md:
  - Remove old import examples using barrel exports
  - Add new import examples using direct paths
  - Document the tRPC type sharing approach
- [ ] Update coding-standards.md:
  - Add "No Barrel Exports" rule
  - Document direct import requirement
  - Add tRPC type sharing guidelines
- [ ] Update project-structure.md:
  - Remove references to index.ts files
  - Document new structure without barrel exports
  - Add section on tRPC router organization

##### Type Management Documentation
- [ ] Document new type management policy in a dedicated file
- [ ] Create migration guide for developers
- [ ] Add examples of how to import types with tRPC

#### Task 7.3: Configure CI/CD
- [ ] Add knip to CI pipeline
- [ ] Configure to fail on unused exports
- [ ] Add pre-commit hook

## 4. Risk Mitigation

1. **Breaking Changes**: Run comprehensive test suite after each phase
2. **Import Errors**: Use TypeScript compiler to catch import issues
3. **Circular Dependencies**: Refactor to eliminate circular imports
4. **Performance**: Measure build times before/after
5. **Team Impact**: Communicate changes and provide migration guide
6. **Merge Conflicts**: This large refactor can affect many files. Mitigation: perform this work on an isolated branch and coordinate with the team to minimize other changes. Rebase frequently or temporarily pause merges to avoid conflicts. Communicate the plan's timeline so everyone is aware
7. **Dependency Removal Verification**: After removing dependencies and files (Phase 2), run a fresh install and start/test the apps to confirm nothing was accidentally broken. This double-checks that no code was implicitly relying on the removed items

## 5. Success Metrics

- **Zero unused exports** reported by knip
- **Reduced build time** by eliminating unnecessary bundling
- **Improved code navigation** with direct imports
- **Clearer module boundaries** without barrel exports
- **Smaller bundle size** from tree-shaking improvements

## 6. Long-term Maintenance

1. **ESLint Rules**: Enforce no barrel exports
2. **Code Review**: Check for unnecessary exports
3. **Regular Audits**: Run knip monthly
4. **Documentation**: Keep type policy updated
5. **Training**: Educate team on direct import benefits

## Conclusion

This refactoring will significantly improve code maintainability, reduce complexity, and enable better tree-shaking while maintaining tRPC type sharing capabilities. The elimination of barrel exports will make dependencies explicit and improve developer experience through clearer import paths.

**Key Changes from Original Plan**:
- `@certquiz/shared` package will be maintained and refactored for tRPC type sharing
- Frontend dependencies (`bits-ui`, Tailwind utilities) will be verified before removal
- Comprehensive documentation updates to support the new import patterns
- Additional risk mitigation strategies for merge conflicts and dependency verification

**tRPC Integration Benefits**:
- End-to-end type safety without code generation
- Direct type imports from backend router definitions
- Shared types in `@certquiz/shared` for environment-agnostic code
- Clear separation between API contract types and domain implementation

Estimated Timeline: 5 days with one developer
Expected Reduction: ~1500 lines of unnecessary export code (reduced from 2000 due to keeping @certquiz/shared)