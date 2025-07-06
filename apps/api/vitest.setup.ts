// Global test setup for API tests
// This file runs before all tests to ensure consistent test environment

// Mock environment variables if needed
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent'; // Disable logs during tests

// Add any global test utilities or mocks here
