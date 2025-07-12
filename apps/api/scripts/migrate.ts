#!/usr/bin/env bun
/**
 * Thin CLI wrapper for the migration system
 * Delegates to the actual implementation in src/system/migration/
 */
import { cli } from '@api/system/migration/migrate';

cli(process.argv.slice(2)).catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
