import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from '@api/shared/result';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { analyzeMigrations, type MigrationContext } from './runtime';
import {
  findOrphanedDownMigrations,
  findSequenceGaps,
  validateFileName,
  validateSequenceNumbers,
} from './validate-helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Types
export interface ValidationError {
  file: string;
  reason: string;
}

export interface ValidationWarning {
  file: string;
  reason: string;
}

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export async function validateMigrations(
  migrationsPath?: string
): Promise<Result<ValidationResult, string>> {
  const dir = migrationsPath || path.join(__dirname, '../../infra/db/migrations');

  // Use a dummy database connection for the analyzer
  // (we only need file analysis, not DB queries)
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy';
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    const ctx: MigrationContext = { db, migrationsPath: dir };
    const analysisResult = await analyzeMigrations(ctx);

    if (!analysisResult.success) {
      return Result.err(analysisResult.error);
    }

    const analysis = analysisResult.data;
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check 1: Missing down migrations (from analysis)
    for (const missingDown of analysis.missingDownFiles) {
      const upFile = missingDown.replace('.down.sql', '.sql');
      errors.push({
        file: upFile,
        reason: `Missing down migration: ${missingDown}`,
      });
    }

    // Check 2: Validate file naming convention
    for (const file of analysis.files) {
      const nameResult = validateFileName(file.filename);
      if (!nameResult.success) {
        errors.push({
          file: file.filename,
          reason: nameResult.error,
        });
      }
    }

    // Check 3: Validate sequence numbers
    errors.push(...validateSequenceNumbers(analysis.upFiles));

    // Check 4: Find sequence gaps (warnings)
    warnings.push(...findSequenceGaps(analysis.upFiles));

    // Check 5: Find orphaned down migrations
    warnings.push(...findOrphanedDownMigrations(analysis.files, analysis.upFiles));

    return Result.ok({ errors, warnings });
  } finally {
    await client.end();
  }
}

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('✅ Validation passed: All migration files are valid');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push(`❌ Validation failed: Found ${result.errors.length} error(s):\n`);
    for (const error of result.errors) {
      lines.push(`   - ${error.file}: ${error.reason}`);
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`⚠️  Found ${result.warnings.length} warning(s):\n`);
    for (const warning of result.warnings) {
      lines.push(`   - ${warning.file}: ${warning.reason}`);
    }
  }

  return lines.join('\n');
}
