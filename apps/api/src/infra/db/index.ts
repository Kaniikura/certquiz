/**
 * Database infrastructure barrel export (Day 1 - Minimal Infrastructure)
 *
 * This module provides the minimal database functionality needed for
 * Day 1 infrastructure setup. Schema and domain models will be added
 * incrementally as we implement vertical slices.
 *
 * Note: Application code should import withTransaction from '@/infra/unit-of-work'
 * rather than directly from this module.
 */

// Export SQL tag for raw queries if needed
export { sql } from 'drizzle-orm';
// Export database utilities
export { ping } from './client';

// Internal exports for the unit-of-work facade
// WARNING: withTransaction should NOT be used directly in route handlers!
// Route handlers should use IUnitOfWork from middleware context instead.
// Direct usage of withTransaction in routes is deprecated and will cause issues.
export { type TransactionContext, withTransaction } from './uow';
