-- Create KeyCloak database
CREATE DATABASE keycloak;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial schema will be handled by Drizzle migrations