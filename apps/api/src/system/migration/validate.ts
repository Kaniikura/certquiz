import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from '@api/shared/result';
import * as fileRepo from './file-repository';

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

// Validation functions
function validateFileName(filename: string): Result<void, string> {
  // Allow up migrations (XXXX_name.sql), down migrations (XXXX_name.down.sql), and irreversible migrations (XXXX_name.irrev.sql)
  const pattern = /^(\d{4})_[a-z0-9_-]+(\.(?:down|irrev))?\.sql$/;
  if (!pattern.test(filename)) {
    return Result.err(
      'Invalid filename format. Expected: XXXX_name.sql, XXXX_name.down.sql, or XXXX_name.irrev.sql'
    );
  }
  return Result.ok(undefined);
}

function extractSequenceNumber(filename: string): number {
  const match = filename.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : -1;
}

export async function validateMigrations(
  migrationsPath?: string
): Promise<Result<ValidationResult, string>> {
  const dir = migrationsPath || path.join(__dirname, '../../../db/migrations');

  // Get all migration files
  const filesResult = await fileRepo.listMigrationFiles(dir);
  if (!filesResult.success) {
    return Result.err(`Failed to list migration files: ${filesResult.error.type}`);
  }

  const files = filesResult.data;
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Separate up and down migrations
  const upMigrations = files.filter((f) => f.type === 'up');
  const downMigrations = new Set(files.filter((f) => f.type === 'down').map((f) => f.baseName));

  // Check 1: Every up migration should have a down migration (unless .irrev)
  for (const upMigration of upMigrations) {
    if (!upMigration.filename.includes('.irrev') && !downMigrations.has(upMigration.baseName)) {
      errors.push({
        file: upMigration.filename,
        reason: `Missing down migration: ${upMigration.baseName}.down.sql`,
      });
    }
  }

  // Check 2: Validate file naming convention
  for (const file of files) {
    const nameResult = validateFileName(file.filename);
    if (!nameResult.success) {
      errors.push({
        file: file.filename,
        reason: nameResult.error,
      });
    }
  }

  // Check 3: Validate sequence numbers are unique and sequential
  const sequenceNumbers = upMigrations
    .map((f) => ({ file: f.filename, seq: extractSequenceNumber(f.filename) }))
    .filter((item) => item.seq !== -1)
    .sort((a, b) => a.seq - b.seq);

  // Check for duplicates
  const seenNumbers = new Set<number>();
  for (const { file, seq } of sequenceNumbers) {
    if (seenNumbers.has(seq)) {
      errors.push({
        file,
        reason: `Duplicate sequence number: ${seq}`,
      });
    }
    seenNumbers.add(seq);
  }

  // Check for gaps (as warnings)
  for (let i = 1; i < sequenceNumbers.length; i++) {
    const prev = sequenceNumbers[i - 1];
    const curr = sequenceNumbers[i];
    if (curr.seq !== prev.seq + 1) {
      warnings.push({
        file: curr.file,
        reason: `Gap in sequence: ${prev.seq} → ${curr.seq}`,
      });
    }
  }

  // Check 4: Check for orphaned down migrations
  const upMigrationBaseNames = new Set(upMigrations.map((f) => f.baseName));
  for (const file of files.filter((f) => f.type === 'down')) {
    if (!upMigrationBaseNames.has(file.baseName)) {
      warnings.push({
        file: file.filename,
        reason: 'Orphaned down migration (no corresponding up migration)',
      });
    }
  }

  return Result.ok({ errors, warnings });
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
