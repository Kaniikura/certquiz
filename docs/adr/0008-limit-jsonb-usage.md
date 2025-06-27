# 8. Limit JSONB Usage to Truly Dynamic Data

Date: 2025-06-27

## Status

Accepted

## Context

PostgreSQL's JSONB type is powerful and flexible, but overuse can lead to problems:

- Query performance degrades with complex JSON operations
- Indexing JSON fields is limited and expensive  
- Type safety is lost at the database level
- Migrations become difficult when JSON structure changes
- ORMs have limited support for JSON operations

Initial design proposed JSONB for:
- Category statistics (attempted, correct, accuracy per category)
- Question metadata
- User preferences
- Audit log details

However, most of this data has predictable structure that would benefit from proper normalization.

## Decision

We will limit JSONB usage to only truly dynamic, unstructured data:

**Use JSONB for:**
```typescript
// Truly dynamic data
auditLogs: {
  metadata: jsonb('metadata').default({}) // Variable based on action type
}

// Feature flags with unknown structure  
featureFlags: {
  config: jsonb('config').default({}) // Flexible per feature
}

// External API responses
webhookLogs: {
  payload: jsonb('payload') // Unpredictable structure
}
```

**Use normalized tables instead of JSONB for:**
```typescript
// Instead of: categoryStats: jsonb
// Create dedicated table:
export const categoryProgress = pgTable('category_progress', {
  userId: uuid('user_id').references(() => users.id),
  category: text('category').notNull(),
  attempted: integer('attempted').notNull().default(0),
  correct: integer('correct').notNull().default(0),
  accuracy: real('accuracy').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Composite primary key
primaryKey: [userId, category]
```

## Consequences

**Positive:**
- Better query performance with proper indexes
- Type safety maintained throughout the stack
- Easier to write complex queries
- Standard SQL aggregations work
- Better migration support

**Negative:**
- More tables to manage
- Need migrations when adding new tracked data
- Slightly more complex schema

**Neutral:**
- Team needs to identify truly dynamic vs structured data
- Database normalization skills required
- More upfront design thinking needed