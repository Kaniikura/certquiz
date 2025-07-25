import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Result } from '@api/shared/result';

// Types
export interface MigrationFile {
  filename: string;
  path: string;
  type: 'up' | 'down' | 'irreversible';
  baseName: string;
  sequenceNumber: number;
}

type FileError =
  | { type: 'FileSystemError'; path: string; reason: unknown }
  | { type: 'PathTraversalError'; path: string }
  | { type: 'InvalidFilename'; filename: string }
  | { type: 'InvalidSequence'; filename: string; sequence: string };

// Value object helpers (inline to keep it simple)
type MigrationType = 'up' | 'down' | 'irreversible';

type ValidatedMigration = {
  baseName: string; // e.g. 0001_create_users
  type: MigrationType; // up | down | irreversible
  sequenceNumber: number; // 1 … 9999
};

const typeMap: Record<string, MigrationType> = {
  down: 'down',
  irrev: 'irreversible',
  '': 'up', // "no suffix" → up migration
};

// Compile the regex once – faster & avoids recompilation on every call.
const MIGRATION_RE = /^(?<seq>\d{4})_(?<name>[a-z0-9_-]+)(?:\.(?<suffix>down|irrev))?\.sql$/i;

function validateMigrationFilename(filename: string): Result<ValidatedMigration, FileError> {
  const match = filename.match(MIGRATION_RE)?.groups;
  if (!match) {
    return Result.err({ type: 'InvalidFilename', filename });
  }

  const { seq, name, suffix = '' } = match;
  const sequenceNumber = Number(seq);

  // Extra defensive check - sequence numbers should be valid 4-digit numbers (0000-9999)
  if (Number.isNaN(sequenceNumber) || sequenceNumber < 0 || sequenceNumber > 9999) {
    return Result.err({ type: 'InvalidSequence', filename, sequence: seq });
  }

  // Normalize suffix to lowercase for case-insensitive matching
  const normalizedSuffix = suffix.toLowerCase();

  return Result.ok({
    baseName: `${seq}_${name}`, // keeps original 0-padding
    type: typeMap[normalizedSuffix], // '', 'down', or 'irrev' (case-insensitive)
    sequenceNumber,
  });
}

function validatePath(inputPath: string, allowedRoot: string): Result<string, FileError> {
  const resolved = path.resolve(inputPath);
  const normalizedRoot = path.resolve(allowedRoot);

  if (!resolved.startsWith(normalizedRoot)) {
    return Result.err({ type: 'PathTraversalError', path: resolved });
  }

  return Result.ok(resolved);
}

// Repository functions
export async function listMigrationFiles(
  migrationsPath: string
): Promise<Result<MigrationFile[], FileError>> {
  try {
    const entries = await readdir(migrationsPath, { withFileTypes: true });
    const migrations: MigrationFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.sql')) {
        continue;
      }

      const filenameResult = validateMigrationFilename(entry.name);
      if (!filenameResult.success) {
        continue; // Skip invalid files
      }

      const fullPath = path.join(migrationsPath, entry.name);
      const pathResult = validatePath(fullPath, migrationsPath);
      if (!pathResult.success) {
        return pathResult;
      }

      migrations.push({
        filename: entry.name,
        path: pathResult.data,
        type: filenameResult.data.type,
        baseName: filenameResult.data.baseName,
        sequenceNumber: filenameResult.data.sequenceNumber,
      });
    }

    // Sort by sequence number
    migrations.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return Result.ok(migrations);
  } catch (error) {
    return Result.err({ type: 'FileSystemError', path: migrationsPath, reason: error });
  }
}

export async function readFileContent(filepath: string): Promise<Result<string, FileError>> {
  try {
    const content = await readFile(filepath, 'utf-8');
    return Result.ok(content);
  } catch (error) {
    return Result.err({ type: 'FileSystemError', path: filepath, reason: error });
  }
}

export async function calculateFileHash(filepath: string): Promise<Result<string, FileError>> {
  const contentResult = await readFileContent(filepath);
  if (!contentResult.success) {
    return contentResult;
  }

  const hash = createHash('sha256').update(contentResult.data).digest('hex');
  return Result.ok(hash);
}

export async function fileExists(filepath: string): Promise<Result<boolean, FileError>> {
  try {
    await access(filepath);
    return Result.ok(true);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return Result.ok(false);
    }
    return Result.err({ type: 'FileSystemError', path: filepath, reason: error });
  }
}

export async function findMigrationByHash(
  migrationsPath: string,
  targetHash: string
): Promise<Result<MigrationFile | null, FileError>> {
  const filesResult = await listMigrationFiles(migrationsPath);
  if (!filesResult.success) {
    return filesResult;
  }

  const upMigrations = filesResult.data.filter((f) => f.type === 'up');

  for (const file of upMigrations) {
    const hashResult = await calculateFileHash(file.path);
    if (!hashResult.success) {
      continue;
    }

    if (hashResult.data === targetHash) {
      return Result.ok(file);
    }
  }

  return Result.ok(null);
}

export async function hasDownMigration(
  migrationsPath: string,
  baseName: string
): Promise<Result<boolean, FileError>> {
  const downPath = path.join(migrationsPath, `${baseName}.down.sql`);
  return fileExists(downPath);
}

// Export internals for testing
export const __internal__ = {
  validateMigrationFilename,
  validatePath,
};
