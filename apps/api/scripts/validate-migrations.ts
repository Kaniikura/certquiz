#!/usr/bin/env bun
/**
 * Thin CLI wrapper for migration validation
 * Delegates to the actual implementation in src/system/migration/
 */
import { formatValidationResult, validateMigrations } from '@api/system/migration/validate';

async function main() {
  console.log('🔍 Validating migration files...\n');

  const result = await validateMigrations();

  if (!result.success) {
    console.error(`❌ Validation failed: ${result.error}`);
    process.exit(1);
  }

  const output = formatValidationResult(result.data);
  console.log(output);

  // Exit with error if there are any errors (not warnings)
  if (result.data.errors.length > 0) {
    process.exit(1);
  }

  console.log('\n✅ Validation completed');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
