CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Test migration for rollback convention
CREATE TABLE IF NOT EXISTS test_migration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);