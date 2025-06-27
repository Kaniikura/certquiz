# 7. Use Soft Deletes Instead of Hard Deletes

Date: 2025-06-27

## Status

Accepted

## Context

In a quiz application, data integrity and audit trails are critical:

- Users may want to recover accidentally deleted questions
- We need to maintain referential integrity for completed quizzes
- Regulatory compliance may require data retention
- Analytics need historical data even for "deleted" items
- Admin actions should be reversible

Hard deletes would:
- Break foreign key references in quiz history
- Make it impossible to recover from mistakes
- Lose valuable audit information
- Complicate GDPR compliance (need to track what was deleted)

## Decision

We will implement soft deletes using status fields and timestamps instead of actually removing records.

Implementation patterns:

```typescript
// For simple entities - use boolean flag
users: {
  isActive: boolean('is_active').notNull().default(true)
}

// For complex entities - use status enum
questions: {
  status: questionStatusEnum('status').notNull().default('active')
  // Values: 'active', 'archived', 'pending'
}

// For temporal data - use timestamp
quizSessions: {
  completedAt: timestamp('completed_at') // null = active session
}
```

All queries will filter by default:
```typescript
// Repository base class
async findAll(includeDeleted = false) {
  let query = this.db.select().from(this.table);
  
  if (!includeDeleted && 'status' in this.table) {
    query = query.where(eq(this.table.status, 'active'));
  }
  
  return query;
}
```

## Consequences

**Positive:**
- Data recovery is possible
- Maintains referential integrity
- Complete audit trail
- Can analyze deleted data patterns
- Supports "undelete" functionality

**Negative:**
- Database size grows over time
- Need to remember to filter in queries
- More complex than hard deletes
- Index performance may degrade

**Neutral:**
- Need periodic data archival strategy
- GDPR compliance requires actual deletion after retention period
- Backup strategies must account for larger datasets