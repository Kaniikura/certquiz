-- E2E Test Database Initialization Script
-- Creates necessary databases and extensions for E2E testing

-- Create Keycloak database
CREATE DATABASE keycloak_e2e;

-- Connect to certquiz_e2e database (created by POSTGRES_DB env var)
\c certquiz_e2e;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant all privileges to e2e_user
GRANT ALL PRIVILEGES ON DATABASE certquiz_e2e TO e2e_user;
GRANT ALL PRIVILEGES ON DATABASE keycloak_e2e TO e2e_user;

-- Set search path
ALTER DATABASE certquiz_e2e SET search_path TO public;

-- Create schema if needed
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO e2e_user;