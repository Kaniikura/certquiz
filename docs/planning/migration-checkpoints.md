# VSA Migration Checkpoints

## Overview

This document tracks the migration checkpoints for the clean-slate VSA + Repository Pattern implementation.

## Migration Status

- ✅ **Legacy branch created**: `legacy-module-arch` (backup of current module-based architecture)
- 🔄 **Clean-slate branch**: `feat/vsa-architecture-reset` (current working branch)
- 📋 **Implementation plan**: Reviewed and ready in `planning/vsa-implementation-plan.md`

## Checkpoints

### Checkpoint 1: Preparation ✅
- [x] Review VSA implementation plan
- [x] Create legacy-module-arch branch for backup
- [x] Push legacy branch to remote
- [x] Create migration checkpoints document

### Checkpoint 2: Clean-Slate Reset ✅
- [x] Delete module-based architecture directories
- [x] Create new VSA directory structure
- [x] Move database files to infra/db/
- [x] Rename database.ts to client.ts
- [x] Clean up old config and types directories
- [x] Create basic index.ts with Hono setup
- [x] Create unit-of-work.ts helper

### Checkpoint 3: Infrastructure Foundation
- [ ] Create infra/db/client.ts
- [ ] Create infra/unit-of-work.ts
- [ ] Setup error handling middleware
- [ ] Configure logging and request-ID middleware

### Checkpoint 4: First Vertical Slice (Health)
- [ ] Create system/health structure
- [ ] Implement health handler with TDD
- [ ] Wire up health route
- [ ] Validate middleware chain

### Checkpoint 5: Auth Slice with Repository
- [ ] Create auth domain with repository interface
- [ ] Implement DrizzleUserRepository
- [ ] Create login use case
- [ ] Integrate KeyCloak

### Checkpoint 6: Migration Validation
- [ ] All tests passing
- [ ] Health endpoint returns 200
- [ ] Login flow works with repository pattern
- [ ] Transaction boundaries verified

## Rollback Plan

If issues arise during migration:
1. Switch to `legacy-module-arch` branch
2. Cherry-pick any critical fixes
3. Re-evaluate migration strategy

## Success Criteria

- All checkpoints completed
- 90% domain test coverage achieved
- No cross-slice imports
- Performance metrics equal or better than legacy

## Notes

- Using clean-slate approach (no gradual migration)
- Repository interfaces in domain layer
- Implementations use transaction context
- Co-located tests with .test.ts suffix