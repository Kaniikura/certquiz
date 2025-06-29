# Phase 2 Database Enhancements

## Overview

This document contains database enhancements deferred from Phase 1 following YAGNI principles. These features can be implemented after the MVP is successful and real usage patterns emerge.

## Deferred Enhancements

### 1. Performance Optimizations

#### Materialized Views
```sql
-- Category statistics materialized view (updated for normalized schema)
CREATE MATERIALIZED VIEW category_statistics AS
SELECT 
  e.code as exam_code,
  c.code as category_code,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE q.is_premium = true) as premium_questions,
  COUNT(*) FILTER (WHERE q.is_user_generated = true) as user_questions
FROM questions q
JOIN question_exams qe ON q.id = qe.question_id
JOIN exams e ON qe.exam_id = e.id
JOIN question_categories qc ON q.id = qc.question_id  
JOIN categories c ON qc.category_id = c.id
WHERE q.status = 'active'
GROUP BY e.code, c.code;

CREATE INDEX idx_cat_stats ON category_statistics(exam_code, category_code);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_category_statistics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY category_statistics;
END;
$$ LANGUAGE plpgsql;
```

#### Expression Indexes for JSONB
```sql
-- For frequently accessed category stats
CREATE INDEX idx_user_progress_ospf_accuracy 
ON user_progress ((category_stats->'OSPF'->>'accuracy'));

-- For audit log queries
CREATE INDEX idx_audit_logs_action_time 
ON audit_logs (action, created_at DESC)
WHERE entity_type = 'question';
```

### 2. Enhanced Security

#### Row Level Security (RLS)
```typescript
// apps/api/src/db/policies.ts
export async function setupRLS(db: Database) {
  // Users can only access their own data
  await db.execute(sql`
    ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY user_progress_policy ON user_progress
      FOR ALL
      USING (user_id = current_setting('app.current_user_id')::uuid);
  `);
  
  // Problem reports - creators can only update their own
  await db.execute(sql`
    ALTER TABLE problem_reports ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY problem_reports_insert ON problem_reports
      FOR INSERT
      WITH CHECK (reporter_id = current_setting('app.current_user_id')::uuid);
  `);
}
```

### 3. Additional Tables

#### Study Sessions Tracking
```typescript
export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time', { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp('end_time', { withTimezone: true }),
  focusTime: integer('focus_time').notNull().default(0), // actual study time in seconds
  breakTime: integer('break_time').notNull().default(0), // break time in seconds
  questionsAttempted: integer('questions_attempted').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    userIdx: index('idx_study_sessions_user').on(table.userId),
    startTimeIdx: index('idx_study_sessions_start').on(table.startTime),
  };
});
```

#### Question Difficulty Tracking
```typescript
export const questionDifficulty = pgTable('question_difficulty', {
  questionId: uuid('question_id').primaryKey()
    .references(() => questions.id, { onDelete: 'cascade' }),
  attemptCount: integer('attempt_count').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  averageTime: integer('average_time'), // average answer time in seconds
  difficultyScore: decimal('difficulty_score', { precision: 3, scale: 2 })
    .notNull().default('0.50'), // 0.00-1.00
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    scoreIdx: index('idx_difficulty_score').on(table.difficultyScore),
  };
});
```

### 4. Advanced Features

#### Partitioning for Audit Logs
```sql
-- Partition audit_logs by month for better performance
CREATE TABLE audit_logs (
  -- ... existing columns ...
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### Read Replica Configuration
```typescript
// apps/api/src/db/replicas.ts
export const readReplica = postgres(process.env.DATABASE_READ_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const readDb = drizzle(readReplica, { 
  schema: { ...schema, ...relations },
  logger: false, // Less logging on read replica
});
```

### 5. Backup and Recovery

#### Point-in-Time Recovery
```sql
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'aws s3 cp %p s3://backup-bucket/wal/%f';
```

#### Automated Backup Script
```bash
#!/bin/bash
# Daily logical backup with compression
pg_dump -h $DB_HOST -U $DB_USER -d certquiz \
  --no-owner --clean --if-exists \
  | gzip > /backup/daily/certquiz_$(date +%Y%m%d_%H%M%S).sql.gz

# Keep only last 30 days
find /backup/daily -name "certquiz_*.sql.gz" -mtime +30 -delete
```

### 6. Monitoring and Maintenance

#### Slow Query Monitoring
```sql
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
ALTER SYSTEM SET log_statement = 'mod'; -- Log all data-modifying statements
```

#### Auto-vacuum Tuning
```sql
-- More aggressive vacuum for high-update tables
ALTER TABLE user_progress SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE quiz_sessions SET (
  autovacuum_vacuum_scale_factor = 0.1
);
```

### 7. Analytics and Reporting

#### OLAP Separation
```typescript
// Weekly export to data warehouse
export async function exportToDataWarehouse() {
  // Export denormalized data for analytics
  const analyticsData = await db.execute(sql`
    SELECT 
      u.id as user_id,
      u.created_at as user_created,
      up.level,
      up.total_questions,
      up.accuracy,
      COUNT(DISTINCT qs.id) as total_sessions,
      AVG(qs.score) as avg_score
    FROM users u
    LEFT JOIN user_progress up ON u.id = up.user_id
    LEFT JOIN quiz_sessions qs ON u.id = qs.user_id
    GROUP BY u.id, u.created_at, up.level, up.total_questions, up.accuracy
  `);
  
  // Send to BigQuery/Snowflake
  await sendToDataWarehouse(analyticsData);
}
```

## Implementation Priority

When Phase 2 begins, implement in this order:

1. **Performance** (Month 1)
   - Materialized views for common aggregations
   - Expression indexes for JSONB queries
   - Read replica setup

2. **Analytics** (Month 2)
   - Study sessions tracking
   - Question difficulty calculation
   - OLAP export pipeline

3. **Security & Compliance** (Month 3)
   - Row Level Security
   - Audit log partitioning
   - Backup automation

4. **Advanced Features** (Month 4+)
   - Real-time analytics
   - Machine learning integration
   - Multi-region support

## Migration Considerations

- All Phase 2 features can be added without breaking Phase 1 schema
- Use feature flags to gradually roll out new capabilities
- Test performance impact before enabling for all users