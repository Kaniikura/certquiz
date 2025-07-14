/**
 * Helper functions for migration validation
 */
import { Result } from '@api/shared/result';
import type { MigrationFile } from './file-repository';
import type { ValidationError, ValidationWarning } from './validate';

/**
 * Validate that a filename follows the migration naming convention
 */
export function validateFileName(filename: string): Result<void, string> {
  // Allow up migrations (XXXX_name.sql), down migrations (XXXX_name.down.sql),
  // and irreversible migrations (XXXX_name.irrev.sql)
  const pattern = /^(\d{4})_[a-z0-9_-]+(\.(down|irrev))?.sql$/;
  if (!pattern.test(filename)) {
    return Result.err(
      'Invalid filename format. Expected: XXXX_name.sql, XXXX_name.down.sql, or XXXX_name.irrev.sql'
    );
  }
  return Result.ok(undefined);
}

/**
 * Extract sequence number from migration filename
 */
export function extractSequenceNumber(filename: string): number {
  const match = filename.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : -1;
}

/**
 * Validate sequence numbers are unique and sequential
 */
export function validateSequenceNumbers(upFiles: MigrationFile[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const sequenceNumbers = upFiles
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

  return errors;
}

/**
 * Find gaps in sequence numbers (returns warnings)
 */
export function findSequenceGaps(upFiles: MigrationFile[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const sequenceNumbers = upFiles
    .map((f) => ({ file: f.filename, seq: extractSequenceNumber(f.filename) }))
    .filter((item) => item.seq !== -1)
    .sort((a, b) => a.seq - b.seq);

  // Check for gaps
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

  return warnings;
}

/**
 * Find orphaned down migrations (down files without corresponding up files)
 */
export function findOrphanedDownMigrations(
  allFiles: MigrationFile[],
  upFiles: MigrationFile[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const upMigrationBaseNames = new Set(upFiles.map((f) => f.baseName));
  const downFiles = allFiles.filter((f) => f.type === 'down');

  for (const file of downFiles) {
    if (!upMigrationBaseNames.has(file.baseName)) {
      warnings.push({
        file: file.filename,
        reason: 'Orphaned down migration (no corresponding up migration)',
      });
    }
  }

  return warnings;
}
