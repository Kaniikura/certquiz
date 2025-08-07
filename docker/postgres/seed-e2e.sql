-- E2E Test Seed Data Script
-- Adds minimal test data for E2E testing

-- Connect to certquiz_e2e database
\c certquiz_e2e;

-- This script will be populated with test data after migrations run
-- For now, it's a placeholder that ensures the database is ready

-- Create a test marker table to verify seeding
CREATE TABLE IF NOT EXISTS e2e_test_marker (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_run_id VARCHAR(255)
);

-- Insert a marker record
INSERT INTO e2e_test_marker (test_run_id) VALUES ('e2e-seed-complete');