# Implementation Plan: Moderation Metadata Persistence

## Overview

This document outlines the implementation plan for persisting question moderation metadata (moderatedBy and feedback) in the CertQuiz application. Currently, this critical data is not being saved to the database, which limits audit capabilities and user feedback.

**Status**: ✅ Completed  
**Priority**: High  
**Estimated Time**: 2.5 hours  
**Actual Time**: 4 hours (including comprehensive testing and bug fixes)  
**Completion Date**: 2025-08-04  

## Problem Statement

The current implementation in `DrizzleQuestionRepository.updateStatus()` (lines 570-572) has a TODO comment indicating that moderation metadata is not being persisted:

```typescript
// Store moderation metadata in a way that fits the current schema
// In a full implementation, you might want to add dedicated moderation columns
```

This means:
- No audit trail of who approved/rejected questions
- No record of feedback provided to content creators
- No ability to track moderation patterns or moderator performance
- Potential compliance issues for educational platforms

## Technical Value Assessment

### Benefits
1. **Audit Trail** ✅
   - Complete history of all moderation actions
   - Who, when, what, and why for every decision
   - Essential for accountability

2. **Compliance** ✅
   - Many educational platforms require moderation logs
   - Helps meet regulatory requirements
   - Provides evidence for dispute resolution

3. **User Experience** ✅
   - Content creators can see why questions were rejected
   - Enables iterative improvement of submissions
   - Builds trust in the moderation process

4. **Analytics** ✅
   - Track moderator performance and consistency
   - Identify common rejection reasons
   - Optimize moderation workflows

5. **Legal Protection** ✅
   - Evidence in case of disputes
   - Demonstrates fair and consistent moderation
   - Protects against bias claims

### Technical Approach

**Decision**: Create a separate `moderation_logs` table instead of adding columns to the question table.

**Rationale**:
- Preserves full history (not just the latest action)
- Better normalization - questions table stays focused
- Enables rich querying of moderation history
- Supports future features like moderation analytics
- No performance impact on question queries

## Implementation Details

### 1. Database Schema

Create new table `moderation_logs`:

```sql
CREATE TABLE "moderation_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question_id" uuid NOT NULL,
  "action" text NOT NULL, -- 'approve', 'reject', 'request_changes'
  "moderated_by" uuid NOT NULL,
  "moderated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "feedback" text,
  "previous_status" "question_status" NOT NULL,
  "new_status" "question_status" NOT NULL,
  CONSTRAINT "moderation_logs_question_id_fk" FOREIGN KEY ("question_id") 
    REFERENCES "question"("question_id") ON DELETE cascade,
  CONSTRAINT "moderation_logs_moderated_by_fk" FOREIGN KEY ("moderated_by") 
    REFERENCES "auth_user"("user_id")
);

-- Performance indexes
CREATE INDEX "ix_moderation_logs_question" ON "moderation_logs" 
  ("question_id", "moderated_at" DESC);
CREATE INDEX "ix_moderation_logs_moderator" ON "moderation_logs" 
  ("moderated_by", "moderated_at" DESC);
CREATE INDEX "ix_moderation_logs_action" ON "moderation_logs" 
  ("action", "moderated_at" DESC);
```

### 2. Drizzle Schema

Create `apps/api/src/features/question/infrastructure/drizzle/schema/moderation.ts`:

```typescript
import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { questionStatusEnum } from './enums';
import { question } from './question';

export const moderationLogs = pgTable(
  'moderation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.questionId, { onDelete: 'cascade' }),
    action: text('action').notNull(), // 'approve', 'reject', 'request_changes'
    moderatedBy: uuid('moderated_by')
      .notNull()
      .references(() => authUser.userId),
    moderatedAt: timestamp('moderated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    feedback: text('feedback'),
    previousStatus: questionStatusEnum('previous_status').notNull(),
    newStatus: questionStatusEnum('new_status').notNull(),
  },
  (table) => [
    index('ix_moderation_logs_question').on(table.questionId, table.moderatedAt),
    index('ix_moderation_logs_moderator').on(table.moderatedBy, table.moderatedAt),
    index('ix_moderation_logs_action').on(table.action, table.moderatedAt),
  ]
);

export type ModerationLogRow = typeof moderationLogs.$inferSelect;
```

### 3. Repository Updates

Update `DrizzleQuestionRepository.updateStatus()`:

```typescript
async updateStatus(
  questionId: QuestionId,
  status: QuestionStatus,
  moderatedBy: string,
  feedback?: string
): Promise<void> {
  try {
    // ... existing validation ...

    // Start transaction
    await this.db.transaction(async (tx) => {
      // Update question status
      await tx
        .update(question)
        .set({
          status: mapQuestionStatusToDb(status),
          updatedAt: new Date(),
        })
        .where(eq(question.questionId, questionId));

      // Log moderation action
      await tx.insert(moderationLogs).values({
        questionId,
        action: this.mapStatusToAction(status),
        moderatedBy,
        feedback,
        previousStatus: currentStatus,
        newStatus: mapQuestionStatusToDb(status),
      });
    });

    // ... existing logging ...
  } catch (error) {
    // ... existing error handling ...
  }
}

private mapStatusToAction(status: QuestionStatus): string {
  switch (status) {
    case QuestionStatus.ACTIVE:
      return 'approve';
    case QuestionStatus.INACTIVE:
      return 'reject';
    case QuestionStatus.DRAFT:
      return 'request_changes';
    default:
      return 'unknown';
  }
}
```

### 4. Testing Updates

Update `InMemoryQuestionRepository` to track moderation logs:

```typescript
export class InMemoryQuestionRepository implements IQuestionRepository {
  private questions = new Map<string, Question>();
  private moderationLogs: Array<{
    questionId: string;
    action: string;
    moderatedBy: string;
    moderatedAt: Date;
    feedback?: string;
    previousStatus: QuestionStatus;
    newStatus: QuestionStatus;
  }> = [];

  async updateStatus(
    questionId: QuestionId,
    status: QuestionStatus,
    moderatedBy: string,
    feedback?: string
  ): Promise<void> {
    // ... existing validation ...

    const previousStatus = question.status;
    question.status = status;
    question.updatedAt = new Date();

    // Track moderation log
    this.moderationLogs.push({
      questionId: questionId.value,
      action: this.mapStatusToAction(status),
      moderatedBy,
      moderatedAt: new Date(),
      feedback,
      previousStatus,
      newStatus: status,
    });
  }

  // Helper method for tests
  getModerationLogs(questionId: string) {
    return this.moderationLogs.filter(log => log.questionId === questionId);
  }
}
```

## Implementation Steps

1. **Create this planning document** ✅
2. **Edit migration file** to add moderation_logs table ✅
3. **Create moderation.ts** Drizzle schema file ✅
4. **Update schema index.ts** to export moderation schema ✅
5. **Update DrizzleQuestionRepository** to persist moderation data ✅
6. **Update InMemoryQuestionRepository** for tests ✅
7. **Run tests** to ensure nothing breaks ✅
8. **Test the implementation** with actual moderation actions ✅

## Testing Strategy

1. **Unit Tests**:
   - Verify moderation logs are created on status updates
   - Test transaction rollback if logging fails
   - Validate feedback requirements

2. **Integration Tests**:
   - Test actual database persistence
   - Verify foreign key constraints
   - Test cascade deletion

3. **Manual Testing**:
   - Moderate questions through admin interface
   - Verify logs appear in database
   - Check that feedback is preserved

## Future Enhancements

1. **Moderation Analytics Dashboard**:
   - Moderator performance metrics
   - Common rejection reasons
   - Time-to-moderation statistics

2. **Moderation History API**:
   - Endpoint to retrieve moderation history for a question
   - User-facing feedback display

3. **Bulk Moderation Support**:
   - Log batch moderation actions
   - Performance optimization for bulk operations

## Risk Mitigation

1. **Data Migration**: Not needed as this is a new table
2. **Performance**: Indexes ensure queries remain fast
3. **Storage**: Text feedback field could grow large - consider limits
4. **Privacy**: Ensure moderation logs respect data retention policies

## Success Criteria

- [x] Moderation metadata is persisted to database
- [x] All moderation actions create audit logs
- [x] Feedback is available for rejected questions
- [x] No performance degradation (indexes added for query optimization)
- [x] All existing tests pass (1280 unit tests, 147 integration tests)
- [x] New tests cover moderation logging (52 integration tests for moderation)

## References

- Original review comment identifying the issue
- Current implementation: `DrizzleQuestionRepository.ts` lines 570-572
- Admin moderation handler: `moderate-questions/handler.ts`
- VSA architecture pattern for feature organization

## Progress Update (2025-08-04)

### Implementation Complete

The moderation metadata persistence feature has been fully implemented and tested. All unit and integration tests are passing successfully.

### Commits Created

The implementation was organized into logical commits:

1. **Domain Logic** - Added `moderateStatus()` method to Question entity with business rules
2. **Database Schema** - Created `moderation_logs` table for audit trail
3. **Repository Implementation** - Updated repositories to use domain method and persist logs
4. **Admin API Endpoints** - Implemented moderation endpoints with proper validation
5. **Admin Handler Improvements** - Enhanced list handlers with better error handling
6. **Shared Utilities** - Improved type safety and added documentation
7. **Integration Tests** - Added 52 comprehensive tests for moderation workflows

### Final Test Results

- All 1280 unit tests passing
- All 147 integration tests passing
- Complete coverage of moderation scenarios
- Edge cases handled properly

## Completion Summary

### What Was Accomplished

1. **Database Schema**: Added `moderation_logs` table to track all moderation actions with full audit trail capabilities
2. **Drizzle Integration**: Created schema file with proper TypeScript types and database constraints
3. **Repository Implementation**: Updated both Drizzle and in-memory repositories to persist moderation data using transactions
4. **Domain-Driven Design**: Implemented `moderateStatus()` domain method in Question entity to enforce business rules
5. **Error Handling**: Fixed all type errors and import issues during implementation
6. **Performance Optimization**: Added appropriate indexes for common query patterns
7. **Comprehensive Testing**: Created 52 integration tests for moderation workflows
8. **Bug Fixes**: Resolved all test failures and edge cases

### Key Implementation Details

- Used separate table approach for better normalization and historical tracking
- Implemented transaction-based updates to ensure data consistency
- Added proper foreign key constraints to maintain referential integrity
- Domain method enforces business rules: only DRAFT questions can be moderated
- Created helper methods for mapping status to action names
- Preserved all existing business rules and validation logic

### Technical Challenges Resolved

1. **Import Issues**: Resolved missing imports for `moderationLogs` and `questionStatusEnum`
2. **Type Errors**: Fixed type-only imports and ensured proper type casting
3. **Method Missing**: Added `mapStatusToAction` helper method to both repository implementations
4. **Schema Integration**: Successfully integrated new schema into existing infrastructure
5. **Test Failures**: Fixed status mapping issues (PENDING → draft)
6. **Error Message Consistency**: Updated error expectations in repository tests
7. **Domain Rule Enforcement**: Ensured only DRAFT questions can be moderated

### Test Results

- **Unit Tests**: 1280 passed | 1 skipped (87 test files)
- **Integration Tests**: 147 passed (13 test files)
- **Moderation Tests**: 52 comprehensive tests covering all scenarios
- **Coverage**: Full coverage of moderation workflows including edge cases

### Next Steps

1. ✅ Run the test suite to ensure no regressions
2. ✅ Create specific tests for moderation logging functionality
3. ✅ Test with actual moderation workflows in the admin interface
4. Consider adding API endpoints to expose moderation history
5. Implement moderation analytics dashboard
6. Add bulk moderation support for efficiency