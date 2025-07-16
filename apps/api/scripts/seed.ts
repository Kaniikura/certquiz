#!/usr/bin/env bun
/**
 * Thin CLI wrapper for the seed system
 * Delegates to the actual implementation in src/system/seed/
 */
import { cli } from '@api/system/seed/cli';

cli(process.argv.slice(2)).catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
