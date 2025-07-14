/**
 * Shared migration runtime - Single source of truth for migration analysis
 */
import { Result } from '@api/shared/result';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as dbRepo from './db-repository';
import * as fileRepo from './file-repository';

export interface MigrationContext {
  db: PostgresJsDatabase;
  migrationsPath: string;
}

export interface MigrationAnalysis {
  files: fileRepo.MigrationFile[]; // All files (up & down)
  upFiles: fileRepo.MigrationFile[]; // Only up migrations
  hashByFile: Map<string, string>; // hash → filename mapping
  fileByHash: Map<string, string>; // filename → hash mapping (inverse)
  appliedRecords: dbRepo.MigrationRecord[]; // Full records from DB
  appliedHashes: Set<string>; // Just the hashes for quick lookup
  pendingFiles: string[]; // Filenames of pending migrations
  missingDownFiles: string[]; // Filenames missing .down.sql
}

/**
 * Analyze the current state of migrations.
 * This is the heavy-lifting function that all other functions should use.
 * Performs all I/O operations once and returns a rich analysis object.
 */
export async function analyzeMigrations(
  ctx: MigrationContext
): Promise<Result<MigrationAnalysis, string>> {
  // Step 1: List all migration files
  const filesResult = await fileRepo.listMigrationFiles(ctx.migrationsPath);
  if (!filesResult.success) {
    return Result.err(`Failed to list migration files: ${filesResult.error.type}`);
  }
  const files = filesResult.data;

  // Step 2: Filter and process up migrations (including irreversible)
  const upFiles = files.filter((f) => f.type === 'up' || f.type === 'irreversible');
  const hashByFile = new Map<string, string>();
  const fileByHash = new Map<string, string>();

  // Calculate hashes for all up migrations
  for (const file of upFiles) {
    const hashResult = await fileRepo.calculateFileHash(file.path);
    if (!hashResult.success) {
      return Result.err(`Failed to hash ${file.filename}: ${hashResult.error.type}`);
    }
    hashByFile.set(hashResult.data, file.filename);
    fileByHash.set(file.filename, hashResult.data);
  }

  // Step 3: Get applied migrations from database
  const appliedResult = await dbRepo.getAllAppliedMigrations(ctx.db);
  const appliedRecords = appliedResult.success ? appliedResult.data : [];
  const appliedHashes = new Set(appliedRecords.map((r) => r.hash));

  // Step 4: Compute derived facts
  const pendingFiles: string[] = [];
  for (const [hash, filename] of hashByFile.entries()) {
    if (!appliedHashes.has(hash)) {
      pendingFiles.push(filename);
    }
  }

  // Step 5: Check for missing down migrations (optimized)
  const downBaseNames = new Set(files.filter((f) => f.type === 'down').map((f) => f.baseName));
  const missingDownFiles: string[] = [];
  for (const file of upFiles) {
    // Skip irreversible migrations
    if (file.type !== 'irreversible') {
      if (!downBaseNames.has(file.baseName)) {
        missingDownFiles.push(`${file.baseName}.down.sql`);
      }
    }
  }

  return Result.ok({
    files,
    upFiles,
    hashByFile,
    fileByHash,
    appliedRecords,
    appliedHashes,
    pendingFiles,
    missingDownFiles,
  });
}

/**
 * Format a list of items for console output
 */
export function formatList(items: string[], indent = '   '): string {
  if (items.length === 0) {
    return `${indent}(none)`;
  }
  return items.map((item) => `${indent}- ${item}`).join('\n');
}
