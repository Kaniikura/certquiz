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

export type { TransactionContext } from './uow';
