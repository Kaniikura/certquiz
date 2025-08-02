# Barrel Exports Migration Guide

## Overview

This guide documents the migration from barrel exports (index.ts re-export files) to direct imports across the CertQuiz codebase. This refactoring improves tree-shaking, reduces bundle size, and makes dependencies explicit.

## What are Barrel Exports?

Barrel exports are `index.ts` files that re-export items from other files:

```typescript
// features/auth/index.ts (barrel export)
export { Email } from './domain/value-objects/Email';
export { UserId } from './domain/value-objects/UserId';
export { User } from './domain/entities/User';
```

## Why Remove Them?

1. **Poor Tree-Shaking**: Bundlers often include entire barrels even when only one export is used
2. **Hidden Dependencies**: Makes it hard to see what specific modules depend on
3. **Circular Dependencies**: Barrels increase the risk of circular import chains
4. **Build Performance**: Direct imports are faster to resolve and bundle

## Migration Strategy

### Phase 1: Analysis & Setup ✅

1. **Baseline Analysis**
   ```bash
   bun run knip > knip-baseline.txt
   ```
   - 48 unused exports found
   - 18 unused types
   - 45 barrel export files identified

2. **Tooling Configuration**
   - Biome: `noReExportAll` set to "error"
   - knip: Strict rules for unused code detection
   - Codemod scripts created for automation

### Phase 2: Import Transformation

Transform all imports from barrel exports to direct imports.

#### Before:
```typescript
import { Email, UserId, User } from '@api/features/auth';
import { QuizSession, QuizConfig } from '@api/features/quiz/domain';
```

#### After:
```typescript
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { User } from '@api/features/auth/domain/entities/User';
import { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import { QuizConfig } from '@api/features/quiz/domain/value-objects/QuizConfig';
```

### Phase 3: Remove Barrel Files

Once all imports are transformed, remove the now-unused index.ts files.

## Using the Codemod Scripts

### 1. Preview Changes (Dry Run)

See what changes will be made without modifying files:

```bash
bun run codemod:barrel-dry-run
```

Output shows:
- Files that will be modified
- Line-by-line import transformations
- Total number of changes

### 2. Transform Imports

Apply the transformations to all TypeScript files:

```bash
bun run codemod:barrel-transform
```

This script:
- Analyzes all barrel exports to map exports to source files
- Transforms imports to use direct paths
- Preserves import functionality while removing barrel dependencies

### 3. Validate Imports

Ensure all imports resolve correctly after transformation:

```bash
bun run codemod:validate-imports
```

Checks for:
- Broken import paths
- Remaining barrel imports
- Resolution issues

### 4. Remove Barrel Files

After imports are transformed and validated:

```bash
# Preview which files can be removed
bun run codemod:barrel-remove --dry-run

# Actually remove barrel files
bun run codemod:barrel-remove
```

## Step-by-Step Migration Process

### Step 1: Create Migration Branch
```bash
git checkout -b refactor/eliminate-unused-exports
```

### Step 2: Run Baseline Analysis
```bash
bun run knip > knip-baseline-before.txt
```

### Step 3: Preview Transformations
```bash
bun run codemod:barrel-dry-run
```

### Step 4: Apply Transformations
```bash
bun run codemod:barrel-transform
```

### Step 5: Validate and Test
```bash
# Validate imports
bun run codemod:validate-imports

# Run tests
bun run test

# Type check
bun run typecheck

# Build to ensure bundling works
bun run build
```

### Step 6: Remove Barrel Files
```bash
bun run codemod:barrel-remove
```

### Step 7: Final Validation
```bash
# Run knip again to see improvements
bun run knip > knip-baseline-after.txt

# Ensure everything still works
bun run test
bun run build
```

## Common Import Patterns

### Domain Entities
```typescript
// Before
import { User, Email, UserId } from '@api/features/auth/domain';

// After
import { User } from '@api/features/auth/domain/entities/User';
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
```

### Repository Interfaces
```typescript
// Before
import { IUserRepository } from '@api/features/user/domain';

// After
import { IUserRepository } from '@api/features/user/domain/repositories/IUserRepository';
```

### Shared Utilities
```typescript
// Before
import { Result, Ok, Err } from '@api/shared';

// After
import { Result, Ok, Err } from '@api/shared/result';
```

### Test Support
```typescript
// Before
import { aUser, aQuizSession } from '@api/test-support';

// After
import { aUser } from '@api/test-support/builders/UserBuilder';
import { aQuizSession } from '@api/test-support/builders/quiz/QuizSessionBuilder';
```

## Troubleshooting

### Import Not Found After Transformation

If an import can't be resolved after transformation:

1. Check if the source file actually exports the item
2. Verify the file path is correct
3. Ensure TypeScript path mappings are configured

### Circular Dependencies

Direct imports may expose circular dependencies that were hidden by barrels:

1. Use `bunx madge --circular --extensions ts ./apps/api/src` to find cycles
2. Refactor to break the cycle (e.g., introduce interfaces, split modules)

### Test Failures

If tests fail after migration:

1. Check for missing exports that tests depended on
2. Update test imports to use direct paths
3. Ensure test utilities are properly exported

## Benefits After Migration

1. **Reduced Bundle Size**: Better tree-shaking removes unused code
2. **Faster Builds**: Direct imports resolve faster
3. **Explicit Dependencies**: Clear visibility of what each file depends on
4. **Easier Refactoring**: Moving files doesn't break barrel export chains
5. **Better IDE Support**: Go-to-definition works directly

## Maintaining the Pattern

### ESLint/Biome Rules

The Biome configuration now enforces:
```json
{
  "performance": {
    "noReExportAll": "error"
  }
}
```

### Code Review Checklist

- [ ] No new `index.ts` barrel files created
- [ ] All imports use direct paths
- [ ] No `export * from` statements
- [ ] Dependencies are explicit and minimal

### Import Convention

Follow this pattern for all imports:
```typescript
// ✅ Good - Direct import
import { Email } from '@api/features/auth/domain/value-objects/Email';

// ❌ Bad - Barrel import
import { Email } from '@api/features/auth/domain';
import { Email } from '@api/features/auth';
```

## Rollback Plan

If issues arise:

1. The migration branch preserves the original state
2. Barrel files are removed in a separate step (can be restored)
3. Git history allows reverting the transformation commits

## Success Metrics

After migration:
- ✅ 0 barrel export files (down from 45)
- ✅ 0 unused exports reported by knip
- ✅ Reduced build time
- ✅ Smaller bundle sizes
- ✅ All tests passing
- ✅ No runtime errors

## Next Steps

After completing the barrel exports migration:

1. Remove unused dependencies identified by knip
2. Clean up any duplicate type definitions
3. Consider extracting truly shared types to `@certquiz/shared`
4. Set up CI to prevent barrel exports from being reintroduced