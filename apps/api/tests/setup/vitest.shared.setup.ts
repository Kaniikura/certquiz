/**
 * Shared Vitest setup file
 *
 * This file contains setup logic that is common to both unit and integration tests.
 * Currently minimal, but provides a place for shared configurations as the project grows.
 */

// Ensure NODE_ENV is set to 'test' for all tests
process.env.NODE_ENV = 'test';

// Currently no other shared setup is needed, but this file provides a foundation
// for future shared configuration like:
// - Global polyfills
// - Shared test utilities
// - Common mocks that apply to all test types
